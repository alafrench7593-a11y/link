// Les couleurs et les espacements de LinkFoot, au même endroit.
// L'app native reprend exactement la palette des maquettes du canvas.
export const C = {
  bg: '#0B0F0C',
  card: '#1E232B',
  cardAlt: '#13171C',
  line: 'rgba(255,255,255,0.07)',
  text: '#F2F4F7',
  dim: '#AEB6C2',
  faint: '#79828F',
  ghost: '#6B736C',
  green: '#2ECC71',
  onGreen: '#171B21',
  amber: '#F5C84C',
  red: '#FF4757',
  blue: '#5CC8FF',
  violet: '#C39BFF'
};

export const S = { pad: 16, gap: 12, radius: 10, pill: 20 };

// Les six raretés partagent leur couleur avec le moteur : une rareté ne change
// pas d'apparence selon l'écran.
export const rarityTint = (club, id) => {
  const r = club.RARITY().find((x) => x.id === id);
  return r ? r.tint : C.faint;
};
