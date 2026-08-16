import type { MetadataRoute } from "next"
import { resolveSiteUrl } from "@/lib/utils/site-url"

const siteUrl = resolveSiteUrl()

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteUrl}/calculator`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/calculator/overview`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/calculator/plan`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/calculator/expenses`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ]
}
