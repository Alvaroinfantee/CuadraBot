export const drywallLocales = ["es", "en"] as const
export type DrywallLocale = (typeof drywallLocales)[number]

export type DrywallPathKey =
  | "home"
  | "order"
  | "scope"
  | "terms"
  | "privacy"
  | "refunds"
  | "confidentiality"

export const drywallPaths: Record<
  DrywallLocale,
  Record<DrywallPathKey, string>
> = {
  es: {
    home: "/",
    order: "/pedido",
    scope: "/alcance",
    terms: "/terminos",
    privacy: "/privacidad",
    refunds: "/reembolsos",
    confidentiality: "/confidencialidad",
  },
  en: {
    home: "/en",
    order: "/en/order",
    scope: "/en/scope",
    terms: "/en/terms",
    privacy: "/en/privacy",
    refunds: "/en/refunds",
    confidentiality: "/en/confidentiality",
  },
}

export function normalizeDrywallLocale(value: unknown): DrywallLocale {
  return value === "en" ? "en" : "es"
}

export function drywallPath(locale: DrywallLocale, key: DrywallPathKey) {
  return drywallPaths[locale][key]
}

export function drywallText(
  locale: DrywallLocale,
  spanish: string,
  english: string
) {
  return locale === "en" ? english : spanish
}

export function drywallPortalUrlPath(
  projectId: string,
  locale: DrywallLocale,
  params: Record<string, string> = {}
) {
  const search = new URLSearchParams({ lang: locale, ...params })
  return `/portal/${projectId}?${search.toString()}`
}
