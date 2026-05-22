import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { PackageColumns } from "@/components/site/package-columns"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { buttonVariants } from "@/components/ui/button"
import { getActivePackages } from "@/lib/packages"
import { commonCopy, localePath, type Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export const metadata = {
  title: "Pricing",
}

export default async function PricingPage() {
  return <PricingContent locale="en" />
}

export async function PricingContent({ locale }: { locale: Locale }) {
  const packages = await getActivePackages()
  const copy = commonCopy[locale]
  const pageCopy =
    locale === "es"
      ? {
          title: "Paquetes de render claros, listos para arrancar.",
          body: "Elige el alcance que encaja con tu proyecto, sube tus planos y paga de forma segura.",
          quote: "Cotizar por proyecto",
        }
      : {
          title: "Clear rendering packages, ready to start.",
          body: "Choose the scope that fits your project, upload your plans, and pay securely.",
          quote: "Quote by project",
        }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader locale={locale} />
      <main>
        <section className="border-b blueprint-fine-grid">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-20 sm:px-6 lg:px-8">
            <h1 className="max-w-4xl text-5xl font-semibold tracking-normal">
              {pageCopy.title}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              {pageCopy.body}
            </p>
            <p className="text-sm font-semibold text-primary">
              {copy.ready72}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href={localePath(locale, "/order")} className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")}>
                {copy.startRender}
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
              <Link href={localePath(locale, "/quote")} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 px-6")}>
                {pageCopy.quote}
              </Link>
            </div>
          </div>
        </section>
        <section className="py-16">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <PackageColumns packages={packages} locale={locale} />
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}
