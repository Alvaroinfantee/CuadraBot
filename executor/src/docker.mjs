import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import { assertSafeId, ensurePrivateDirectory, safeChild } from "./util.mjs"

const MANAGED_LABEL = "com.cuadrabot.executor.managed=true"

export class CommandError extends Error {
  constructor(message, { exitCode, stderr }) {
    super(message)
    this.name = "CommandError"
    this.exitCode = exitCode
    this.stderr = stderr
  }
}

export class CommandRunner {
  constructor(binary = "docker") {
    if (!binary || /[\r\n\0]/.test(binary)) throw new Error("Invalid Docker binary")
    this.binary = binary
  }

  run(args, { timeoutMs = 60_000, maxOutputBytes = 1024 * 1024 } = {}) {
    if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
      throw new Error("Docker arguments must be strings")
    }
    return new Promise((resolve, reject) => {
      const child = spawn(this.binary, args, {
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      })
      const stdout = []
      const stderr = []
      let stdoutBytes = 0
      let stderrBytes = 0
      let killedForOutput = false
      const collect = (chunks, chunk, which) => {
        if (which === "stdout") stdoutBytes += chunk.length
        else stderrBytes += chunk.length
        if (stdoutBytes + stderrBytes > maxOutputBytes) {
          killedForOutput = true
          child.kill("SIGKILL")
          return
        }
        chunks.push(chunk)
      }
      child.stdout.on("data", (chunk) => collect(stdout, chunk, "stdout"))
      child.stderr.on("data", (chunk) => collect(stderr, chunk, "stderr"))
      const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs)
      child.once("error", (error) => {
        clearTimeout(timer)
        reject(error)
      })
      child.once("close", (exitCode) => {
        clearTimeout(timer)
        const output = {
          stdout: Buffer.concat(stdout).toString("utf8").trim(),
          stderr: Buffer.concat(stderr).toString("utf8").trim(),
          exitCode,
        }
        if (exitCode === 0 && !killedForOutput) resolve(output)
        else {
          reject(
            new CommandError(
              killedForOutput
                ? "Docker command exceeded its output limit"
                : "Docker command failed",
              output
            )
          )
        }
      })
    })
  }
}

export class DockerLifecycle {
  constructor(config, runner = new CommandRunner(config.dockerBin)) {
    this.config = config
    this.runner = runner
  }

  async assertReady() {
    await this.runner.run(["info", "--format", "{{.ServerVersion}}"], {
      timeoutMs: 15_000,
    })
    const result = await this.runner.run([
      "inspect",
      "--format",
      "{{.State.Running}}",
      this.config.egressContainer,
    ])
    if (result.stdout !== "true") throw new Error("Egress container is not running")
  }

  async prepareJobDirectory(executionId) {
    const jobsRoot = await ensurePrivateDirectory(this.config.jobsRoot)
    const destination = safeChild(jobsRoot, executionId, "execution identifier")
    await fs.mkdir(destination, { recursive: false, mode: 0o707 })
    const metadata = await fs.lstat(destination)
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error("Unsafe job bind directory")
    }
    if (process.platform !== "win32") await fs.chmod(destination, 0o707)
    return destination
  }

  async start(record, { jobDirectory, processorToken }) {
    validateRuntimeRecord(record)
    validateMount(jobDirectory, this.config.jobsRoot)
    await this.runner.run([
      "network",
      "create",
      "--internal",
      "--label",
      MANAGED_LABEL,
      "--label",
      `com.cuadrabot.executor.execution=${record.executionId}`,
      "--label",
      "com.cuadrabot.executor.role=job-network",
      record.networkName,
    ])
    try {
      await this.runner.run([
        "network",
        "connect",
        "--alias",
        "openai-egress",
        record.networkName,
        this.config.egressContainer,
      ])
      const args = processorRunArgs(this.config, record, {
        jobDirectory,
        processorToken,
      })
      await this.runner.run(args, { timeoutMs: 120_000 })
      return await this.processorEndpoint(record)
    } catch (error) {
      await this.remove(record).catch(() => undefined)
      throw error
    }
  }

  async processorEndpoint(record) {
    validateRuntimeRecord(record)
    const format = "{{json (index .NetworkSettings.Ports \"8000/tcp\")}}"
    const result = await this.runner.run([
      "inspect",
      "--format",
      format,
      record.containerName,
    ])
    const { host, port } = parsePortBinding(result.stdout)
    return { host, port, origin: `http://${host === "::1" ? "[::1]" : host}:${port}` }
  }

  async attest(record) {
    validateRuntimeRecord(record)
    const [containerResult, networkResult] = await Promise.all([
      this.runner.run([
        "inspect",
        "--format",
        "{{json .}}",
        record.containerName,
      ]),
      this.runner.run([
        "network",
        "inspect",
        "--format",
        "{{json .}}",
        record.networkName,
      ]),
    ])
    let container
    let network
    try {
      container = JSON.parse(containerResult.stdout)
      network = JSON.parse(networkResult.stdout)
    } catch {
      return false
    }
    return attestRuntime({
      container,
      network,
      record,
      egressContainer: this.config.egressContainer,
    })
  }

  async remove(record) {
    validateRuntimeRecord(record)
    const failures = []
    for (const operation of [
      () =>
        this.runner.run(["rm", "--force", record.containerName], {
          timeoutMs: 60_000,
        }),
      () =>
        this.runner.run([
          "network",
          "disconnect",
          "--force",
          record.networkName,
          this.config.egressContainer,
        ]),
      () => this.runner.run(["network", "rm", record.networkName]),
    ]) {
      try {
        await ignoreMissing(operation)
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length) {
      throw new AggregateError(failures, "Docker cleanup was incomplete")
    }
  }

  async removeJobDirectory(executionId) {
    const rootMetadata = await fs.lstat(this.config.jobsRoot)
    if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
      throw new Error("Refusing to use an unsafe jobs root")
    }
    const destination = safeChild(
      this.config.jobsRoot,
      executionId,
      "execution identifier"
    )
    const root = path.resolve(this.config.jobsRoot)
    if (path.dirname(destination) !== root) {
      throw new Error("Refusing to remove a path outside the jobs root")
    }
    try {
      const metadata = await fs.lstat(destination)
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new Error("Refusing to remove an unsafe job path")
      }
    } catch (error) {
      if (error?.code === "ENOENT") return
      throw error
    }
    await fs.rm(destination, { recursive: true, force: true })
  }
}

export function attestRuntime({ container, network, record, egressContainer }) {
  try {
    validateRuntimeRecord(record)
    const labels = container?.Config?.Labels ?? {}
    const networks = container?.NetworkSettings?.Networks ?? {}
    const networkLabels = network?.Labels ?? {}
    const members = Object.values(network?.Containers ?? {}).map(
      (member) => member?.Name
    )
    const binding = JSON.stringify(
      container?.NetworkSettings?.Ports?.["8000/tcp"] ?? null
    )
    parsePortBinding(binding)
    return (
      container?.State?.Running === true &&
      labels["com.cuadrabot.executor.managed"] === "true" &&
      labels["com.cuadrabot.executor.role"] === "processor" &&
      labels["com.cuadrabot.executor.execution"] === record.executionId &&
      container?.HostConfig?.ReadonlyRootfs === true &&
      container?.HostConfig?.NetworkMode === record.networkName &&
      Object.keys(networks).length === 1 &&
      Object.hasOwn(networks, record.networkName) &&
      network?.Name === record.networkName &&
      network?.Internal === true &&
      networkLabels["com.cuadrabot.executor.managed"] === "true" &&
      networkLabels["com.cuadrabot.executor.role"] === "job-network" &&
      networkLabels["com.cuadrabot.executor.execution"] ===
        record.executionId &&
      members.length === 2 &&
      members.includes(record.containerName) &&
      members.includes(egressContainer)
    )
  } catch {
    return false
  }
}

function parsePortBinding(serialized) {
  let bindings
  try {
    bindings = JSON.parse(serialized)
  } catch {
    throw new Error("Processor port binding was invalid")
  }
  if (!Array.isArray(bindings) || bindings.length !== 1) {
    throw new Error("Processor must expose exactly one loopback binding")
  }
  const binding = bindings[0]
  const host = binding?.HostIp
  const port = Number(binding?.HostPort)
  if (
    !["127.0.0.1", "::1"].includes(host) ||
    !Number.isSafeInteger(port) ||
    port < 1 ||
    port > 65_535
  ) {
    throw new Error("Processor API was not bound safely to loopback")
  }
  return { host, port }
}

export function processorRunArgs(config, record, { jobDirectory, processorToken }) {
  validateRuntimeRecord(record)
  validateMount(jobDirectory, config.jobsRoot)
  if (!processorToken || /[\r\n\0]/.test(processorToken)) {
    throw new Error("Invalid processor token")
  }
  return [
    "run",
    "--detach",
    "--name",
    record.containerName,
    "--label",
    MANAGED_LABEL,
    "--label",
    `com.cuadrabot.executor.execution=${record.executionId}`,
    "--label",
    "com.cuadrabot.executor.role=processor",
    "--label",
    `com.cuadrabot.executor.expires_at=${record.expiresAt}`,
    "--network",
    record.networkName,
    "--publish",
    "127.0.0.1::8000",
    "--user",
    `${config.processorUid}:${config.processorGid}`,
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges:true",
    "--pids-limit",
    String(config.processorPids),
    "--cpus",
    String(config.processorCpus),
    "--memory",
    config.processorMemory,
    "--memory-swap",
    config.processorMemorySwap,
    "--ulimit",
    "nofile=4096:4096",
    "--stop-timeout",
    "30",
    "--restart",
    "no",
    "--tmpfs",
    `/tmp:rw,noexec,nosuid,nodev,size=${config.processorTmpfs},uid=${config.processorUid},gid=${config.processorGid},mode=700`,
    "--mount",
    `type=bind,src=${path.resolve(jobDirectory)},dst=/data,rw`,
    "--env",
    "TAKEOFF_ENV=production",
    "--env",
    "TAKEOFF_DATA_DIR=/data",
    "--env",
    "TAKEOFF_MAX_WORKERS=1",
    "--env",
    `TAKEOFF_SERVICE_API_TOKEN=${processorToken}`,
    "--env",
    `TAKEOFF_CODEX_MODEL=${config.defaultModel}`,
    "--env",
    `TAKEOFF_MAX_UPLOAD_BYTES=${config.maxUploadBytes}`,
    "--env",
    `TAKEOFF_MAX_TOTAL_UPLOAD_BYTES=${config.maxUploadBytes}`,
    config.processorImage,
  ]
}

function validateRuntimeRecord(record) {
  assertSafeId(record.executionId, "execution identifier")
  assertSafeId(record.containerName, "container name")
  assertSafeId(record.networkName, "network name")
  if (!Number.isSafeInteger(record.expiresAt) || record.expiresAt < 1) {
    throw new Error("Invalid execution expiry")
  }
}

function validateMount(jobDirectory, jobsRoot) {
  const root = path.resolve(jobsRoot)
  const destination = path.resolve(jobDirectory)
  if (
    path.dirname(destination) !== root ||
    /[,\r\n\0]/.test(destination)
  ) {
    throw new Error("Unsafe job bind path")
  }
}

async function ignoreMissing(operation) {
  try {
    await operation()
  } catch (error) {
    const detail = `${error?.message ?? ""} ${error?.stderr ?? ""}`.toLowerCase()
    if (
      detail.includes("no such container") ||
      detail.includes("no such network") ||
      detail.includes("not connected") ||
      detail.includes("not found")
    ) {
      return
    }
    throw error
  }
}
