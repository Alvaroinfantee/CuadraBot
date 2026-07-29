import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/config"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/admin/", "/api/", "/demo/"],
      },
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  }
}
