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

  return publicMarketingPaths.flatMap((path) => {
    const englishUrl = `${base}${localizedPublicPath(path, "en")}`
    const spanishUrl = `${base}${localizedPublicPath(path, "es")}`
    const alternates = {
      languages: {
        en: englishUrl,
        es: spanishUrl,
        "x-default": englishUrl,
      },
    }

    return sitemapLocales.map((locale) => ({
      url: `${base}${localizedPublicPath(path, locale)}`,
      lastModified: generatedAt,
      changeFrequency:
        path === "/" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "/" ? 1 : path === "/pricing" ? 0.9 : 0.7,
      alternates,
    }))
  })
}
