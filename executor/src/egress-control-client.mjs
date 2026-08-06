import { SAFE_TOKEN_ID, strictHttpUrl } from "./util.mjs"

export class EgressControlClient {
  constructor({ baseUrl, token, timeoutMs = 10_000, fetchImpl = fetch }) {
    this.baseUrl = strictHttpUrl(String(baseUrl), "egress control URL", {
      loopback: true,
    })
    this.token = token
    this.timeoutMs = timeoutMs
    this.fetchImpl = fetchImpl
  }

  async assertReady() {
    const response = await this.fetchImpl(
      new URL("/readyz", this.baseUrl),
      { signal: AbortSignal.timeout(this.timeoutMs) }
    )
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !SAFE_TOKEN_ID.test(body.instanceId ?? "")) {
      throw new Error("Egress proxy is not ready")
    }
    return body.instanceId
  }

  async register(payload) {
    const response = await this.fetchImpl(
      new URL("/control/tokens", this.baseUrl),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      }
    )
    const body = await response.json().catch(() => ({}))
    if (
      response.status !== 201 ||
      !SAFE_TOKEN_ID.test(body.tokenId ?? "") ||
      typeof body.token !== "string" ||
      !body.token.startsWith("cbe_") ||
      !SAFE_TOKEN_ID.test(body.egressInstanceId ?? "")
    ) {
      throw new Error("Egress proxy refused token registration")
    }
    return body
  }

  async revoke(tokenId) {
    if (!SAFE_TOKEN_ID.test(tokenId)) throw new Error("Invalid egress token id")
    const response = await this.fetchImpl(
      new URL(`/control/tokens/${tokenId}`, this.baseUrl),
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${this.token}` },
        signal: AbortSignal.timeout(this.timeoutMs),
      }
    )
    if (response.status !== 204 && response.status !== 404) {
      throw new Error("Egress proxy refused token revocation")
    }
  }
}
