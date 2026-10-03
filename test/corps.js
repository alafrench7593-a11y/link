// L'orientation du corps (règle reprise de Gameplay Football, domaine public) : sans le ballon, un
// joueur peut regarder le ballon sans courir vers lui. Pas chassé et recul sous le sprint, 22° au
// plus en sprint, recul seulement au pas ou au petit trot ; le porteur regarde où il va.
//
// L'angle des images de la passerelle (angle{k}) est cette orientation. C'est une sortie : le jeu
// lit toujours la direction de course, aucun tirage n'est ajouté. Que le match soit le même au
// geste près, rendus mis à part, le prouvent les scènes figées (tools/scenes-ue5.mjs --check) et
// les données du cœur C++ ; ici, on vérifie que la règle tient sur des matchs entiers.
import { Club } from '../src/club.js';

let ok = 0, ko = 0;
const t = (nom, cond, detail) => {
  console.log((cond ? '  ok   ' : '  ÉCHEC') + ' ' + nom + (detail ? '  (' + detail + ')' : ''));
  cond ? ok++ : ko++;
};
const ADV = { club: 'Référence', ovr: 66, style: 'blocmed' };
const GRAINES = [3, 11];
const PORTEUR = 4, AU_SOL = 1;

console.log('Le corps regarde-t-il le jeu comme un footballeur ?');
console.log(GRAINES.length + ' matchs entiers, chaque joueur à chaque image (10 par seconde)\n');

const c = { mouv: 0, recul: 0, chasse: 0, sprint: 0, sprintHors: 0, reculVite: 0, porteur: 0, porteurHors: 0, tours: 0, toursVifs: 0 };
for (const g of GRAINES) {
  const club = new Club(); club.createClub({ name: 'FC Corps', seed: 4242 });
  const doc = club.matchPont(ADV, { seed: g, debug: true }).document;
  const ch = doc.images.champs, D = doc.images.donnees, it = ch.indexOf('t');
  const col = (n) => ch.indexOf(n);
  for (let k = 0; k < 22; k++) {
    const ix = col('x' + k), iy = col('y' + k), ia = col('angle' + k), ie = col('etats' + k);
    for (let i = 1; i < D.length; i++) {
      const dt = (D[i][it] - D[i - 1][it]) / 10; if (dt <= 0 || dt > 0.11) continue;
      const dx = (D[i][ix] - D[i - 1][ix]) / 100, dy = (D[i][iy] - D[i - 1][iy]) / 100, v = Math.hypot(dx, dy) / dt;
      if (v > 11) continue;   // placement d'un coup de pied arrêté, remplacement : pas un mouvement
      const a1 = D[i][ia] / 1000, a0 = D[i - 1][ia] / 1000;
      let da = a1 - a0; da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
      c.tours++; if (da / dt > (D[i][ie] & PORTEUR ? 6 : 3) * Math.PI * 1.02) c.toursVifs++;
      if (v < 1 || D[i][ie] & AU_SOL) continue;
      let d = Math.atan2(dy, dx) - a1; d = Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) * 180 / Math.PI;
      c.mouv++;
      if (D[i][ie] & PORTEUR) { c.porteur++; if (d > 12) c.porteurHors++; continue; }
      if (d > 100) { c.recul++; if (v > 4.6) c.reculVite++; } else if (d > 45) c.chasse++;
      if (v >= 6.4) { c.sprint++; if (d > 30) c.sprintHors++; }
    }
  }
}
const pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(1) + ' %';
t('des joueurs reculent face au jeu', c.recul / c.mouv > 0.01, pc(c.recul, c.mouv) + ' des instants en mouvement');
t('des pas chassés (corps de 45 à 100° de la course)', c.chasse / c.mouv > 0.05, pc(c.chasse, c.mouv));
t('mais l\'essentiel du temps, on court où l\'on regarde', (c.recul + c.chasse) / c.mouv < 0.4, pc(c.recul + c.chasse, c.mouv) + ' de recul ou de pas chassés');
t('en sprint, le corps reste dans l\'axe (30° au plus)', c.sprintHors / Math.max(1, c.sprint) < 0.03, pc(c.sprintHors, c.sprint) + ' hors axe sur ' + c.sprint + ' instants de sprint');
t('on ne recule qu\'au pas ou au petit trot', c.reculVite / Math.max(1, c.recul) < 0.03, pc(c.reculVite, c.recul) + ' des reculs au-dessus de 4,6 m/s');
t('le porteur regarde où il va', c.porteurHors / Math.max(1, c.porteur) < 0.05, pc(c.porteurHors, c.porteur) + ' hors axe sur ' + c.porteur + ' instants');
t('le corps tourne au plus de 540°/s (1 080°/s balle au pied)', c.toursVifs / c.tours < 0.002, c.toursVifs + ' images sur ' + c.tours);

console.log('\n' + (ko ? 'ÉCHECS : ' + ko + ' sur ' + (ok + ko) : 'OK : ' + ok + ' vérifications, le corps regarde le jeu'));
process.exit(ko ? 1 : 0);
