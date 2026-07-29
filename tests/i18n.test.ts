import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { POST as persistLocale } from "../src/app/api/locale/route"
import robots from "../src/app/robots"
import sitemap from "../src/app/sitemap"
import { getSiteUrl } from "../src/lib/config"
import {
  buildLocalizedMetadata,
  buildLocalizedAuthMetadata,
  commonCopy,
  isLocale,
  localeCookieName,
  localeForRequestPath,
  locales,
  localeTag,
  localizedAuthPath,
  localizedPublicPath,
  localizeSubscriptionPlanName,
  normalizeLocale,
  publicMarketingPaths,
  spanishPublicPathToEnglish,
  switchLocalePath,
  type Locale,
  type PublicMarketingPath,
} from "../src/lib/i18n"

const root = process.cwd()
const expectedPublicPaths = [
  "/",
  "/pricing",
  "/sample",
  "/how-it-works",
  "/accuracy",
  "/security",
  "/faq",
  "/fixture-takeoff",
  "/electrical-takeoff",
  "/cable-takeoff",
  "/privacy",
  "/terms",
  "/refund-policy",
] as const satisfies readonly PublicMarketingPath[]

test("the public route manifest has exactly 13 reciprocal EN/ES pairs", () => {
  assert.deepEqual(publicMarketingPaths, expectedPublicPaths)
  assert.equal(new Set(publicMarketingPaths).size, 13)
  assert.deepEqual(locales, ["en", "es"])

  const expectedSpanishPaths = expectedPublicPaths.map((publicPath) =>
    publicPath === "/" ? "/es" : `/es${publicPath}`
  )
  assert.deepEqual(
    publicMarketingPaths.map((publicPath) =>
      localizedPublicPath(publicPath, "es")
    ),
    expectedSpanishPaths
  )

  for (const publicPath of publicMarketingPaths) {
    assert.equal(localizedPublicPath(publicPath, "en"), publicPath)
    assert.equal(
      spanishPublicPathToEnglish(localizedPublicPath(publicPath, "es")),
      publicPath
    )
    assert.equal(existsSync(pageFile(publicPath, "en")), true)
    assert.equal(existsSync(pageFile(publicPath, "es")), true)

    const englishPage = readFileSync(pageFile(publicPath, "en"), "utf8")
    const spanishPage = readFileSync(pageFile(publicPath, "es"), "utf8")
    for (const [locale, page] of [
      ["en", englishPage],
      ["es", spanishPage],
    ] as const) {
      assert.match(page, /buildLocalizedMetadata\(\{/)
      assert.match(page, new RegExp(`locale:\\s*"${locale}"`))
      assert.match(page, new RegExp(`path:\\s*"${escapeRegExp(publicPath)}"`))
    }
  }

  assert.match(read("src/app/es/layout.tsx"), /lang="es"/)
})

test("locale switching preserves query strings and hashes without overmatching", () => {
  assert.equal(
    switchLocalePath("/pricing?plan=growth#subscriptions", "es"),
    "/es/pricing?plan=growth#subscriptions"
  )
  assert.equal(
    switchLocalePath("/es/pricing?plan=growth#subscriptions", "en"),
    "/pricing?plan=growth#subscriptions"
  )
  assert.equal(
    switchLocalePath("/es?campaign=launch#top", "en"),
    "/?campaign=launch#top"
  )
  assert.equal(
    switchLocalePath("/faq?next=%2Fpricing%3Fplan%3Dteam", "es"),
    "/es/faq?next=%2Fpricing%3Fplan%3Dteam"
  )
  assert.equal(
    switchLocalePath("/dashboard/jobs/123?tab=files#results", "es"),
    "/dashboard/jobs/123?tab=files#results"
  )
  assert.equal(
    switchLocalePath(
      "/login?lang=es&error=invalid_credentials&next=%2Fdashboard",
      "en"
    ),
    "/login?error=invalid_credentials&next=%2Fdashboard"
  )
  assert.equal(
    switchLocalePath(
      "/login?error=invalid_credentials&next=%2Fdashboard",
      "es"
    ),
    "/login?error=invalid_credentials&next=%2Fdashboard&lang=es"
  )
  assert.equal(
    switchLocalePath("/escalation?level=2", "en"),
    "/escalation?level=2"
  )
  assert.equal(spanishPublicPathToEnglish("/escalation"), null)
  assert.equal(spanishPublicPathToEnglish("/es/not-a-public-route"), null)
})

test("request locale rules keep public canonicals explicit and private routes stable", () => {
  assert.equal(isLocale("en"), true)
  assert.equal(isLocale("es"), true)
  assert.equal(isLocale("fr"), false)
  assert.equal(normalizeLocale("fr"), "en")
  assert.equal(localeTag("en"), "en-US")
  assert.equal(localeTag("es"), "es-ES")

  assert.equal(localeForRequestPath("/es/faq", "en"), "es")
  assert.equal(localeForRequestPath("/faq", "es"), "en")
  assert.equal(localeForRequestPath("/faq", "en", "es"), "en")
  assert.equal(localeForRequestPath("/dashboard/jobs", "es"), "es")
  assert.equal(localeForRequestPath("/login", "es"), "es")
  assert.equal(localeForRequestPath("/login", "en", "es"), "es")
  assert.equal(localeForRequestPath("/admin/users", "es"), "en")
  assert.equal(localeForRequestPath("/admin/users", "en", "es"), "en")
  assert.equal(localeForRequestPath("/api/health", "es"), "en")
  assert.equal(localeForRequestPath("/demo/dashboard", "es"), "en")
  assert.equal(localeForRequestPath("/dashboard", "invalid"), "en")

  assert.equal(localizedAuthPath("/login", "en"), "/login")
  assert.equal(localizedAuthPath("/login", "es"), "/login?lang=es")
  assert.equal(
    localizedAuthPath("/login?next=%2Fdashboard", "es"),
    "/login?next=%2Fdashboard&lang=es"
  )
})

test("localized metadata is self-canonical and reciprocally linked", () => {
  for (const publicPath of publicMarketingPaths) {
    for (const locale of locales) {
      const metadata = buildLocalizedMetadata({
        locale,
        path: publicPath,
        title: locale === "es" ? "Título en español" : "English title",
        description:
          locale === "es"
            ? "Descripción localizada."
            : "Localized description.",
      })
      const english = localizedPublicPath(publicPath, "en")
      const spanish = localizedPublicPath(publicPath, "es")
      const openGraph = metadata.openGraph as {
        alternateLocale?: string[]
        images?: Array<{ url: string }>
        locale?: string
        url?: string
      }

      assert.equal(
        metadata.alternates?.canonical,
        localizedPublicPath(publicPath, locale)
      )
      assert.deepEqual(metadata.alternates?.languages, {
        en: english,
        es: spanish,
        "x-default": english,
      })
      assert.equal(openGraph.url, localizedPublicPath(publicPath, locale))
      assert.equal(openGraph.locale, locale === "es" ? "es_ES" : "en_US")
      assert.deepEqual(
        openGraph.alternateLocale,
        locale === "es" ? ["en_US"] : ["es_ES"]
      )
      assert.equal(
        openGraph.images?.[0]?.url,
        locale === "es" ? "/es/opengraph-image" : "/opengraph-image"
      )
    }
  }
})

test("private auth metadata is localized and remains non-indexable", () => {
  const metadata = buildLocalizedAuthMetadata({
    locale: "es",
    title: "Iniciar sesión",
    description: "Accede a tu espacio de trabajo.",
  })
  const openGraph = metadata.openGraph as {
    description?: string
    locale?: string
  }

  assert.equal(metadata.description, "Accede a tu espacio de trabajo.")
  assert.deepEqual(metadata.keywords, [])
  assert.deepEqual(metadata.robots, { index: false, follow: false })
  assert.equal(openGraph.locale, "es_ES")
  assert.equal(
    openGraph.description,
    "Accede a tu espacio de trabajo."
  )
})

test("Spanish subscription labels do not leak English tier names", () => {
  assert.equal(
    localizeSubscriptionPlanName("team-monthly", "Team", "es"),
    "Equipo"
  )
  assert.equal(
    localizeSubscriptionPlanName("office-monthly", "Office", "es"),
    "Oficina"
  )
  assert.equal(
    localizeSubscriptionPlanName("team-monthly", "Team", "en"),
    "Team"
  )
})

test("the sitemap publishes all 26 canonical URLs with reciprocal alternates", () => {
  const base = getSiteUrl()
  const entries = sitemap()
  assert.equal(entries.length, publicMarketingPaths.length * locales.length)
  assert.equal(new Set(entries.map((entry) => entry.url)).size, entries.length)

  for (const publicPath of publicMarketingPaths) {
    const englishUrl = `${base}${localizedPublicPath(publicPath, "en")}`
    const spanishUrl = `${base}${localizedPublicPath(publicPath, "es")}`
    const expectedLanguages = {
      en: englishUrl,
      es: spanishUrl,
      "x-default": englishUrl,
    }

    for (const canonicalUrl of [englishUrl, spanishUrl]) {
      const entry = entries.find((candidate) => candidate.url === canonicalUrl)
      assert.ok(entry, `Missing sitemap entry for ${canonicalUrl}`)
      assert.deepEqual(entry.alternates?.languages, expectedLanguages)
    }
  }
})

test("robots uses prefix-safe exclusions for private EN and ES namespaces", () => {
  const output = robots()
  const rules = Array.isArray(output.rules) ? output.rules : [output.rules]
  const wildcard = rules.find((rule) => rule.userAgent === "*")
  assert.ok(wildcard)
  assert.equal(wildcard.allow, "/")

  const disallow = Array.isArray(wildcard.disallow)
    ? wildcard.disallow
    : [wildcard.disallow]
  const protectedPrefixes = ["/admin", "/api", "/auth", "/dashboard", "/demo"]
  assert.deepEqual(
    disallow,
    protectedPrefixes.flatMap((prefix) => [prefix, `/es${prefix}`])
  )
  assert.equal(
    disallow.every((prefix) => prefix && !prefix.endsWith("/")),
    true
  )
  assert.equal(output.sitemap, `${getSiteUrl()}/sitemap.xml`)

  for (const entry of sitemap()) {
    const pathname = new URL(entry.url).pathname
    assert.equal(
      disallow.some(
        (prefix) => typeof prefix === "string" && pathname.startsWith(prefix)
      ),
      false,
      `Public sitemap URL is blocked by robots: ${pathname}`
    )
  }
})

test("the locale endpoint accepts only supported locales and hardens its cookie", async () => {
  const response = await persistLocale(
    new Request("https://cuadrabot.com/api/locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: "es" }),
    })
  )
  const cookie = response.headers.get("set-cookie")

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { locale: "es" })
  assert.ok(cookie)
  assert.match(cookie, new RegExp(`^${localeCookieName}=es;`))
  assert.match(cookie, /Path=\//)
  assert.match(cookie, /Max-Age=31536000/)
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /SameSite=lax/i)

  const invalid = await persistLocale(
    new Request("https://cuadrabot.com/api/locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: "fr" }),
    })
  )
  assert.equal(invalid.status, 422)
  assert.equal(invalid.headers.get("set-cookie"), null)

  const routeSource = read("src/app/api/locale/route.ts")
  assert.match(routeSource, /secure:\s*process\.env\.NODE_ENV === "production"/)
})

test("Spanish shared copy is complete and customer copy avoids banned promises", () => {
  assert.deepEqual(
    leafKeys(commonCopy.es).sort(),
    leafKeys(commonCopy.en).sort()
  )
  for (const value of leafValues(commonCopy.es)) {
    assert.equal(value.trim().length > 0, true)
  }

  const spanishSharedCopy = JSON.stringify({
    auth: commonCopy.es.auth,
    dashboard: commonCopy.es.dashboard,
    footer: commonCopy.es.footer,
    nav: commonCopy.es.nav,
  })
  assert.doesNotMatch(
    spanishSharedCopy,
    /\b(?:How it works|Pricing|Accuracy|Security|Log in|All rights reserved)\b/
  )

  const customerCopySources = [
    ...sourceFiles("src/app"),
    ...sourceFiles("src/components"),
    path.join(root, "src/lib/i18n.ts"),
  ]
    .map((filename) => readFileSync(filename, "utf8"))
    .join("\n")
  assert.doesNotMatch(customerCopySources, /\b48\s*(?:hours?|horas?)\b/i)
  assert.doesNotMatch(
    customerCopySources,
    /\bhuman[-\s]?reviewed\b|\brevisi[oó]n humana\b|\brevisad[oa] por (?:una )?persona\b/i
  )

  const spanishSocialImage = read("src/app/es/opengraph-image.tsx")
  assert.match(spanishSocialImage, /Mediciones guiadas por leyendas en horas\./)
  assert.match(spanishSocialImage, /Descarga recuentos/)
  assert.doesNotMatch(spanishSocialImage, /Self-serve construction takeoffs/)
})

function pageFile(publicPath: PublicMarketingPath, locale: Locale) {
  const route = publicPath === "/" ? "" : publicPath
  const localePrefix = locale === "es" ? "/es" : ""
  return path.join(root, "src/app", `${localePrefix}${route}`, "page.tsx")
}

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8")
}

function sourceFiles(relativeDirectory: string): string[] {
  const directory = path.join(root, relativeDirectory)
  return readdirSync(directory).flatMap((entry) => {
    const filename = path.join(directory, entry)
    if (statSync(filename).isDirectory()) {
      return sourceFiles(path.relative(root, filename))
    }
    return /\.(?:ts|tsx)$/.test(filename) ? [filename] : []
  })
}

function leafKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix]
  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key)
  )
}

function leafValues(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (!value || typeof value !== "object") return []
  return Object.values(value).flatMap(leafValues)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
