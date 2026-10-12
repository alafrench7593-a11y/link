import { site } from "@/config/site";

/**
 * Arguments affichés (bandeau de réassurance et « Pourquoi BTS DÉBARRAT »).
 * À VALIDER par l'entreprise : passer `actif` à false pour tout engagement
 * qui ne peut pas être tenu systématiquement.
 */
export const reassurance = () =>
  [
    { actif: site.confirmations.devisGratuit, texte: "Devis gratuit" },
    { actif: true, texte: "Étude du volume et des contraintes d'accès" },
    { actif: true, texte: "Accompagnement personnalisé" },
    { actif: site.confirmations.particuliersEtProfessionnels, texte: "Particuliers et professionnels" },
    { actif: true, texte: "Organisation adaptée au chantier" },
    { actif: !!site.whatsapp, texte: "Contact simple par WhatsApp" },
  ].filter((r) => r.actif);

export type Argument = { actif: boolean; icone: "phone" | "clipboard" | "check" | "truck" | "shield" | "recycle"; titre: string; texte: string };

export const arguments_: Argument[] = [
  { actif: true, icone: "phone", titre: "Un contact accessible", texte: "WhatsApp, téléphone ou formulaire : vous choisissez le canal, vous envoyez vos photos, nous revenons vers vous avec des questions précises." },
  { actif: true, icone: "clipboard", titre: "Une étude personnalisée", texte: "Chaque lieu a ses contraintes : étage, ascenseur, stationnement, nature des objets. Elles sont regardées avant de vous proposer quoi que ce soit." },
  { actif: true, icone: "check", titre: "Un devis détaillé", texte: "Le périmètre, les modalités et le prix sont écrits avant l'intervention. Vous validez, ou non, en connaissance de cause." },
  { actif: true, icone: "truck", titre: "Une organisation adaptée", texte: "Nombre de personnes, durée, horaires et accès sont préparés en fonction du chantier, pas d'un forfait standard." },
  { actif: true, icone: "shield", titre: "Le respect des lieux", texte: "Parties communes, voisinage, objets à conserver : vos consignes sont la base de l'intervention." },
  { actif: true, icone: "recycle", titre: "Tri et orientation", texte: "Les objets sont orientés selon leur état et les filières disponibles : réemploi lorsque c'est possible, recyclage, traitement adapté." },
];

export const etapes = [
  { titre: "Vous nous présentez votre besoin", texte: "Par WhatsApp, téléphone ou formulaire : type de bien, ville, volume approximatif, photos si possible." },
  { titre: "Nous étudions le chantier", texte: "Volume, accès, étage, stationnement, objets particuliers. Nous posons les questions utiles et, si nécessaire, proposons une visite." },
  { titre: "Nous vous proposons des modalités adaptées", texte: "Un devis détaillé précise le périmètre, l'organisation et le prix." },
  { titre: "L'intervention est organisée", texte: "Après validation du devis, l'intervention a lieu selon les conditions et la date convenues ensemble." },
];
