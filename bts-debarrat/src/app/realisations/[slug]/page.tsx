import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/PageHero";
import { BeforeAfter } from "@/components/BeforeAfter";
import { CtaFinal } from "@/components/CtaFinal";
import { ButtonLink, WhatsAppButton } from "@/components/Buttons";
import { realisationsPubliees } from "@/config/realisations";
import { getService } from "@/config/services";
import { pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

const pages = () => realisationsPubliees().filter((r) => r.pageDediee);

export function generateStaticParams() {
  return pages().map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const cible = (await params).slug;
  const r = pages().find((x) => x.slug === cible);
  if (!r) return { robots: { index: false } };
  return pageMetadata({ title: `${r.titre}${r.ville ? ` à ${r.ville}` : ""} | BTS DÉBARRAT`, description: r.resume, path: `/realisations/${r.slug}/` });
}

export default async function Realisation({ params }: { params: Promise<{ slug: string }> }) {
  const cible = (await params).slug;
  const r = pages().find((x) => x.slug === cible);
  if (!r) notFound();
  const service = getService(r.service);
  const message = `Bonjour BTS DÉBARRAT, j'ai vu la réalisation « ${r.titre} » et j'ai un projet similaire à [ville]. Je peux vous envoyer des photos.`;
  return (
    <>
      <PageHero eyebrow={[r.ville, r.date].filter(Boolean).join(" · ") || "Réalisation"} title={r.titre} intro={r.resume} crumbs={[{ name: "Réalisations", path: "/realisations/" }, { name: r.titre, path: `/realisations/${r.slug}/` }]}>
        <WhatsAppButton message={message} emplacement={`realisation-${r.slug}`}>J&apos;ai un projet similaire</WhatsAppButton>
        <ButtonLink href="/devis/" variant="dark">Demander un devis</ButtonLink>
      </PageHero>
      <section className="py-16 md:py-24">
        <div className="container-x">
          <BeforeAfter
            label={r.titre}
            avant={<Image src={r.photoAvant} alt={r.altAvant} fill sizes="100vw" className="object-cover" priority />}
            apres={<Image src={r.photoApres} alt={r.altApres} fill sizes="100vw" className="object-cover" />}
          />
          <div className="mt-16 grid gap-12 lg:grid-cols-3">
            <div><h2 className="text-xl font-bold">Le besoin</h2><p className="mt-3 leading-relaxed text-muted">{r.besoin}</p></div>
            <div><h2 className="text-xl font-bold">Les contraintes</h2><ul className="mt-3 list-disc space-y-1 pl-5 text-muted">{r.contraintes.map((c) => <li key={c}>{c}</li>)}</ul></div>
            <div><h2 className="text-xl font-bold">La prestation</h2><p className="mt-3 leading-relaxed text-muted">{r.prestation}</p></div>
          </div>
          <div className="mt-12 rounded-2xl bg-mist p-8"><h2 className="text-xl font-bold">Le résultat</h2><p className="mt-3 leading-relaxed text-muted">{r.resultat}</p></div>
          {r.galerie && r.galerie.length > 0 && (
            <ul className="mt-12 grid gap-4 md:grid-cols-3">
              {r.galerie.map((g) => <li key={g.src} className="relative aspect-[3/2] overflow-hidden rounded-xl"><Image src={g.src} alt={g.alt} fill sizes="33vw" className="object-cover" /></li>)}
            </ul>
          )}
          {service && <p className="mt-12">Prestation correspondante : <Link href={`/${service.slug}/`} className="font-semibold text-accent underline">{service.nomMenu}</Link></p>}
        </div>
      </section>
      <CtaFinal message={message} />
    </>
  );
}
