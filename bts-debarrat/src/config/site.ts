/**
 * CONFIGURATION CENTRALE DE BTS DÉBARRAT
 * ---------------------------------------------------------------
 * Toutes les informations modifiables du site sont ici.
 * Règle : une valeur inconnue reste `null`. Ne jamais la remplacer
 * par une valeur inventée. Le site masque ce qui est `null` et la page
 * /espace-pro/ liste ce qui reste à fournir avant la mise en ligne.
 */

export type Avis = {
  /** Prénom ou nom public, publié avec l'autorisation du client. */
  auteur: string;
  /** Note sur 5, telle que donnée par le client sur la source. */
  note: number | null;
  texte: string;
  prestation: string | null;
  ville: string | null;
  /** Date de publication sur la source, format AAAA-MM-JJ. */
  date: string;
  /** Ex. "Google", "Avis recueilli par e-mail". */
  source: string;
  lienSource: string | null;
};

export const site = {
  nom: "BTS DÉBARRAT",

  /** [NUMERO_WHATSAPP] au format international SANS + ni espaces, ex. 33612345678. */
  whatsapp: null as string | null,
  /** [TELEPHONE] au format affiché, ex. "06 12 34 56 78". */
  telephone: null as string | null,
  /** [TELEPHONE] au format international pour le lien tel:, ex. "+33612345678". */
  telephoneLien: null as string | null,
  /** [EMAIL] adresse publique de contact. */
  email: null as string | null,

  /** [ADRESSE_ENTREPRISE] adresse officielle (siège). */
  adresse: null as null | {
    rue: string;
    codePostal: string;
    ville: string;
    /** false = adresse de domiciliation, non affichée comme lieu d'accueil du public. */
    recoitDuPublic: boolean;
  },

  /** Informations juridiques — [SIRET]. */
  juridique: {
    raisonSociale: null as string | null,
    formeJuridique: null as string | null,
    siret: null as string | null,
    rcsOuRm: null as string | null,
    capital: null as string | null,
    tvaIntracom: null as string | null,
    directeurPublication: null as string | null,
    hebergeur: null as string | null,
  },

  /** [HORAIRES] tels qu'ils seront affichés, ex. ["Lundi – vendredi : 8 h – 19 h"]. */
  horaires: null as string[] | null,

  /** [LIEN_GOOGLE_BUSINESS] URL publique de la fiche Google Business Profile. */
  lienGoogleBusiness: null as string | null,
  /** [LIEN_AVIS_GOOGLE] lien direct « laisser un avis » (Google Business Profile > Demander des avis). */
  lienAvisGoogle: null as string | null,
  /**
   * Note et nombre d'avis Google, recopiés À LA MAIN depuis la fiche, avec la date du relevé.
   * Rien n'est synchronisé automatiquement : laisser null tant que le relevé n'est pas fait.
   */
  releveGoogle: null as null | { note: number; nombre: number; dateReleve: string },

  /** [LOGO] chemin dans /public, ex. "/logo.svg". null = logotype typographique. */
  logo: "/brand/logo-horizontal.svg" as string | null,

  /** [AVIS_CLIENTS] témoignages authentiques et autorisés uniquement. */
  avis: [] as Avis[],

  /** Assurance professionnelle (RC Pro) : assureur et numéro, si souhaité à l'affichage. */
  assurance: null as null | { assureur: string; contrat: string | null },
  /** Certifications ou agréments réels, avec leur intitulé exact. */
  certifications: [] as string[],
  /** Engagements environnementaux réellement tenus (filières, partenaires réels). */
  engagementsEnvironnement: [] as string[],

  /**
   * Engagements commerciaux : à passer à `true` UNIQUEMENT après confirmation par l'entreprise.
   * Tant qu'ils restent `false`, le site n'en parle pas.
   */
  confirmations: {
    devisGratuit: false,
    particuliersEtProfessionnels: true,
    deplacementPourEstimation: false,
    debarrasGratuitPossible: false,
  },

  /** Mesure d'audience. null = aucun script chargé. */
  analytics: {
    /** "plausible" (sans cookie, pas de bannière) ou "ga4" (bannière de consentement affichée). */
    fournisseur: null as null | "plausible" | "ga4",
    /** Domaine Plausible ou identifiant GA4 (G-XXXXXXX). */
    identifiant: null as string | null,
  },

  /** Code de vérification Google Search Console (balise meta), sans guillemets. */
  googleSiteVerification: null as string | null,
};

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
