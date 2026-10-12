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
  { titre: "Présentez votre besoin", texte: "Un message WhatsApp avec quelques photos, un appel ou le formulaire : type de bien, ville, volume approximatif, contraintes d'accès." },
  { titre: "Recevez une proposition adaptée", texte: "Nous étudions le lieu et revenons vers vous avec un devis détaillé : périmètre, organisation, prix. Rien n'est engagé avant votre accord." },
  { titre: "L'intervention est organisée", texte: "Après validation, nous fixons la date et les modalités ensemble, puis nous prenons en charge le tri, la manutention et l'évacuation." },
];
