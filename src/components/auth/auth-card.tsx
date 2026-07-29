import Link from "next/link"
import type { ReactNode } from "react"

export function AuthCard({
  eyebrow,
  title,
  body,
  children,
  footer,
}: {
  eyebrow: string
  title: string
  body: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f5f7fa] px-4 py-12">
      <div className="absolute inset-0 blueprint-fine-grid opacity-50" />
      <div className="relative grid w-full max-w-5xl overflow-hidden border bg-background shadow-xl lg:grid-cols-[0.82fr_1.18fr]">
        <aside className="hidden border-r bg-[#0b1f3a] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <Link href="/" className="text-xl font-semibold">
            Cuadrabot
          </Link>
          <div className="space-y-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-blue-300">
              Verified bid capacity
            </p>
            <p className="text-3xl font-semibold leading-tight">
              From scaled plans to marked quantities in hours.
            </p>
            <p className="text-sm leading-6 text-slate-300">
              Private plan storage, source-linked counts, automatic validation,
              and downloadable PDF and Excel evidence.
            </p>
          </div>
        </aside>
        <section className="p-6 sm:p-10 lg:p-14">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {body}
          </p>
          <div className="mt-8">{children}</div>
          <div className="mt-8 border-t pt-6 text-sm text-muted-foreground">
            {footer}
          </div>
        </section>
      </div>
    </main>
  )
}
