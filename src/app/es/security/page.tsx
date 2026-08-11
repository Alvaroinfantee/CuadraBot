import {
  ClockIcon,
  DatabaseIcon,
  EyeOffIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { CtaBand, PageHero } from "@/components/site/page-hero"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "es",
  path: "/security",
  title: "Seguridad y privacidad",
  description:
    "Cómo protege Cuadrabot los planos de clientes, las credenciales de procesamiento, los datos de facturación y el acceso administrativo.",
})

const measures = [
  [
    LockKeyholeIcon,
    "Almacenamiento privado",
    "Los planos originales y los entregables se guardan en contenedores privados. Las descargas de fuentes utilizan enlaces con comprobación de propiedad que caducan a los cinco minutos.",
  ],
  [
    KeyRoundIcon,
    "Acceso de corta duración",
    "Los procesadores y los clientes reciben enlaces firmados para una finalidad y un periodo limitados; los contenedores nunca son públicos.",
  ],
  [
    EyeOffIcon,
    "Secretos solo en el servidor",
    "Las credenciales de Stripe, del servicio de Supabase, del procesador y del procesamiento nunca se exponen como variables públicas del navegador.",
  ],
  [
    DatabaseIcon,
    "Controles de datos por cliente",
    "Las lecturas del cliente están limitadas mediante seguridad por fila. Las escrituras de confianza usan código de servidor de alcance reducido y RPC auditadas.",
  ],
  [
    ShieldCheckIcon,
    "Administración verificada",
    "El acceso administrativo requiere un perfil autenticado con el rol adecuado; los cambios sensibles se registran en el historial de auditoría.",
  ],
  [
    ClockIcon,
    "Archivo y conservación",
    "Los originales verificados cuentan con un registro en base de datos respaldado por checksum y un archivo de fuente protegido. Los archivos generados, el cierre de cuentas y las solicitudes de eliminación siguen controles independientes.",
  ],
] as const

export default function SecurityPageEs() {
  return (
    <div className="min-h-screen">
      <SiteHeader locale="es" />
      <main>
        <PageHero
          eyebrow="Seguridad y privacidad"
          title="Tus planos son datos del cliente, no contenido público."
          body="Cuadrabot separa el acceso del navegador, la autoridad de la aplicación, las credenciales de procesamiento y los controles administrativos que protegen los archivos privados de cada proyecto."
          primary="Probar una hoja gratis"
          secondary="Leer la política de privacidad"
          secondaryHref="/es/privacy"
          locale="es"
        />
        <section className="border-b py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {measures.map(([Icon, title, body]) => (
                <article key={String(title)} className="border p-7">
                  <Icon className="size-6 text-primary" />
                  <h2 className="mt-6 text-lg font-semibold">{String(title)}</h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {String(body)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="border-b bg-[#0b1f3a] py-16 text-white">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold">
              Compromiso sobre el uso de los datos
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div className="border-l border-blue-300/50 pl-5">
                <h3 className="font-semibold">Uso para prestar el servicio</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Los planos se procesan para realizar la medición solicitada,
                  ejecutar las validaciones, entregar los archivos, resolver
                  incidencias, prevenir abusos y cumplir obligaciones legales.
                </p>
              </div>
              <div className="border-l border-blue-300/50 pl-5">
                <h3 className="font-semibold">
                  Sin entrenamiento silencioso de modelos
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Cuadrabot no utiliza los planos de sus clientes para entrenar
                  sus propios modelos sin un consentimiento independiente y
                  explícito.
                </p>
              </div>
            </div>
          </div>
        </section>
        <CtaBand locale="es" />
      </main>
      <SiteFooter locale="es" />
    </div>
  )
}
