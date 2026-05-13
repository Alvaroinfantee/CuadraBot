import Image from "next/image"
import Link from "next/link"
import {
  ArrowDownIcon,
  ArrowRightIcon,
  CreditCardIcon,
  DownloadIcon,
  FileUpIcon,
  LayersIcon,
  LockIcon,
  SparklesIcon,
  TargetIcon,
  ZapIcon,
} from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { PackageColumns } from "@/components/site/package-columns"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { galleryExamples } from "@/lib/gallery-examples"
import { getActivePackages } from "@/lib/packages"
import { commonCopy, homeCopy, localePath, type Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const stepIcons = [FileUpIcon, CreditCardIcon, SparklesIcon, DownloadIcon]
const reasonIcons = [ZapIcon, LockIcon, CreditCardIcon, TargetIcon, LayersIcon]

export default async function Home() {
  return <HomeContent locale="en" />
}

export async function HomeContent({ locale }: { locale: Locale }) {
  const packages = await getActivePackages()
  const copy = homeCopy[locale]
  const common = commonCopy[locale]
  const examples = galleryExamples[locale]

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader locale={locale} />
      <main>
        <section className="relative overflow-hidden border-b">
          <div className="absolute inset-y-0 left-0 w-40 blueprint-grid opacity-80" />
          <div className="absolute inset-y-0 right-0 w-1/2 blueprint-fine-grid opacity-60" />
          <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-5">
                <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-normal text-foreground sm:text-6xl lg:text-7xl">
                  {copy.headline}
                </h1>
                <p className="max-w-xl text-lg leading-8 text-muted-foreground">
                  {copy.subheadline}
                </p>
                <p className="text-sm font-semibold text-primary">
                  {copy.promise72}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href={localePath(locale, "/order")} className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")}>
                  {common.startRender}
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
                <Link href={localePath(locale, "/pricing")} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 px-6")}>
                  {common.viewPricing}
                </Link>
              </div>
            </div>
            <div className="relative min-h-[420px] overflow-hidden rounded-sm">
              <Image
                src="/images/gallery-mediterranean-villa.png"
                alt="Blueprint to architectural render example"
                fill
                priority
                className="object-cover"
                sizes="(min-width: 1024px) 54vw, 100vw"
              />
            </div>
            <div className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground lg:flex">
              {copy.scroll}
              <ArrowDownIcon className="text-primary" />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-b py-16">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 sm:px-6 lg:px-8">
            <SectionHeading title={common.howItWorks} />
            <div className="grid gap-8 md:grid-cols-4">
              {copy.steps.map(([title, body], index) => {
                const Icon = stepIcons[index]
                return (
                <div key={title} className="flex flex-col gap-6">
                  <Icon className="text-primary" />
                  <div className="flex flex-col gap-2">
                    <div className="font-mono text-2xl font-semibold">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{body}</p>
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-6">
              <SectionHeading title={common.packages} />
              <Link href={localePath(locale, "/pricing")} className="hidden items-center gap-2 text-sm font-medium text-primary sm:flex">
                {copy.fullPricing}
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </div>
            <PackageColumns packages={packages} locale={locale} />
          </div>
        </section>

        <section className="pb-16">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-6">
              <SectionHeading title={copy.exampleGallery} />
              <Link href={localePath(locale, "/gallery")} className="hidden items-center gap-2 text-sm font-medium text-primary sm:flex">
                {copy.moreExamples}
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              {examples.map((example) => (
                <article key={example.title} className="flex flex-col gap-4">
                  <div className="relative aspect-[4/3] overflow-hidden border bg-muted">
                    <Image
                      src={example.image}
                      alt={example.title}
                      fill
                      className="object-cover"
                      sizes="(min-width: 1024px) 33vw, 100vw"
                    />
                    <Badge className="absolute left-3 top-3 rounded-sm bg-foreground text-background">
                      {example.category}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xl font-semibold">{example.title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {example.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="why-cuadrabot" className="border-y py-16">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 sm:px-6 lg:px-8">
            <SectionHeading title={common.whyCuadrabot} />
            <div className="grid gap-8 md:grid-cols-5">
              {copy.reasons.map(([title, body], index) => {
                const Icon = reasonIcons[index]
                return (
                <div key={title} className="flex flex-col gap-5 md:border-l md:pl-6">
                  <Icon className="text-primary" />
                  <div className="flex flex-col gap-2">
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{body}</p>
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
            <SectionHeading title={common.faq} />
            <Accordion className="grid gap-0 md:grid-cols-2 md:gap-x-16">
              {copy.faqs.map(([question, answer]) => (
                <AccordionItem key={question} value={question}>
                  <AccordionTrigger>{question}</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground">{answer}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="border-y blueprint-grid py-16">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-4xl font-semibold tracking-normal">
              {copy.finalHeadline}
            </h2>
            <p className="text-muted-foreground">
              {copy.finalBody}
            </p>
            <Link href={localePath(locale, "/order")} className={cn(buttonVariants({ size: "lg" }), "h-12 px-8")}>
              {common.startRender}
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-6">
      <h2 className="shrink-0 text-3xl font-semibold tracking-normal">{title}</h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}
