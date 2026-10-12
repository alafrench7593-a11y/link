import { PageHero } from "@/components/PageHero";
import { site } from "@/config/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Gestion des cookies | BTS DÉBARRAT", description: "Cookies et traceurs utilisés sur le site de BTS DÉBARRAT, et comment modifier votre choix.", path: "/cookies/" });

export default function Cookies() {
  const f = site.analytics.fournisseur;
  return (
    <>
      <PageHero eyebrow="Traceurs" title="Gestion des cookies" crumbs={[{ name: "Cookies", path: "/cookies/" }]} />
      <section className="py-16 md:py-24">
        <div className="container-x prose-site max-w-3xl">
          {f === null && <p>Ce site ne dépose actuellement aucun cookie de mesure d&apos;audience ni de publicité.</p>}
          {f === "plausible" && <p>La fréquentation est mesurée avec Plausible Analytics, un outil qui ne dépose pas de cookie et ne collecte pas de donnée personnelle identifiante. Aucun consentement n&apos;est donc demandé.</p>}
          {f === "ga4" && (
            <>
              <p>Avec votre accord, nous utilisons Google Analytics 4 pour mesurer la fréquentation (pages consultées, clics sur les boutons de contact). Sans accord, aucun cookie de mesure n&apos;est déposé.</p>
              <p>Pour modifier votre choix, effacez les données de ce site dans votre navigateur : la question vous sera posée à nouveau.</p>
            </>
          )}
          <h2>Stockage local</h2>
          <p>Le formulaire de devis conserve temporairement votre saisie dans votre navigateur (session en cours) pour éviter de la perdre en cas de rechargement. Elle est effacée à la fermeture de l&apos;onglet ou après l&apos;envoi.</p>
          <h2>Services tiers</h2>
          <p>Les boutons WhatsApp ouvrent le service WhatsApp (Meta) uniquement lorsque vous cliquez dessus.</p>
        </div>
      </section>
    </>
  );
}
