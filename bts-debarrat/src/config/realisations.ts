/**
 * RÉALISATIONS — [PHOTOS_REALISATIONS]
 * N'ajouter que des chantiers réels, avec l'accord du client pour publier
 * les photos (aucun visage, plaque, nom, courrier ou élément identifiant).
 * Photos à déposer dans /public/photos/realisations/<slug>/avant.webp et apres.webp
 * (format 3:2 conseillé, 1600 × 1067 px, WebP ou AVIF).
 */
import type { TypeBien } from "./services";

export type Realisation = {
  slug: string;
  titre: string;
  typeBien: Exclude<TypeBien, "autre">;
  /** Slug de la prestation correspondante, ex. "debarras-appartement". */
  service: string;
  /** Ville uniquement si connue ET publiable. */
  ville: string | null;
  date: string | null;
  resume: string;
  besoin: string;
  contraintes: string[];
  prestation: string;
  resultat: string;
  photoAvant: string;
  photoApres: string;
  altAvant: string;
  altApres: string;
  /** Photos supplémentaires facultatives. */
  galerie?: { src: string; alt: string }[];
  /** true = page individuelle /realisations/<slug>/ générée. */
  pageDediee: boolean;
  autorisationClient: boolean;
};

/*
Exemple de structure (à dupliquer avec de VRAIES informations) :
{
  slug: "debarras-appartement-montreuil",
  titre: "Débarras d'un appartement de trois pièces",
  typeBien: "appartement",
  service: "debarras-appartement",
  ville: "Montreuil",
  date: "2026-09",
  resume: "…",
  besoin: "…",
  contraintes: ["4e étage sans ascenseur", "…"],
  prestation: "…",
  resultat: "…",
  photoAvant: "/photos/realisations/debarras-appartement-montreuil/avant.webp",
  photoApres: "/photos/realisations/debarras-appartement-montreuil/apres.webp",
  altAvant: "Séjour encombré avant le débarras",
  altApres: "Séjour vidé après le débarras",
  pageDediee: true,
  autorisationClient: true,
}
*/
export const realisations: Realisation[] = [];

export const realisationsPubliees = () => realisations.filter((r) => r.autorisationClient);

export const categoriesRealisations: { id: Realisation["typeBien"] | "tous"; label: string }[] = [
  { id: "tous", label: "Tout" },
  { id: "maison", label: "Maisons" },
  { id: "appartement", label: "Appartements" },
  { id: "cave", label: "Caves" },
  { id: "grenier", label: "Greniers" },
  { id: "garage", label: "Garages" },
  { id: "bureau", label: "Bureaux et locaux pro" },
];
