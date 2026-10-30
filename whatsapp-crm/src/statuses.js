// Statuts d'une fiche et règles de transition automatiques.

export const STATUSES = {
  a_contacter: 'À contacter',
  contacte: 'Contacté',               // contact touché hors WhatsApp ou avant l'outil (import)
  message_envoye: 'Message envoyé',   // l'API a accepté le message
  en_attente: 'En attente de réponse', // le message est distribué ou lu, pas de réponse
  relance_a_effectuer: 'Relance à effectuer',
  reponse_recue: 'Réponse reçue',
  interesse: 'Intéressé',
  client: 'Client',
  partenaire: 'Partenaire',
  ne_plus_contacter: 'Ne plus contacter',
};

export const CATEGORIES = ['client', 'prospect', 'partenaire', 'professionnel', 'organisateur', 'fournisseur', 'autre'];

// Statuts « acquis » : un envoi ou une relance ne les fait pas redescendre.
const STICKY = new Set(['interesse', 'client', 'partenaire']);

export function statusAfterOutbound(current) {
  if (current === 'ne_plus_contacter' || STICKY.has(current)) return current;
  return 'message_envoye';
}

export function statusAfterDelivery(current) {
  if (current === 'message_envoye' || current === 'contacte') return 'en_attente';
  return current;
}

export function statusAfterInbound(current) {
  if (current === 'ne_plus_contacter' || STICKY.has(current)) return current;
  return 'reponse_recue';
}

export function isFollowupEligible(status) {
  return status === 'message_envoye' || status === 'en_attente' || status === 'relance_a_effectuer';
}

// Rubriques du tableau de bord → requête SQL (clause WHERE sur contacts).
export const SECTIONS = {
  tous: { label: 'Tous les contacts', where: '1=1' },
  contactes: { label: 'Contacts contactés', where: 'first_contacted_at IS NOT NULL' },
  a_contacter: { label: 'À contacter', where: "status = 'a_contacter'" },
  en_attente: { label: 'En attente de réponse', where: "status IN ('message_envoye','en_attente')" },
  relances: { label: 'Relances à effectuer', where: "status = 'relance_a_effectuer'" },
  reponses: { label: 'Réponses reçues', where: "status = 'reponse_recue'" },
  interesses: { label: 'Clients intéressés', where: "status = 'interesse'" },
  clients: { label: 'Clients', where: "status = 'client' OR category = 'client'" },
  partenaires: { label: 'Partenaires', where: "status = 'partenaire' OR category = 'partenaire'" },
  ne_plus_contacter: { label: 'Ne plus contacter', where: "status = 'ne_plus_contacter'" },
};
