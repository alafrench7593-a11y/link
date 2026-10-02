// Les données de test du cœur C++ (unreal/LinkFoot/Source/LinkFootCore), produites par le
// vrai moteur LinkFoot. Rien n'est écrit à la main : le cœur doit lire ce que le moteur
// écrit, et voir dans le mouvement ce que les cartes y ont mis.
//
//   node unreal/tests-coeur/generer-fixtures.mjs <dossier>
//
// Écrit dans <dossier> :
//   match-77.json         un match complet (graine 77), tel que le moteur l'exporte
//   match-77-attendu.json ce que le décodeur JavaScript lit dans chaque image (une empreinte
//                         par image), le repère d'Unreal calculé par la passerelle JS, les
//                         comptes de verifierPont : le cœur C++ doit trouver la même chose
//   press-bas.json        le même match, sans pressing (press 0)
//   press-haut.json       le même match, pressing à fond (press 2)
//   match-78.json, match-79.json  deux autres matchs (autres adversaires) : les statistiques
//                         recalculées par le cœur doivent être celles du moteur sur chacun
//   match-77-debug.json   le match 77 en mode débogage : cibles de l'IA et délibérations (§71)
import { Club } from '../../src/club.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dossier = process.argv[2];
if (!dossier) { console.error('usage : node generer-fixtures.mjs <dossier>'); process.exit(2); }
mkdirSync(dossier, { recursive: true });

const ADV = { club: 'Référence', ovr: 66, style: 'blocmed' };
const club = (retouche) => { const c = new Club(); c.createClub({ name: 'FC Pont', seed: 4242 }); if (retouche) retouche(c); return c; };
const tac = (o) => (c) => c.setState({ tac: Object.assign({}, c.state.tac, o) });

// la même formule que empreinteImagesPont, sur une suite d'entiers quelconque
function cyrb53Entiers(valeurs, graine) {
  let h1 = 0xdeadbeef ^ graine, h2 = 0x41c6ce57 ^ graine;
  for (const v of valeurs) { h1 = Math.imul(h1 ^ v, 2654435761); h2 = Math.imul(h2 ^ v, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return String(4294967296 * (2097151 & h2) + (h1 >>> 0));
}

const t0 = Date.now();
const { document: doc } = club().matchPont(ADV, { seed: 77 });
writeFileSync(join(dossier, 'match-77.json'), JSON.stringify(doc));

// Ce que lit le décodeur de référence (lireImagePont), champ par champ, image par image.
const c = new Club(), P = c.PASSERELLE();
const parImage = doc.images.donnees.map((_, i) => {
  const im = c.lireImagePont(doc, i), v = [];
  const cm = (m) => Math.round(m * 100);
  v.push(Math.round(im.t * 10), im.horloge, im.mi_temps, im.coupe ? 1 : 0, cm(im.ballon[0]), cm(im.ballon[1]), cm(im.ballon[2]), im.porteur,
    im.score[0], im.score[1], im.cpa ? P.cpa.indexOf(im.cpa) : 0, im.tireur);
  im.joueurs.forEach((j) => v.push(j.present ? 1 : 0, cm(j.x), cm(j.y), j.angle, j.energie, j.etats, j.intention ? P.intentions.indexOf(j.intention) + 1 : 0));
  return cyrb53Entiers(v, 1);
});

// Le repère d'Unreal selon la passerelle JS, sur des points et des angles tirés du match.
const repere = [];
for (let i = 0; i < doc.images.donnees.length; i += 997) {
  const im = c.lireImagePont(doc, i);
  im.joueurs.filter((j) => j.present).slice(0, 4).forEach((j) => {
    const u = c.versUnreal(j.x, j.y, 0.37);
    repere.push({ x: j.x, y: j.y, z: 0.37, X: u.X, Y: u.Y, Z: u.Z, angle: j.angle, lacet: c.lacetUnreal(j.angle) });
  });
}
const verif = c.verifierPont(doc);
const attendu = {
  images: doc.images.donnees.length, actions: doc.actions.length, evenements: doc.evenements.length, joueurs: doc.joueurs.length,
  empreinte_images: doc.empreinte_images, par_image: parImage, repere,
  verification: verif.compte,
  remplacements: doc.actions.filter((a) => a.a === 'remplacement').map((a) => ({ t: a.t, code: a.c, entrant: a.entrant, vitesse_max: a.vitesse_max }))
};
writeFileSync(join(dossier, 'match-77-attendu.json'), JSON.stringify(attendu));

// Le pressing : le même match, la même graine, seul le réglage change.
writeFileSync(join(dossier, 'press-bas.json'), JSON.stringify(club(tac({ press: 0, engage: 0, ptrap: 0 })).matchPont(ADV, { seed: 77 }).document));
writeFileSync(join(dossier, 'press-haut.json'), JSON.stringify(club(tac({ press: 2, engage: 2, ptrap: 2 })).matchPont(ADV, { seed: 77 }).document));

writeFileSync(join(dossier, 'match-78.json'), JSON.stringify(club().matchPont({ club: 'Rival', ovr: 70, style: 'pressing' }, { seed: 78 }).document));
writeFileSync(join(dossier, 'match-79.json'), JSON.stringify(club().matchPont({ club: 'Costauds', ovr: 75, style: 'direct' }, { seed: 79 }).document));
writeFileSync(join(dossier, 'match-77-debug.json'), JSON.stringify(club().matchPont(ADV, { seed: 77, debug: true }).document));

console.log('fixtures écrites dans ' + dossier + ' en ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
