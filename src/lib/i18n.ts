import type { Metadata } from "next"
import type {
  TakeoffJobStatus,
  TakeoffTrade,
} from "@/lib/takeoff-types"
import type {
  TakeoffPrice,
  TakeoffPricingTier,
} from "@/lib/takeoff-pricing"

export const locales = ["en", "es"] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "en"
export const localeCookieName = "cuadrabot_locale"

export const publicMarketingPaths = [
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
] as const

export type PublicMarketingPath = (typeof publicMarketingPaths)[number]

const publicMarketingPathSet = new Set<string>(publicMarketingPaths)
const authPagePathSet = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
])

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "es"
}

export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : defaultLocale
}

export function localeTag(locale: Locale) {
  return locale === "es" ? "es-ES" : "en-US"
}

export function localizedPublicPath(
  path: PublicMarketingPath,
  locale: Locale
) {
  if (locale === "en") return path
  return path === "/" ? "/es" : `/es${path}`
}

export function localizedAuthPath(path: string, locale: Locale) {
  const target = new URL(path, "https://cuadrabot.invalid")
  target.searchParams.delete("lang")
  if (locale === "es") target.searchParams.set("lang", "es")
  return `${target.pathname}${target.search}${target.hash}`
}

export function switchLocalePath(pathWithSuffix: string, locale: Locale) {
  const { pathname, suffix } = splitPathSuffix(pathWithSuffix)
  const englishPath = spanishPublicPathToEnglish(pathname)

  if (englishPath) {
    return `${localizedPublicPath(englishPath, locale)}${suffix}`
  }
  if (publicMarketingPathSet.has(pathname)) {
    return `${localizedPublicPath(
      pathname as PublicMarketingPath,
      locale
    )}${suffix}`
  }

  if (authPagePathSet.has(pathname)) {
    return localizedAuthPath(`${pathname}${suffix}`, locale)
  }

  return `${pathname}${suffix}`
}

export function localeForRequestPath(
  pathname: string,
  persistedLocale?: string | null,
  explicitLocale?: unknown
): Locale {
  if (spanishPublicPathToEnglish(pathname)) return "es"
  if (publicMarketingPathSet.has(pathname)) return "en"
  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === "/demo" ||
    pathname.startsWith("/demo/")
  ) {
    return "en"
  }
  if (authPagePathSet.has(pathname) && isLocale(explicitLocale)) {
    return explicitLocale
  }
  return normalizeLocale(persistedLocale)
}

export function spanishPublicPathToEnglish(
  pathname: string
): PublicMarketingPath | null {
  if (pathname === "/es") return "/"
  if (!pathname.startsWith("/es/")) return null
  const candidate = pathname.slice(3)
  return publicMarketingPathSet.has(candidate)
    ? (candidate as PublicMarketingPath)
    : null
}

export function buildLocalizedMetadata(input: {
  locale: Locale
  path: PublicMarketingPath
  title: string
  description: string
  keywords?: string[]
}): Metadata {
  const canonical = localizedPublicPath(input.path, input.locale)
  const english = localizedPublicPath(input.path, "en")
  const spanish = localizedPublicPath(input.path, "es")
  const image =
    input.locale === "es" ? "/es/opengraph-image" : "/opengraph-image"

  return {
    title: input.title,
    description: input.description,
    keywords: input.keywords,
    alternates: {
      canonical,
      languages: {
        en: english,
        es: spanish,
        "x-default": english,
      },
    },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "Cuadrabot",
      locale: input.locale === "es" ? "es_ES" : "en_US",
      alternateLocale: input.locale === "es" ? ["en_US"] : ["es_ES"],
      title: input.title,
      description: input.description,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt:
            input.locale === "es"
              ? "Medición de elementos guiada por leyendas, con plano anotado y cantidades trazables de Cuadrabot"
              : "Cuadrabot legend-driven fixture takeoff with annotated plan and source-linked quantities",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image],
    },
  }
}

export function buildLocalizedAuthMetadata(input: {
  locale: Locale
  title: string
  description: string
}): Metadata {
  const image =
    input.locale === "es" ? "/es/opengraph-image" : "/opengraph-image"
  return {
    title: input.title,
    description: input.description,
    keywords: [],
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: "Cuadrabot",
      locale: input.locale === "es" ? "es_ES" : "en_US",
      title: input.title,
      description: input.description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image],
    },
  }
}

type CommonCopy = {
  language: string
  switchToEnglish: string
  switchToSpanish: string
  nav: {
    howItWorks: string
    pricing: string
    accuracy: string
    security: string
    faq: string
    login: string
    freeCta: string
    openNavigation: string
  }
  footer: {
    description: string
    disclaimer: string
    product: string
    company: string
    sample: string
    privacy: string
    terms: string
    refund: string
    support: string
    rights: string
  }
  dashboard: {
    overview: string
    newTakeoff: string
    takeoffs: string
    billing: string
    settings: string
    admin: string
    available: string
    credits: string
    creditsAvailable: string
    privateWorkspace: string
    help: string
    logout: string
    openNavigation: string
    userFallback: string
    companyFallback: string
  }
  auth: {
    eyebrow: string
    title: string
    body: string
  }
}

export const commonCopy: Record<Locale, CommonCopy> = {
  en: {
    language: "Language",
    switchToEnglish: "View in English",
    switchToSpanish: "Ver en español",
    nav: {
      howItWorks: "How it works",
      pricing: "Pricing",
      accuracy: "Accuracy",
      security: "Security",
      faq: "FAQ",
      login: "Log in",
      freeCta: "Check my plans free",
      openNavigation: "Open navigation",
    },
    footer: {
      description:
        "Self-serve legend-driven takeoffs from PDF plans, delivered in hours with source-linked fixture counts, marked evidence, and downloadable quantities.",
      disclaimer:
        "Takeoff support only. Not engineering, architectural, permit, or final-bid advice. Always verify quantities against the contract documents.",
      product: "Product",
      company: "Company",
      sample: "Sample output",
      privacy: "Privacy",
      terms: "Terms",
      refund: "Refund policy",
      support: "Support",
      rights: "All rights reserved.",
    },
    dashboard: {
      overview: "Overview",
      newTakeoff: "New takeoff",
      takeoffs: "Takeoffs",
      billing: "Credits & billing",
      settings: "Company settings",
      admin: "Admin control panel",
      available: "Available",
      credits: "credits",
      creditsAvailable: "credits available",
      privateWorkspace: "Private workspace",
      help: "Help",
      logout: "Log out",
      openNavigation: "Open workspace navigation",
      userFallback: "Cuadrabot user",
      companyFallback: "Company workspace",
    },
    auth: {
      eyebrow: "Legend-driven takeoffs",
      title: "From PDF legends to source-linked quantities in hours.",
      body:
        "Private plan storage, fixture and device counts, supported cable or conduit runs, automatic validation, and downloadable PDF and Excel evidence.",
    },
  },
  es: {
    language: "Idioma",
    switchToEnglish: "View in English",
    switchToSpanish: "Ver en español",
    nav: {
      howItWorks: "Cómo funciona",
      pricing: "Precios",
      accuracy: "Precisión",
      security: "Seguridad",
      faq: "Preguntas frecuentes",
      login: "Iniciar sesión",
      freeCta: "Probar un plano gratis",
      openNavigation: "Abrir navegación",
    },
    footer: {
      description:
        "Mediciones autoservicio guiadas por leyendas de planos PDF, entregadas en horas con recuentos vinculados al origen, planos marcados y cantidades descargables.",
      disclaimer:
        "Solo ofrecemos apoyo para mediciones. No constituye asesoramiento de ingeniería, arquitectura, permisos ni oferta final. Verifica siempre las cantidades con los documentos contractuales.",
      product: "Producto",
      company: "Empresa",
      sample: "Ejemplo de entrega",
      privacy: "Privacidad",
      terms: "Términos",
      refund: "Política de reembolso",
      support: "Soporte",
      rights: "Todos los derechos reservados.",
    },
    dashboard: {
      overview: "Resumen",
      newTakeoff: "Nueva medición",
      takeoffs: "Mediciones",
      billing: "Créditos y facturación",
      settings: "Datos de la empresa",
      admin: "Panel de administración",
      available: "Disponibles",
      credits: "créditos",
      creditsAvailable: "créditos disponibles",
      privateWorkspace: "Espacio de trabajo privado",
      help: "Ayuda",
      logout: "Cerrar sesión",
      openNavigation: "Abrir navegación del espacio de trabajo",
      userFallback: "Usuario de Cuadrabot",
      companyFallback: "Espacio de trabajo de la empresa",
    },
    auth: {
      eyebrow: "Mediciones guiadas por la leyenda",
      title: "De las leyendas del PDF a cantidades trazables en horas.",
      body:
        "Almacenamiento privado, recuentos de elementos y dispositivos, recorridos compatibles de cable o canalización, validación automática y entregables en PDF y Excel.",
    },
  },
}

export const localizedTradeLabels: Record<
  Locale,
  Record<TakeoffTrade, string>
> = {
  en: {
    flooring_finishes: "Flooring & finishes",
    drywall_partitions_ceilings: "Drywall, partitions & ceilings",
    doors_windows_openings: "Doors, windows & openings",
    electrical_fixtures: "Electrical & lighting fixtures",
    cable_conduit_runs: "Cable & conduit runs",
    other_legend_devices: "Other legend-coded devices",
    fixture_device_counts: "Fixture & legend-device counts",
  },
  es: {
    flooring_finishes: "Suelos y acabados",
    drywall_partitions_ceilings: "Tabiquería, pladur y techos",
    doors_windows_openings: "Puertas, ventanas y huecos",
    electrical_fixtures: "Equipos eléctricos y luminarias",
    cable_conduit_runs: "Recorridos de cables y canalizaciones",
    other_legend_devices: "Otros dispositivos codificados en la leyenda",
    fixture_device_counts: "Recuento de equipos y dispositivos por leyenda",
  },
}

export const localizedJobStatusLabels: Record<
  Locale,
  Record<TakeoffJobStatus, string>
> = {
  en: {
    draft: "Draft",
    awaiting_upload: "Awaiting upload",
    ready: "Quote ready",
    queued: "Queued",
    processing: "Measuring",
    needs_review: "Review requested",
    completed: "Delivered",
    failed: "Needs attention",
    canceled: "Cancelled",
  },
  es: {
    draft: "Borrador",
    awaiting_upload: "Pendiente de carga",
    ready: "Presupuesto listo",
    queued: "En cola",
    processing: "Midiendo",
    needs_review: "Revisión solicitada",
    completed: "Entregado",
    failed: "Requiere atención",
    canceled: "Cancelado",
  },
}

const spanishPriceCopy: Record<
  TakeoffPricingTier,
  Pick<TakeoffPrice, "name" | "description">
> = {
  free_sample: {
    name: "Muestra de una hoja",
    description:
      "Una hoja real con leyenda legible y un alcance, una vez por empresa.",
  },
  first_verified: {
    name: "Primera medición verificada",
    description: "Un alcance basado en leyenda y hasta 5 páginas de planos.",
  },
  essential: {
    name: "Esencial",
    description: "Un alcance basado en leyenda y hasta 10 páginas de planos.",
  },
  professional: {
    name: "Profesional",
    description: "Un alcance basado en leyenda y hasta 25 páginas de planos.",
  },
  multi_trade: {
    name: "Multialcance",
    description:
      "Recuentos de equipos y recorridos de cables o canalizaciones, hasta 25 páginas de planos.",
  },
  large_set: {
    name: "Proyecto grande",
    description:
      "Uno o ambos resultados basados en leyenda, hasta 250 páginas de planos.",
  },
}

export function localizeTakeoffPrice(
  price: TakeoffPrice,
  locale: Locale
): TakeoffPrice {
  return locale === "es"
    ? { ...price, ...spanishPriceCopy[price.tier] }
    : price
}

export function localizeSubscriptionPlanName(
  sku: string,
  name: string,
  locale: Locale
) {
  if (locale !== "es") return name
  if (sku === "team-monthly") return "Equipo"
  if (sku === "office-monthly") return "Oficina"
  return name
}

function splitPathSuffix(value: string) {
  const match = value.match(/^([^?#]*)(.*)$/)
  return {
    pathname: match?.[1] || "/",
    suffix: match?.[2] || "",
  }
}
