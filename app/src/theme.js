// Les couleurs, les polices et les espacements de LinkFoot, au même endroit.
//
// D'après la maquette Figma « Football-app » (Figma Make, prototype LINKCONNECT) : un noir
// profond, des surfaces à peine plus claires bordées d'un filet blanc à 10 %, un citron
// (#C7FF32) pour ce qui agit et ce qui compte, des gris pour le reste ; Manrope pour les titres
// et les chiffres, DM Sans pour le texte. Les tailles de la maquette (7 à 10 px) sont relevées
// pour se lire sur un vrai téléphone.
//
// Les noms d'avant restent, pour que chaque écran suive sans réécriture : C.green est la couleur
// d'accent (citron désormais), C.card la surface, C.faint le gris des textes secondaires.
import { Platform } from 'react-native';

export const C = {
  bg: '#050505',
  card: '#101010',          // --surface
  cardAlt: '#171717',       // --surface-2
  raised: '#202020',        // --surface-3
  line: 'rgba(255,255,255,0.1)',
  lineSoft: 'rgba(255,255,255,0.06)',
  text: '#FFFFFF',
  dim: '#B0B0B0',           // --soft
  faint: '#8A8A8A',         // --muted
  ghost: '#686868',         // les surtitres
  accent: '#C7FF32',
  onAccent: '#0A0C08',
  accentLine: 'rgba(199,255,50,0.32)',
  accentFill: 'rgba(199,255,50,0.07)',
  green: '#C7FF32',
  onGreen: '#0A0C08',
  amber: '#F5C84C',
  amberLine: 'rgba(245,200,76,0.4)',
  red: '#FF4559',           // --danger
  live: '#FF6878',
  liveFill: 'rgba(255,69,89,0.12)',
  blue: '#5CC8FF',
  blueLine: 'rgba(92,200,255,0.35)',
  violet: '#C39BFF',
  violetLine: 'rgba(195,155,255,0.35)'
};

export const S = { pad: 16, gap: 12, radius: 16, radiusSm: 10, radiusLg: 24, pill: 22 };

// Sur le web, les deux polices partent avec l'app (src/polices.web.js). Sur téléphone, la police
// du système : aucun nom de police inconnu n'y est demandé.
const WEB = Platform.OS === 'web';
export const F = {
  titre: WEB ? 'Manrope, "DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' : undefined,
  texte: WEB ? '"DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' : undefined
};

// Les styles de texte de la maquette, partagés par tous les écrans.
export const T = {
  // le petit surtitre espacé au-dessus des titres (« HAPPENING NOW »)
  surtitre: { fontFamily: F.texte, color: C.ghost, fontSize: 9.5, fontWeight: '700', letterSpacing: 1.6 },
  titre: { fontFamily: F.titre, color: C.text, fontSize: 27, fontWeight: '800', letterSpacing: -1.2, lineHeight: 30 },
  section: { fontFamily: F.titre, color: C.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.8 },
  nom: { fontFamily: F.texte, color: C.text, fontSize: 14, fontWeight: '700' },
  corps: { fontFamily: F.texte, color: C.text, fontSize: 13, lineHeight: 18 },
  aide: { fontFamily: F.texte, color: C.faint, fontSize: 11.5, lineHeight: 16.5 },
  chiffre: { fontFamily: F.titre, color: C.text, fontWeight: '800', letterSpacing: -0.6 }
};

// Les six raretés partagent leur couleur avec le moteur : une rareté ne change
// pas d'apparence selon l'écran.
export const rarityTint = (club, id) => {
  const r = club.RARITY().find((x) => x.id === id);
  return r ? r.tint : C.faint;
};
