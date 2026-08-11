import Link from "next/link"
import {
  ArrowRightIcon,
  CheckIcon,
  CoinsIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  buildLocalizedMetadata,
  freeTrialSignupPath,
  localizedAuthPath,
  localizedPublicPath,
  localizeSubscriptionPlanName,
  localizeTakeoffPrice,
} from "@/lib/i18n"
import {
  creditPacks,
  servicePriceCards,
  subscriptionPlans,
} from "@/lib/takeoff-pricing"
import { cn } from "@/lib/utils"

export const metadata = buildLocalizedMetadata({
  locale: "es",
  path: "/pricing",
  title: "Precios",
  description:
    "Precios fijos para mediciones autoservicio de elementos, dispositivos y recorridos compatibles guiadas por leyendas, con créditos y planes opcionales.",
})

const packNames: Record<(typeof creditPacks)[number]["sku"], string> = {
  "credits-550": "Paquete inicial",
  "credits-1800": "Paquete crecimiento",
  "credits-5000": "Paquete oficina",
}

export default function PricingPageEs() {
  return (
    <div className="min-h-screen">
      <SiteHeader locale="es" />
      <main>
        <section className="border-b blueprint-fine-grid">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
              Precios transparentes
            </p>
            <h1 className="mt-4 max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl">
              Compra capacidad de medición guiada por leyendas, no otra
              licencia por usuario.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Empieza con una hoja de un plano real gratis, sin tarjeta. Las
              mediciones de pago usan créditos después de verificar el PDF, su
              número real de páginas y los alcances seleccionados.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={freeTrialSignupPath("es")}
                className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")}
              >
                Iniciar prueba gratis
                <ArrowRightIcon />
              </Link>
              <Link
                href={localizedPublicPath("/sample", "es")}
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "h-12 bg-white px-6"
                )}
              >
                Ver un ejemplo de entrega
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b bg-blue-50/70 py-12">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
            <div>
              <Badge>Prueba gratuita</Badge>
              <h2 className="mt-4 text-3xl font-semibold">
                Una hoja de un plano real por 0 $
              </h2>
              <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
                Elige un alcance basado en leyenda y recibe el PDF anotado y el
                libro de cantidades en Excel. Sin tarjeta, sin créditos y una
                prueba por usuario.
              </p>
            </div>
            <Link
              href={freeTrialSignupPath("es")}
              className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")}
            >
              Probar una hoja gratis
              <ArrowRightIcon />
            </Link>
          </div>
        </section>

        <section className="border-b py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                  Por medición
                </p>
                <h2 className="mt-3 text-3xl font-semibold">
                  Alcances autoservicio por leyenda con precio fijo
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                Se incluye una corrección dentro del alcance aprobado. Los
                trabajos de más de 25 páginas pasan al nivel fijo Proyecto
                grande de 499&nbsp;$ y siguen siendo autoservicio.
              </p>
            </div>
            <div className="mt-10 grid gap-px border bg-border md:grid-cols-2 xl:grid-cols-5">
              {servicePriceCards.map((basePrice, index) => {
                const price = localizeTakeoffPrice(basePrice, "es")
                return (
                  <article key={price.tier} className="bg-white p-6">
                    <div className="flex min-h-7 items-start justify-between gap-3">
                      <p className="font-medium">{price.name}</p>
                      {index === 1 ? <Badge>Popular</Badge> : null}
                    </div>
                    <p className="mt-6 text-4xl font-semibold">
                      {formatDollars(price.priceCents)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {price.credits} créditos
                    </p>
                    <p className="mt-6 min-h-18 text-sm leading-6 text-muted-foreground">
                      {price.description}
                    </p>
                    <ul className="mt-6 space-y-3 border-t pt-5 text-sm">
                      {[
                        "PDF marcado",
                        "Cantidades en Excel por código de leyenda",
                        "Validación automatizada",
                        "Una corrección",
                      ].map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <CheckIcon className="size-4 text-primary" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="border-b bg-[#f5f7fa] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                Planes mensuales opcionales
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Créditos previsibles para un volumen recurrente de mediciones
              </h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Los créditos mensuales se conceden después de cada factura
                pagada y nunca implican un uso ilimitado. Los créditos de
                lanzamiento no caducan.
              </p>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {subscriptionPlans.map((plan, index) => (
                <article
                  key={plan.sku}
                  className={cn(
                    "border bg-white p-7",
                    index === 1 && "border-primary shadow-lg"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold">
                      {localizeSubscriptionPlanName(
                        plan.sku,
                        plan.name,
                        "es"
                      )}
                    </h3>
                    {index === 1 ? <Badge>Más flexible</Badge> : null}
                  </div>
                  <p className="mt-6">
                    <span className="text-4xl font-semibold">
                      {formatDollars(plan.priceCents)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {" "}
                      / mes
                    </span>
                  </p>
                  <div className="mt-6 border-y py-5">
                    <p className="text-2xl font-semibold">
                      {plan.credits.toLocaleString("es-ES")} créditos
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sin caducidad de lanzamiento · cancela al final del periodo
                    </p>
                  </div>
                  <Link
                    href={localizedAuthPath("/signup", "es")}
                    className={cn(
                      buttonVariants({
                        variant: index === 1 ? "default" : "outline",
                      }),
                      "mt-6 w-full"
                    )}
                  >
                    Crear una cuenta
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                Paquetes de créditos
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Añade capacidad sin suscripción
              </h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Los paquetes de créditos de lanzamiento no caducan e incluyen
                una bonificación mayor en los volúmenes superiores.
              </p>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {creditPacks.map((pack) => (
                <article key={pack.sku} className="border p-7">
                  <CoinsIcon className="size-5 text-primary" />
                  <h3 className="mt-5 text-xl font-semibold">
                    {packNames[pack.sku]}
                  </h3>
                  <p className="mt-5 text-4xl font-semibold">
                    {formatDollars(pack.priceCents)}
                  </p>
                  <p className="mt-6 text-2xl font-semibold">
                    {pack.credits.toLocaleString("es-ES")} créditos
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Incluye {pack.bonus.toLocaleString("es-ES")} créditos de
                    bonificación
                  </p>
                  <Link
                    href={localizedAuthPath("/signup", "es")}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "mt-6 w-full"
                    )}
                  >
                    Crear una cuenta
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#0b1f3a] py-14 text-white">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
            <div className="flex gap-4">
              <ShieldCheckIcon className="mt-1 size-6 shrink-0 text-blue-300" />
              <div>
                <h2 className="text-xl font-semibold">
                  Los créditos solo se mueven después de confirmar.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Los fallos del sistema liberan los créditos reservados. La
                  confirmación de pago procede de webhooks firmados de Stripe,
                  nunca de una redirección ni de un importe enviado por el
                  navegador.
                </p>
              </div>
            </div>
            <Link
              href={localizedAuthPath("/signup", "es")}
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "shrink-0"
              )}
            >
              Crear una cuenta
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter locale="es" />
    </div>
  )
}

function formatDollars(priceCents: number) {
  return `${(priceCents / 100).toLocaleString("es-ES")} $`
}
