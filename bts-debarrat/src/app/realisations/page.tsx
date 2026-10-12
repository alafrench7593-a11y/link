import { PageHero } from "@/components/PageHero";
import { RealisationsGrid } from "@/components/RealisationsGrid";
import { CtaFinal } from "@/components/CtaFinal";
import { ButtonLink, WhatsAppButton } from "@/components/Buttons";
import { BeforeAfter } from "@/components/BeforeAfter";
import { RoomIllustration } from "@/components/RoomIllustration";
import { TrackView } from "@/components/MotionProviders";
import { realisationsPubliees } from "@/config/realisations";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Nos réalisations : débarras avant / après | BTS DÉBARRAT",
  description: "Photos avant / après de chantiers de débarras réalisés par BTS DÉBARRAT : maisons, appartements, caves, greniers, garages et locaux professionnels.",
  path: "/realisations/",
});

export default function Realisations() {
  const items = realisationsPubliees();
  return (
    <>
      <TrackView evenement="realisations_consultation" />
      <PageHero
        eyebrow="Nos réalisations"
        title="Avant, après : des chantiers réels"
        intro="Chaque réalisation publiée ici est un chantier de BTS DÉBARRAT, présenté avec l'accord du client et sans élément permettant d'identifier les occupants."
        crumbs={[{ name: "Réalisations", path: "/realisations/" }]}
      >
        <WhatsAppButton emplacement="realisations-hero">J&apos;ai un projet similaire</WhatsAppButton>
      </PageHero>
      <section className="py-20 md:py-28">
        <div className="container-x">
          {items.length > 0 ? (
            <RealisationsGrid items={items} />
          ) : (
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div data-reveal>
                <h2 className="text-[clamp(1.7rem,3vw,2.4rem)] font-extrabold leading-tight">Les premières réalisations arrivent</h2>
                <p className="mt-4 max-w-lg leading-relaxed text-muted">
                  Nous publions uniquement des chantiers authentiques, avec des photos prises par nos équipes et l&apos;autorisation des clients. Cette page s&apos;enrichira au fil des interventions.
                </p>
                <p className="mt-4 max-w-lg leading-relaxed text-muted">En attendant, envoyez-nous des photos de votre lieu : nous vous dirons comment nous l&apos;aborderions.</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <WhatsAppButton emplacement="realisations-vide" />
                  <ButtonLink href="/devis/" variant="dark">Demander un devis</ButtonLink>
                </div>
              </div>
              <div data-reveal style={{ "--d": 150 } as React.CSSProperties}>
                <BeforeAfter
                  label="Illustration d'une cave avant et après débarras"
                  avant={<RoomIllustration kind="cave" state="avant" />}
                  apres={<RoomIllustration kind="cave" state="apres" />}
                  tag="Illustration — pas une réalisation"
                />
              </div>
            </div>
          )}
        </div>
      </section>
      <CtaFinal />
    </>
  );
}
