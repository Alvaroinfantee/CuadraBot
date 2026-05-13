import Image from "next/image"
import Link from "next/link"
import { DownloadIcon } from "lucide-react"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { StatusBadge } from "@/components/site/status-badge"
import { buttonVariants } from "@/components/ui/button"

export const metadata = {
  title: "Client order preview",
  robots: {
    index: false,
    follow: false,
  },
}

const finalRenders = [
  {
    name: "Mediterranean exterior final render.png",
    href: "/images/gallery-mediterranean-villa.png",
    image: "/images/gallery-mediterranean-villa.png",
  },
  {
    name: "Warm interior final render.png",
    href: "/images/gallery-interior-renovation.png",
    image: "/images/gallery-interior-renovation.png",
  },
]

export default function DemoClientOrderPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader locale="en" />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3">
          <StatusBadge status="completed" />
          <h1 className="text-5xl font-semibold tracking-normal">CB-DEMO-CLIENT</h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            This is the customer-facing delivery view. Once you upload final renders
            in admin and send completion, the client receives a link to a page like this.
          </p>
        </div>

        <section className="grid gap-4 border p-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Package" value="Render Pro" />
          <Info label="Customer email" value="client@example.com" />
          <Info label="Render type" value="Exterior" />
          <Info label="Delivery estimate" value="3-5 business days" />
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold">Uploaded files</h2>
            <div className="flex flex-col gap-2">
              <div className="border px-3 py-2 text-sm">demo-floor-plan-and-elevation.png</div>
              <div className="border px-3 py-2 text-sm">demo-site-reference.png</div>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold">Final renders</h2>
            <div className="flex flex-col gap-5">
              {finalRenders.map((render) => (
                <article key={render.name} className="flex flex-col gap-3">
                  <div className="relative aspect-[4/3] overflow-hidden border bg-muted">
                    <Image
                      src={render.image}
                      alt={render.name}
                      fill
                      className="object-cover"
                      sizes="(min-width: 768px) 50vw, 100vw"
                    />
                  </div>
                  <Link href={render.href} className={buttonVariants({ variant: "outline" })}>
                    <DownloadIcon data-icon="inline-start" />
                    {render.name}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border p-6">
          <h2 className="mb-3 text-2xl font-semibold">Owner delivery flow</h2>
          <ol className="grid gap-2 text-sm leading-6 text-muted-foreground">
            <li>1. Open the paid order in `/admin/orders`.</li>
            <li>2. Upload one or more final render files in the order detail page.</li>
            <li>3. Review the uploaded files on the same page.</li>
            <li>4. Click “Mark completed and email client”.</li>
            <li>5. The client receives an email linking back to their order status page.</li>
          </ol>
        </section>
      </main>
      <SiteFooter locale="en" />
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
