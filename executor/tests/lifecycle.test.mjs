import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { BrokerController } from "../src/broker-controller.mjs"
import { validateBrokerState } from "../src/broker-state.mjs"
import {
  CommandError,
  DockerLifecycle,
  attestRuntime,
  processorRunArgs,
} from "../src/docker.mjs"
import { AtomicJsonState } from "../src/state.mjs"
import { safetyIdentifier, safeChild } from "../src/util.mjs"

const IMAGE = `registry.invalid/takeoff@sha256:${"a".repeat(64)}`
const EGRESS_TOKEN = "cbe_ephemeral-token-must-never-enter-docker-state"
const EGRESS_INSTANCE_ID = "9".repeat(32)

test("processor lifecycle command has every isolation flag and no egress credential", () => {
  const root = path.resolve("C:/executor-test/jobs")
  const record = runtimeRecord("a".repeat(32))
  const config = dockerConfig(root)
  const args = processorRunArgs(config, record, {
    jobDirectory: path.join(root, record.executionId),
    processorToken: "processor-only-token",
  })
  const joined = args.join(" ")
  for (const expected of [
    "--read-only",
    "--cap-drop ALL",
    "--security-opt no-new-privileges:true",
    "--pids-limit 256",
    "--cpus 2",
    "--memory 6g",
    "--memory-swap 6g",
    "--user 10001:10001",
    "--publish 127.0.0.1::8000",
    "--restart no",
    "noexec,nosuid,nodev",
    "com.cuadrabot.executor.role=processor",
    "TAKEOFF_SERVICE_API_TOKEN=processor-only-token",
  ]) {
    assert.match(joined, new RegExp(escapeRegExp(expected)))
  }
  assert.equal(args.at(-1), IMAGE)
  assert.doesNotMatch(joined, /OPENAI_API_KEY|cbe_|sk-/)
  assert.equal(args.filter((value) => value === "--mount").length, 1)
  const mountIndex = args.indexOf("--mount")
  assert.equal(
    args[mountIndex + 1],
    `type=bind,src=${path.join(root, record.executionId)},dst=/data`
  )
  assert.equal(args.filter((value) => value === "--network").length, 1)
})

test("broker startup reconciles stale state before strict runtime readiness", async () => {
  const source = await fs.readFile(
    new URL("../src/broker-main.mjs", import.meta.url),
    "utf8"
  )
  const reconcile = source.indexOf("await controller.reconcileStartup()")
  const ready = source.indexOf("await controller.assertReady()")
  assert.ok(reconcile >= 0 && ready > reconcile)
})

test("bind paths and identifiers reject traversal", () => {
  const root = path.resolve("C:/executor-test/jobs")
  const record = runtimeRecord("b".repeat(32))
  assert.throws(
    () =>
      processorRunArgs(dockerConfig(root), record, {
        jobDirectory: path.resolve(root, "..", "escape"),
        processorToken: "processor-token",
      }),
    /unsafe job bind path/i
  )
  assert.throws(() => safeChild(root, "../escape"), /invalid/i)
  assert.throws(
    () =>
      processorRunArgs(dockerConfig(root), { ...record, executionId: "../x" }, {
        jobDirectory: path.join(root, record.executionId),
        processorToken: "processor-token",
      }),
    /invalid execution/i
  )
})

test("Docker endpoint accepts one dynamic loopback binding and rejects exposure", async () => {
  const record = runtimeRecord("c".repeat(32))
  const valid = new DockerLifecycle(
    dockerConfig("C:/executor-test/jobs"),
    runnerReturning(
      JSON.stringify([{ HostIp: "127.0.0.1", HostPort: "49152" }])
    )
  )
  assert.deepEqual(await valid.processorEndpoint(record), {
    host: "127.0.0.1",
    port: 49_152,
    origin: "http://127.0.0.1:49152",
  })

  for (const binding of [
    [{ HostIp: "0.0.0.0", HostPort: "49152" }],
    [
      { HostIp: "127.0.0.1", HostPort: "49152" },
      { HostIp: "::", HostPort: "49152" },
    ],
    [{ HostIp: "127.0.0.1", HostPort: "0" }],
  ]) {
    const lifecycle = new DockerLifecycle(
      dockerConfig("C:/executor-test/jobs"),
      runnerReturning(JSON.stringify(binding))
    )
    await assert.rejects(lifecycle.processorEndpoint(record), /loopback|exactly one/i)
  }
})

test("Docker removal treats already-removed objects as idempotent", async () => {
  const calls = []
  const runner = {
    async run(args) {
      calls.push(args)
      throw new CommandError("Docker command failed", {
        exitCode: 1,
        stderr: "Error: No such container or network",
      })
    },
  }
  const lifecycle = new DockerLifecycle(dockerConfig("C:/executor-test/jobs"), runner)
  await lifecycle.remove(runtimeRecord("d".repeat(32)))
  assert.equal(calls.length, 3)
})

test("runtime attestation requires live processor, one internal network, loopback, and egress", () => {
  const record = runtimeRecord("8".repeat(32))
  const valid = inspectionFixture(record)
  assert.equal(attestRuntime(valid), true)

  const stopped = structuredClone(valid)
  stopped.container.State.Running = false
  assert.equal(attestRuntime(stopped), false)

  const publicNetwork = structuredClone(valid)
  publicNetwork.network.Internal = false
  assert.equal(attestRuntime(publicNetwork), false)

  const publicPort = structuredClone(valid)
  publicPort.container.NetworkSettings.Ports["8000/tcp"][0].HostIp = "0.0.0.0"
  assert.equal(attestRuntime(publicPort), false)

  const missingEgress = structuredClone(valid)
  delete missingEgress.network.Containers.egress
  assert.equal(attestRuntime(missingEgress), false)

  const sibling = structuredClone(valid)
  sibling.network.Containers.sibling = { Name: "unrelated-container" }
  assert.equal(attestRuntime(sibling), false)
})

test("controller keeps stable per-user safety IDs and never persists the egress token", async (t) => {
  const fixture = await controllerFixture(t)
  const userA = "11111111-1111-4111-8111-111111111111"
  const userB = "22222222-2222-4222-8222-222222222222"

  const first = await fixture.controller.startExecution({
    sourceJobId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    userId: userA,
    budgetClass: "essential",
  })
  assert.equal(
    JSON.stringify(fixture.state.snapshot()).includes(EGRESS_TOKEN),
    false
  )
  await fixture.controller.bindProcessorJob(first.record.executionId, "f".repeat(32))
  assert.equal(
    fixture.controller.recoverProcessorJob({
      sourceJobId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      userId: userA,
      budgetClass: "essential",
    }),
    "f".repeat(32)
  )
  await fixture.controller.cleanupExecution(first.record.executionId)
  const second = await fixture.controller.startExecution({
    sourceJobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    userId: userA,
    budgetClass: "essential",
  })
  await fixture.controller.cleanupExecution(second.record.executionId)
  const third = await fixture.controller.startExecution({
    sourceJobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    userId: userB,
    budgetClass: "essential",
  })
  await fixture.controller.cleanupExecution(third.record.executionId)

  const ids = fixture.egress.registrations.map((value) => value.safetyIdentifier)
  assert.equal(ids[0], ids[1])
  assert.notEqual(ids[1], ids[2])
  assert.equal(ids[0], safetyIdentifier(fixture.config.safetySecret, userA))
  assert.match(ids[0], /^cb_[a-f0-9]{48}$/)
})

test("cleanup revokes first, destroys every resource, retries, and is idempotent", async (t) => {
  const fixture = await controllerFixture(t, { failFirstRevoke: true })
  const runtime = await fixture.controller.startExecution({
    sourceJobId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    userId: "33333333-3333-4333-8333-333333333333",
    budgetClass: "essential",
  })
  await assert.rejects(
    fixture.controller.cleanupExecution(runtime.record.executionId),
    /cleanup was incomplete/i
  )
  assert.deepEqual(fixture.docker.operations.slice(-2), [
    `remove:${runtime.record.executionId}`,
    `files:${runtime.record.executionId}`,
  ])
  assert.equal(
    fixture.state.snapshot().executions[runtime.record.executionId].status,
    "cleaning"
  )
  assert.equal(await fixture.controller.sweepUnhealthy(), 1)
  assert.equal(
    await fixture.controller.cleanupExecution(runtime.record.executionId),
    false
  )
  assert.equal(fixture.state.snapshot().executions[runtime.record.executionId], undefined)
})

test("startup reconciliation removes starting, cleaning, and unbound running records", async (t) => {
  const fixture = await controllerFixture(t)
  const records = [
    { ...runtimeRecord("1".repeat(32)), status: "starting" },
    {
      ...runtimeRecord("2".repeat(32)),
      status: "cleaning",
      processorJobId: "a".repeat(32),
    },
    { ...runtimeRecord("3".repeat(32)), status: "running" },
    {
      ...runtimeRecord("4".repeat(32)),
      status: "running",
      processorJobId: "b".repeat(32),
    },
  ]
  await fixture.state.mutate((draft) => {
    for (const record of records) draft.executions[record.executionId] = record
  })
  await fixture.controller.reconcileStartup()
  const remaining = fixture.state.snapshot().executions
  assert.deepEqual(Object.keys(remaining), ["4".repeat(32)])
  assert.deepEqual(
    fixture.egress.revoked.sort(),
    records.slice(0, 3).map((record) => record.tokenId).sort()
  )
})

test("startup removes a stopped processor or an execution from an older egress instance", async (t) => {
  const fixture = await controllerFixture(t)
  const stopped = {
    ...runtimeRecord("5".repeat(32)),
    processorJobId: "c".repeat(32),
  }
  const oldEgress = {
    ...runtimeRecord("6".repeat(32)),
    processorJobId: "d".repeat(32),
    egressInstanceId: "8".repeat(32),
  }
  await fixture.state.mutate((draft) => {
    draft.executions[stopped.executionId] = stopped
    draft.executions[oldEgress.executionId] = oldEgress
  })
  fixture.docker.unhealthy.add(stopped.executionId)
  await fixture.controller.reconcileStartup()
  assert.deepEqual(fixture.state.snapshot().executions, {})
  assert.ok(fixture.docker.attested.includes(stopped.executionId))
  assert.equal(fixture.docker.attested.includes(oldEgress.executionId), false)
})

test("startup fails closed when stale execution cleanup cannot complete", async (t) => {
  const fixture = await controllerFixture(t, { failFirstRevoke: true })
  const stale = {
    ...runtimeRecord("7".repeat(32)),
    processorJobId: "e".repeat(32),
  }
  await fixture.state.mutate((draft) => {
    draft.executions[stale.executionId] = stale
  })
  fixture.docker.unhealthy.add(stale.executionId)
  await assert.rejects(
    fixture.controller.reconcileStartup(),
    /startup reconciliation failed/i
  )
  assert.equal(
    fixture.state.snapshot().executions[stale.executionId].status,
    "cleaning"
  )
})

async function controllerFixture(t, { failFirstRevoke = false } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cuadrabot-broker-test-"))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const state = await new AtomicJsonState(path.join(directory, "broker.json"), {
    initialState: { version: 1, executions: {} },
    validate: validateBrokerState,
  }).init()
  const config = {
    ...dockerConfig(path.join(directory, "jobs")),
    safetySecret: "safety-secret-that-is-at-least-32-characters",
    processorKeySecret: "processor-secret-that-is-at-least-32-chars",
    maxConcurrentJobs: 1,
    jobTtlMs: 8 * 60 * 60 * 1_000,
    allowedModels: ["gpt-5.6-sol"],
    defaultModel: "gpt-5.6-sol",
    processorReadyTimeoutMs: 100,
  }
  let registrationCounter = 0
  let revokeFailed = false
  const egress = {
    registrations: [],
    revoked: [],
    async assertReady() { return EGRESS_INSTANCE_ID },
    async register(payload) {
      this.registrations.push(payload)
      registrationCounter += 1
      return {
        tokenId: registrationCounter.toString(16).padStart(32, "0"),
        token: EGRESS_TOKEN,
        egressInstanceId: EGRESS_INSTANCE_ID,
      }
    },
    async revoke(tokenId) {
      if (failFirstRevoke && !revokeFailed) {
        revokeFailed = true
        throw new Error("egress unavailable")
      }
      this.revoked.push(tokenId)
    },
  }
  const docker = {
    operations: [],
    attested: [],
    unhealthy: new Set(),
    async assertReady() {},
    async prepareJobDirectory(executionId) {
      this.operations.push(`prepare:${executionId}`)
      return path.join(config.jobsRoot, executionId)
    },
    async start(record, options) {
      this.operations.push(`start:${record.executionId}`)
      assert.notEqual(options.processorToken, EGRESS_TOKEN)
      return { host: "127.0.0.1", port: 12345, origin: "http://127.0.0.1:12345" }
    },
    async processorEndpoint() {
      return { host: "127.0.0.1", port: 12345, origin: "http://127.0.0.1:12345" }
    },
    async attest(record) {
      this.attested.push(record.executionId)
      return !this.unhealthy.has(record.executionId)
    },
    async remove(record) {
      this.operations.push(`remove:${record.executionId}`)
    },
    async removeJobDirectory(executionId) {
      this.operations.push(`files:${executionId}`)
    },
  }
  const controller = new BrokerController({
    config,
    state,
    docker,
    egress,
    fetchImpl: async () => new Response("ready", { status: 200 }),
  })
  return { state, config, egress, docker, controller }
}

function runtimeRecord(executionId) {
  const createdAt = Date.now()
  return {
    executionId,
    sourceJobId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    containerName: `cuadrabot-takeoff-${executionId}`,
    networkName: `cuadrabot-job-${executionId}`,
    tokenId: executionId.slice(0, 32),
    egressInstanceId: EGRESS_INSTANCE_ID,
    userFingerprint: "f".repeat(64),
    budgetClass: "essential",
    processorJobId: null,
    status: "running",
    createdAt,
    expiresAt: createdAt + 8 * 60 * 60 * 1_000,
  }
}

function dockerConfig(jobsRoot) {
  return {
    jobsRoot: path.resolve(jobsRoot),
    dockerBin: "docker",
    egressContainer: "cuadrabot-openai-egress",
    processorUid: 10_001,
    processorGid: 10_001,
    processorPids: 256,
    processorCpus: 2,
    processorMemory: "6g",
    processorMemorySwap: "6g",
    processorTmpfs: "512m",
    maxUploadBytes: 250 * 1024 * 1024,
    defaultModel: "gpt-5.6-sol",
    processorImage: IMAGE,
  }
}

function inspectionFixture(record) {
  return {
    record,
    egressContainer: "cuadrabot-openai-egress",
    container: {
      State: { Running: true },
      Config: {
        Labels: {
          "com.cuadrabot.executor.managed": "true",
          "com.cuadrabot.executor.role": "processor",
          "com.cuadrabot.executor.execution": record.executionId,
        },
      },
      HostConfig: {
        ReadonlyRootfs: true,
        NetworkMode: record.networkName,
      },
      NetworkSettings: {
        Networks: { [record.networkName]: {} },
        Ports: {
          "8000/tcp": [{ HostIp: "127.0.0.1", HostPort: "49152" }],
        },
      },
    },
    network: {
      Name: record.networkName,
      Internal: true,
      Labels: {
        "com.cuadrabot.executor.managed": "true",
        "com.cuadrabot.executor.role": "job-network",
        "com.cuadrabot.executor.execution": record.executionId,
      },
      Containers: {
        processor: { Name: record.containerName },
        egress: { Name: "cuadrabot-openai-egress" },
      },
    },
  }
}

function runnerReturning(stdout) {
  return { async run() { return { stdout, stderr: "", exitCode: 0 } } }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
