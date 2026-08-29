import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/config"
import {
  localizedPublicPath,
  publicMarketingPaths,
  type Locale,
} from "@/lib/i18n"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl()
  const generatedAt = new Date()
  const sitemapLocales = ["en", "es"] as const satisfies readonly Locale[]

  const entries: MetadataRoute.Sitemap = []
  for (const path of publicMarketingPaths) {
    if (path === "/") {
      entries.push({
        url: base,
        lastModified: generatedAt,
        changeFrequency: "weekly" as const,
        priority: 1,
        alternates: { languages: { es: base, "x-default": base } },
      })
      continue
    }
    const englishUrl = `${base}${localizedPublicPath(path, "en")}`
    const spanishUrl = `${base}${localizedPublicPath(path, "es")}`
    const alternates = {
      languages: {
        en: englishUrl,
        es: spanishUrl,
        "x-default": englishUrl,
      },
    }

    entries.push(...sitemapLocales.map((locale) => ({
      url: `${base}${localizedPublicPath(path, locale)}`,
      lastModified: generatedAt,
      changeFrequency: "monthly" as const,
      priority: path === "/pricing" ? 0.9 : 0.7,
      alternates,
    })))
  }
  return entries
}
