import Link from "next/link"
import { DownloadIcon } from "lucide-react"
import { notFound } from "next/navigation"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { StatusBadge } from "@/components/site/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { hasSupabaseServerEnv } from "@/lib/config"
import { formatDeliveryRange } from "@/lib/format"
import { getPackageDisplay, type Locale } from "@/lib/i18n"
import type { OrderFile } from "@/lib/types"

export const metadata = {
  title: "Order status",
}

export const dynamic = "force-dynamic"

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ publicToken: string }>
}) {
  return <OrderStatusContent locale="en" params={params} />
}

export async function OrderStatusContent({
  params,
  locale,
}: {
  params: Promise<{ publicToken: string }>
  locale: Locale
}) {
  const { publicToken } = await params

  if (!hasSupabaseServerEnv()) {
    notFound()
  }

  const supabase = createSupabaseAdminClient()
  const { data: order } = await supabase
    .from("orders")
    .select("*, packages(*), order_files(*)")
    .eq("public_token", publicToken)
    .maybeSingle()

  if (!order) {
    notFound()
  }

  const packagePlan = Array.isArray(order.packages) ? order.packages[0] : order.packages
  const files = (order.order_files ?? []) as OrderFile[]
  const customerFiles = files.filter((file) => file.file_role === "customer_upload")
  const finalFiles = files.filter((file) => file.file_role === "final_render")
  const finalDownloads = await Promise.all(
    finalFiles.map(async (file) => {
      const { data } = await supabase.storage
        .from(file.bucket)
        .createSignedUrl(file.storage_path, 60 * 60)

      return { ...file, signedUrl: data?.signedUrl ?? null }
    })
  )
  const copy =
    locale === "es"
      ? {
          body: "Consulta el estado del render y descarga los archivos finales cuando estén listos.",
          package: "Paquete",
          customerEmail: "Email del cliente",
          renderType: "Tipo de render",
          delivery: "Entrega estimada",
          uploadedFiles: "Archivos subidos",
          finalRenders: "Renders finales",
          noFinals:
            "Las descargas de renders finales aparecerán aquí después del procesamiento y la revisión.",
          noUploads: "No hay archivos subidos adjuntos.",
          fallbackPackage: "Paquete",
        }
      : {
          body: "Track rendering status and download final render files when complete.",
          package: "Package",
          customerEmail: "Customer email",
          renderType: "Render type",
          delivery: "Delivery estimate",
          uploadedFiles: "Uploaded files",
          finalRenders: "Final renders",
          noFinals:
            "Final render downloads will appear here after processing and review.",
          noUploads: "No uploaded files are attached.",
          fallbackPackage: "Package",
        }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader locale={locale} />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3">
          <StatusBadge status={order.status} locale={locale} />
          <h1 className="text-5xl font-semibold tracking-normal">{order.order_number}</h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            {copy.body}
          </p>
        </div>
        <section className="grid gap-4 border p-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info
            label={copy.package}
            value={packagePlan ? getPackageDisplay(locale, packagePlan).name : copy.fallbackPackage}
          />
          <Info label={copy.customerEmail} value={order.customer_email} />
          <Info label={copy.renderType} value={order.render_type ?? "-"} />
          <Info
            label={copy.delivery}
            value={
              packagePlan
                ? formatDeliveryRange(
                    packagePlan.estimated_delivery_days_min,
                    packagePlan.estimated_delivery_days_max,
                    locale
                  )
                : "-"
            }
          />
        </section>
        <section className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold">{copy.uploadedFiles}</h2>
            <FileList files={customerFiles} emptyCopy={copy.noUploads} />
          </div>
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold">{copy.finalRenders}</h2>
            {finalDownloads.length ? (
              <div className="flex flex-col gap-2">
                {finalDownloads.map((file) => (
                  <Link
                    key={file.id}
                    href={file.signedUrl ?? "#"}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    <DownloadIcon data-icon="inline-start" />
                    {file.original_filename}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="border p-4 text-sm leading-6 text-muted-foreground">
                {copy.noFinals}
              </p>
            )}
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function FileList({ files, emptyCopy }: { files: OrderFile[]; emptyCopy: string }) {
  if (!files.length) {
    return (
      <p className="border p-4 text-sm leading-6 text-muted-foreground">
        {emptyCopy}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {files.map((file) => (
        <div key={file.id} className="border px-3 py-2 text-sm">
          {file.original_filename}
        </div>
      ))}
    </div>
  )
}
