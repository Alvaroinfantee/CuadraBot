#!/usr/bin/env -S npx tsx

import { randomBytes, randomUUID } from "node:crypto"
import {
  chmod,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js"
import { config as loadDotenv } from "dotenv"

const DEFAULT_CUSTOMER_CREDITS = 5_000
const MAX_CUSTOMER_CREDITS = 100_000
const AUTH_PAGE_SIZE = 1_000
const MAX_AUTH_PAGES = 10_000
const REDACTION = "[REDACTED]"
export const TEST_ACCOUNT_ENV_PATH = ".env.test-accounts.local"
const TEST_CREDENTIAL_NAMES = [
  "CUADRABOT_TEST_ADMIN_EMAIL",
  "CUADRABOT_TEST_ADMIN_PASSWORD",
  "CUADRABOT_TEST_USER_EMAIL",
  "CUADRABOT_TEST_USER_PASSWORD",
  "CUADRABOT_TEST_APPROVER_EMAIL",
  "CUADRABOT_TEST_APPROVER_PASSWORD",
] as const

type Environment = Record<string, string | undefined>
type AccountRole = "admin" | "customer"
type TestCredentialName = (typeof TEST_CREDENTIAL_NAMES)[number]
type TestCredentialEnvironment = Partial<
  Record<TestCredentialName, string>
>

export type AuthAccount = Pick<User, "id" | "email" | "user_metadata">

export type AuthAccountInput = {
  email: string
  password: string
  emailConfirm: true
  userMetadata: Record<string, unknown>
}

export type TestAccountSpec = {
  email: string
  password: string
  fullName: string
  companyName: string
  preferredLocale: "en" | "es"
  role: AccountRole
  countryCode?: "ES"
  region?: "Madrid"
  city?: "Madrid"
  timezone?: "Europe/Madrid"
}

export type ProvisioningConfig = {
  supabaseUrl: string
  supabaseSecretKey: string
  target: {
    kind: "local" | "remote-sandbox"
    projectRef: string | null
  }
  admin: TestAccountSpec
  customer: TestAccountSpec
  approver: TestAccountSpec | null
  customerCreditTarget: number
}

export type CreditAccountState = {
  balance: number
  version: number
}

export interface ProvisioningGateway {
  findAuthUserByEmail(email: string): Promise<AuthAccount | null>
  createAuthUser(input: AuthAccountInput): Promise<AuthAccount>
  updateAuthUser(
    userId: string,
    input: AuthAccountInput
  ): Promise<AuthAccount>
  upsertProfile(
    user: AuthAccount,
    account: TestAccountSpec
  ): Promise<void>
  readCreditAccount(userId: string): Promise<CreditAccountState | null>
  adjustCredits(input: {
    userId: string
    amount: number
    idempotencyKey: string
    actorUserId: string
    actorEmail: string
    reason: string
  }): Promise<void>
}

export type ProvisioningSummary = {
  targetKind: ProvisioningConfig["target"]["kind"]
  adminCreated: boolean
  customerCreated: boolean
  approverCreated: boolean | null
  customerCreditBalance: number
  customerCreditsAdded: number
}

export type GeneratedCredentials = {
  environment: Environment
  fileEnvironment: TestCredentialEnvironment
  generated: boolean
}

export function loadProvisioningConfig(
  environment: Environment
): ProvisioningConfig {
  if (environment.CUADRABOT_PROVISION_TEST_ACCOUNTS !== "true") {
    throw new Error(
      "Set CUADRABOT_PROVISION_TEST_ACCOUNTS=true to run the explicit test-account bootstrap."
    )
  }

  assertNotProduction(environment)

  const supabaseUrl = required(
    environment,
    "NEXT_PUBLIC_SUPABASE_URL"
  )
  const parsedSupabaseUrl = parseUrl(
    supabaseUrl,
    "NEXT_PUBLIC_SUPABASE_URL"
  )
  const target = validateTarget(parsedSupabaseUrl, environment)
  const supabaseSecretKey =
    environment.SUPABASE_SECRET_KEY?.trim() ||
    environment.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""

  validateSecretKey(supabaseSecretKey, environment)

  const admin = accountFromEnvironment(environment, {
    emailName: "CUADRABOT_TEST_ADMIN_EMAIL",
    passwordName: "CUADRABOT_TEST_ADMIN_PASSWORD",
    fullName: "Cuadrabot Test Admin",
    companyName: "Cuadrabot QA",
    preferredLocale: "en",
    role: "admin",
  })
  const customer = accountFromEnvironment(environment, {
    emailName: "CUADRABOT_TEST_USER_EMAIL",
    passwordName: "CUADRABOT_TEST_USER_PASSWORD",
    fullName: "Cuadrabot Test Customer",
    companyName: "Cuadrabot Fixture QA",
    preferredLocale: "es",
    role: "customer",
    countryCode: "ES",
    region: "Madrid",
    city: "Madrid",
    timezone: "Europe/Madrid",
  })
  const approver = optionalApproverFromEnvironment(environment)

  assertDistinctAccounts([admin, customer, approver].filter(isAccountSpec))

  const customerCreditTarget = parseCreditTarget(
    environment.CUADRABOT_TEST_USER_CREDITS
  )

  return {
    supabaseUrl: parsedSupabaseUrl.toString().replace(/\/$/, ""),
    supabaseSecretKey,
    target,
    admin,
    customer,
    approver,
    customerCreditTarget,
  }
}

export async function provisionTestAccounts(
  config: ProvisioningConfig,
  gateway: ProvisioningGateway
): Promise<ProvisioningSummary> {
  const adminResult = await ensureAccount(gateway, config.admin)
  const customerResult = await ensureAccount(gateway, config.customer)
  const approverResult = config.approver
    ? await ensureAccount(gateway, config.approver)
    : null

  const beforeCredits =
    (await gateway.readCreditAccount(customerResult.user.id)) ?? {
      balance: 0,
      version: 0,
    }
  const creditsToAdd = Math.max(
    config.customerCreditTarget - beforeCredits.balance,
    0
  )

  if (creditsToAdd > 0) {
    await gateway.adjustCredits({
      userId: customerResult.user.id,
      amount: creditsToAdd,
      idempotencyKey: buildCreditIdempotencyKey({
        userId: customerResult.user.id,
        target: config.customerCreditTarget,
        version: beforeCredits.version,
      }),
      actorUserId: adminResult.user.id,
      actorEmail: config.admin.email,
      reason: "Test account bootstrap credit allocation",
    })
  }

  const afterCredits = await gateway.readCreditAccount(
    customerResult.user.id
  )
  if (!afterCredits) {
    throw new Error(
      "The customer credit account is missing after provisioning. Apply all database migrations before retrying."
    )
  }
  if (afterCredits.balance < config.customerCreditTarget) {
    throw new Error(
      "The customer credit balance did not reach the configured test target."
    )
  }

  return {
    targetKind: config.target.kind,
    adminCreated: adminResult.created,
    customerCreated: customerResult.created,
    approverCreated: approverResult?.created ?? null,
    customerCreditBalance: afterCredits.balance,
    customerCreditsAdded: creditsToAdd,
  }
}

export function buildCreditIdempotencyKey(input: {
  userId: string
  target: number
  version: number
}) {
  return [
    "test-account-bootstrap",
    input.userId,
    `target-${input.target}`,
    `version-${input.version}`,
  ].join(":")
}

export function redactSensitiveText(
  input: string,
  sensitiveValues: Array<string | undefined>
) {
  return sensitiveValues
    .filter((value): value is string => Boolean(value && value.length >= 4))
    .sort((left, right) => right.length - left.length)
    .reduce(
      (redacted, value) => redacted.replaceAll(value, REDACTION),
      input
    )
}

export function prepareGeneratedCredentials(
  environment: Environment,
  existingFileEnvironment: Environment = {},
  generatePassword: () => string = generateStrongTestPassword
): GeneratedCredentials {
  const output = { ...environment }
  const fileEnvironment = pickTestCredentials(existingFileEnvironment)

  if (environment.CUADRABOT_GENERATE_TEST_PASSWORDS !== "true") {
    return { environment: output, fileEnvironment, generated: false }
  }

  const requestedAccounts = [
    {
      emailName: "CUADRABOT_TEST_ADMIN_EMAIL",
      passwordName: "CUADRABOT_TEST_ADMIN_PASSWORD",
      required: true,
    },
    {
      emailName: "CUADRABOT_TEST_USER_EMAIL",
      passwordName: "CUADRABOT_TEST_USER_PASSWORD",
      required: true,
    },
    {
      emailName: "CUADRABOT_TEST_APPROVER_EMAIL",
      passwordName: "CUADRABOT_TEST_APPROVER_PASSWORD",
      required: false,
    },
  ] as const
  const usedPasswords = new Set(
    requestedAccounts
      .map(({ passwordName }) => output[passwordName]?.trim())
      .filter((value): value is string => Boolean(value))
  )
  let generated = false

  for (const account of requestedAccounts) {
    const email = output[account.emailName]?.trim()
    const password = output[account.passwordName]?.trim()
    const existingGeneratedPassword =
      existingFileEnvironment[account.passwordName]?.trim()
    if (!email && !password && !account.required) continue
    if (!email) {
      throw new Error(
        `Set ${account.emailName} before generating its test password.`
      )
    }
    validateTestEmail(email, account.emailName)

    let generatedForAccount = false
    if (!password) {
      const nextPassword = uniqueGeneratedPassword(
        usedPasswords,
        generatePassword,
        account.passwordName
      )
      output[account.passwordName] = nextPassword
      usedPasswords.add(nextPassword)
      generated = true
      generatedForAccount = true
    }

    if (generatedForAccount) {
      fileEnvironment[account.emailName] = email.toLowerCase()
      fileEnvironment[account.passwordName] =
        output[account.passwordName]?.trim()
    } else if (existingGeneratedPassword) {
      fileEnvironment[account.emailName] =
        existingFileEnvironment[account.emailName]?.trim().toLowerCase() ??
        email.toLowerCase()
      fileEnvironment[account.passwordName] =
        existingGeneratedPassword
    }
  }

  return { environment: output, fileEnvironment, generated }
}

export function generateStrongTestPassword() {
  return `${randomBytes(24).toString("base64url")}!Aa1`
}

export function serializeTestCredentials(
  environment: TestCredentialEnvironment
) {
  const lines = [
    "# Generated locally by npm run test:accounts:provision.",
    "# Contains test login credentials only. Never commit this file.",
  ]

  for (const name of TEST_CREDENTIAL_NAMES) {
    const value = environment[name]
    if (value) lines.push(`${name}=${serializeDotenvValue(value)}`)
  }

  return `${lines.join("\n")}\n`
}

export async function persistTestCredentials(
  path: string,
  environment: TestCredentialEnvironment
) {
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  try {
    await writeFile(
      temporaryPath,
      serializeTestCredentials(environment),
      {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      }
    )
    await chmod(temporaryPath, 0o600)
    await rename(temporaryPath, path)
    await chmod(path, 0o600)
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
}

export function formatProvisioningSummary(summary: ProvisioningSummary) {
  const approver = summary.approverCreated === null
    ? "Optional second admin: not configured."
    : `Optional second admin: ${
        summary.approverCreated ? "created" : "updated"
      }.`

  return [
    `Test accounts provisioned against an approved ${summary.targetKind} target.`,
    `Primary admin: ${summary.adminCreated ? "created" : "updated"}.`,
    `Customer: ${summary.customerCreated ? "created" : "updated"}.`,
    approver,
    `Customer credit balance: ${summary.customerCreditBalance.toLocaleString(
      "en-US"
    )}.`,
    `Credits added in this run: ${summary.customerCreditsAdded.toLocaleString(
      "en-US"
    )}.`,
    "Credentials remain only in the local environment file and were not printed.",
  ].join("\n")
}

class SupabaseProvisioningGateway implements ProvisioningGateway {
  constructor(private readonly client: SupabaseClient) {}

  async findAuthUserByEmail(email: string) {
    for (let page = 1; page <= MAX_AUTH_PAGES; page += 1) {
      const { data, error } = await this.client.auth.admin.listUsers({
        page,
        perPage: AUTH_PAGE_SIZE,
      })
      assertSupabaseSuccess(error, "Could not list Auth users")

      const match = data.users.find(
        (user) => user.email?.toLowerCase() === email.toLowerCase()
      )
      if (match) return match
      if (data.users.length < AUTH_PAGE_SIZE) return null
    }

    throw new Error(
      "Auth user lookup exceeded the bounded pagination limit."
    )
  }

  async createAuthUser(input: AuthAccountInput) {
    const { data, error } = await this.client.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: input.emailConfirm,
      user_metadata: input.userMetadata,
    })
    assertSupabaseSuccess(error, "Could not create an Auth user")
    if (!data.user) {
      throw new Error("Supabase did not return the created Auth user.")
    }
    return data.user
  }

  async updateAuthUser(userId: string, input: AuthAccountInput) {
    const { data, error } = await this.client.auth.admin.updateUserById(
      userId,
      {
        password: input.password,
        email_confirm: input.emailConfirm,
        ban_duration: "none",
        user_metadata: input.userMetadata,
      }
    )
    assertSupabaseSuccess(error, "Could not update an Auth user")
    if (!data.user) {
      throw new Error("Supabase did not return the updated Auth user.")
    }
    return data.user
  }

  async upsertProfile(user: AuthAccount, account: TestAccountSpec) {
    const profile = {
      id: user.id,
      email: account.email,
      full_name: account.fullName,
      company_name: account.companyName,
      role: account.role,
      status: "active",
      ...(account.role === "customer"
        ? {
            country_code: account.countryCode,
            region: account.region,
            city: account.city,
            timezone: account.timezone,
            location_source: "admin",
          }
        : {}),
    }
    const { error } = await this.client
      .from("profiles")
      .upsert(profile, { onConflict: "id" })
    assertSupabaseSuccess(error, "Could not upsert a test profile")
  }

  async readCreditAccount(userId: string) {
    const { data, error } = await this.client
      .from("credit_accounts")
      .select("balance,version")
      .eq("user_id", userId)
      .maybeSingle()
    assertSupabaseSuccess(error, "Could not read the customer credit account")

    if (!data) return null
    return {
      balance: Number(data.balance),
      version: Number(data.version),
    }
  }

  async adjustCredits(input: {
    userId: string
    amount: number
    idempotencyKey: string
    actorUserId: string
    actorEmail: string
    reason: string
  }) {
    const { error } = await this.client.rpc("admin_adjust_credits", {
      p_user_id: input.userId,
      p_amount: input.amount,
      p_idempotency_key: input.idempotencyKey,
      p_actor_user_id: input.actorUserId,
      p_actor_email: input.actorEmail,
      p_reason: input.reason,
    })
    assertSupabaseSuccess(error, "Could not allocate test credits")
  }
}

async function ensureAccount(
  gateway: ProvisioningGateway,
  account: TestAccountSpec
) {
  const existing = await gateway.findAuthUserByEmail(account.email)
  const userMetadata = {
    ...(existing?.user_metadata ?? {}),
    full_name: account.fullName,
    company_name: account.companyName,
    preferred_locale: account.preferredLocale,
    test_account: true,
  }
  const input: AuthAccountInput = {
    email: account.email,
    password: account.password,
    emailConfirm: true,
    userMetadata,
  }
  const user = existing
    ? await gateway.updateAuthUser(existing.id, input)
    : await gateway.createAuthUser(input)

  await gateway.upsertProfile(user, account)
  return { user, created: !existing }
}

function accountFromEnvironment(
  environment: Environment,
  input: Omit<TestAccountSpec, "email" | "password"> & {
    emailName: string
    passwordName: string
  }
): TestAccountSpec {
  const email = required(environment, input.emailName).toLowerCase()
  const password = required(environment, input.passwordName)
  validateTestEmail(email, input.emailName)
  validateStrongPassword(password, input.passwordName)

  return {
    email,
    password,
    fullName: input.fullName,
    companyName: input.companyName,
    preferredLocale: input.preferredLocale,
    role: input.role,
    countryCode: input.countryCode,
    region: input.region,
    city: input.city,
    timezone: input.timezone,
  }
}

function optionalApproverFromEnvironment(
  environment: Environment
): TestAccountSpec | null {
  const email = environment.CUADRABOT_TEST_APPROVER_EMAIL?.trim() ?? ""
  const password =
    environment.CUADRABOT_TEST_APPROVER_PASSWORD?.trim() ?? ""

  if (!email && !password) return null
  if (!email || !password) {
    throw new Error(
      "Set both CUADRABOT_TEST_APPROVER_EMAIL and CUADRABOT_TEST_APPROVER_PASSWORD, or leave both empty."
    )
  }

  validateTestEmail(email, "CUADRABOT_TEST_APPROVER_EMAIL")
  validateStrongPassword(password, "CUADRABOT_TEST_APPROVER_PASSWORD")

  return {
    email: email.toLowerCase(),
    password,
    fullName: "Cuadrabot Test Approver",
    companyName: "Cuadrabot QA",
    preferredLocale: "en",
    role: "admin",
  }
}

function validateTarget(
  supabaseUrl: URL,
  environment: Environment
): ProvisioningConfig["target"] {
  if (isLoopbackUrl(supabaseUrl)) {
    if (supabaseUrl.protocol !== "http:") {
      throw new Error("The local Supabase test target must use HTTP.")
    }
    return { kind: "local", projectRef: null }
  }

  if (supabaseUrl.protocol !== "https:") {
    throw new Error("A remote Supabase test target must use HTTPS.")
  }
  if (
    supabaseUrl.port ||
    supabaseUrl.pathname !== "/" ||
    supabaseUrl.search ||
    supabaseUrl.hash
  ) {
    throw new Error(
      "A remote Supabase test target must use the exact project origin."
    )
  }
  if (environment.CUADRABOT_ALLOW_REMOTE_TEST_PROVISIONING !== "true") {
    throw new Error(
      "Remote provisioning is disabled. Use a local Supabase stack or explicitly approve a dedicated sandbox."
    )
  }

  const projectRef = required(
    environment,
    "CUADRABOT_TEST_PROJECT_REF"
  ).toLowerCase()
  if (!/^[a-z0-9]+$/.test(projectRef)) {
    throw new Error(
      "CUADRABOT_TEST_PROJECT_REF must contain only lowercase letters and numbers."
    )
  }
  if (supabaseUrl.hostname !== `${projectRef}.supabase.co`) {
    throw new Error(
      "The approved sandbox project ref does not match NEXT_PUBLIC_SUPABASE_URL."
    )
  }

  return { kind: "remote-sandbox", projectRef }
}

function assertNotProduction(environment: Environment) {
  const productionSignals = [
    ["NODE_ENV", environment.NODE_ENV],
    ["VERCEL_ENV", environment.VERCEL_ENV],
    ["CUADRABOT_ENVIRONMENT", environment.CUADRABOT_ENVIRONMENT],
  ] as const
  const signal = productionSignals.find(
    ([, value]) => value?.toLowerCase() === "production"
  )
  if (signal) {
    throw new Error(
      `Test-account provisioning is forbidden when ${signal[0]}=production.`
    )
  }

  const siteUrl = required(environment, "NEXT_PUBLIC_SITE_URL")
  const parsedSiteUrl = parseUrl(siteUrl, "NEXT_PUBLIC_SITE_URL")
  if (!isLoopbackUrl(parsedSiteUrl)) {
    throw new Error(
      "Test-account provisioning requires NEXT_PUBLIC_SITE_URL to use localhost or a loopback address."
    )
  }
}

function validateSecretKey(
  secretKey: string,
  environment: Environment
) {
  if (!secretKey || secretKey.length < 20) {
    throw new Error(
      "Set SUPABASE_SECRET_KEY (or the legacy SUPABASE_SERVICE_ROLE_KEY) to a server-only admin key."
    )
  }
  if (secretKey.startsWith("sb_publishable_")) {
    throw new Error(
      "A Supabase publishable key cannot provision test accounts."
    )
  }

  const publicKeys = [
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
  if (publicKeys.includes(secretKey)) {
    throw new Error(
      "The Supabase admin key must not match a browser-exposed public key."
    )
  }

  const legacyRole = readLegacyJwtRole(secretKey)
  if (legacyRole && legacyRole !== "service_role") {
    throw new Error(
      "The legacy Supabase JWT must carry the service_role claim."
    )
  }
}

function readLegacyJwtRole(value: string) {
  const parts = value.split(".")
  if (parts.length !== 3) return null

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    ) as { role?: unknown }
    return typeof payload.role === "string" ? payload.role : null
  } catch {
    return null
  }
}

function validateTestEmail(email: string, name: string) {
  if (
    !/^[^\s@]+@[^\s@]+\.test$/i.test(email) ||
    email.length > 254
  ) {
    throw new Error(`${name} must use a reserved .test email address.`)
  }
}

function validateStrongPassword(password: string, name: string) {
  const isStrong =
    password.length >= 16 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)

  if (!isStrong) {
    throw new Error(
      `${name} must be at least 16 characters and include uppercase, lowercase, number, and symbol characters.`
    )
  }
}

function uniqueGeneratedPassword(
  usedPasswords: Set<string>,
  generatePassword: () => string,
  name: string
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const password = generatePassword()
    validateStrongPassword(password, name)
    if (!usedPasswords.has(password)) return password
  }
  throw new Error("Could not generate a distinct test password.")
}

function assertDistinctAccounts(accounts: TestAccountSpec[]) {
  const emails = accounts.map((account) => account.email.toLowerCase())
  if (new Set(emails).size !== emails.length) {
    throw new Error("Every provisioned test account must use a distinct email.")
  }

  const passwords = accounts.map((account) => account.password)
  if (new Set(passwords).size !== passwords.length) {
    throw new Error(
      "Every provisioned test account must use a distinct password."
    )
  }
}

function parseCreditTarget(value: string | undefined) {
  const normalized = value?.trim() || String(DEFAULT_CUSTOMER_CREDITS)
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      "CUADRABOT_TEST_USER_CREDITS must be a whole number."
    )
  }

  const credits = Number(normalized)
  if (
    !Number.isSafeInteger(credits) ||
    credits < 0 ||
    credits > MAX_CUSTOMER_CREDITS
  ) {
    throw new Error(
      `CUADRABOT_TEST_USER_CREDITS must be between 0 and ${MAX_CUSTOMER_CREDITS}.`
    )
  }
  return credits
}

function required(environment: Environment, name: string) {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function parseUrl(value: string, name: string) {
  try {
    const url = new URL(value)
    if (url.username || url.password) {
      throw new Error("embedded credentials are not allowed")
    }
    return url
  } catch {
    throw new Error(`${name} must be a valid URL without embedded credentials.`)
  }
}

function isLoopbackUrl(url: URL) {
  return (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1" ||
    url.hostname === "[::1]"
  )
}

function isAccountSpec(
  account: TestAccountSpec | null
): account is TestAccountSpec {
  return account !== null
}

function pickTestCredentials(
  environment: Environment
): TestCredentialEnvironment {
  return Object.fromEntries(
    TEST_CREDENTIAL_NAMES.flatMap((name) => {
      const value = environment[name]?.trim()
      return value ? [[name, value]] : []
    })
  )
}

function serializeDotenvValue(value: string) {
  if (/[\r\n]/.test(value)) {
    throw new Error(
      "Generated test credentials cannot contain line breaks."
    )
  }

  for (const quote of ['"', "'", "`"]) {
    if (!value.includes(quote)) return `${quote}${value}${quote}`
  }
  throw new Error(
    "Generated test credentials contain unsupported quote characters."
  )
}

function assertSupabaseSuccess(
  error: { message: string } | null,
  context: string
): asserts error is null {
  if (error) throw new Error(`${context}: ${error.message}`)
}

function createProvisioningGateway(config: ProvisioningConfig) {
  const client = createClient(
    config.supabaseUrl,
    config.supabaseSecretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )
  return new SupabaseProvisioningGateway(client)
}

function loadLocalEnvironment() {
  const localResult = loadDotenv({
    path: resolve(process.cwd(), ".env.local"),
    override: false,
    quiet: true,
  })
  if (
    localResult.error &&
    (localResult.error as NodeJS.ErrnoException).code !== "ENOENT"
  ) {
    throw localResult.error
  }

  const credentialResult = loadDotenv({
    path: resolve(process.cwd(), TEST_ACCOUNT_ENV_PATH),
    override: false,
    quiet: true,
    processEnv: {},
  })
  if (
    credentialResult.error &&
    (credentialResult.error as NodeJS.ErrnoException).code !== "ENOENT"
  ) {
    throw credentialResult.error
  }
  const credentialEnvironment = pickTestCredentials(
    credentialResult.parsed ?? {}
  )
  for (const [name, value] of Object.entries(credentialEnvironment)) {
    if (!process.env[name]?.trim()) process.env[name] = value
  }
  return credentialEnvironment
}

async function main() {
  const existingCredentialEnvironment = loadLocalEnvironment()
  let config: ProvisioningConfig | null = null

  try {
    const prepared = prepareGeneratedCredentials(
      process.env,
      existingCredentialEnvironment
    )
    config = loadProvisioningConfig(prepared.environment)

    if (prepared.generated) {
      const credentialPath = resolve(
        process.cwd(),
        TEST_ACCOUNT_ENV_PATH
      )
      await persistTestCredentials(
        credentialPath,
        prepared.fileEnvironment
      )
      console.log(
        `Generated test credentials were saved to ${credentialPath}.`
      )
    }

    const summary = await provisionTestAccounts(
      config,
      createProvisioningGateway(config)
    )
    console.log(formatProvisioningSummary(summary))
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown provisioning error."
    const sensitiveValues = config
      ? [
          config.supabaseSecretKey,
          config.admin.password,
          config.customer.password,
          config.approver?.password,
        ]
      : [
          process.env.SUPABASE_SECRET_KEY,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          process.env.CUADRABOT_TEST_ADMIN_PASSWORD,
          process.env.CUADRABOT_TEST_USER_PASSWORD,
          process.env.CUADRABOT_TEST_APPROVER_PASSWORD,
        ]

    console.error(
      `Test account provisioning failed: ${redactSensitiveText(
        message,
        sensitiveValues
      )}`
    )
    process.exitCode = 1
  }
}

const invokedPath = process.argv[1]
if (
  invokedPath &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  void main()
}
