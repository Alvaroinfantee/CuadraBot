import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "AW-18182187189";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cuadrabot.com"),
  title: {
    default: "Cuadrabot | Construction takeoffs from blueprint PDFs",
    template: "%s | Cuadrabot",
  },
  description:
    "Upload blueprint PDFs, get an instant takeoff quote, pay securely, and receive reviewed takeoff files.",
};

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
        {googleAdsId ? (
          <>
            <Script
              id="google-ads-gtag-src"
              src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`}
              strategy="beforeInteractive"
            />
            <Script id="google-ads-gtag-init" strategy="beforeInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${googleAdsId}');
              `}
            </Script>
          </>
        ) : null}
        {children}
        <Toaster />
      </body>
    </html>
  );
}
