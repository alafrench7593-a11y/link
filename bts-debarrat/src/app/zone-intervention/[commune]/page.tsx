import { notFound } from "next/navigation";
import { PageHero } from "@/components/PageHero";
import { CtaFinal } from "@/components/CtaFinal";
import { ButtonLink, WhatsAppButton } from "@/components/Buttons";
import { ServiceCards } from "@/components/ServiceCards";
import { communesPubliees, departements } from "@/config/zones";
import { servicesAvecPage } from "@/config/services";
import { pageMetadata } from "@/lib/seo";

/** Page locale générée uniquement pour une commune confirmée ET dotée d'un contenu original. */
export const dynamicParams = false;

export function generateStaticParams() {
  return communesPubliees().map((c) => ({ commune: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ commune: string }> }) {
  const cible = (await params).commune;
  const c = communesPubliees().find((x) => x.slug === cible);
  if (!c) return {};
  return pageMetadata({
    title: `Débarras à ${c.nom} (${c.departement}) | BTS DÉBARRAT`,
    description: `Débarras de logements, caves et locaux à ${c.nom}. Contraintes locales, préparation et demande de devis auprès de BTS DÉBARRAT.`,
    path: `/zone-intervention/${c.slug}/`,
  });
}

export default async function Commune({ params }: { params: Promise<{ commune: string }> }) {
  const cible = (await params).commune;
  const c = communesPubliees().find((x) => x.slug === cible);
  if (!c || !c.contenu) notFound();
  const dep = departements.find((d) => d.code === c.departement);
  const message = `Bonjour BTS DÉBARRAT, je souhaite obtenir un devis pour un débarras à ${c.nom}. Le type de bien est [type de bien]. Pouvez-vous m'indiquer les informations nécessaires ?`;
  return (
    <>
      <PageHero eyebrow={`${dep?.nom ?? ""} (${c.departement})`} title={`Débarras à ${c.nom}`} crumbs={[{ name: "Zone d'intervention", path: "/zone-intervention/" }, { name: c.nom, path: `/zone-intervention/${c.slug}/` }]}>
        <WhatsAppButton message={message} emplacement={`commune-${c.slug}`} />
        <ButtonLink href="/devis/" variant="dark">Demander un devis</ButtonLink>
      </PageHero>
      <section className="py-20">
        <div className="container-x prose-site max-w-3xl">{c.contenu.map((p) => <p key={p}>{p}</p>)}</div>
      </section>
      <section className="bg-mist py-20"><div className="container-x"><ServiceCards items={servicesAvecPage()} /></div></section>
      <div className="pt-20"><CtaFinal message={message} /></div>
    </>
  );
}
