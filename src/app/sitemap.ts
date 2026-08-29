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
      const englishHome = `${base}/en`
      const homeAlternates = {
        languages: { es: base, en: englishHome, "x-default": base },
      }
      entries.push({
        url: base,
        lastModified: generatedAt,
        changeFrequency: "weekly" as const,
        priority: 1,
        alternates: homeAlternates,
      }, {
        url: englishHome,
        lastModified: generatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.9,
        alternates: homeAlternates,
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

  const drywallLegalPairs = [
    ["/alcance", "/en/scope"],
    ["/terminos", "/en/terms"],
    ["/privacidad", "/en/privacy"],
    ["/reembolsos", "/en/refunds"],
    ["/confidencialidad", "/en/confidentiality"],
  ] as const
  for (const [spanishPath, englishPath] of drywallLegalPairs) {
    const spanishUrl = `${base}${spanishPath}`
    const englishUrl = `${base}${englishPath}`
    const alternates = {
      languages: { es: spanishUrl, en: englishUrl, "x-default": spanishUrl },
    }
    entries.push(
      {
        url: spanishUrl,
        lastModified: generatedAt,
        changeFrequency: "yearly" as const,
        priority: 0.4,
        alternates,
      },
      {
        url: englishUrl,
        lastModified: generatedAt,
        changeFrequency: "yearly" as const,
        priority: 0.4,
        alternates,
      }
    )
  }
  return entries
}
