/**
 * ZONES — [ZONES_COUVERTES]
 * `couverture` : "confirmee" (intervention habituelle), "sur-demande" (étudiée au cas par cas),
 * "a-confirmer" (valeur par défaut tant que l'entreprise n'a pas validé).
 * Une page locale /zone-intervention/[commune]/ n'est générée QUE si la commune est
 * `confirmee: true` ET possède un `contenu` original (pas de pages locales artificielles).
 */

export type Couverture = "confirmee" | "sur-demande" | "a-confirmer";

export type Departement = { code: string; nom: string; couverture: Couverture };

export type Commune = {
  slug: string;
  nom: string;
  departement: string;
  confirmee: boolean;
  /** Paragraphes originaux et spécifiques à la commune (contraintes réelles, quartiers, accès). */
  contenu: string[] | null;
};

export const departements: Departement[] = [
  { code: "75", nom: "Paris", couverture: "a-confirmer" },
  { code: "77", nom: "Seine-et-Marne", couverture: "a-confirmer" },
  { code: "78", nom: "Yvelines", couverture: "a-confirmer" },
  { code: "91", nom: "Essonne", couverture: "a-confirmer" },
  { code: "92", nom: "Hauts-de-Seine", couverture: "a-confirmer" },
  { code: "93", nom: "Seine-Saint-Denis", couverture: "a-confirmer" },
  { code: "94", nom: "Val-de-Marne", couverture: "a-confirmer" },
  { code: "95", nom: "Val-d'Oise", couverture: "a-confirmer" },
];

/** Communes à examiner. Aucune n'est confirmée tant que l'entreprise ne l'a pas validé. */
export const communes: Commune[] = [
  ["paris", "Paris", "75"], ["montreuil", "Montreuil", "93"], ["vincennes", "Vincennes", "94"],
  ["saint-denis", "Saint-Denis", "93"], ["rosny-sous-bois", "Rosny-sous-Bois", "93"], ["bobigny", "Bobigny", "93"],
  ["noisy-le-grand", "Noisy-le-Grand", "93"], ["champs-sur-marne", "Champs-sur-Marne", "77"], ["creteil", "Créteil", "94"],
  ["champigny-sur-marne", "Champigny-sur-Marne", "94"], ["boulogne-billancourt", "Boulogne-Billancourt", "92"],
  ["nanterre", "Nanterre", "92"], ["versailles", "Versailles", "78"], ["cergy", "Cergy", "95"],
  ["evry-courcouronnes", "Évry-Courcouronnes", "91"], ["melun", "Melun", "77"], ["meaux", "Meaux", "77"],
].map(([slug, nom, departement]) => ({ slug, nom, departement, confirmee: false, contenu: null }));

export const communesPubliees = () => communes.filter((c) => c.confirmee && c.contenu && c.contenu.length > 0);
export const communesConfirmees = () => communes.filter((c) => c.confirmee);
export const libelleCouverture: Record<Couverture, string> = {
  confirmee: "Intervention habituelle",
  "sur-demande": "Étude au cas par cas",
  "a-confirmer": "Selon l'adresse, à vérifier",
};
