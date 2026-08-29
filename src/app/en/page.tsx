import { TakeoffLanding } from "@/components/takeoff/takeoff-landing"

export const metadata = {
  title: "Reviewed drywall takeoffs from PDF plans",
  description:
    "Upload PDF plans and receive a reviewed Excel quantity workbook and colour-marked PDF in two business days for €149 plus VAT.",
  alternates: {
    canonical: "/en",
    languages: { es: "/", en: "/en", "x-default": "/" },
  },
  openGraph: {
    type: "website" as const,
    url: "/en",
    siteName: "Cuadrabot",
    locale: "en_US",
    alternateLocale: ["es_ES"],
    title: "Reviewed drywall takeoffs from PDF plans",
    description:
      "Upload PDF plans and receive a reviewed Excel quantity workbook and colour-marked PDF in two business days for €149 plus VAT.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Cuadrabot drywall takeoffs from PDF plans",
      },
    ],
  },
  twitter: {
    card: "summary_large_image" as const,
    title: "Reviewed drywall takeoffs from PDF plans",
    description:
      "Upload PDF plans and receive a reviewed Excel quantity workbook and colour-marked PDF in two business days for €149 plus VAT.",
    images: ["/opengraph-image"],
  },
}

export default function EnglishHomePage() {
  return <TakeoffLanding locale="en" />
}
