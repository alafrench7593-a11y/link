import Link from "next/link";
import { Hero } from "@/components/home/Hero";
import { Reassurance } from "@/components/home/Reassurance";
import { BeforeAfterGallery } from "@/components/home/BeforeAfterGallery";
import { Process } from "@/components/home/Process";
import { Why } from "@/components/home/Why";
import { ServiceCards } from "@/components/ServiceCards";
import { SectionHeading } from "@/components/Section";
import { ZoneMap } from "@/components/ZoneMap";
import { Faq } from "@/components/Faq";
import { CtaFinal } from "@/components/CtaFinal";
import { Testimonials } from "@/components/Testimonials";
import { ButtonLink, WhatsAppButton, libelleDevis } from "@/components/Buttons";
import { JsonLd } from "@/components/JsonLd";
import { IconArrow } from "@/components/Icons";
import { servicesAvecPage, servicesSecondaires } from "@/config/services";
import { realisationsPubliees } from "@/config/realisations";
import { departements } from "@/config/zones";
import { site } from "@/config/site";
import { faqAccueil } from "@/content/faq";
import { faqJsonLd, pageMetadata } from "@/lib/seo";
import { whatsappUrl } from "@/lib/whatsapp";

export const metadata = pageMetadata({
  title: "Entreprise de débarras en Île-de-France | BTS DÉBARRAT",
  description:
    "Besoin de vider une maison, un appartement, une cave ou un local ? Présentez votre projet à BTS DÉBARRAT et demandez un devis.",
  path: "/",
});

export default function Accueil() {
  const secondaires = servicesSecondaires();
  return (
    <>
      <Hero />
      <Reassurance />

      <section className="py-24 md:py-32" aria-labelledby="titre-services">
        <div className="container-x">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <SectionHeading
              id="titre-services"
              eyebrow="Nos prestations"
              title="Chaque lieu a ses contraintes. Chaque débarras, sa méthode."
              intro="Particuliers et professionnels : choisissez votre situation pour découvrir comment nous l'abordons, ce qu'il faut préparer et les questions fréquentes."
            />
            <ButtonLink href="/devis/" variant="outline" className="shrink-0">{libelleDevis()}</ButtonLink>
          </div>
          <div className="mt-14">
            <ServiceCards items={servicesAvecPage()} />
          </div>
          {secondaires.length > 0 && (
            <div data-reveal className="mt-10 rounded-[1.25rem] bg-mist p-6 md:p-8">
              <h3 className="text-lg font-bold">Autres prestations</h3>
              <ul className="mt-4 grid gap-4 md:grid-cols-2">
                {secondaires.map((s) => (
                  <li key={s.slug} className="flex gap-3">
                    <IconArrow className="mt-1 size-4 shrink-0 text-accent" />
                    <span><strong className="font-semibold">{s.nomMenu}.</strong> <span className="text-muted">{s.carte}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="on-dark relative overflow-hidden bg-ink py-24 text-white md:py-32" aria-labelledby="titre-avant-apres">
        <div className="pointer-events-none absolute -left-40 bottom-0 size-[36rem] rounded-full bg-accent/25 blur-[140px]" aria-hidden />
        <div className="container-x relative">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <SectionHeading id="titre-avant-apres" dark eyebrow="Avant / après" title="Faites glisser. Voyez l'espace revenir." />
            <ButtonLink href="/realisations/" variant="outline-light" className="shrink-0">Toutes les réalisations</ButtonLink>
          </div>
          <div className="mt-14">
            <BeforeAfterGallery realisations={realisationsPubliees()} whatsappBase={whatsappUrl()} />
          </div>
        </div>
      </section>

      <Process />
      <Why />

      {site.avis.length > 0 && (
        <section className="py-24 md:py-32" aria-labelledby="titre-avis">
          <div className="container-x">
            <SectionHeading id="titre-avis" eyebrow="Avis clients" title="Ils nous ont fait confiance" intro="Découvrez les retours de nos clients après leur débarras." />
            <div className="mt-12">
              <Testimonials avis={site.avis.slice(0, 6)} />
            </div>
            <div className="mt-10 flex flex-wrap gap-3">
              <ButtonLink href="/avis-clients/" variant="dark">Tous nos avis</ButtonLink>
              <ButtonLink href="/devis/" variant="outline">Demander un devis</ButtonLink>
              <WhatsAppButton emplacement="temoignages" />
            </div>
          </div>
        </section>
      )}

      <section className="py-24 md:py-32" aria-labelledby="titre-zone">
        <div className="container-x">
          <SectionHeading
            id="titre-zone"
            eyebrow="Zone d'intervention"
            title="Paris et l'Île-de-France, adresse par adresse"
            intro="Nous étudions les demandes dans les huit départements franciliens. La faisabilité dépend de l'adresse exacte et des contraintes du chantier."
          />
          <div className="mt-14">
            <ZoneMap departements={departements} />
          </div>
          <Link href="/zone-intervention/" className="group mt-10 inline-flex items-center gap-2 font-semibold text-accent">
            En savoir plus sur notre zone d&apos;intervention <IconArrow className="btn-arrow size-4" />
          </Link>
        </div>
      </section>

      <section className="bg-mist py-24 md:py-32" aria-labelledby="titre-faq">
        <div className="container-x grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <SectionHeading id="titre-faq" eyebrow="Questions fréquentes" title="Prix, délais, photos : les réponses franches" />
            <div data-reveal className="mt-8">
              <WhatsAppButton emplacement="faq">Poser ma question</WhatsAppButton>
            </div>
          </div>
          <Faq items={faqAccueil} />
        </div>
      </section>

      <div className="pt-24 md:pt-32">
        <CtaFinal />
      </div>
      <JsonLd data={faqJsonLd(faqAccueil)} />
    </>
  );
}
