import crypto from "node:crypto"
import { createEgressConfig } from "./egress-config.mjs"
import { createEgressServers } from "./egress-proxy.mjs"
import { AtomicJsonState } from "./state.mjs"
import { TokenRegistry, validateTokenState } from "./token-registry.mjs"

const config = createEgressConfig()
const state = await new AtomicJsonState(config.stateFile, {
  initialState: { version: 1, tokens: {}, ledgers: {} },
  validate: validateTokenState,
}).init()
const registry = new TokenRegistry(state, {
  allowedModels: config.allowedModels,
  maxRequestsPerToken: config.maxRequestsPerToken,
  maxRequestBytesPerToken: config.maxRequestBytesPerToken,
  maxOutputTokensPerRequest: config.maxOutputTokensPerRequest,
  maxOutputTokensPerToken: config.maxOutputTokensPerToken,
  maxTokenTtlMs: config.maxTokenTtlMs,
})
await registry.purgeExpired()

const options = {
  ...config,
  registry,
  fetchImpl: fetch,
  instanceId: crypto.randomBytes(16).toString("hex"),
}
const { dataServer, controlServer } = createEgressServers(options)

await Promise.all([
  listen(dataServer, config.dataPort, config.dataHost),
  listen(controlServer, config.controlPort, config.controlHost),
])
console.log(
  `CuadraBot OpenAI egress listening on data ${config.dataHost}:${config.dataPort} and control ${config.controlHost}:${config.controlPort}`
)

const purgeTimer = setInterval(() => {
  void registry.purgeExpired().catch((error) => {
    console.error("Egress token expiry sweep failed", error)
  })
}, 60_000)
purgeTimer.unref()

let stopping = false
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    if (stopping) return
    stopping = true
    clearInterval(purgeTimer)
    Promise.all([close(dataServer), close(controlServer)])
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error)
        process.exit(1)
      })
  })
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, host, () => {
      server.off("error", reject)
      resolve()
    })
  })
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}
