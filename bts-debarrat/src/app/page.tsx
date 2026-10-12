import Link from "next/link";
import { Hero } from "@/components/home/Hero";
import { Statement } from "@/components/home/Statement";
import { Prestations } from "@/components/home/Prestations";
import { BeforeAfterGallery } from "@/components/home/BeforeAfterGallery";
import { Methode } from "@/components/home/Methode";
import { Engagements } from "@/components/home/Engagements";
import { AvisSection } from "@/components/home/AvisSection";
import { ContactFinal } from "@/components/home/ContactFinal";
import { Faq } from "@/components/Faq";
import { JsonLd } from "@/components/JsonLd";
import { IconArrow } from "@/components/Icons";
import { servicesAvecPage, servicesSecondaires } from "@/config/services";
import { realisationsPubliees } from "@/config/realisations";
import { departements } from "@/config/zones";
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
  return (
    <>
      <Hero />
      <Statement />
      <Prestations items={servicesAvecPage()} />

      <section className="bg-white pb-24 md:pb-36" aria-labelledby="titre-avant-apres">
        <div className="container-x">
          <div className="grid gap-6 border-t border-line pt-16 md:grid-cols-12 md:items-end md:pt-24">
            <h2 id="titre-avant-apres" data-split="" className="font-display text-[clamp(2.4rem,5.5vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.045em] md:col-span-7">
              {["Avant, après.", "Une pièce à la fois."].map((l, i) => (
                <span key={l} className="split-word block" style={{ "--i": i * 3 } as React.CSSProperties}><span>{l} </span></span>
              ))}
            </h2>
            <p data-reveal className="max-w-md text-[1.05rem] leading-relaxed text-muted md:col-span-5 md:justify-self-end">
              Faites glisser le curseur. Les réalisations de BTS DÉBARRAT seront présentées ici avec leurs vraies photos, prises au même endroit avant et après l&apos;intervention.
            </p>
          </div>
          <div className="mt-12 md:mt-16">
            <BeforeAfterGallery realisations={realisationsPubliees()} whatsappBase={whatsappUrl()} />
          </div>
        </div>
      </section>

      <Methode />
      <Engagements />
      <AvisSection />

      <section className="bg-mist py-24 md:py-32" aria-labelledby="titre-faq">
        <div className="container-x grid gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <h2 id="titre-faq" data-reveal className="font-display text-[clamp(2rem,3.6vw,3rem)] font-semibold leading-[1.02] tracking-[-0.04em]">Questions fréquentes</h2>
            <p data-reveal className="mt-5 max-w-xs text-[0.98rem] leading-relaxed text-muted">Prix, délais, photos, succession : des réponses franches, sans promesse que nous ne pourrions pas tenir.</p>
          </div>
          <div className="md:col-span-8"><Faq items={faqAccueil} /></div>
        </div>
      </section>

      <section className="bg-mist pb-24 md:pb-32" aria-labelledby="titre-zone">
        <div className="container-x grid gap-10 border-t border-line pt-14 md:grid-cols-12">
          <h2 id="titre-zone" data-reveal className="font-display text-[clamp(1.8rem,3vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.035em] md:col-span-4">Paris et l&apos;Île-de-France</h2>
          <div className="md:col-span-8">
            <ul data-reveal className="flex flex-wrap gap-x-6 gap-y-2 text-[1.05rem]">
              {departements.map((d) => (
                <li key={d.code}>{d.nom} <span className="text-stone">{d.code}</span></li>
              ))}
            </ul>
            <p data-reveal className="mt-5 max-w-xl text-[0.95rem] leading-relaxed text-muted">
              La faisabilité dépend de l&apos;adresse exacte : indiquez votre commune, nous vous répondons clairement.
            </p>
            <Link href="/zone-intervention/" className="group mt-3 inline-flex min-h-11 items-center gap-1.5 font-medium">
              Zone d&apos;intervention <IconArrow className="btn-arrow size-4" />
            </Link>
            {servicesSecondaires().length > 0 && (
              <p className="mt-10 text-[0.9rem] leading-relaxed text-muted">
                Également : {servicesSecondaires().map((s) => s.nomMenu.toLowerCase()).join(" · ")}.
              </p>
            )}
          </div>
        </div>
      </section>

      <ContactFinal />
      <JsonLd data={faqJsonLd(faqAccueil)} />
    </>
  );
}
