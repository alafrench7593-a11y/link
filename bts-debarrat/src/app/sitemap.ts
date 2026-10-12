import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/site";
import { servicesAvecPage } from "@/config/services";
import { realisationsPubliees } from "@/config/realisations";
import { communesPubliees } from "@/config/zones";

export default function sitemap(): MetadataRoute.Sitemap {
  const u = (p: string, priority: number) => ({ url: `${siteUrl}${p}`, priority });
  return [
    u("/", 1),
    u("/devis/", 0.9),
    ...servicesAvecPage().map((s) => u(`/${s.slug}/`, 0.9)),
    u("/realisations/", 0.7),
    ...realisationsPubliees().filter((r) => r.pageDediee).map((r) => u(`/realisations/${r.slug}/`, 0.6)),
    u("/avis-clients/", 0.7),
    u("/zone-intervention/", 0.7),
    ...communesPubliees().map((c) => u(`/zone-intervention/${c.slug}/`, 0.6)),
    u("/a-propos/", 0.5),
    u("/contact/", 0.6),
    u("/mentions-legales/", 0.2),
    u("/politique-de-confidentialite/", 0.2),
    u("/cookies/", 0.2),
  ];
}
