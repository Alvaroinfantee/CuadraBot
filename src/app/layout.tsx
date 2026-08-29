import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { headers } from "next/headers"
import { Toaster } from "@/components/ui/sonner"
import { GoogleAdsTag } from "@/components/site/google-ads"
import { buildGoogleAdsConsentBootstrap } from "@/lib/google-ads-bootstrap"
import {
  googleAdsConfigurationIsValid,
  googleAdsId,
} from "@/lib/google-ads"
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
    default: "Cuadrabot | Mediciones de pladur desde planos PDF",
    template: "%s | Cuadrabot",
  },
  description:
    "Mediciones de pladur revisadas en dos días laborables: Excel de cantidades y PDF marcado desde 149 € más IVA.",
  applicationName: "Cuadrabot",
  keywords: [
    "mediciones de pladur",
    "medición de tabiques",
    "medición desde planos PDF",
    "cuadro de mediciones Excel",
    "planos marcados",
  ],
  openGraph: {
    type: "website",
    siteName: "Cuadrabot",
    title: "Mediciones de pladur revisadas en dos días laborables.",
    description:
      "Sube tus planos PDF y recibe un Excel de cantidades y un PDF marcado.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Cuadrabot, mediciones de pladur desde planos PDF",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mediciones de pladur revisadas en dos días laborables.",
    description:
      "Sube tus planos PDF y recibe un Excel de cantidades y un PDF marcado.",
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
      {googleAdsConfigurationIsValid ? (
        <head>
          <script
            id="google-ads-consent-default"
            dangerouslySetInnerHTML={{
              __html: buildGoogleAdsConsentBootstrap(),
            }}
          />
          <script
            async
            id="google-ads-library"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
              googleAdsId
            )}`}
          />
        </head>
      ) : null}
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
        <GoogleAdsTag locale={locale} />
      </body>
    </html>
  );
}
