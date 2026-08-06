import { createBrokerConfig } from "./broker-config.mjs"
import { BrokerController } from "./broker-controller.mjs"
import { createBrokerServer } from "./broker-server.mjs"
import { validateBrokerState } from "./broker-state.mjs"
import { DockerLifecycle } from "./docker.mjs"
import { EgressControlClient } from "./egress-control-client.mjs"
import { AtomicJsonState } from "./state.mjs"
import { ensurePrivateDirectory } from "./util.mjs"

const config = createBrokerConfig()
await ensurePrivateDirectory(config.stateRoot)
await ensurePrivateDirectory(config.jobsRoot)
const state = await new AtomicJsonState(config.stateFile, {
  initialState: { version: 1, executions: {} },
  validate: validateBrokerState,
}).init()
const docker = new DockerLifecycle(config)
const egress = new EgressControlClient({
  baseUrl: config.egressControlUrl,
  token: config.egressControlToken,
})
const controller = new BrokerController({ config, state, docker, egress })

await controller.reconcileStartup()
await controller.assertReady()
const server = createBrokerServer({ config, controller })
await listen(server, config.port, config.host)
console.log(`CuadraBot execution broker listening on ${config.host}:${config.port}`)

const cleanupTimer = setInterval(() => {
  void Promise.all([
    controller.sweepExpired(),
    controller.sweepUnhealthy(),
  ]).catch((error) => {
    console.error("Executor TTL cleanup failed", error)
  })
}, config.cleanupIntervalMs)
cleanupTimer.unref()

let stopping = false
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    if (stopping) return
    stopping = true
    clearInterval(cleanupTimer)
    server.close((error) => {
      if (error) console.error(error)
      process.exit(error ? 1 : 0)
    })
  })
}

function listen(target, port, host) {
  return new Promise((resolve, reject) => {
    target.once("error", reject)
    target.listen(port, host, () => {
      target.off("error", reject)
      resolve()
    })
  })
}
