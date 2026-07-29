import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
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
    default: "Cuadrabot | Self-serve construction takeoffs",
    template: "%s | Cuadrabot",
  },
  description:
    "Upload scaled PDF plans and receive marked drawings plus Excel quantities in hours.",
  applicationName: "Cuadrabot",
  keywords: [
    "construction takeoff",
    "quantity takeoff",
    "flooring takeoff",
    "drywall takeoff",
    "door takeoff",
    "estimating",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Cuadrabot",
    title: "Self-serve construction takeoffs in hours.",
    description:
      "Upload scaled PDF plans and receive marked drawings plus Excel quantities.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Cuadrabot source-linked plan takeoff and verified quantity workbook",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Self-serve construction takeoffs in hours.",
    description:
      "Upload scaled PDF plans and receive marked drawings plus Excel quantities.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
