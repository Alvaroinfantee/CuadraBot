import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { headers } from "next/headers"
import { Toaster } from "@/components/ui/sonner"
import { GoogleAdsTag } from "@/components/site/google-ads"
import { normalizeLocale } from "@/lib/i18n"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cuadrabot.com"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Cuadrabot | Legend-driven fixture takeoffs",
    template: "%s | Cuadrabot",
  },
  description:
    "Upload PDF plans with a readable legend and receive source-linked fixture, device, and supported cable or conduit quantities in hours.",
  applicationName: "Cuadrabot",
  keywords: [
    "fixture takeoff",
    "electrical fixture takeoff",
    "lighting fixture count",
    "PDF symbol counting",
    "legend based takeoff",
    "cable takeoff from PDF",
  ],
  openGraph: {
    type: "website",
    siteName: "Cuadrabot",
    title: "Legend-driven fixture takeoffs in hours.",
    description:
      "Upload PDF plans with a readable legend and receive source-linked counts, a marked PDF, and Excel quantities.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Cuadrabot legend-driven fixture takeoff with source-linked evidence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Legend-driven fixture takeoffs in hours.",
    description:
      "Upload PDF plans with a readable legend and receive source-linked counts, a marked PDF, and Excel quantities.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers()
  const locale = normalizeLocale(
    requestHeaders.get("x-cuadrabot-locale")
  )

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
        <GoogleAdsTag locale={locale} />
      </body>
    </html>
  );
}
