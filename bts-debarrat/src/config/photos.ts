/**
 * PHOTOGRAPHIES — catalogue unique de toutes les images du site.
 *
 * Chaque emplacement décrit ce que la photo doit montrer. Tant que `src` est null,
 * le site affiche un emplacement neutre et légendé : aucune image n'est simulée.
 *
 * - Photo de banque d'images : `demonstration: true` + `credit` renseigné (auteur, lien, licence).
 *   Elle est alors légendée « Photo d'illustration » et n'est JAMAIS présentée comme un chantier.
 * - Photo de BTS DÉBARRAT : `demonstration: false`, `credit: null`.
 *
 * Fichiers : /public/photos/<id>.webp (ou .jpg), largeur 2000 px conseillée.
 * Téléchargement automatique depuis `credit.telechargement` : npm run photos
 */

export type Credit = {
  auteur: string;
  /** Page de la photo sur la banque d'images. */
  page: string;
  /** "Licence Unsplash" ou "Licence Pexels" : usage commercial gratuit, sans attribution obligatoire. */
  licence: string;
  /** URL directe du fichier, utilisée par scripts/photos.mjs. */
  telechargement: string | null;
};

export type Photo = {
  id: string;
  /** Ce que la photo doit montrer — sert de légende tant qu'elle manque. */
  sujet: string;
  alt: string;
  src: string | null;
  demonstration: boolean;
  credit: Credit | null;
};

const vide = (id: string, sujet: string, alt: string): Photo => ({ id, sujet, alt, src: null, demonstration: true, credit: null });

export const photos = {
  hero: vide("hero", "Pièce encombrée de meubles et de cartons, lumière naturelle", "Pièce d'habitation encombrée de cartons et de meubles avant un débarras"),
  equipe: vide("equipe", "Deux personnes portant un meuble vers la sortie d'un logement", "Professionnels transportant un meuble hors d'un logement"),
  vide: vide("vide", "Pièce vide et propre, parquet, fenêtre", "Pièce vidée, sol dégagé, lumière naturelle"),
  maison: vide("maison", "Séjour de maison rempli de meubles anciens", "Séjour de maison encombré de meubles"),
  appartement: vide("appartement", "Appartement avec cartons empilés", "Appartement encombré de cartons empilés"),
  cave: vide("cave", "Cave d'immeuble encombrée, étagères et cartons", "Cave encombrée d'étagères et de cartons"),
  grenier: vide("grenier", "Combles sous charpente avec malles et cartons", "Grenier sous charpente encombré de malles"),
  garage: vide("garage", "Garage rempli d'outils, d'étagères et de cartons", "Garage encombré d'étagères et d'outils"),
  succession: vide("succession", "Intérieur ancien meublé, souvenirs, bibliothèque", "Intérieur ancien meublé avant un débarras après succession"),
  bureaux: vide("bureaux", "Bureaux avec mobilier et cartons avant déménagement", "Bureaux avec mobilier et cartons avant libération des locaux"),
  commerce: vide("commerce", "Réserve ou boutique avec rayonnages et stock", "Local commercial avec rayonnages et stock à évacuer"),
  contact: vide("contact", "Porte d'entrée ouverte sur un couloir vide", "Couloir vide vu depuis une porte ouverte"),
} satisfies Record<string, Photo>;

export type PhotoId = keyof typeof photos;

/** Correspondance prestation → photo. */
export const photoService: Record<string, PhotoId> = {
  "debarras-maison": "maison",
  "debarras-appartement": "appartement",
  "debarras-cave": "cave",
  "debarras-grenier": "grenier",
  "debarras-garage-box": "garage",
  "debarras-succession": "succession",
  "debarras-bureaux": "bureaux",
  "debarras-local-commercial": "commerce",
};
