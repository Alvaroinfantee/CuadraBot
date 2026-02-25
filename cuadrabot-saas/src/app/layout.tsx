import type { Metadata } from "next";
import Providers from "@/components/Providers";
import "./globals.css";


export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "CuadraBot — Contabilidad Inteligente para República Dominicana",
    template: "%s | CuadraBot",
  },
  description:
    "Automatiza tu contabilidad fiscal en República Dominicana. Sube tus CSV y obtén todos los reportes necesarios para pagar tus impuestos con inteligencia artificial.",
  keywords: [
    "contabilidad",
    "impuestos",
    "República Dominicana",
    "DGII",
    "CPA",
    "contador",
    "fiscal",
    "automatización",
    "inteligencia artificial",
    "reportes fiscales",
    "declaración de impuestos",
  ],
  authors: [{ name: "CuadraBot" }],
  creator: "CuadraBot",
  openGraph: {
    type: "website",
    locale: "es_DO",
    url: "/",
    siteName: "CuadraBot",
    title: "CuadraBot — Contabilidad Inteligente para República Dominicana",
    description:
      "Automatiza tu contabilidad fiscal en RD. Sube tus CSV y obtén reportes fiscales con IA.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CuadraBot - Contabilidad Inteligente",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CuadraBot — Contabilidad Inteligente",
    description:
      "Automatiza tu contabilidad fiscal en RD con inteligencia artificial.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        {/* Google Analytics placeholder */}
        {/* <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script> */}

        {/* Meta Pixel placeholder */}
        {/* <script dangerouslySetInnerHTML={{ __html: `...` }} /> */}

        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
