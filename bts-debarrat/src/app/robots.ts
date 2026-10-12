import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/espace-pro/", "/marque/"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
