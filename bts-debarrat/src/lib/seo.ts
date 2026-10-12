import type { Metadata } from "next";
import { site, siteUrl } from "@/config/site";
import { departements } from "@/config/zones";

export function pageMetadata({ title, description, path, noindex = false }: { title: string; description: string; path: string; noindex?: boolean }): Metadata {
  const url = `${siteUrl}${path}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: { type: "website", locale: "fr_FR", url, siteName: site.nom, title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * LocalBusiness : seules les informations réellement renseignées dans la configuration
 * sont publiées. Aucune note agrégée n'est balisée (avis auto-hébergés non éligibles).
 */
export function localBusinessJsonLd() {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl}/#entreprise`,
    name: site.nom,
    url: `${siteUrl}/`,
    description: "Entreprise de débarras de maisons, appartements, caves, greniers, garages, bureaux et locaux professionnels.",
  };
  if (site.telephoneLien) data.telephone = site.telephoneLien;
  if (site.email) data.email = site.email;
  if (site.logo) data.logo = `${siteUrl}${site.logo}`;
  if (site.adresse) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: site.adresse.rue,
      postalCode: site.adresse.codePostal,
      addressLocality: site.adresse.ville,
      addressCountry: "FR",
    };
  }
  const zones = departements.filter((d) => d.couverture === "confirmee");
  if (zones.length) data.areaServed = zones.map((d) => ({ "@type": "AdministrativeArea", name: `${d.nom} (${d.code})` }));
  if (site.lienGoogleBusiness) data.sameAs = [site.lienGoogleBusiness];
  return data;
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${siteUrl}${it.path}` })),
  };
}

export function faqJsonLd(items: { q: string; r: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.r } })),
  };
}

export function serviceJsonLd(nom: string, description: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: nom,
    description,
    url: `${siteUrl}${path}`,
    serviceType: "Débarras",
    provider: { "@id": `${siteUrl}/#entreprise` },
  };
}
