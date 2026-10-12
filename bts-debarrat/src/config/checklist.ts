import { site } from "./site";
import { departements, communesConfirmees } from "./zones";
import { realisationsPubliees } from "./realisations";

export type Point = { id: string; libelle: string; ok: boolean; bloquant: boolean; aide: string };

/** Ce qui doit être complété avant la mise en ligne. */
export function checklist(): Point[] {
  const env = (k: string) => Boolean(process.env[k]);
  return [
    { id: "whatsapp", libelle: "[NUMERO_WHATSAPP]", ok: !!site.whatsapp, bloquant: true, aide: "src/config/site.ts → whatsapp (ex. 33612345678)" },
    { id: "telephone", libelle: "[TELEPHONE]", ok: !!site.telephone && !!site.telephoneLien, bloquant: true, aide: "src/config/site.ts → telephone + telephoneLien" },
    { id: "email", libelle: "[EMAIL]", ok: !!site.email, bloquant: true, aide: "src/config/site.ts → email" },
    { id: "adresse", libelle: "[ADRESSE_ENTREPRISE]", ok: !!site.adresse, bloquant: true, aide: "Obligatoire dans les mentions légales" },
    { id: "siret", libelle: "[SIRET] et informations juridiques", ok: !!site.juridique.siret && !!site.juridique.raisonSociale && !!site.juridique.directeurPublication && !!site.juridique.hebergeur, bloquant: true, aide: "src/config/site.ts → juridique" },
    { id: "horaires", libelle: "[HORAIRES]", ok: !!site.horaires?.length, bloquant: false, aide: "src/config/site.ts → horaires" },
    { id: "zones", libelle: "[ZONES_COUVERTES] départements validés", ok: departements.some((d) => d.couverture !== "a-confirmer"), bloquant: true, aide: "src/config/zones.ts → couverture de chaque département" },
    { id: "communes", libelle: "Communes réellement desservies", ok: communesConfirmees().length > 0, bloquant: false, aide: "src/config/zones.ts → confirmee + contenu" },
    { id: "devis", libelle: "Transmission du formulaire (Resend)", ok: env("RESEND_API_KEY") && env("DEVIS_DESTINATAIRE") && env("DEVIS_EXPEDITEUR"), bloquant: true, aide: "Variables RESEND_API_KEY, DEVIS_DESTINATAIRE, DEVIS_EXPEDITEUR" },
    { id: "url", libelle: "URL publique du site", ok: env("NEXT_PUBLIC_SITE_URL") && !process.env.NEXT_PUBLIC_SITE_URL!.includes("exemple"), bloquant: true, aide: "Variable NEXT_PUBLIC_SITE_URL" },
    { id: "gbp", libelle: "[LIEN_GOOGLE_BUSINESS]", ok: !!site.lienGoogleBusiness, bloquant: false, aide: "src/config/site.ts → lienGoogleBusiness" },
    { id: "avisgoogle", libelle: "[LIEN_AVIS_GOOGLE]", ok: !!site.lienAvisGoogle, bloquant: false, aide: "src/config/site.ts → lienAvisGoogle" },
    { id: "logo", libelle: "[LOGO]", ok: !!site.logo, bloquant: false, aide: "Déposer le fichier dans /public et renseigner site.logo" },
    { id: "photos", libelle: "[PHOTOS_REALISATIONS]", ok: realisationsPubliees().length > 0, bloquant: false, aide: "src/config/realisations.ts + /public/photos/realisations" },
    { id: "avis", libelle: "[AVIS_CLIENTS]", ok: site.avis.length > 0, bloquant: false, aide: "src/config/site.ts → avis (authentiques et autorisés)" },
    { id: "devisgratuit", libelle: "Gratuité du devis confirmée (ou non)", ok: site.confirmations.devisGratuit, bloquant: false, aide: "site.confirmations.devisGratuit — tant que false, le mot « gratuit » n'apparaît pas" },
  ];
}

export const pointsBloquantsManquants = () => checklist().filter((p) => p.bloquant && !p.ok);
