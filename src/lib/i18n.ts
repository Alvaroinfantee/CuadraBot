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
    startRender: "Start your takeoff",
    viewPricing: "Get a takeoff quote",
    pricing: "Pricing",
    projectQuote: "Takeoff quote",
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
    ready72: "Takeoff delivery in 7 days max.",
    blueprintToRender:
      "PDF blueprint takeoff services for contractors, developers, architects, and property teams.",
    serviceDisclaimer:
      "Cuadrabot provides quantity takeoff support only. It does not replace licensed architectural, engineering, permitting, estimating, or construction documentation services.",
  },
  es: {
    startRender: "Iniciar takeoff",
    viewPricing: "Cotizar takeoff",
    pricing: "Precios",
    projectQuote: "Cotizar takeoff",
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
    ready72: "Entrega del takeoff en 7 dias maximo.",
    blueprintToRender:
      "Servicios de takeoff desde planos PDF para contratistas, promotores, arquitectos y equipos inmobiliarios.",
    serviceDisclaimer:
      "Cuadrabot ofrece unicamente apoyo de quantity takeoff. No sustituye servicios profesionales de arquitectura, ingenieria, permisos, estimacion ni documentacion de construccion.",
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
    headline: "Construction takeoffs from your blueprint PDFs",
    subheadline:
      "Upload scaled PDF plans. Cuadrabot quotes instantly by page and delivers a clean takeoff package after review.",
    promise72: "Takeoff delivery in 7 days max.",
    scroll: "Scroll to quote",
    fullPricing: "Open takeoff quote",
    exampleGallery: "Takeoff workflow",
    moreExamples: "View takeoff quote",
    beforeAfter: "Plan / Takeoff",
    finalHeadline: "Ready to price the quantities?",
    finalBody: "Upload your PDF plans, get an instant takeoff quote, and check out securely.",
    steps: [
      ["Upload your PDF plans", "Send scaled blueprint PDFs for the areas you need measured."],
      ["Get an instant quote", "The takeoff price is calculated by detected PDF page count."],
      ["Pay securely", "Stripe Checkout confirms payment server-side before production starts."],
      ["Receive the final takeoff", "Download the reviewed takeoff package from your private order page."],
    ],
    reasons: [
      ["Fast workflow", "Upload PDFs, see the price, and get the job queued quickly."],
      ["Secure file upload", "Private storage and signed URLs keep source plans controlled."],
      ["Online payment", "Stripe Checkout handles payment before takeoff work starts."],
      ["Human review", "Final takeoff files can be reviewed before customer delivery."],
      ["Built for project teams", "Contractors, developers, architects, and property teams can order without long back-and-forth."],
    ],
    faqs: [
      ["What files can I upload?", "Public takeoff orders currently accept PDF blueprint files only."],
      ["Do the plans need scale?", "Yes. The PDFs should include a clear scale or enough dimensions to measure correctly."],
      ["How long does it take?", "Takeoff delivery is 7 days max after payment and usable plan files are received."],
      ["What can I request?", "Use the notes field to specify the quantities, materials, areas, or priorities you need measured."],
      ["Are my files private?", "Yes. Uploads are stored in private Supabase Storage buckets and accessed through signed URLs."],
    ],
  },
  es: {
    headline: "Takeoffs de construccion desde tus planos PDF",
    subheadline:
      "Sube planos PDF con escala. Cuadrabot cotiza al instante por pagina y entrega un takeoff revisado.",
    promise72: "Entrega del takeoff en 7 dias maximo.",
    scroll: "Desplazate para cotizar",
    fullPricing: "Abrir cotizador de takeoff",
    exampleGallery: "Flujo de takeoff",
    moreExamples: "Ver cotizador",
    beforeAfter: "Plano / Takeoff",
    finalHeadline: "Listo para medir cantidades?",
    finalBody: "Sube tus planos PDF, recibe una cotizacion instantanea y paga de forma segura.",
    steps: [
      ["Sube tus planos PDF", "Envia PDFs con escala de las areas que necesitas medir."],
      ["Recibe cotizacion instantanea", "El precio del takeoff se calcula por paginas detectadas en el PDF."],
      ["Paga seguro", "Stripe Checkout confirma el pago en servidor antes de iniciar produccion."],
      ["Recibe el takeoff final", "Descarga el paquete revisado desde tu pagina privada de pedido."],
    ],
    reasons: [
      ["Flujo rapido", "Sube PDFs, ve el precio y deja el trabajo en cola rapidamente."],
      ["Subida segura", "El almacenamiento privado y las URLs firmadas mantienen tus planos bajo control."],
      ["Pago online", "Stripe Checkout gestiona el pago antes de iniciar el takeoff."],
      ["Revision humana", "Los archivos finales pueden revisarse antes de entregarse al cliente."],
      ["Para equipos de proyecto", "Contratistas, promotores, arquitectos y equipos inmobiliarios pueden pedir takeoffs sin idas y vueltas."],
    ],
    faqs: [
      ["Que archivos puedo subir?", "Los pedidos publicos de takeoff aceptan actualmente planos en PDF."],
      ["Los planos necesitan escala?", "Si. Los PDFs deben incluir una escala clara o cotas suficientes para medir correctamente."],
      ["Cuanto tarda?", "La entrega del takeoff es de 7 dias maximo despues del pago y de recibir planos utilizables."],
      ["Que puedo pedir?", "Usa las notas para indicar cantidades, materiales, areas o prioridades que necesitas medir."],
      ["Mis archivos son privados?", "Si. Las subidas se guardan en buckets privados de Supabase Storage y se accede con URLs firmadas."],
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
