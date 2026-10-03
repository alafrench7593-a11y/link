// Les deux polices de la maquette Figma : Manrope pour les titres et les chiffres, DM Sans pour
// le texte. Elles partent avec l'app (assets/polices, licence SIL OFL 1.1, jointe), sans service
// de polices en ligne : l'app s'affiche pareil hors connexion. Déclarées une fois, au démarrage ;
// le navigateur ne les télécharge qu'au premier texte qui les demande.
import { adresse } from './fichiers';

const POLICES = [
  ['Manrope', 700, require('../assets/polices/manrope-700.woff2')],
  ['Manrope', 800, require('../assets/polices/manrope-800.woff2')],
  ['DM Sans', 400, require('../assets/polices/dm-sans-400.woff2')],
  ['DM Sans', 500, require('../assets/polices/dm-sans-500.woff2')],
  ['DM Sans', 700, require('../assets/polices/dm-sans-700.woff2')]
];

let fait = false;
export function chargerPolices() {
  if (fait || typeof document === 'undefined') return;
  fait = true;
  const css = POLICES.map(([nom, poids, m]) =>
    `@font-face{font-family:'${nom}';font-style:normal;font-weight:${poids};font-display:swap;src:url('${adresse(m)}') format('woff2');}`).join('\n');
  const el = document.createElement('style');
  el.setAttribute('data-linkfoot', 'polices');
  el.textContent = css;
  document.head.appendChild(el);
}
