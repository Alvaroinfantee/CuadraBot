export const locales = ["en", "es"] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = "en"

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale)
}

export function localePath(locale: Locale, path = "/") {
  if (locale === defaultLocale) return path
  if (path === "/") return "/es"
  return `/es${path.startsWith("/") ? path : `/${path}`}`
}

export const commonCopy = {
  en: {
    startRender: "Start your render",
    viewPricing: "View pricing",
    pricing: "Pricing",
    packages: "Packages",
    gallery: "Gallery",
    examples: "Examples",
    whyCuadrabot: "Why Cuadrabot",
    howItWorks: "How it works",
    faq: "FAQ",
    terms: "Terms",
    privacy: "Privacy",
    refundPolicy: "Refund policy",
    logIn: "Log in",
    choose: "Choose",
    selectedPackage: "Selected package",
    views: "Views",
    revisions: "Revisions",
    estimate: "Estimate",
    dueToday: "Due today",
    businessDays: "business days",
    bestFor: "Best for",
    ready72: "First renders ready in 72 hours max.",
    blueprintToRender:
      "Blueprint-to-render visualization services for architects, developers, realtors, and homeowners.",
    serviceDisclaimer:
      "Cuadrabot provides visualization/rendering services only. It does not replace licensed architectural, engineering, permitting, or construction documentation services.",
  },
  es: {
    startRender: "Iniciar render",
    viewPricing: "Ver precios",
    pricing: "Precios",
    packages: "Paquetes",
    gallery: "Galería",
    examples: "Ejemplos",
    whyCuadrabot: "Por qué Cuadrabot",
    howItWorks: "Cómo funciona",
    faq: "FAQ",
    terms: "Términos",
    privacy: "Privacidad",
    refundPolicy: "Política de reembolso",
    logIn: "Acceso",
    choose: "Elegir",
    selectedPackage: "Paquete seleccionado",
    views: "Vistas",
    revisions: "Revisiones",
    estimate: "Estimación",
    dueToday: "Total de hoy",
    businessDays: "días hábiles",
    bestFor: "Ideal para",
    ready72: "Primeros renders listos en 72 horas máximo.",
    blueprintToRender:
      "Servicios de visualización de plano a render para arquitectos, promotores, agentes inmobiliarios y propietarios.",
    serviceDisclaimer:
      "Cuadrabot ofrece únicamente servicios de visualización/renderizado. No sustituye servicios profesionales de arquitectura, ingeniería, permisos ni documentación de construcción.",
  },
} satisfies Record<Locale, Record<string, string>>

type HomeCopy = {
  headline: string
  subheadline: string
  promise72: string
  scroll: string
  fullPricing: string
  exampleGallery: string
  moreExamples: string
  beforeAfter: string
  finalHeadline: string
  finalBody: string
  steps: [string, string][]
  reasons: [string, string][]
  faqs: [string, string][]
}

export const homeCopy = {
  en: {
    headline: "Architectural renders from your blueprints",
    subheadline:
      "Upload your floor plans, elevations, or sketches. Cuadrabot turns them into polished architectural renderings.",
    promise72: "First renders ready in 72 hours max.",
    scroll: "Scroll to explore",
    fullPricing: "View full pricing",
    exampleGallery: "Example gallery",
    moreExamples: "View more examples",
    beforeAfter: "Before / After",
    finalHeadline: "Ready to bring your project to life?",
    finalBody: "Upload your plans and get first renders ready in 72 hours max.",
    steps: [
      ["Upload your blueprint", "Send floor plans, elevations, sketches, PDFs, images, DWG, DXF, or ZIP files."],
      ["Choose your package", "Pick the rendering scope and delivery range that fits your project."],
      ["Pay securely", "Stripe Checkout confirms payment server-side before rendering starts."],
      ["Receive final renders", "Download finished images once they pass human review."],
    ],
    reasons: [
      ["Fast workflow", "A focused upload-to-payment flow gets your project queued quickly."],
      ["Secure file upload", "Private storage and signed URLs keep source plans controlled."],
      ["Online payment", "Stripe Checkout handles payment before rendering starts."],
      ["Human review", "Final images can be reviewed before customer delivery."],
      ["Built for property teams", "Architects, developers, realtors, and homeowners can order without long back-and-forth."],
    ],
    faqs: [
      ["What files can I upload?", "PDF, PNG, JPG/JPEG, DWG, DXF, and ZIP files are accepted for the MVP."],
      ["Do I need a finished architectural plan?", "No. Finished plans help, but sketches, elevations, and reference files can also be uploaded."],
      ["How long does it take?", "First renders are ready in 72 hours max. Full delivery depends on package scope and revisions."],
      ["Can I request revisions?", "Revision rounds depend on the selected package and are tracked with the order."],
      ["Are my files private?", "Yes. Uploads are stored in private Supabase Storage buckets and accessed through signed URLs."],
    ],
  },
  es: {
    headline: "Renders arquitectónicos a partir de tus planos",
    subheadline:
      "Sube plantas, elevaciones o bocetos. Cuadrabot los convierte en renders arquitectónicos pulidos.",
    promise72: "Primeros renders listos en 72 horas máximo.",
    scroll: "Desplázate para explorar",
    fullPricing: "Ver todos los precios",
    exampleGallery: "Galería de ejemplos",
    moreExamples: "Ver más ejemplos",
    beforeAfter: "Antes / Después",
    finalHeadline: "¿Listo para dar vida a tu proyecto?",
    finalBody: "Sube tus planos y recibe primeros renders listos en 72 horas máximo.",
    steps: [
      ["Sube tu plano", "Envía plantas, elevaciones, bocetos, PDF, imágenes, DWG, DXF o archivos ZIP."],
      ["Elige tu paquete", "Selecciona el alcance y plazo de entrega que encajan con tu proyecto."],
      ["Paga seguro", "Stripe Checkout confirma el pago en servidor antes de iniciar el renderizado."],
      ["Recibe los renders finales", "Descarga las imágenes terminadas después de la revisión humana."],
    ],
    reasons: [
      ["Flujo rápido", "Un proceso enfocado de subida y pago pone tu proyecto en cola rápidamente."],
      ["Subida segura", "El almacenamiento privado y las URLs firmadas mantienen tus planos bajo control."],
      ["Pago online", "Stripe Checkout gestiona el pago antes de iniciar el renderizado."],
      ["Revisión humana", "Las imágenes finales pueden revisarse antes de entregarse al cliente."],
      ["Para equipos inmobiliarios", "Arquitectos, promotores, agentes y propietarios pueden pedir renders sin idas y vueltas."],
    ],
    faqs: [
      ["¿Qué archivos puedo subir?", "El MVP acepta PDF, PNG, JPG/JPEG, DWG, DXF y ZIP."],
      ["¿Necesito un plano arquitectónico terminado?", "No. Los planos terminados ayudan, pero también puedes subir bocetos, elevaciones y referencias."],
      ["¿Cuánto tarda?", "Los primeros renders están listos en 72 horas máximo. La entrega final depende del paquete y las revisiones."],
      ["¿Puedo pedir revisiones?", "Las rondas de revisión dependen del paquete elegido y se registran con el pedido."],
      ["¿Mis archivos son privados?", "Sí. Las subidas se guardan en buckets privados de Supabase Storage y se accede con URLs firmadas."],
    ],
  },
} satisfies Record<Locale, HomeCopy>

export type PackageDisplayCopy = {
  name: string
  description: string
  includes: string[]
  bestFor: string
  cta: string
  badge?: string
}

export const packageCopy = {
  en: {
    "basic-render": {
      name: "Basic Render",
      description: "One clear, polished view to validate your idea quickly.",
      includes: [
        "1 rendered view",
        "Standard quality",
        "Basic lighting and materials",
        "Delivery in 3-5 business days",
        "No revisions included",
      ],
      bestFor: "Early ideas, small renovations, and quick visualization.",
      cta: "Start with Basic",
    },
    "pro-render": {
      name: "Pro Render",
      description: "The most balanced option for presenting your project with more detail.",
      includes: [
        "2 rendered views",
        "Enhanced materials and lighting",
        "2 revision rounds",
        "Delivery in 3-5 business days",
        "Standard priority",
      ],
      bestFor:
        "Architects, designers, realtors, and owners who need a serious presentation.",
      cta: "Choose Pro",
      badge: "Most popular",
    },
    "premium-render-pack": {
      name: "Premium Render Pack",
      description: "Four views ready for presentation, sales, or client approval.",
      includes: [
        "4 rendered views",
        "Enhanced staging",
        "Premium materials, lighting, and composition",
        "2 revision rounds",
        "Delivery in 2-4 business days",
        "Final review before delivery",
      ],
      bestFor: "Real estate projects, commercial presentations, and professional proposals.",
      cta: "Choose Premium",
    },
  },
  es: {
    "basic-render": {
      name: "Render Básico",
      description: "Una vista clara y pulida para validar tu idea rápidamente.",
      includes: [
        "1 vista renderizada",
        "Calidad estándar",
        "Iluminación y materiales básicos",
        "Entrega en 3-5 días hábiles",
        "Sin revisiones incluidas",
      ],
      bestFor: "Ideas iniciales, remodelaciones pequeñas y visualización rápida.",
      cta: "Empezar con Básico",
    },
    "pro-render": {
      name: "Render Pro",
      description: "La opción más equilibrada para presentar tu proyecto con más detalle.",
      includes: [
        "2 vistas renderizadas",
        "Materiales e iluminación mejorados",
        "2 rondas de revisión",
        "Entrega en 3-5 días hábiles",
        "Prioridad estándar",
      ],
      bestFor:
        "Arquitectos, diseñadores, inmobiliarias y propietarios que necesitan una presentación seria.",
      cta: "Elegir Pro",
      badge: "Más popular",
    },
    "premium-render-pack": {
      name: "Pack Premium de Renders",
      description: "Cuatro vistas listas para presentación, venta o aprobación del cliente.",
      includes: [
        "4 vistas renderizadas",
        "Ambientación mejorada",
        "Materiales, iluminación y composición premium",
        "2 rondas de revisión",
        "Entrega en 2-4 días hábiles",
        "Revisión final antes de entrega",
      ],
      bestFor:
        "Proyectos inmobiliarios, presentaciones comerciales y propuestas profesionales.",
      cta: "Elegir Premium",
    },
  },
} satisfies Record<Locale, Record<string, PackageDisplayCopy>>

export function getPackageDisplay(
  locale: Locale,
  plan: {
    slug: string
    name: string
    description: string
    included_views?: number
    revision_rounds?: number
    estimated_delivery_days_min?: number
    estimated_delivery_days_max?: number
  }
): PackageDisplayCopy {
  const copyBySlug: Record<string, PackageDisplayCopy> = packageCopy[locale]
  const knownPackage = copyBySlug[plan.slug]

  if (knownPackage) return knownPackage

  const views = plan.included_views ?? 1
  const revisions = plan.revision_rounds ?? 0
  const minDays = plan.estimated_delivery_days_min ?? 3
  const maxDays = plan.estimated_delivery_days_max ?? 5

  return {
    name: plan.name,
    description: plan.description,
    includes:
      locale === "es"
        ? [
            `${views} ${views === 1 ? "vista renderizada" : "vistas renderizadas"}`,
            `${revisions} ${revisions === 1 ? "ronda de revisión" : "rondas de revisión"}`,
            `Entrega en ${minDays}-${maxDays} días hábiles`,
          ]
        : [
            `${views} rendered ${views === 1 ? "view" : "views"}`,
            `${revisions} ${revisions === 1 ? "revision round" : "revision rounds"}`,
            `Delivery in ${minDays}-${maxDays} business days`,
          ],
    bestFor:
      locale === "es"
        ? "Proyectos que necesitan una visualización arquitectónica clara."
        : "Projects that need a clear architectural visualization.",
    cta: commonCopy[locale].choose,
  }
}
