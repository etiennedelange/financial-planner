import type { MetadataRoute } from "next"
import { resolveSiteUrl } from "@/lib/utils/site-url"

const siteUrl = resolveSiteUrl()

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
