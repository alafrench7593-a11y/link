/** Règles de validation partagées entre le formulaire (client) et l'API (serveur). */

export const TYPES_PRESTATION = [
  { id: "maison", label: "Maison" },
  { id: "appartement", label: "Appartement" },
  { id: "cave", label: "Cave" },
  { id: "grenier", label: "Grenier" },
  { id: "garage", label: "Garage / box" },
  { id: "bureau", label: "Bureau" },
  { id: "commerce", label: "Commerce" },
  { id: "autre", label: "Autre" },
] as const;

export const VOLUMES = ["Moins de 5 m³ (quelques meubles)", "5 à 15 m³ (une pièce ou une cave pleine)", "15 à 30 m³ (petit logement)", "Plus de 30 m³ (grand logement, maison)", "Je ne sais pas"];
export const ETAGES = ["Rez-de-chaussée / plain-pied", "1er étage", "2e étage", "3e étage", "4e étage", "5e étage ou plus", "Sous-sol", "Maison à étages"];
export const ASCENSEUR = ["Oui", "Non", "Sans objet"];
export const ENCOMBREMENT = ["Léger — quelques objets", "Moyen — pièces meublées", "Important — pièces pleines", "Très important — circulation difficile"];
export const CONTACT_PREFERE = ["Téléphone", "WhatsApp", "E-mail"];

export const LIMITES = { photos: 6, octetsParPhoto: 2_500_000, octetsTotal: 4_000_000, texte: 2000 };

export type DonneesDevis = {
  prestation: string;
  ville: string;
  codePostal: string;
  surface: string;
  volume: string;
  etage: string;
  ascenseur: string;
  encombrement: string;
  date: string;
  infos: string;
  nom: string;
  telephone: string;
  email: string;
  contact: string;
  consentement: boolean;
};

export const vide: DonneesDevis = {
  prestation: "", ville: "", codePostal: "", surface: "", volume: "", etage: "", ascenseur: "", encombrement: "", date: "", infos: "",
  nom: "", telephone: "", email: "", contact: "Téléphone", consentement: false,
};

const telOk = (t: string) => /^(?:(?:\+|00)33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$/.test(t.trim());
const mailOk = (m: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m.trim());

export type Erreurs = Partial<Record<keyof DonneesDevis, string>>;

export function valider(d: DonneesDevis, etape: 1 | 2 | 4 | "tout"): Erreurs {
  const e: Erreurs = {};
  const t = (s: unknown) => (typeof s === "string" ? s.trim() : "");
  if (etape === 1 || etape === "tout") {
    if (!TYPES_PRESTATION.some((p) => p.id === d.prestation)) e.prestation = "Choisissez le type de lieu à débarrasser.";
  }
  if (etape === 2 || etape === "tout") {
    if (t(d.ville).length < 2) e.ville = "Indiquez la ville du chantier.";
    if (!/^\d{5}$/.test(t(d.codePostal))) e.codePostal = "Le code postal comporte 5 chiffres, par exemple 93100.";
    if (d.surface && !/^\d{1,5}$/.test(t(d.surface))) e.surface = "Indiquez une surface en m², en chiffres.";
    if (t(d.infos).length > LIMITES.texte) e.infos = `${LIMITES.texte} caractères maximum.`;
    if (d.date && !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) e.date = "Date invalide.";
  }
  if (etape === 4 || etape === "tout") {
    if (t(d.nom).length < 2) e.nom = "Indiquez votre nom.";
    if (!telOk(d.telephone)) e.telephone = "Numéro français attendu, par exemple 06 12 34 56 78.";
    if (d.email && !mailOk(d.email)) e.email = "Adresse e-mail invalide.";
    if (d.contact === "E-mail" && !d.email) e.email = "Indiquez votre e-mail pour être recontacté par e-mail.";
    if (!CONTACT_PREFERE.includes(d.contact)) e.contact = "Choisissez un moyen de contact.";
    if (!d.consentement) e.consentement = "Votre accord est nécessaire pour que nous puissions vous recontacter.";
  }
  return e;
}

export const codePostalIdf = (cp: string) => /^(75|77|78|91|92|93|94|95)\d{3}$/.test(cp.trim());
