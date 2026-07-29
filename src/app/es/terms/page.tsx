import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "es",
  path: "/terms",
  title: "Términos del servicio",
  description:
    "Términos aplicables a las cuentas, los créditos, las suscripciones y los servicios de medición de Cuadrabot.",
})

export default function TermsPageEs() {
  return (
    <div className="min-h-screen">
      <SiteHeader locale="es" />
      <main>
        <section className="border-b blueprint-fine-grid">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
              Legal
            </p>
            <h1 className="mt-3 text-4xl font-semibold">
              Términos del servicio
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              En vigor desde el 29 de julio de 2026
            </p>
          </div>
        </section>
        <article className="mx-auto max-w-4xl px-4 py-16 text-sm leading-7 text-muted-foreground sm:px-6">
          <Term title="1. El servicio">
            Cuadrabot presta apoyo para mediciones de obra a partir de planos
            proporcionados por el cliente, incluido el análisis y la validación
            automatizados, evidencias marcadas sobre el plano, archivos de
            cantidades, supuestos y herramientas relacionadas del espacio de
            trabajo. No presta servicios de arquitectura, ingeniería,
            topografía, revisión normativa o de permisos, asesoramiento de
            costes ni una oferta final.
          </Term>
          <Term title="2. Cuentas y autorización">
            Debes proporcionar información exacta, proteger tus credenciales y
            comunicar sin demora cualquier acceso no autorizado. Si utilizas
            Cuadrabot para una empresa, confirmas que puedes aceptar estos
            términos y cargar los materiales en su nombre. Podemos suspender una
            cuenta por motivos de seguridad, impago, uso ilegal o incumplimiento
            sustancial.
          </Term>
          <Term title="3. Materiales e instrucciones del cliente">
            Conservas la titularidad de los planos cargados y concedes a
            Cuadrabot y a sus procesadores los derechos limitados necesarios
            para alojar, archivar y procesar de forma privada los materiales y
            prestar el servicio, incluido conservar los planos de origen
            verificados para el historial del proyecto, recuperación, soporte y
            disputas, tal como describe la Política de privacidad. Debes tener
            permiso para facilitar los materiales y no puedes cargar contenido
            malicioso, ilegal, sujeto a restricciones de exportación o
            confidencial de terceros sin autorización.
          </Term>
          <Term title="4. Alcance y verificación">
            Un precio fijo solo cubre el alcance de especialidades seleccionado,
            las páginas verificadas, el conjunto de planos de origen y los
            supuestos indicados. Eres responsable de contrastar los resultados
            con el conjunto completo de documentos contractuales,
            especificaciones, cuadros, adendas, alternativas y condiciones de
            obra antes de fijar precios, comprar o construir.
          </Term>
          <Term title="5. Créditos, paquetes y suscripciones">
            Los créditos son unidades de uso de la aplicación, no dinero, valor
            almacenado ni propiedad transferible. Los créditos no caducan
            durante la versión de lanzamiento. Cualquier política futura de
            caducidad se comunicará antes de la compra y se aplicará de forma
            prospectiva. Las suscripciones se renuevan hasta su cancelación y
            pueden cancelarse al final del periodo desde el portal de
            facturación. Un pago fallido no genera nuevos créditos.
          </Term>
          <Term title="6. Entrega y correcciones">
            Los alcances autoservicio que cumplen los requisitos se procesan
            automáticamente y, por lo general, se entregan en cuestión de horas
            después de una carga válida y de confirmar el precio. El plazo es un
            objetivo, no una garantía, y puede variar según la complejidad de los
            planos, la carga de la cola o la respuesta que deba aportar el
            cliente. Se incluye una corrección cuando se solicita dentro de los
            7 días posteriores a la entrega y se limita al alcance aprobado y al
            conjunto de planos original. Las revisiones, ampliaciones de alcance
            o cambios de documentos requieren un nuevo precio.
          </Term>
          <Term title="7. Uso aceptable">
            No puedes investigar ni eludir controles de acceso, enviar volumen
            automatizado fuera de las interfaces publicadas, revender el acceso
            sin acuerdo, aplicar ingeniería inversa a componentes protegidos del
            servicio, interferir con terceros ni utilizar ilegalmente los
            resultados o sistemas.
          </Term>
          <Term title="8. Disponibilidad y cambios">
            Podemos mantener, mejorar o retirar funciones y recurrir a
            subcontratistas cualificados. No garantizamos un servicio
            ininterrumpido. Si un fallo del sistema impide una medición, se
            liberan los créditos reservados; esto es independiente de los
            retrasos causados por documentos del cliente incompletos, ilegibles,
            sin escala o modificados.
          </Term>
          <Term title="9. Exclusiones de garantía y responsabilidad">
            En la medida permitida por la ley, el servicio y los resultados se
            prestan con diligencia razonable, pero sin garantizar que cada
            documento, interpretación del alcance o cantidad esté libre de
            errores. Cuadrabot no responde por pérdidas indirectas,
            consecuenciales o especiales, ni por pérdidas posteriores en
            ofertas, compras, planificación, construcción o beneficios. La
            responsabilidad total se limita al importe pagado por el servicio
            afectado durante los tres meses anteriores, salvo que la ley no
            permita esa limitación.
          </Term>
          <Term title="10. Legislación aplicable y contacto">
            Los derechos imperativos de consumidores y de protección de datos
            no se ven afectados. Estos términos se rigen por la legislación
            española y las disputas se someten a los juzgados y tribunales
            competentes para el operador de Cuadrabot, salvo que una norma
            imperativa exija otro fuero. Contacto:{" "}
            <a
              href="mailto:support@cuadrabot.com"
              className="text-primary underline"
            >
              support@cuadrabot.com
            </a>
            .
          </Term>
        </article>
      </main>
      <SiteFooter locale="es" />
    </div>
  )
}

function Term({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-9">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-3">{children}</p>
    </section>
  )
}
