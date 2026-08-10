import {
  localeTag,
  type Locale,
} from "@/lib/i18n"

const englishDashboardCopy = {
  metadata: {
    workspace: "Workspace",
    jobs: "Takeoffs",
    jobDetails: "Takeoff details",
    correction: "Request a correction",
    newTakeoff: "New takeoff",
    billing: "Credits and billing",
    settings: "Company settings",
  },
  overview: {
    eyebrow: "Customer workspace",
    title: "Your legend takeoff desk",
    description:
      "Upload PDF plan sets with readable legends, follow automated code mapping and counting, and download source-linked results in hours.",
    newTakeoff: "New takeoff",
    availableCredits: "Available credits",
    usedAllTime: "used all time",
    inProgress: "In progress",
    processingQueue: "Self-serve processing queue",
    delivered: "Delivered",
    deliveredNote: "Marked PDF and workbook",
    billingPlan: "Billing plan",
    active: "Active",
    payAsYouGo: "Pay as you go",
    cancelsAtPeriodEnd: "Cancels at period end",
    noSeatLicense: "No seat license required",
    recentTakeoffs: "Recent takeoffs",
    viewAll: "View all",
    sampleBadge: "Included once per company",
    sampleTitle: "Try one sheet free",
    sampleBody:
      "Pick one legend-based scope and a sheet where its legend is visible. We will return a marked PDF and quantity workbook through the same automated workflow as paid work.",
    sampleCta: "Start free sample",
    emptyTitle: "No takeoffs yet",
    emptyBody:
      "Upload your first PDF plan set with a readable legend to receive a fixed credit quote.",
    emptyCta: "Create a takeoff",
  },
  jobs: {
    eyebrow: "Project register",
    title: "Takeoffs",
    description:
      "Every plan set, status transition, credit charge, and verified deliverable in one place.",
    newTakeoff: "New takeoff",
    project: "Project",
    status: "Status",
    scope: "Scope",
    pages: "Pages",
    credits: "Credits",
    created: "Created",
    empty: "No takeoffs yet.",
  },
  detail: {
    freeSample: "Free sample",
    verifiedTakeoff: "Verified takeoff",
    created: "Created",
    planPages: "plan pages",
    credits: "credits",
    attentionTitle: "This job needs attention",
    failureFallback:
      "The processing team has been notified. Reserved credits will be released for system failures.",
    progress: "Progress",
    planVerified: "Plan verified",
    measured: "Legend mapped",
    outputValidated: "Output validated",
    delivered: "Delivered",
    currentStage: "Current stage",
    deliverables: "Deliverables",
    verifiedOutput: "Verified output",
    annotatedBlueprintTitle: "Annotated blueprint PDF",
    annotatedBlueprintBody:
      "Counted fixtures and measured runs are marked on the drawing so you can review where each quantity came from.",
    countWorkbookTitle: "Excel count workbook",
    countWorkbookBody:
      "Quantities organized by legend code, sheet, and area for estimating and review.",
    processingTitle: "Processing is still in progress",
    processingBody:
      "The annotated blueprint PDF and Excel count workbook will appear here when processing completes.",
    legendSummary: "Legend reconciliation",
    legendEntries: "Legend entries",
    mappedPlacements: "Counted placements",
    measuredRuns: "Measured runs",
    unresolvedSymbols: "Unresolved symbols",
    legendCoverage: "Mapped coverage",
    legendCoverageBody:
      "Coverage compares mapped items with explicitly unresolved symbols. Review unresolved items and limitations before using quantities.",
    scope: "Scope",
    trades: "Takeoff categories",
    instructions: "Instructions",
    noInstructions: "No additional instructions.",
    reserved: "Reserved",
    charged: "Charged",
    originalArchive: "Original plan archive",
    privateArchive: "private source storage",
    checksumRegistered: "checksum registered",
    deletionTitle: "Deletion requested",
    deletionBody:
      "Customer download is paused while the approved deletion workflow is completed.",
    sourceUnavailableTitle: "Source temporarily unavailable",
    sourceUnavailableBody: "The integrity monitor has alerted support.",
    downloadOriginal: "Download original plan",
    activity: "Activity",
    activityFallback:
      "Activity will appear as the job moves through the queue.",
    activityUpdate: "Takeoff status updated.",
    requestCorrection: "Request included correction",
  },
  correction: {
    eyebrow: "Included support",
    title: "Request a correction",
    descriptionStart: "Describe one in-scope correction for",
    descriptionEnd:
      "New documents, revisions, or added legend scope require a new quote.",
    details: "Correction details",
    alreadyTitle: "Correction already requested",
    alreadyBody:
      "The request is in the support queue. You can follow its status on the takeoff page.",
    incompleteTitle: "Delivery is not complete",
    incompleteBody:
      "A correction can be requested after the verified files are delivered.",
    closedTitle: "Included correction window closed",
    closedStart: "Included corrections are available for",
    closedEnd:
      "days after delivery while the original project files are retained. Start a new takeoff for revised or additional work.",
    placeholder:
      "Identify the sheet, code or area, what you expected, and why. Keep the request within the approved scope and original plan set.",
    submit: "Send correction request",
  },
  newTakeoff: {
    eyebrow: "New project",
    title: "Upload a legend-based plan set",
    description:
      "Choose fixture and legend-device counts, cable or conduit runs, or both. Supported sets remain self-serve up to 250 pages, with delivery in hours.",
    pausedTitle: "New takeoffs are temporarily paused",
    pausedBody:
      "New takeoff actions are temporarily unavailable. Please try again later.",
  },
  form: {
    projectAndScope: "Project and scope",
    verifiedTakeoff: "Verified takeoff",
    verifiedTakeoffBody: "Fixed credit quote after server verification.",
    freeSample: "Free one-sheet sample",
    available: "Available",
    used: "Used",
    freeSampleBody: "One legend-based scope, once per company.",
    projectName: "Project name",
    projectPlaceholder: "Northside retail fit-out",
    measurePrompt: "What should Cuadrabot extract?",
    scopeRequirementsTitle: "Legend and route requirements",
    scopeRequirementsBody:
      "The PDF must include a readable legend or schedule for selected codes. Cable or conduit quantities also require a visible route and a stated usable scale. Ambiguous items are flagged rather than guessed.",
    planSet: "PDF plan set with a readable legend",
    chooseFile: "Choose a plan set or drop it here",
    fileLimitStart: "PDF only · up to",
    fileLimitEnd: "MB · 250 pages",
    samplePage: "Sheet/page to count",
    samplePageBody:
      "We will process only this PDF page for the free sample. Its applicable legend or schedule must be visible on the same sheet.",
    instructions: "Instructions and assumptions",
    instructionsPlaceholder:
      "Legend sheet or page, codes to include, demolition or alternates to exclude, areas, levels, and naming rules...",
    verifying: "Verifying the plan set",
    cancelUpload: "Cancel upload",
    uploadCancelled: "Upload paused. Submit again to resume it.",
    uploadQuote: "Upload and get fixed quote",
    fixedQuote: "Fixed quote",
    credits: "credits",
    verifiedPages: "Verified pages",
    availableCredits: "Available",
    deliveryTarget: "Delivery target",
    inHours: "In hours",
    includedDeliverables: "Included with this quote",
    annotatedPdfIncluded: "Annotated blueprint PDF",
    annotatedPdfIncludedBody:
      "The source drawing with every counted fixture and measured run marked for review.",
    workbookIncluded: "Excel count workbook",
    workbookIncludedBody:
      "The verified quantities organized by legend code, sheet, and area.",
    moreCreditsTitle: "More credits required",
    addCreditsStart: "Add",
    addCreditsEnd: "credits to confirm this takeoff.",
    reserveAndStart: "Reserve credits and start",
    addCredits: "Add credits",
    noEstimateTitle: "No browser-estimated charges",
    noEstimateBody:
      "Cuadrabot verifies the uploaded object and actual PDF page count before showing the price. Unresolved or ambiguous legend codes are flagged rather than guessed.",
    privateStorage: "Private object storage",
    pageVerification:
      "Readable legend required · visible route and stated scale required for measured runs",
    automatedValidation: "Automated validation before delivery",
    invalidPdf: "Upload a PDF plan set.",
    createError: "Could not create the takeoff.",
    verifyError: "Could not verify the plan set.",
    verifiedToast: "Plan set verified. Review the fixed quote.",
    genericError: "Something went wrong.",
    queueError: "Could not queue the takeoff.",
    queuedToast: "Takeoff queued.",
    insufficientStart: "You need",
    insufficientEnd: "credits. Add credits before confirming.",
  },
  billing: {
    eyebrow: "Billing",
    title: "Credits and plans",
    description:
      "Buy reusable credits or subscribe for a monthly allocation. Plans are optional, there are no seat licenses, and usage is never unlimited.",
    pausedTitle: "New purchases are temporarily paused",
    pausedBody:
      "New billing actions are temporarily unavailable. Please try again later.",
    available: "Available",
    readyToReserve: "Ready to reserve",
    grantedAllTime: "Granted all time",
    grantsNote: "Packs, plans, and adjustments",
    usedAllTime: "Used all time",
    settledTakeoffs: "Settled takeoffs",
    monthlyPlans: "Monthly plans",
    monthlyBody:
      "Credits grant after each successfully paid invoice. Launch credits do not expire.",
    mostFlexible: "Most flexible",
    perMonth: "per month",
    creditsEachMonth: "credits each month",
    noExpiry: "No launch credit expiry",
    cancelAtPeriodEnd: "Cancel at period end",
    choose: "Choose",
    creditPacks: "Credit packs",
    packsBody:
      "Best for occasional or seasonal bid volume. Launch credits do not expire.",
    oneTime: "one time",
    includes: "Includes",
    bonusCredits: "bonus credits",
    buy: "Buy",
    stripeNote:
      "Stripe hosts payment collection and the billing portal. Cuadrabot grants internal takeoff credits only after a signed payment webhook; returning from Checkout never grants credits by itself.",
    starterPack: "Starter pack",
    growthPack: "Growth pack",
    officePack: "Office pack",
    manageBilling: "Manage billing",
    checkoutSuccessTitle: "Payment confirmed",
    checkoutSuccessBody:
      "Stripe confirmed the payment. Credits are granted only by the signed webhook and may take a moment to appear.",
    checkoutConfirmingTitle: "Payment is still confirming",
    checkoutConfirmingBody:
      "We could not verify this Checkout return yet. Refresh this page shortly; no credits are granted from the return URL itself.",
    checkoutCancelledTitle: "Checkout cancelled",
    checkoutCancelledBody: "No payment was completed and no credits were changed.",
    checkoutUnavailable: "Checkout is not available.",
    checkoutFailed: "Checkout failed.",
    portalUnavailable: "Billing portal is not available.",
    portalFailed: "Could not open billing.",
  },
  settings: {
    eyebrow: "Workspace profile",
    title: "Company settings",
    description:
      "Keep contact and coarse location information accurate for support, tax operations, and regional reporting.",
    saved: "Company settings saved.",
    profile: "Profile",
    yourName: "Your name",
    company: "Company",
    countryCode: "Country code",
    region: "Region / state",
    city: "City",
    timezone: "Timezone",
    ageBand: "Optional age range",
    ageNotShared: "Prefer not to share",
    ageConsent:
      "I voluntarily allow Cuadrabot to use this age range in aggregated marketing analysis.",
    ageHelp:
      "We never infer your age. Leave this unchecked to remove any previously shared age range.",
    save: "Save profile",
    privacyTitle: "Privacy and account requests",
    privacyBody:
      "Request a copy, correction, deletion, or account closure by emailing from the account address. We verify identity and retain billing records where law requires.",
    privacyEmail: "Email privacy@cuadrabot.com",
    privacySubject: "Cuadrabot data request",
  },
  actions: {
    requiredName: "Name and company are required.",
    countryCode: "Use a two-letter country code.",
    profileSaveError: "Company settings could not be saved.",
    correctionLength:
      "Describe the correction in 10 to 4,000 characters.",
    correctionSaveError: "The correction request could not be saved.",
    cleanupBusy:
      "Generated files are in an active cleanup operation. Refresh and try again shortly.",
  },
} as const

type LocalizedCopy<T> = T extends string
  ? string
  : { [K in keyof T]: LocalizedCopy<T[K]> }

export type DashboardCopy = LocalizedCopy<typeof englishDashboardCopy>

const spanishDashboardCopy = {
  metadata: {
    workspace: "Espacio de trabajo",
    jobs: "Mediciones",
    jobDetails: "Detalles de la medición",
    correction: "Solicitar una corrección",
    newTakeoff: "Nueva medición",
    billing: "Créditos y facturación",
    settings: "Datos de la empresa",
  },
  overview: {
    eyebrow: "Espacio de trabajo del cliente",
    title: "Tu mesa de mediciones por leyenda",
    description:
      "Sube planos PDF con leyendas legibles, sigue el mapeo y recuento automatizado de códigos y descarga resultados vinculados al plano en cuestión de horas.",
    newTakeoff: "Nueva medición",
    availableCredits: "Créditos disponibles",
    usedAllTime: "utilizados en total",
    inProgress: "En curso",
    processingQueue: "Cola de procesamiento autoservicio",
    delivered: "Entregadas",
    deliveredNote: "PDF marcado y libro Excel",
    billingPlan: "Plan de facturación",
    active: "Activo",
    payAsYouGo: "Pago por uso",
    cancelsAtPeriodEnd: "Se cancela al final del periodo",
    noSeatLicense: "Sin licencia por usuario",
    recentTakeoffs: "Mediciones recientes",
    viewAll: "Ver todas",
    sampleBadge: "Incluida una vez por empresa",
    sampleTitle: "Prueba una hoja gratis",
    sampleBody:
      "Elige un alcance basado en leyenda y una hoja donde la leyenda sea visible. Recibirás un PDF marcado y un libro de cantidades mediante el mismo flujo automatizado que los trabajos de pago.",
    sampleCta: "Iniciar muestra gratuita",
    emptyTitle: "Aún no hay mediciones",
    emptyBody:
      "Carga tu primer juego de planos PDF con una leyenda legible para recibir un presupuesto fijo en créditos.",
    emptyCta: "Crear una medición",
  },
  jobs: {
    eyebrow: "Registro de proyectos",
    title: "Mediciones",
    description:
      "Todos los planos, cambios de estado, cargos de créditos y entregables verificados en un solo lugar.",
    newTakeoff: "Nueva medición",
    project: "Proyecto",
    status: "Estado",
    scope: "Alcance",
    pages: "Páginas",
    credits: "Créditos",
    created: "Creada",
    empty: "Aún no hay mediciones.",
  },
  detail: {
    freeSample: "Muestra gratuita",
    verifiedTakeoff: "Medición verificada",
    created: "Creada",
    planPages: "páginas de planos",
    credits: "créditos",
    attentionTitle: "Esta medición requiere atención",
    failureFallback:
      "Se ha avisado al equipo de soporte. Los créditos reservados se liberarán si se trata de un fallo del sistema.",
    progress: "Progreso",
    planVerified: "Plano verificado",
    measured: "Leyenda relacionada",
    outputValidated: "Resultado validado",
    delivered: "Entregado",
    currentStage: "Etapa actual",
    deliverables: "Entregables",
    verifiedOutput: "Resultado verificado",
    annotatedBlueprintTitle: "PDF del plano anotado",
    annotatedBlueprintBody:
      "Los equipos contados y los recorridos medidos aparecen marcados en el plano para que puedas revisar el origen de cada cantidad.",
    countWorkbookTitle: "Recuento en Excel",
    countWorkbookBody:
      "Cantidades organizadas por código de leyenda, hoja y zona para presupuestar y revisar.",
    processingTitle: "El procesamiento sigue en curso",
    processingBody:
      "El PDF del plano anotado y el recuento en Excel aparecerán aquí cuando termine el procesamiento.",
    legendSummary: "Conciliación con la leyenda",
    legendEntries: "Entradas de leyenda",
    mappedPlacements: "Ubicaciones contadas",
    measuredRuns: "Recorridos medidos",
    unresolvedSymbols: "Símbolos sin resolver",
    legendCoverage: "Cobertura relacionada",
    legendCoverageBody:
      "La cobertura compara los elementos relacionados con los símbolos marcados como no resueltos. Revisa los elementos no resueltos y las limitaciones antes de usar las cantidades.",
    scope: "Alcance",
    trades: "Categorías de medición",
    instructions: "Instrucciones",
    noInstructions: "Sin instrucciones adicionales.",
    reserved: "Reservados",
    charged: "Cobrados",
    originalArchive: "Archivo del plano original",
    privateArchive: "almacenamiento privado del original",
    checksumRegistered: "huella digital registrada",
    deletionTitle: "Eliminación solicitada",
    deletionBody:
      "La descarga está pausada mientras se completa el proceso de eliminación aprobado.",
    sourceUnavailableTitle: "Original no disponible temporalmente",
    sourceUnavailableBody:
      "El control de integridad ha avisado al equipo de soporte.",
    downloadOriginal: "Descargar plano original",
    activity: "Actividad",
    activityFallback:
      "La actividad aparecerá a medida que la medición avance por la cola.",
    activityUpdate: "Se ha actualizado el estado de la medición.",
    requestCorrection: "Solicitar la corrección incluida",
  },
  correction: {
    eyebrow: "Soporte incluido",
    title: "Solicitar una corrección",
    descriptionStart: "Describe una corrección dentro del alcance para",
    descriptionEnd:
      "Los documentos nuevos, las revisiones o un alcance adicional de leyenda requieren otro presupuesto.",
    details: "Detalles de la corrección",
    alreadyTitle: "Corrección ya solicitada",
    alreadyBody:
      "La solicitud está en la cola de soporte. Puedes seguir su estado en la página de la medición.",
    incompleteTitle: "La entrega aún no está completa",
    incompleteBody:
      "Puedes solicitar una corrección después de que se entreguen los archivos verificados.",
    closedTitle: "El plazo de corrección incluida ha terminado",
    closedStart: "Las correcciones incluidas están disponibles durante",
    closedEnd:
      "días después de la entrega mientras se conserven los archivos originales del proyecto. Crea una nueva medición para trabajos revisados o adicionales.",
    placeholder:
      "Indica la hoja, el código o la zona, qué esperabas y por qué. Mantén la solicitud dentro del alcance aprobado y del juego de planos original.",
    submit: "Enviar solicitud de corrección",
  },
  newTakeoff: {
    eyebrow: "Nuevo proyecto",
    title: "Carga planos con leyenda",
    description:
      "Elige recuentos de equipos y dispositivos por leyenda, recorridos de cables o canalizaciones, o ambos. Los proyectos compatibles siguen siendo autoservicio hasta 250 páginas, con entrega en horas.",
    pausedTitle: "Las nuevas mediciones están pausadas temporalmente",
    pausedBody:
      "Las nuevas mediciones no están disponibles temporalmente. Inténtalo de nuevo más tarde.",
  },
  form: {
    projectAndScope: "Proyecto y alcance",
    verifiedTakeoff: "Medición verificada",
    verifiedTakeoffBody:
      "Presupuesto fijo en créditos tras la verificación en el servidor.",
    freeSample: "Muestra gratuita de una hoja",
    available: "Disponible",
    used: "Utilizada",
    freeSampleBody: "Un alcance basado en leyenda, una vez por empresa.",
    projectName: "Nombre del proyecto",
    projectPlaceholder: "Reforma de local en Gran Vía",
    measurePrompt: "¿Qué debe extraer Cuadrabot?",
    scopeRequirementsTitle: "Requisitos de leyenda y recorrido",
    scopeRequirementsBody:
      "El PDF debe incluir una leyenda o cuadro legible para los códigos seleccionados. Las cantidades de cables o canalizaciones también requieren una ruta visible y una escala utilizable indicada. Los elementos ambiguos se señalan, no se adivinan.",
    planSet: "Juego de planos PDF con leyenda legible",
    chooseFile: "Elige un juego de planos o arrástralo aquí",
    fileLimitStart: "Solo PDF · hasta",
    fileLimitEnd: "MB · 250 páginas",
    samplePage: "Hoja o página que se contará",
    samplePageBody:
      "Para la muestra gratuita solo procesaremos esta página del PDF. La leyenda o cuadro aplicable debe estar visible en la misma hoja.",
    instructions: "Instrucciones y supuestos",
    instructionsPlaceholder:
      "Hoja o página de la leyenda, códigos que incluir, demoliciones o alternativas que excluir, zonas, niveles y reglas de nombres...",
    verifying: "Verificando los planos",
    cancelUpload: "Cancelar carga",
    uploadCancelled:
      "Carga pausada. Envíala de nuevo para reanudarla.",
    uploadQuote: "Cargar y obtener presupuesto fijo",
    fixedQuote: "Presupuesto fijo",
    credits: "créditos",
    verifiedPages: "Páginas verificadas",
    availableCredits: "Disponibles",
    deliveryTarget: "Objetivo de entrega",
    inHours: "En cuestión de horas",
    includedDeliverables: "Incluido en este presupuesto",
    annotatedPdfIncluded: "PDF del plano anotado",
    annotatedPdfIncludedBody:
      "El plano original con cada equipo contado y recorrido medido marcado para su revisión.",
    workbookIncluded: "Recuento en Excel",
    workbookIncludedBody:
      "Las cantidades verificadas organizadas por código de leyenda, hoja y zona.",
    moreCreditsTitle: "Se necesitan más créditos",
    addCreditsStart: "Añade",
    addCreditsEnd: "créditos para confirmar esta medición.",
    reserveAndStart: "Reservar créditos y comenzar",
    addCredits: "Añadir créditos",
    noEstimateTitle: "Sin cargos calculados en el navegador",
    noEstimateBody:
      "Cuadrabot verifica el archivo cargado y el número real de páginas del PDF antes de mostrar el precio. Los códigos de leyenda ambiguos o sin resolver se señalan, no se adivinan.",
    privateStorage: "Almacenamiento privado",
    pageVerification:
      "Leyenda legible obligatoria · ruta visible y escala indicada para recorridos medidos",
    automatedValidation: "Validación automática antes de la entrega",
    invalidPdf: "Carga un juego de planos en PDF.",
    createError: "No se pudo crear la medición.",
    verifyError: "No se pudieron verificar los planos.",
    verifiedToast:
      "Planos verificados. Revisa el presupuesto fijo.",
    genericError: "Se ha producido un error.",
    queueError: "No se pudo añadir la medición a la cola.",
    queuedToast: "Medición añadida a la cola.",
    insufficientStart: "Necesitas",
    insufficientEnd:
      "créditos. Añade créditos antes de confirmar.",
  },
  billing: {
    eyebrow: "Facturación",
    title: "Créditos y planes",
    description:
      "Compra créditos reutilizables o suscríbete para recibir una asignación mensual. Los planes son opcionales, no hay licencias por usuario y el uso nunca es ilimitado.",
    pausedTitle: "Las nuevas compras están pausadas temporalmente",
    pausedBody:
      "Las nuevas compras no están disponibles temporalmente. Inténtalo de nuevo más tarde.",
    available: "Disponibles",
    readyToReserve: "Listos para reservar",
    grantedAllTime: "Concedidos en total",
    grantsNote: "Paquetes, planes y ajustes",
    usedAllTime: "Utilizados en total",
    settledTakeoffs: "Mediciones liquidadas",
    monthlyPlans: "Planes mensuales",
    monthlyBody:
      "Los créditos se conceden después de cada factura pagada correctamente. Los créditos de lanzamiento no caducan.",
    mostFlexible: "Más flexible",
    perMonth: "al mes",
    creditsEachMonth: "créditos al mes",
    noExpiry: "Sin caducidad durante el lanzamiento",
    cancelAtPeriodEnd: "Cancelación al final del periodo",
    choose: "Elegir",
    creditPacks: "Paquetes de créditos",
    packsBody:
      "La mejor opción para un volumen de ofertas ocasional o estacional. Los créditos de lanzamiento no caducan.",
    oneTime: "pago único",
    includes: "Incluye",
    bonusCredits: "créditos de bonificación",
    buy: "Comprar",
    stripeNote:
      "Stripe gestiona el cobro y el portal de facturación. Cuadrabot solo concede créditos internos después de recibir una notificación de pago firmada; volver desde Checkout no concede créditos por sí solo.",
    starterPack: "Paquete Inicial",
    growthPack: "Paquete Crecimiento",
    officePack: "Paquete Oficina",
    manageBilling: "Gestionar facturación",
    checkoutSuccessTitle: "Pago confirmado",
    checkoutSuccessBody:
      "Stripe ha confirmado el pago. Los créditos solo se conceden mediante la notificación firmada y pueden tardar un momento en aparecer.",
    checkoutConfirmingTitle: "El pago todavía se está confirmando",
    checkoutConfirmingBody:
      "Todavía no hemos podido verificar este retorno de Checkout. Actualiza la página en unos instantes; la URL de retorno nunca concede créditos por sí sola.",
    checkoutCancelledTitle: "Checkout cancelado",
    checkoutCancelledBody: "No se ha completado ningún pago ni se han modificado créditos.",
    checkoutUnavailable: "El proceso de pago no está disponible.",
    checkoutFailed: "No se pudo abrir el proceso de pago.",
    portalUnavailable: "El portal de facturación no está disponible.",
    portalFailed: "No se pudo abrir la facturación.",
  },
  settings: {
    eyebrow: "Perfil del espacio de trabajo",
    title: "Datos de la empresa",
    description:
      "Mantén actualizados los datos de contacto y ubicación general para soporte, operaciones fiscales e informes regionales.",
    saved: "Se han guardado los datos de la empresa.",
    profile: "Perfil",
    yourName: "Tu nombre",
    company: "Empresa",
    countryCode: "Código de país",
    region: "Región o provincia",
    city: "Ciudad",
    timezone: "Zona horaria",
    ageBand: "Rango de edad opcional",
    ageNotShared: "Prefiero no compartirlo",
    ageConsent:
      "Autorizo voluntariamente a Cuadrabot a utilizar este rango de edad en análisis de marketing agregados.",
    ageHelp:
      "Nunca inferimos tu edad. Deja esta casilla sin marcar para eliminar cualquier rango compartido anteriormente.",
    save: "Guardar perfil",
    privacyTitle: "Privacidad y solicitudes sobre la cuenta",
    privacyBody:
      "Solicita una copia, corrección, eliminación o cierre de la cuenta escribiendo desde la dirección asociada. Verificamos la identidad y conservamos los registros de facturación cuando la ley lo exige.",
    privacyEmail: "Escribir a privacy@cuadrabot.com",
    privacySubject: "Solicitud de datos de Cuadrabot",
  },
  actions: {
    requiredName: "El nombre y la empresa son obligatorios.",
    countryCode: "Usa un código de país de dos letras.",
    profileSaveError: "No se pudieron guardar los datos de la empresa.",
    correctionLength:
      "Describe la corrección con entre 10 y 4.000 caracteres.",
    correctionSaveError:
      "No se pudo guardar la solicitud de corrección.",
    cleanupBusy:
      "Los archivos generados están en un proceso de limpieza activo. Actualiza la página e inténtalo de nuevo en unos instantes.",
  },
} satisfies DashboardCopy

export const dashboardCopy: Record<Locale, DashboardCopy> = {
  en: englishDashboardCopy,
  es: spanishDashboardCopy,
}

export function formatDashboardDate(
  value: string,
  locale: Locale,
  includeTime = false
) {
  return new Intl.DateTimeFormat(localeTag(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "numeric",
          minute: "2-digit",
        }
      : {}),
  }).format(new Date(value))
}

export function formatDashboardNumber(value: number, locale: Locale) {
  return value.toLocaleString(localeTag(locale))
}

export function formatUsd(valueInCents: number, locale: Locale) {
  return new Intl.NumberFormat(localeTag(locale), {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(valueInCents / 100)
}

export function formatPlanPages(value: number, locale: Locale) {
  if (locale === "es") {
    return `${formatDashboardNumber(value, locale)} ${
      value === 1 ? "página" : "páginas"
    }`
  }
  return `${formatDashboardNumber(value, locale)} ${
    value === 1 ? "page" : "pages"
  }`
}

export function formatTrades(value: number, locale: Locale) {
  if (locale === "es") {
    return `${formatDashboardNumber(value, locale)} ${
      value === 1 ? "alcance" : "alcances"
    }`
  }
  return `${formatDashboardNumber(value, locale)} ${
    value === 1 ? "scope" : "scopes"
  }`
}

const englishStages: Record<string, string> = {
  draft: "Draft",
  awaiting_upload: "Awaiting upload",
  plan_verified: "Plan verified",
  queued: "Queued",
  claimed: "Preparing processing",
  input_download: "Downloading the source plan",
  takeoff_processing: "Reading legends and counting placements",
  takeoff_queued: "Queued for legend-based takeoff",
  takeoff_codex_analysis: "Mapping legend codes and symbols",
  takeoff_replay_validation: "Validating the result",
  takeoff_takeoff_validation: "Reconciling quantities by legend code",
  takeoff_pdf_annotation: "Marking the PDF",
  takeoff_completed: "Preparing delivery",
  artifact_upload: "Uploading deliverables",
  delivery: "Preparing delivery",
  delivered: "Delivered",
  correction_requested: "Correction requested",
  rework_queued: "Correction queued",
  retry_queued: "Retry queued",
  stale_claim: "Retry queued",
  stale_claim_exhausted: "Processing stopped",
  canceled: "Canceled",
  upload_expired: "Upload expired",
}

const spanishStages: Record<string, string> = {
  draft: "Borrador",
  awaiting_upload: "Pendiente de carga",
  plan_verified: "Plano verificado",
  queued: "En cola",
  claimed: "Preparando el procesamiento",
  input_download: "Descargando el plano original",
  takeoff_processing: "Leyendo leyendas y contando ubicaciones",
  takeoff_queued: "En cola para la medición por leyenda",
  takeoff_codex_analysis: "Relacionando códigos y símbolos de la leyenda",
  takeoff_replay_validation: "Validando el resultado",
  takeoff_takeoff_validation: "Conciliando cantidades por código de leyenda",
  takeoff_pdf_annotation: "Marcando el PDF",
  takeoff_completed: "Preparando la entrega",
  artifact_upload: "Cargando los entregables",
  delivery: "Preparando la entrega",
  delivered: "Entregado",
  correction_requested: "Corrección solicitada",
  rework_queued: "Corrección en cola",
  retry_queued: "Reintento en cola",
  stale_claim: "Reintento en cola",
  stale_claim_exhausted: "Procesamiento detenido",
  canceled: "Cancelado",
  upload_expired: "Carga caducada",
}

export function localizeJobStage(stage: string, locale: Locale) {
  const known = locale === "es" ? spanishStages[stage] : englishStages[stage]
  if (known) return known
  return locale === "es"
    ? "Procesando la medición"
    : stage.replaceAll("_", " ")
}

function metadataNumber(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function localizeJobEvent(input: {
  eventType: string
  message: string | null
  metadata?: Record<string, unknown> | null
  locale: Locale
}) {
  if (input.locale === "en") {
    return (
      input.message ??
      englishJobEventFallback[input.eventType] ??
      input.eventType.replaceAll("_", " ")
    )
  }

  const credits = metadataNumber(input.metadata, "credits")
  switch (input.eventType) {
    case "draft_created":
      return "Borrador creado; pendiente de la carga del plano."
    case "plan_verified":
      return "Plano, formato PDF, número de páginas y presupuesto fijo verificados."
    case "free_sample_queued":
      return "Muestra gratuita añadida a la cola de procesamiento."
    case "credits_reserved":
      return credits === null
        ? "Créditos reservados para la medición."
        : `Se han reservado ${formatDashboardNumber(credits, "es")} créditos.`
    case "job_claimed":
      return "El procesador ha iniciado la medición."
    case "processing_progress": {
      const stage =
        typeof input.metadata?.stage === "string"
          ? localizeJobStage(input.metadata.stage, "es")
          : "Procesando la medición"
      return `${stage}.`
    }
    case "automation_completed":
      return "Medición automatizada completada y entregables publicados."
    case "credits_settled":
      return credits === null
        ? "Créditos liquidados tras la entrega."
        : `Se han liquidado ${formatDashboardNumber(credits, "es")} créditos.`
    case "credits_released":
      return credits === null
        ? "Se han liberado los créditos reservados."
        : `Se han liberado ${formatDashboardNumber(credits, "es")} créditos.`
    case "processing_retry_queued":
      return "Se ha programado otro intento de procesamiento."
    case "processing_failed":
      return "El procesamiento agotó los intentos disponibles y se liberaron los créditos reservados."
    case "correction_requested":
      return "Se ha solicitado la corrección incluida."
    case "takeoff_delivered":
      return "La corrección o excepción se ha resuelto y los archivos están disponibles."
    case "qa_rework_requested":
      return "La corrección se ha añadido a otra ejecución de procesamiento."
    case "takeoff_canceled":
      return "La medición se ha cancelado."
    case "upload_expired":
      return "La sesión de carga caducó y el archivo privado se programó para su eliminación."
    default:
      return dashboardCopy.es.detail.activityUpdate
  }
}

const englishJobEventFallback: Record<string, string> = {
  draft_created: "Takeoff draft created; waiting for the plan upload.",
  plan_verified:
    "Plan object, PDF signature, page count, and fixed quote verified.",
  free_sample_queued: "Free accuracy sample queued for processing.",
  credits_reserved: "Credits reserved for this takeoff.",
  job_claimed: "Takeoff job claimed by processor.",
  processing_progress: "Takeoff processing updated.",
  automation_completed:
    "Automated measurement completed and deliverables were released.",
  credits_settled: "Takeoff credits settled.",
  credits_released: "Reserved credits released.",
  processing_retry_queued:
    "A retryable processing failure was queued for another attempt.",
  processing_failed:
    "Processing failed after its available attempts. Reserved credits were released.",
  correction_requested: "Customer requested the included correction.",
  takeoff_delivered:
    "The correction or exception was resolved for delivery.",
  qa_rework_requested:
    "The correction or exception was queued for another processing pass.",
  takeoff_canceled: "The takeoff was canceled.",
  upload_expired:
    "The unqueued upload session expired and its private source file was scheduled for deletion.",
}

export function localizeFailureMessage(input: {
  failureCode: string | null
  storedMessage: string | null
  locale: Locale
}) {
  if (input.locale === "en") {
    return input.storedMessage ?? dashboardCopy.en.detail.failureFallback
  }

  switch (input.failureCode) {
    case "upload_expired":
      return "La sesión de carga caducó antes de añadir la medición a la cola."
    case "stale_claim_exhausted":
      return "El procesamiento dejó de responder y agotó los intentos disponibles. Se ha avisado al equipo de soporte."
    case "worker_retryable":
      return "El procesamiento se reintentará automáticamente."
    case "worker_terminal":
      return "No se pudo completar el procesamiento. Se ha avisado al equipo de soporte y se liberarán los créditos reservados."
    case "inactive_workspace_fulfillment_blocked":
      return "La medición se detuvo porque el espacio de trabajo dejó de estar activo. Ponte en contacto con soporte."
    case "workspace_suspended":
      return "La medición se detuvo porque el espacio de trabajo está suspendido. Ponte en contacto con soporte."
    default:
      return dashboardCopy.es.detail.failureFallback
  }
}

const spanishCustomerErrors: Record<string, string> = {
  "Log in to create a takeoff.": "Inicia sesión para crear una medición.",
  "This workspace is not active.":
    "Este espacio de trabajo no está activo.",
  "Workspace is not active.": "El espacio de trabajo no está activo.",
  "Takeoff settings are temporarily unavailable.":
    "La configuración de las mediciones no está disponible temporalmente.",
  "Check the project details.": "Revisa los datos del proyecto.",
  "A free sample covers exactly one trade.":
    "La muestra gratuita cubre exactamente un alcance.",
  "A free sample covers exactly one scope.":
    "La muestra gratuita cubre exactamente un alcance.",
  "The free sample is currently unavailable.":
    "La muestra gratuita no está disponible en este momento.",
  "The free sample for this workspace has already been used.":
    "Este espacio de trabajo ya ha utilizado la muestra gratuita.",
  "The free sample for this workspace is no longer available.":
    "La muestra gratuita ya no está disponible para este espacio de trabajo.",
  "The free sample has already been used.":
    "La muestra gratuita ya se ha utilizado.",
  "Request limits are temporarily unavailable.":
    "Los límites de solicitudes no están disponibles temporalmente.",
  "Too many new takeoff requests. Try again later.":
    "Hay demasiadas solicitudes nuevas. Inténtalo de nuevo más tarde.",
  "Finish or wait for an existing upload before creating another takeoff.":
    "Termina o espera a que finalice una carga existente antes de crear otra medición.",
  "Log in to continue.": "Inicia sesión para continuar.",
  "Invalid submission.": "La solicitud no es válida.",
  "Takeoff not found.": "No se encontró la medición.",
  "This takeoff has already been verified.":
    "Esta medición ya se ha verificado.",
  "Too many plan verification attempts. Try again later.":
    "Hay demasiados intentos de verificación. Inténtalo de nuevo más tarde.",
  "The plan upload is missing.": "Falta el archivo de planos.",
  "The uploaded plan could not be verified.":
    "No se pudo verificar el plano cargado.",
  "The uploaded plan exceeds the file limit.":
    "El plano cargado supera el límite de tamaño.",
  "The uploaded object is not a PDF.": "El archivo cargado no es un PDF.",
  "The PDF is invalid, encrypted, or password protected.":
    "El PDF no es válido, está cifrado o protegido con contraseña.",
  "Could not securely archive the source plan.":
    "No se pudo archivar el plano original de forma segura.",
  "Could not finalize plan verification.":
    "No se pudo finalizar la verificación del plano.",
  "Verify the plan and review its quote first.":
    "Verifica el plano y revisa el presupuesto antes de continuar.",
  "Could not queue the free sample.":
    "No se pudo añadir la muestra gratuita a la cola.",
}

export function localizeCustomerError(
  message: unknown,
  locale: Locale,
  fallback: string
) {
  if (typeof message !== "string" || !message.trim()) return fallback
  if (locale === "en") return message
  const exact = spanishCustomerErrors[message]
  if (exact) return exact
  if (message.startsWith("Plan sets must contain between")) {
    return "Los juegos de planos deben tener entre 1 y 250 páginas."
  }
  if (message.startsWith("Sample page")) {
    return "La página elegida para la muestra no existe en este PDF."
  }
  if (message.toLowerCase().includes("insufficient")) {
    return "No hay créditos suficientes para confirmar esta medición."
  }
  return fallback
}

export function localizeBillingError(
  code: unknown,
  message: unknown,
  locale: Locale,
  fallback: string
) {
  if (locale === "en") {
    return typeof message === "string" && message.trim() ? message : fallback
  }
  const messages: Record<string, string> = {
    authentication_required: "Inicia sesión para continuar.",
    billing_settings_unavailable:
      "La configuración de facturación no está disponible temporalmente.",
    maintenance:
      "Las compras están pausadas temporalmente. Inténtalo de nuevo más tarde.",
    invalid_billing_sku: "Selecciona un plan de facturación válido.",
    subscriptions_disabled:
      "Las nuevas suscripciones no están disponibles en este momento.",
    subscription_checkout_in_progress:
      "Ya hay un proceso de suscripción en curso.",
    billing_unavailable:
      "La facturación no está disponible temporalmente.",
    workspace_not_active: "Este espacio de trabajo no está activo.",
    billing_account_not_found:
      "Todavía no hay una cuenta de facturación que gestionar.",
    billing_portal_unavailable:
      "La gestión de facturación no está disponible temporalmente.",
    deployment_not_configured:
      "La facturación no está disponible temporalmente.",
    billing_catalog_not_configured:
      "La facturación no está disponible temporalmente.",
    stripe_not_configured:
      "La facturación no está disponible temporalmente.",
  }
  return typeof code === "string" && messages[code]
    ? messages[code]
    : fallback
}

export function localizedCreditPackName(sku: string, locale: Locale) {
  if (locale === "en") {
    if (sku === "credits-550") return dashboardCopy.en.billing.starterPack
    if (sku === "credits-1800") return dashboardCopy.en.billing.growthPack
    return dashboardCopy.en.billing.officePack
  }
  if (sku === "credits-550") return dashboardCopy.es.billing.starterPack
  if (sku === "credits-1800") return dashboardCopy.es.billing.growthPack
  return dashboardCopy.es.billing.officePack
}
