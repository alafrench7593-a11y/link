import { PageHero } from "@/components/PageHero";
import { V } from "@/components/Legal";
import { site } from "@/config/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Mentions légales | BTS DÉBARRAT", description: "Mentions légales du site de BTS DÉBARRAT : éditeur, hébergeur, propriété intellectuelle.", path: "/mentions-legales/" });

export default function MentionsLegales() {
  const j = site.juridique;
  const a = site.adresse;
  return (
    <>
      <PageHero eyebrow="Informations légales" title="Mentions légales" crumbs={[{ name: "Mentions légales", path: "/mentions-legales/" }]} />
      <section className="py-16 md:py-24">
        <div className="container-x prose-site max-w-3xl">
          <h2>Éditeur du site</h2>
          <ul>
            <li>Nom commercial : BTS DÉBARRAT</li>
            <li>Raison sociale : <V v={j.raisonSociale} /></li>
            <li>Forme juridique : <V v={j.formeJuridique} />{j.capital ? ` au capital de ${j.capital}` : ""}</li>
            <li>Siège : <V v={a ? `${a.rue}, ${a.codePostal} ${a.ville}` : null} /></li>
            <li>SIRET : <V v={j.siret} /></li>
            <li>Immatriculation (RCS ou RM) : <V v={j.rcsOuRm} /></li>
            {j.tvaIntracom && <li>TVA intracommunautaire : {j.tvaIntracom}</li>}
            <li>Téléphone : <V v={site.telephone} /></li>
            <li>E-mail : <V v={site.email} /></li>
            <li>Directeur de la publication : <V v={j.directeurPublication} /></li>
          </ul>
          <h2>Hébergement</h2>
          <p><V v={j.hebergeur} /></p>
          <h2>Propriété intellectuelle</h2>
          <p>Les textes, illustrations, photographies et éléments graphiques de ce site sont la propriété de BTS DÉBARRAT ou utilisés avec autorisation. Toute reproduction sans accord préalable est interdite.</p>
          <p>Les photographies de chantiers sont publiées avec l&apos;accord des clients concernés et ne comportent pas d&apos;élément permettant d&apos;identifier les occupants.</p>
          <h2>Données personnelles</h2>
          <p>Le traitement des données transmises via le site est décrit dans la <a href="/politique-de-confidentialite/">politique de confidentialité</a>.</p>
          <h2>Médiation de la consommation</h2>
          <p>Conformément au Code de la consommation, le client consommateur peut recourir gratuitement à un médiateur de la consommation : <V v={null} /></p>
        </div>
      </section>
    </>
  );
}
