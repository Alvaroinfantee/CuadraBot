import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { type Locale } from "@/lib/i18n"

export const metadata = {
  title: "Privacy Policy",
}

export default function PrivacyPage() {
  return <PrivacyContent locale="en" />
}

export function PrivacyContent({ locale }: { locale: Locale }) {
  const content =
    locale === "es"
      ? {
          title: "Política de Privacidad",
          paragraphs: [
            "Cuadrabot recopila la información necesaria para prestar servicios de renderizado arquitectónico: datos de contacto, instrucciones del proyecto, archivos subidos, metadatos de pago y emails transaccionales.",
            "Los archivos de clientes se guardan en buckets privados. El acceso se limita a flujos de admin autorizados y al worker local autenticado que procesa trabajos pagados.",
            "Los pagos se procesan mediante Stripe. Cuadrabot no almacena números completos de tarjeta. Los emails transaccionales pueden enviarse mediante Resend o un proveedor similar.",
            "Los clientes deben tener derecho a subir los planos, dibujos y materiales de referencia que envían.",
          ],
        }
      : {
          title: "Privacy Policy",
          paragraphs: [
            "Cuadrabot collects the information needed to provide architectural rendering services: customer contact details, project instructions, uploaded files, payment metadata, and service emails.",
            "Customer files are stored in private buckets. Access is limited to authorized admin workflows and the authenticated local rendering worker that processes paid jobs.",
            "Payments are processed by Stripe. Cuadrabot does not store full card numbers. Transactional emails may be sent through Resend or a similar provider.",
            "Customers must have the right to upload the plans, drawings, and reference materials they submit.",
          ],
        }

  return (
    <LegalPage title={content.title} locale={locale}>
      {content.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </LegalPage>
  )
}

function LegalPage({ title, children, locale }: { title: string; children: React.ReactNode; locale: Locale }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader locale={locale} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-16 text-base leading-8 text-muted-foreground sm:px-6 lg:px-8">
        <h1 className="text-4xl font-semibold tracking-normal text-foreground">{title}</h1>
        {children}
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}
