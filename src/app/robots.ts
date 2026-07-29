import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/config"

const privateRoutePrefixes = [
  "/admin",
  "/api",
  "/auth",
  "/dashboard",
  "/demo",
] as const

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: privateRoutePrefixes.flatMap((prefix) => [
          prefix,
          `/es${prefix}`,
        ]),
      },
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  }
}
