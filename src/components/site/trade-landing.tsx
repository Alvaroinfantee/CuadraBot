import Link from "next/link"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  FileTextIcon,
  MapPinIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { CtaBand, PageHero } from "@/components/site/page-hero"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { buttonVariants } from "@/components/ui/button"
import {
  localizedPublicPath,
  type Locale,
} from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function TradeLanding({
  eyebrow,
  title,
  body,
  measured,
  assumptions,
  locale = "en",
}: {
  eyebrow: string
  title: string
  body: string
  measured: string[]
  assumptions: string[]
  locale?: Locale
}) {
  const copy =
    locale === "es"
      ? {
          sample: "Ver un ejemplo de entrega",
          included: "Mediciones incluidas",
          focused: "Un alcance inicial bien definido",
          confirm: "Confirma antes de licitar",
          decisions: "Decisiones habituales de alcance",
          evidence: [
            [MapPinIcon, "Vinculado al plano", "Página, zona y geometría visible"],
            [FileTextIcon, "PDF marcado", "Revisa de dónde sale cada cantidad"],
            [FileSpreadsheetIcon, "Entrega en Excel", "Filtra y valora filas estructuradas"],
            [ShieldCheckIcon, "Entrega validada", "Controles automáticos antes de la entrega"],
          ],
          priceTitle: "Los precios autoservicio publicados parten de 49 $.",
          priceBody:
            "La cantidad verificada de páginas y de especialidades disponibles determina el nivel fijo.",
          priceCta: "Ver todos los precios",
        }
      : {
          sample: "View sample output",
          included: "Included measurements",
          focused: "A focused launch scope",
          confirm: "Confirm before bidding",
          decisions: "Common scope decisions",
          evidence: [
            [MapPinIcon, "Plan-linked", "Page, area, and visible geometry"],
            [FileTextIcon, "Marked PDF", "Review where quantities came from"],
            [FileSpreadsheetIcon, "Excel output", "Filter and price structured rows"],
            [ShieldCheckIcon, "Validated output", "Automatic checks gate delivery"],
          ],
          priceTitle: "Published self-serve prices start at $49.",
          priceBody:
            "The verified PDF page count and number of launch trades set the fixed tier.",
          priceCta: "View complete pricing",
        }
  return (
    <div className="min-h-screen">
      <SiteHeader locale={locale} />
      <main>
        <PageHero
          eyebrow={eyebrow}
          title={title}
          body={body}
          secondary={copy.sample}
          locale={locale}
        />
        <section className="border-b py-20">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                {copy.included}
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                {copy.focused}
              </h2>
              <ul className="mt-7 space-y-4">
                {measured.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-6">
                    <CheckCircle2Icon className="mt-1 size-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border bg-[#f5f7fa] p-7">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                {copy.confirm}
              </p>
              <h2 className="mt-3 text-2xl font-semibold">
                {copy.decisions}
              </h2>
              <ul className="mt-6 space-y-4 text-sm leading-6 text-muted-foreground">
                {assumptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <section className="border-b bg-[#0b1f3a] py-16 text-white">
          <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
            {copy.evidence.map(([Icon, title, itemCopy]) => (
              <div key={String(title)} className="border-l border-blue-300/40 pl-5">
                <Icon className="size-5 text-blue-300" />
                <h3 className="mt-4 font-semibold">{String(title)}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {String(itemCopy)}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section className="border-b py-16">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
            <div>
              <h2 className="text-2xl font-semibold">
                {copy.priceTitle}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {copy.priceBody}
              </p>
            </div>
            <Link
              href={localizedPublicPath("/pricing", locale)}
              className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
            >
              {copy.priceCta}
              <ArrowRightIcon />
            </Link>
          </div>
        </section>
        <CtaBand locale={locale} />
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}
