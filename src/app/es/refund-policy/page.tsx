import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "es",
  path: "/refund-policy",
  title: "Política de reembolso",
  description:
    "Condiciones de reembolso para paquetes de créditos, suscripciones y trabajos de medición de Cuadrabot.",
})

export default function RefundPolicyPageEs() {
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
              Política de reembolso
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              En vigor desde el 29 de julio de 2026
            </p>
          </div>
        </section>
        <article className="mx-auto max-w-4xl space-y-9 px-4 py-16 text-sm leading-7 text-muted-foreground sm:px-6">
          <Section title="Paquetes de créditos no utilizados">
            Puede solicitarse el reembolso completo de un paquete de créditos
            dentro de los 14 días siguientes cuando ninguno de sus créditos se
            haya reservado, consumido, transferido, caducado ni combinado en un
            trabajo objeto de disputa. En el lanzamiento no se ofrecen
            reembolsos parciales de paquetes.
          </Section>
          <Section title="Suscripciones">
            Cancela desde el portal de facturación de Stripe para detener la
            renovación al final del periodo pagado vigente. Normalmente no
            prorrateamos un periodo ya iniciado. Los derechos imperativos de
            cancelación o desistimiento, cuando correspondan, no se ven
            afectados.
          </Section>
          <Section title="Cargos por mediciones">
            Cuando confirmas un precio verificado, los créditos se reservan para
            ese alcance. Un fallo del sistema libera la reserva. Los trabajos
            entregados pueden utilizar el proceso de corrección incluido, no
            generan un reembolso automático, salvo que Cuadrabot no pueda
            proporcionar los entregables acordados dentro del alcance después
            de una oportunidad razonable de corrección.
          </Section>
          <Section title="Calidad de los planos y alcance">
            No procede un reembolso porque un plano esté incompleto, carezca de
            escala, sea ilegible, haya cambiado después de la confirmación o no
            incluya documentos necesarios para interpretar el alcance. Si
            detectamos esas condiciones antes de iniciar el trabajo, podemos
            solicitar archivos mejores, revisar el precio o liberar la reserva.
          </Section>
          <Section title="Proceso de reembolso">
            Escribe a{" "}
            <a
              href="mailto:billing@cuadrabot.com"
              className="text-primary underline"
            >
              billing@cuadrabot.com
            </a>{" "}
            indicando el correo de la cuenta, la factura o referencia de
            Checkout y el motivo. Los reembolsos aprobados se devuelven al medio
            de pago original. Las concesiones de créditos originales permanecen
            en el registro inmutable y reciben un asiento compensatorio.
          </Section>
          <Section title="Disputas">
            Contacta con nosotros antes de presentar una disputa de pago para
            que podamos revisar las evidencias del trabajo y la política.
            Mientras una disputa permanezca abierta, los créditos relacionados
            que no se hayan utilizado pueden congelarse y la cuenta puede quedar
            restringida.
          </Section>
        </article>
      </main>
      <SiteFooter locale="es" />
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-3">{children}</p>
    </section>
  )
}
