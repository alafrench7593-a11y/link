import { PageHero } from "@/components/PageHero";
import { V } from "@/components/Legal";
import { site } from "@/config/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Politique de confidentialité | BTS DÉBARRAT", description: "Comment BTS DÉBARRAT traite les données transmises via le formulaire de devis, WhatsApp et le téléphone.", path: "/politique-de-confidentialite/" });

export default function Confidentialite() {
  return (
    <>
      <PageHero eyebrow="Données personnelles" title="Politique de confidentialité" crumbs={[{ name: "Politique de confidentialité", path: "/politique-de-confidentialite/" }]} />
      <section className="py-16 md:py-24">
        <div className="container-x prose-site max-w-3xl">
          <h2>Responsable du traitement</h2>
          <p>BTS DÉBARRAT — <V v={site.juridique.raisonSociale} />, <V v={site.adresse ? `${site.adresse.rue}, ${site.adresse.codePostal} ${site.adresse.ville}` : null} />. Contact : <V v={site.email} />.</p>
          <h2>Données collectées par le formulaire de devis</h2>
          <ul>
            <li>Informations sur le chantier : type de lieu, ville, code postal, surface, volume, étage, ascenseur, encombrement, date souhaitée, informations complémentaires.</li>
            <li>Photos que vous choisissez de joindre.</li>
            <li>Coordonnées : nom, téléphone, e-mail facultatif, moyen de contact préféré.</li>
          </ul>
          <p>Nous ne collectons que ce qui est nécessaire pour étudier votre demande et vous répondre.</p>
          <h2>Finalité et base légale</h2>
          <p>Ces données servent uniquement à répondre à votre demande de devis et, le cas échéant, à organiser l&apos;intervention. Le traitement repose sur votre consentement et sur les mesures précontractuelles prises à votre demande.</p>
          <h2>Destinataires</h2>
          <p>Les demandes sont transmises par e-mail à BTS DÉBARRAT via le service d&apos;envoi Resend, qui agit en tant que sous-traitant. Le site lui-même ne stocke pas les demandes. Les données ne sont ni vendues ni cédées.</p>
          <p>Si vous nous contactez par WhatsApp, vos messages et photos sont également traités par WhatsApp (Meta) selon ses propres conditions.</p>
          <h2>Durée de conservation</h2>
          <p>Les demandes qui n&apos;aboutissent pas sont conservées au maximum trois ans après le dernier contact. Les données liées à une prestation réalisée sont conservées pendant la durée nécessaire aux obligations légales et comptables.</p>
          <h2>Vos droits</h2>
          <p>Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition et de portabilité. Pour l&apos;exercer, écrivez à <V v={site.email} />. Vous pouvez également introduire une réclamation auprès de la CNIL (cnil.fr).</p>
          <h2>Mesure d&apos;audience</h2>
          <p>Voir la page <a href="/cookies/">Gestion des cookies</a>.</p>
        </div>
      </section>
    </>
  );
}
