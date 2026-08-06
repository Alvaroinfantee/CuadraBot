import assert from "node:assert/strict"
import {
  mkdtemp,
  readFile,
  rm,
  stat,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { parse as parseDotenv } from "dotenv"
import {
  buildCreditIdempotencyKey,
  formatProvisioningSummary,
  generateStrongTestPassword,
  loadProvisioningConfig,
  persistTestCredentials,
  prepareGeneratedCredentials,
  provisionTestAccounts,
  redactSensitiveText,
  serializeTestCredentials,
  type AuthAccount,
  type AuthAccountInput,
  type CreditAccountState,
  type ProvisioningGateway,
  type TestAccountSpec,
} from "../scripts/provision-test-accounts"

const baseEnvironment = {
  CUADRABOT_PROVISION_TEST_ACCOUNTS: "true",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SECRET_KEY: "test-server-admin-key-1234567890",
  CUADRABOT_TEST_ADMIN_EMAIL: "admin@cuadrabot.test",
  CUADRABOT_TEST_ADMIN_PASSWORD: "Admin-Only-Password-2026!",
  CUADRABOT_TEST_USER_EMAIL: "customer@cuadrabot.test",
  CUADRABOT_TEST_USER_PASSWORD: "Customer-Only-Password-2026!",
  CUADRABOT_TEST_USER_CREDITS: "5000",
}

describe("test-account target and credential policy", () => {
  it("accepts an explicitly enabled loopback target", () => {
    const config = loadProvisioningConfig(baseEnvironment)

    assert.deepEqual(config.target, { kind: "local", projectRef: null })
    assert.equal(config.customerCreditTarget, 5_000)
    assert.equal(config.customer.countryCode, "ES")
    assert.equal(config.customer.region, "Madrid")
    assert.equal(config.customer.timezone, "Europe/Madrid")
    assert.equal(config.approver, null)
  })

  it("refuses every recognized production signal", () => {
    for (const signal of [
      "NODE_ENV",
      "VERCEL_ENV",
      "CUADRABOT_ENVIRONMENT",
    ]) {
      assert.throws(
        () =>
          loadProvisioningConfig({
            ...baseEnvironment,
            [signal]: "production",
          }),
        /forbidden/
      )
    }

    assert.throws(
      () =>
        loadProvisioningConfig({
          ...baseEnvironment,
          NEXT_PUBLIC_SITE_URL: "",
        }),
      /NEXT_PUBLIC_SITE_URL/
    )

    assert.throws(
      () =>
        loadProvisioningConfig({
          ...baseEnvironment,
          NEXT_PUBLIC_SITE_URL: "https://cuadrabot.com",
        }),
      /localhost or a loopback/
    )
  })

  it("requires explicit, exact approval for a hosted sandbox", () => {
    const remoteEnvironment = {
      ...baseEnvironment,
      NEXT_PUBLIC_SUPABASE_URL:
        "https://sandboxproject123.supabase.co",
    }

    assert.throws(
      () => loadProvisioningConfig(remoteEnvironment),
      /Remote provisioning is disabled/
    )
    assert.throws(
      () =>
        loadProvisioningConfig({
          ...remoteEnvironment,
          CUADRABOT_ALLOW_REMOTE_TEST_PROVISIONING: "true",
          CUADRABOT_TEST_PROJECT_REF: "anotherproject123",
        }),
      /does not match/
    )

    const config = loadProvisioningConfig({
      ...remoteEnvironment,
      CUADRABOT_ALLOW_REMOTE_TEST_PROVISIONING: "true",
      CUADRABOT_TEST_PROJECT_REF: "sandboxproject123",
    })
    assert.deepEqual(config.target, {
      kind: "remote-sandbox",
      projectRef: "sandboxproject123",
    })

    assert.throws(
      () =>
        loadProvisioningConfig({
          ...remoteEnvironment,
          NEXT_PUBLIC_SUPABASE_URL:
            "https://sandboxproject123.supabase.co/auth/v1",
          CUADRABOT_ALLOW_REMOTE_TEST_PROVISIONING: "true",
          CUADRABOT_TEST_PROJECT_REF: "sandboxproject123",
        }),
      /exact project origin/
    )
  })

  it("requires reserved test emails and strong, distinct passwords", () => {
    assert.throws(
      () =>
        loadProvisioningConfig({
          ...baseEnvironment,
          CUADRABOT_TEST_USER_EMAIL: "customer@example.com",
        }),
      /reserved \.test/
    )
    assert.throws(
      () =>
        loadProvisioningConfig({
          ...baseEnvironment,
          CUADRABOT_TEST_USER_PASSWORD: "too-short",
        }),
      /at least 16 characters/
    )
    assert.throws(
      () =>
        loadProvisioningConfig({
          ...baseEnvironment,
          CUADRABOT_TEST_USER_PASSWORD:
            baseEnvironment.CUADRABOT_TEST_ADMIN_PASSWORD,
        }),
      /distinct password/
    )
  })

  it("requires both optional approver fields and provisions an admin role", () => {
    assert.throws(
      () =>
        loadProvisioningConfig({
          ...baseEnvironment,
          CUADRABOT_TEST_APPROVER_EMAIL:
            "approver@cuadrabot.test",
        }),
      /Set both/
    )

    const config = loadProvisioningConfig({
      ...baseEnvironment,
      CUADRABOT_TEST_APPROVER_EMAIL: "approver@cuadrabot.test",
      CUADRABOT_TEST_APPROVER_PASSWORD:
        "Approver-Only-Password-2026!",
    })
    assert.equal(config.approver?.role, "admin")
  })

  it("rejects a browser key and a legacy anon JWT as the admin key", () => {
    assert.throws(
      () =>
        loadProvisioningConfig({
          ...baseEnvironment,
          SUPABASE_SECRET_KEY:
            "sb_publishable_local_testing_key_123456789",
        }),
      /publishable key/
    )

    const anonPayload = Buffer.from(
      JSON.stringify({ role: "anon" })
    ).toString("base64url")
    assert.throws(
      () =>
        loadProvisioningConfig({
          ...baseEnvironment,
          SUPABASE_SECRET_KEY: `header.${anonPayload}.signature`,
        }),
      /service_role/
    )
  })

  it("bounds the configurable target to one audited adjustment", () => {
    for (const credits of ["-1", "1.5", "100001"]) {
      assert.throws(
        () =>
          loadProvisioningConfig({
            ...baseEnvironment,
            CUADRABOT_TEST_USER_CREDITS: credits,
          }),
        /whole number|between/
      )
    }
  })
})

describe("optional secure password generation", () => {
  it("generates missing distinct passwords without changing supplied ones", () => {
    const generatedPasswords = [
      "Generated-Admin-Password-2026!",
      "Generated-Customer-Password-2026!",
      "Generated-Approver-Password-2026!",
    ]
    const environment = {
      ...baseEnvironment,
      CUADRABOT_GENERATE_TEST_PASSWORDS: "true",
      CUADRABOT_TEST_ADMIN_PASSWORD: "",
      CUADRABOT_TEST_USER_PASSWORD:
        "Customer-Already-Supplied-2026!",
      CUADRABOT_TEST_APPROVER_EMAIL:
        "approver@cuadrabot.test",
      CUADRABOT_TEST_APPROVER_PASSWORD: "",
    }
    let index = 0
    const prepared = prepareGeneratedCredentials(
      environment,
      {},
      () => generatedPasswords[index++]
    )

    assert.equal(prepared.generated, true)
    assert.equal(
      prepared.environment.CUADRABOT_TEST_ADMIN_PASSWORD,
      generatedPasswords[0]
    )
    assert.equal(
      prepared.environment.CUADRABOT_TEST_USER_PASSWORD,
      environment.CUADRABOT_TEST_USER_PASSWORD
    )
    assert.equal(
      prepared.environment.CUADRABOT_TEST_APPROVER_PASSWORD,
      generatedPasswords[1]
    )
    assert.equal(
      prepared.fileEnvironment.CUADRABOT_TEST_ADMIN_EMAIL,
      "admin@cuadrabot.test"
    )
    assert.equal(
      prepared.fileEnvironment.CUADRABOT_TEST_ADMIN_PASSWORD,
      generatedPasswords[0]
    )
    assert.equal(
      prepared.fileEnvironment.CUADRABOT_TEST_USER_PASSWORD,
      undefined
    )
    assert.equal(
      prepared.fileEnvironment.CUADRABOT_TEST_APPROVER_PASSWORD,
      generatedPasswords[1]
    )
  })

  it("preserves prior generated credentials when adding an approver", () => {
    const priorPassword = "Prior-Generated-Password-2026!"
    const approverPassword = "New-Approver-Password-2026!"
    const prepared = prepareGeneratedCredentials(
      {
        ...baseEnvironment,
        CUADRABOT_GENERATE_TEST_PASSWORDS: "true",
        CUADRABOT_TEST_ADMIN_PASSWORD: priorPassword,
        CUADRABOT_TEST_APPROVER_EMAIL:
          "approver@cuadrabot.test",
        CUADRABOT_TEST_APPROVER_PASSWORD: "",
      },
      {
        CUADRABOT_TEST_ADMIN_EMAIL: "admin@cuadrabot.test",
        CUADRABOT_TEST_ADMIN_PASSWORD: priorPassword,
      },
      () => approverPassword
    )

    assert.equal(
      prepared.fileEnvironment.CUADRABOT_TEST_ADMIN_PASSWORD,
      priorPassword
    )
    assert.equal(
      prepared.fileEnvironment.CUADRABOT_TEST_APPROVER_PASSWORD,
      approverPassword
    )
  })

  it("uses cryptographic output that satisfies the password policy", () => {
    const password = generateStrongTestPassword()
    assert.ok(password.length >= 16)
    assert.match(password, /[a-z]/)
    assert.match(password, /[A-Z]/)
    assert.match(password, /\d/)
    assert.match(password, /[^A-Za-z0-9]/)
  })

  it("writes only test credentials atomically with mode 0600", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "cuadrabot-test-accounts-")
    )
    const path = join(directory, ".env.test-accounts.local")

    try {
      await persistTestCredentials(path, {
        CUADRABOT_TEST_ADMIN_EMAIL: "admin@cuadrabot.test",
        CUADRABOT_TEST_ADMIN_PASSWORD:
          "Generated-Admin-Password-2026!",
        CUADRABOT_TEST_USER_EMAIL: "customer@cuadrabot.test",
        CUADRABOT_TEST_USER_PASSWORD:
          "Generated-Customer-Password-2026!",
        SUPABASE_SECRET_KEY:
          "must-never-be-written",
      } as Record<string, string>)

      const [contents, fileStats] = await Promise.all([
        readFile(path, "utf8"),
        stat(path),
      ])
      const parsed = parseDotenv(contents)

      assert.equal(fileStats.mode & 0o777, 0o600)
      assert.equal(
        parsed.CUADRABOT_TEST_ADMIN_EMAIL,
        "admin@cuadrabot.test"
      )
      assert.equal(
        parsed.CUADRABOT_TEST_USER_PASSWORD,
        "Generated-Customer-Password-2026!"
      )
      assert.doesNotMatch(contents, /SUPABASE|must-never-be-written/)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it("serializes only the credential allowlist", () => {
    const output = serializeTestCredentials({
      CUADRABOT_TEST_ADMIN_EMAIL: "admin@cuadrabot.test",
      CUADRABOT_TEST_ADMIN_PASSWORD:
        "Generated-Admin-Password-2026!",
      SUPABASE_SECRET_KEY: "must-never-be-written",
    } as Record<string, string>)

    assert.doesNotMatch(output, /SUPABASE|must-never-be-written/)
    assert.deepEqual(parseDotenv(output), {
      CUADRABOT_TEST_ADMIN_EMAIL: "admin@cuadrabot.test",
      CUADRABOT_TEST_ADMIN_PASSWORD:
        "Generated-Admin-Password-2026!",
    })
  })
})

describe("idempotent account and credit provisioning", () => {
  it("creates once, updates on rerun, and does not duplicate credits", async () => {
    const config = loadProvisioningConfig({
      ...baseEnvironment,
      CUADRABOT_TEST_APPROVER_EMAIL: "approver@cuadrabot.test",
      CUADRABOT_TEST_APPROVER_PASSWORD:
        "Approver-Only-Password-2026!",
    })
    const gateway = new FakeGateway()

    const first = await provisionTestAccounts(config, gateway)
    assert.equal(first.adminCreated, true)
    assert.equal(first.customerCreated, true)
    assert.equal(first.approverCreated, true)
    assert.equal(first.customerCreditsAdded, 5_000)
    assert.equal(first.customerCreditBalance, 5_000)
    assert.equal(gateway.createCount, 3)
    assert.equal(gateway.adjustments.length, 1)

    const customerProfile = gateway.profiles.get(
      "customer@cuadrabot.test"
    )
    assert.equal(customerProfile?.role, "customer")
    assert.equal(customerProfile?.countryCode, "ES")
    assert.equal(customerProfile?.region, "Madrid")
    assert.equal(customerProfile?.timezone, "Europe/Madrid")
    assert.equal(
      gateway.profiles.get("admin@cuadrabot.test")?.role,
      "admin"
    )
    assert.equal(
      gateway.profiles.get("approver@cuadrabot.test")?.role,
      "admin"
    )

    const second = await provisionTestAccounts(config, gateway)
    assert.equal(second.adminCreated, false)
    assert.equal(second.customerCreated, false)
    assert.equal(second.approverCreated, false)
    assert.equal(second.customerCreditsAdded, 0)
    assert.equal(second.customerCreditBalance, 5_000)
    assert.equal(gateway.createCount, 3)
    assert.equal(gateway.updateCount, 3)
    assert.equal(gateway.adjustments.length, 1)
  })

  it("never removes credits when the balance is already above target", async () => {
    const config = loadProvisioningConfig(baseEnvironment)
    const gateway = new FakeGateway()
    gateway.creditByEmail.set("customer@cuadrabot.test", {
      balance: 6_000,
      version: 4,
    })

    const summary = await provisionTestAccounts(config, gateway)
    assert.equal(summary.customerCreditBalance, 6_000)
    assert.equal(summary.customerCreditsAdded, 0)
    assert.equal(gateway.adjustments.length, 0)
  })

  it("uses a stable, non-PII credit idempotency key", () => {
    const first = buildCreditIdempotencyKey({
      userId: "11111111-1111-4111-8111-111111111111",
      target: 5_000,
      version: 3,
    })
    const repeat = buildCreditIdempotencyKey({
      userId: "11111111-1111-4111-8111-111111111111",
      target: 5_000,
      version: 3,
    })
    const nextVersion = buildCreditIdempotencyKey({
      userId: "11111111-1111-4111-8111-111111111111",
      target: 5_000,
      version: 4,
    })

    assert.equal(first, repeat)
    assert.notEqual(first, nextVersion)
    assert.doesNotMatch(first, /@/)
  })
})

describe("safe CLI output", () => {
  it("redacts secrets and passwords from provider errors", () => {
    const secret = "server-secret-value-that-must-not-print"
    const password = "Password-That-Must-Not-Print-2026!"
    const redacted = redactSensitiveText(
      `provider included ${secret} and ${password}`,
      [secret, password]
    )

    assert.equal(
      redacted,
      "provider included [REDACTED] and [REDACTED]"
    )
  })

  it("formats a useful summary without account identifiers", () => {
    const output = formatProvisioningSummary({
      targetKind: "local",
      adminCreated: true,
      customerCreated: true,
      approverCreated: null,
      customerCreditBalance: 5_000,
      customerCreditsAdded: 5_000,
    })

    assert.match(output, /Customer credit balance: 5,000/)
    assert.match(output, /were not printed/)
    assert.doesNotMatch(output, /@|password|sb_secret_/i)
  })
})

class FakeGateway implements ProvisioningGateway {
  readonly users = new Map<string, AuthAccount>()
  readonly profiles = new Map<string, TestAccountSpec>()
  readonly creditByUser = new Map<string, CreditAccountState>()
  readonly creditByEmail = new Map<string, CreditAccountState>()
  readonly adjustments: Array<{
    userId: string
    amount: number
    idempotencyKey: string
    actorUserId: string
    actorEmail: string
    reason: string
  }> = []
  readonly appliedIdempotencyKeys = new Set<string>()
  createCount = 0
  updateCount = 0

  async findAuthUserByEmail(email: string) {
    return this.users.get(email.toLowerCase()) ?? null
  }

  async createAuthUser(input: AuthAccountInput) {
    this.createCount += 1
    const user = {
      id: `00000000-0000-4000-8000-${String(
        this.createCount
      ).padStart(12, "0")}`,
      email: input.email,
      user_metadata: input.userMetadata,
    }
    this.users.set(input.email.toLowerCase(), user)

    const stagedCredit = this.creditByEmail.get(
      input.email.toLowerCase()
    )
    if (stagedCredit) {
      this.creditByUser.set(user.id, stagedCredit)
    }
    return user
  }

  async updateAuthUser(userId: string, input: AuthAccountInput) {
    this.updateCount += 1
    const user = {
      id: userId,
      email: input.email,
      user_metadata: input.userMetadata,
    }
    this.users.set(input.email.toLowerCase(), user)
    return user
  }

  async upsertProfile(
    user: AuthAccount,
    account: TestAccountSpec
  ) {
    this.profiles.set(account.email, account)
    if (!this.creditByUser.has(user.id)) {
      this.creditByUser.set(user.id, { balance: 0, version: 0 })
    }
  }

  async readCreditAccount(userId: string) {
    return this.creditByUser.get(userId) ?? null
  }

  async adjustCredits(input: {
    userId: string
    amount: number
    idempotencyKey: string
    actorUserId: string
    actorEmail: string
    reason: string
  }) {
    if (this.appliedIdempotencyKeys.has(input.idempotencyKey)) return
    this.appliedIdempotencyKeys.add(input.idempotencyKey)
    this.adjustments.push(input)

    const current = this.creditByUser.get(input.userId) ?? {
      balance: 0,
      version: 0,
    }
    this.creditByUser.set(input.userId, {
      balance: current.balance + input.amount,
      version: current.version + 1,
    })
  }
}
