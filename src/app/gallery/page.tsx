import Image from "next/image"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { galleryExamples } from "@/lib/gallery-examples"
import { commonCopy, homeCopy, localePath, type Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export const metadata = {
  title: "Gallery",
}

export default function GalleryPage() {
  return <GalleryContent locale="en" />
}

export function GalleryContent({ locale }: { locale: Locale }) {
  const common = commonCopy[locale]
  const home = homeCopy[locale]
  const examples = galleryExamples[locale]

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader locale={locale} />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-5xl font-semibold tracking-normal">{home.exampleGallery}</h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            {locale === "es"
              ? "Ejemplos iniciales de conversión de planos a renders para mostrar el tipo de entrega que Cuadrabot puede producir."
              : "Initial blueprint-to-render examples showing the kind of finished delivery Cuadrabot can produce."}
          </p>
          <p className="text-sm font-semibold text-primary">
            {common.ready72}
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
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
                <h2 className="text-xl font-semibold">{example.title}</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {example.description}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div>
          <Link href={localePath(locale, "/order")} className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")}>
            {common.startRender}
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </div>
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}
