import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/config"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl()
  const paths = [
    "",
    "/pricing",
    "/sample",
    "/how-it-works",
    "/accuracy",
    "/security",
    "/faq",
    "/flooring-takeoff",
    "/drywall-takeoff",
    "/door-window-takeoff",
    "/privacy",
    "/terms",
    "/refund-policy",
  ]

  return paths.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/pricing" ? 0.9 : 0.7,
  }))
}
