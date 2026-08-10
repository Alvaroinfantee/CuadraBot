export type AdminMarketingSnapshot = {
  asOf: string
  metrics: {
    events30: number
    visitors30: number
    sessions30: number
    pageViews30: number
    accountsCreated30: number
    blueprintUploadsStarted30: number
    checkoutsStarted30: number
    purchases30: number
  }
  devices: Array<{ label: string; events: number; visitors: number }>
  geography: Array<{ label: string; events: number; visitors: number }>
  ageBands: Array<{ label: string; visitors: number }>
  campaigns: Array<{
    source: string
    medium: string
    campaign: string
    events: number
    visitors: number
    accountsCreated: number
    blueprintUploadsStarted: number
    checkoutsStarted: number
    purchases: number
  }>
}

export function parseAdminMarketingSnapshot(
  value: unknown
): AdminMarketingSnapshot {
  const root = record(value, "marketing snapshot")
  const metrics = record(root.metrics, "marketing metrics")
  return {
    asOf: isoString(root.asOf, "asOf"),
    metrics: {
      events30: count(metrics.events30, "metrics.events30"),
      visitors30: count(metrics.visitors30, "metrics.visitors30"),
      sessions30: count(metrics.sessions30, "metrics.sessions30"),
      pageViews30: count(metrics.pageViews30, "metrics.pageViews30"),
      accountsCreated30: count(
        metrics.accountsCreated30,
        "metrics.accountsCreated30"
      ),
      blueprintUploadsStarted30: count(
        metrics.blueprintUploadsStarted30,
        "metrics.blueprintUploadsStarted30"
      ),
      checkoutsStarted30: count(
        metrics.checkoutsStarted30,
        "metrics.checkoutsStarted30"
      ),
      purchases30: count(metrics.purchases30, "metrics.purchases30"),
    },
    devices: rows(root.devices, "devices", (item, label) => ({
      label: text(item.label, `${label}.label`),
      events: count(item.events, `${label}.events`),
      visitors: count(item.visitors, `${label}.visitors`),
    })),
    geography: rows(root.geography, "geography", (item, label) => ({
      label: text(item.label, `${label}.label`),
      events: count(item.events, `${label}.events`),
      visitors: count(item.visitors, `${label}.visitors`),
    })),
    ageBands: rows(root.ageBands, "ageBands", (item, label) => ({
      label: text(item.label, `${label}.label`),
      visitors: count(item.visitors, `${label}.visitors`),
    })),
    campaigns: rows(root.campaigns, "campaigns", (item, label) => ({
      source: text(item.source, `${label}.source`),
      medium: text(item.medium, `${label}.medium`),
      campaign: text(item.campaign, `${label}.campaign`),
      events: count(item.events, `${label}.events`),
      visitors: count(item.visitors, `${label}.visitors`),
      accountsCreated: count(
        item.accountsCreated,
        `${label}.accountsCreated`
      ),
      blueprintUploadsStarted: count(
        item.blueprintUploadsStarted,
        `${label}.blueprintUploadsStarted`
      ),
      checkoutsStarted: count(
        item.checkoutsStarted,
        `${label}.checkoutsStarted`
      ),
      purchases: count(item.purchases, `${label}.purchases`),
    })),
  }
}

function rows<Row>(
  value: unknown,
  label: string,
  parse: (item: Record<string, unknown>, label: string) => Row
) {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label}.`)
  return value.map((item, index) =>
    parse(record(item, `${label}[${index}]`), `${label}[${index}]`)
  )
}

function record(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}.`)
  }
  return value as Record<string, unknown>
}

function count(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${label}.`)
  }
  return value
}

function text(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid ${label}.`)
  }
  return value
}

function isoString(value: unknown, label: string) {
  const valueText = text(value, label)
  if (!Number.isFinite(new Date(valueText).getTime())) {
    throw new Error(`Invalid ${label}.`)
  }
  return valueText
}
