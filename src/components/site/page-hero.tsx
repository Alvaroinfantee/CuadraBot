import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function PageHero({
  eyebrow,
  title,
  body,
  primary = "Check my plans free",
  primaryHref = "/signup",
  secondary,
  secondaryHref = "/sample",
}: {
  eyebrow: string
  title: string
  body: string
  primary?: string
  primaryHref?: string
  secondary?: string
  secondaryHref?: string
}) {
  return (
    <section className="border-b blueprint-fine-grid">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </p>
        <h1 className="mt-4 max-w-5xl text-5xl font-semibold tracking-tight sm:text-6xl">
          {title}
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
          {body}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={primaryHref}
            className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")}
          >
            {primary}
            <ArrowRightIcon />
          </Link>
          {secondary ? (
            <Link
              href={secondaryHref}
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "h-12 bg-white px-6"
              )}
            >
              {secondary}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export function CtaBand() {
  return (
    <section className="blueprint-grid py-16">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 text-center sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          See one real sheet measured free.
        </h2>
        <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
          Upload a scaled PDF, pick one launch trade, and receive the same
          marked evidence used for paid work.
        </p>
        <Link
          href="/signup"
          className={cn(buttonVariants({ size: "lg" }), "mt-7 h-12 px-7")}
        >
          Check my plans free
          <ArrowRightIcon />
        </Link>
      </div>
    </section>
  )
}
