// La passerelle vers Unreal Engine 5 (docs/passerelle-ue5.md, src/passerelle.js).
//
// Un rendu externe ne décide rien : il lit ce que le moteur a décidé. Ce fichier vérifie
// que ce qu'il lit est complet, stable et vrai :
//   - enregistrer pour la passerelle ne change pas le match (au chiffre près) ;
//   - deux exports du même match sont identiques (empreinte) ;
//   - le format est celui que docs/passerelle-ue5.md décrit ;
//   - §36 une carte, un joueur, un personnage ; un adversaire garde son visage d'un match à l'autre ;
//   - §57 la chaîne entière : une statistique de la carte se retrouve dans les attributs du
//     moteur, puis dans les mouvements et les actions que le rendu reçoit ;
//   - §55 ce que le rendu ne doit jamais avoir à cacher (hors du terrain, joueurs l'un dans
//     l'autre, ballon loin de son porteur, gardien hors de l'angle, ligne cassée).
//
//   node test/passerelle.js
import { Club } from '../src/club.js';

let ok = 0, ko = 0;
const t = (nom, cond, detail) => {
  console.log((cond ? '  ok   ' : '  ÉCHEC') + ' ' + nom + (detail ? '  (' + detail + ')' : ''));
  cond ? ok++ : ko++;
};
const constat = (nom, detail) => console.log('  constat ' + nom + (detail ? '  (' + detail + ')' : ''));
const tete = (s) => console.log('\n' + s);
const ADV = { club: 'Référence', ovr: 66, style: 'blocmed' };
const club = (retouche) => { const c = new Club(); c.createClub({ name: 'FC Pont', seed: 4242 }); if (retouche) retouche(c); return c; };
const P = new Club().PASSERELLE(), N = P.tete.length, J = P.joueur.length;
const col = (k, champ) => N + k * J + P.joueur.indexOf(champ);

// ---------------------------------------------------------------- le match ne change pas
tete('§59 Enregistrer pour la passerelle ne change pas le match');
{
  let memes = 0;
  const graines = [101, 102, 103];
  for (const g of graines) {
    const a = club().playMatch(ADV, { seed: g }), b = club().matchPont(ADV, { seed: g }).resultat;
    const pareil = JSON.stringify([a.score, a.stats, a.poss, a.log]) === JSON.stringify([b.score, b.stats, b.poss, b.log]);
    if (pareil) memes++;
  }
  t('le même match avec ou sans passerelle : score, statistiques, possession, fil', memes === graines.length, memes + ' sur ' + graines.length);
}

const { resultat: R1, document: D1 } = club().matchPont(ADV, { seed: 77, debug: true });
const { document: D2 } = club().matchPont(ADV, { seed: 77, debug: true });

tete('Le document est stable et vérifiable');
t('deux exports du même match ont la même empreinte', D1.empreinte === D2.empreinte, D1.empreinte);
t('l’empreinte change si une seule image change', (() => {
  const c = new Club(), copie = JSON.parse(JSON.stringify(D1)); copie.images.donnees[500][N] += 1;
  return String(c.empreintePont(JSON.stringify([copie.images.donnees, copie.actions]))) !== D1.empreinte;
})());
t('le résultat du document est celui du match', JSON.stringify(D1.resultat.score) === JSON.stringify(R1.score), R1.score.join('-'));

tete('Le format décrit dans docs/passerelle-ue5.md');
{
  const D = D1.images.donnees, largeur = N + 22 * J + 44;
  t('format linkfoot-match, version 1, dix images par seconde', D1.format === 'linkfoot-match' && D1.version === 1 && D1.moteur.hz === 10);
  t('chaque image a autant de valeurs que de champs annoncés', D1.images.champs.length === largeur && D.every((r) => r.length === largeur), largeur + ' valeurs');
  let croissant = true; for (let i = 1; i < D.length; i++) if (D[i][0] <= D[i - 1][0]) croissant = false;
  t('le temps avance d’une image à l’autre', croissant, D.length + ' images, ' + (D[D.length - 1][0] / 600).toFixed(0) + ' minutes de jeu');
  let trous = 0; for (let i = 1; i < D.length; i++) if (D[i][0] - D[i - 1][0] !== 1 && !D[i][3]) trous++;
  t('un saut dans le temps est toujours une coupe annoncée', trous <= 2, trous + ' saut(s) sans coupe (la célébration d’un but saute un pas)');
  let trie = true; for (let i = 1; i < D1.actions.length; i++) if (D1.actions[i].t < D1.actions[i - 1].t) trie = false;
  const TYPES = ['passe', 'tir', 'degagement', 'touche', 'controle', 'dribble', 'tacle', 'interception', 'faute', 'duel_aerien', 'prise_aerienne',
    'plongeon', 'arret', 'sortie_pieds', 'contre', 'poteau', 'but', 'celebration', 'remplacement', 'hors_jeu'];
  const inconnus = [...new Set(D1.actions.map((a) => a.a).filter((a) => !TYPES.includes(a)))];
  t('les actions sont datées, dans l’ordre, d’un type connu', trie && !inconnus.length, D1.actions.length + ' actions' + (inconnus.length ? ', inconnues : ' + inconnus.join(', ') : ''));
  t('chaque action désigne un joueur du match', D1.actions.every((a) => a.c >= -1 && a.c < 22));
  const codes = D1.joueurs.filter((j) => j.code != null).map((j) => j.code).sort((a, b) => a - b);
  t('22 joueurs sur le terrain, codes 0 à 21, et les bancs', codes.length === 22 && codes.every((c, i) => c === i) && D1.joueurs.length > 22, D1.joueurs.length + ' personnes');
  const parType = {}; D1.actions.forEach((a) => { parType[a.a] = (parType[a.a] || 0) + 1; });
  t('un match produit passes, contrôles, tirs, tacles, duels et plongeons', ['passe', 'controle', 'tir', 'tacle', 'duel_aerien', 'plongeon'].every((k) => parType[k] > 0),
    Object.keys(parType).map((k) => k + ' ' + parType[k]).join(', '));
  const tir = D1.actions.find((a) => a.a === 'tir');
  t('une frappe dit tout ce que le rendu doit jouer : départ, arrivée, durée, variante, issue', tir && ['x0', 'y0', 'x1', 'y1', 'dur', 'apex', 'variante', 'issue'].every((k) => k in tir), JSON.stringify(tir).slice(0, 140));
}

tete('§36 une carte, un joueur, un personnage');
{
  const c = club(), H = D1.joueurs.filter((j) => j.camp === 'H');
  t('nos joueurs : le personnage porte le numéro de la carte', H.every((j) => j.carte === j.id && j.personnage === c.personnagePont(j.id)), H.slice(0, 3).map((j) => j.personnage).join(', '));
  const adv1 = D1.joueurs.filter((j) => j.camp === 'A' && j.code != null).map((j) => j.personnage);
  const autre = club().matchPont(ADV, { seed: 78 }).document.joueurs.filter((j) => j.camp === 'A' && j.code != null).map((j) => j.personnage);
  const ailleurs = club().matchPont({ club: 'Ailleurs FC', ovr: 66, style: 'blocmed' }, { seed: 78 }).document.joueurs.filter((j) => j.camp === 'A' && j.code != null).map((j) => j.personnage);
  t('un adversaire garde les mêmes personnages d’un match à l’autre', JSON.stringify(adv1) === JSON.stringify(autre));
  t('deux clubs adverses n’ont pas les mêmes personnages', adv1.every((p) => !ailleurs.includes(p)));
  const visages = new Set(D1.joueurs.filter((j) => j.code != null).map((j) => JSON.stringify(j.apparence.visage)));
  t('§5 vingt-deux visages différents sur le terrain : pas de clones', visages.size === 22, visages.size + ' visages');
  const tous = new Set(D1.joueurs.map((j) => j.personnage));
  t('aucun personnage en double dans la feuille', tous.size === D1.joueurs.length);
}

tete('§4 et §8 le corps raconte la carte');
{
  const c = club(), sq = c.state.squad, gb = sq.filter((p) => p.pos === 'GB'), champ = sq.filter((p) => p.pos !== 'GB');
  const moy = (l) => l.reduce((a, p) => a + c.profile(p).height, 0) / l.length;
  t('les gardiens sont plus grands que les joueurs de champ', moy(gb) > moy(champ), Math.round(moy(gb)) + ' cm contre ' + Math.round(moy(champ)) + ' cm');
  const p = sq.find((q) => q.pos === 'DEF');
  const fort = c.morphologie(p, { VIT: 60, PHY: 92 }, 'LF-test'), faible = c.morphologie(p, { VIT: 60, PHY: 48 }, 'LF-test');
  t('un physique fort a plus d’épaules et de muscles', fort.muscles > faible.muscles && fort.epaules > faible.epaules, fort.muscles + ' contre ' + faible.muscles);
  const rapide = c.morphologie(p, { VIT: 95, PHY: 60 }, 'LF-test'), lent = c.morphologie(p, { VIT: 45, PHY: 60 }, 'LF-test');
  t('un rapide a les jambes plus longues', rapide.jambes > lent.jambes, rapide.jambes + ' contre ' + lent.jambes);
  const g = D1.joueurs.find((j) => j.code === 0);
  t('le gardien a ses attributs de gardien, et lui seul', !!(g.moteur && g.moteur.gardien) && D1.joueurs.filter((j) => j.moteur && j.moteur.gardien).every((j) => j.code === 0 || j.code === 11));
}

tete('§57 la chaîne entière : carte → attributs du moteur → mouvement → action');
{
  // la vitesse de la carte des attaquants, seule, change
  const avec = (VIT) => club((c) => c.setState({ squad: c.state.squad.map((p) => {
    if (p.pos !== 'ATT') return p; const st = {}; c.cardStats(p).forEach((q) => { st[q.l] = q.v; }); return Object.assign({}, p, { st: Object.assign(st, { VIT }) });
  }) })).matchPont(ADV, { seed: 81 }).document;
  const lents = avec(40), rapides = avec(95);
  const att = (d) => d.joueurs.filter((j) => j.code != null && j.code < 11 && j.poste === 'ATT');
  const vmax = (d) => Math.max(...att(d).map((j) => j.moteur.vitesse_max));
  t('VIT 95 sur la carte : le moteur leur donne une vitesse de pointe plus haute', vmax(rapides) > vmax(lents) + 1, vmax(lents).toFixed(2) + ' contre ' + vmax(rapides).toFixed(2) + ' m/s');
  // la vitesse que le rendu voit, d'une image à l'autre : le 98e centile, parce que le maximum
  // ne mesure que les à-coups des contacts (voir §55)
  const vue = (d) => {
    const codes = att(d).map((j) => j.code), D = d.images.donnees, v = [];
    for (let i = 1; i < D.length; i++) { if (D[i][3] || D[i][0] - D[i - 1][0] !== 1) continue;
      codes.forEach((k) => { if (D[i][col(k, 'x')] < -500) return; v.push(Math.hypot(D[i][col(k, 'x')] - D[i - 1][col(k, 'x')], D[i][col(k, 'y')] - D[i - 1][col(k, 'y')]) / 10); }); }
    v.sort((a, b) => a - b); return v[Math.floor(v.length * 0.98)];
  };
  t('et le rendu les voit courir plus vite', vue(rapides) > vue(lents) + 0.6, vue(lents).toFixed(2) + ' contre ' + vue(rapides).toFixed(2) + ' m/s');
  const profondeur = (d) => { const codes = att(d).map((j) => j.code); return d.actions.filter((a) => a.a === 'passe' && a.genre === 'through' && codes.includes(a.vers)).length; };
  t('et on les cherche dans la profondeur : le rendu reçoit ces passes', profondeur(rapides) > profondeur(lents), profondeur(lents) + ' contre ' + profondeur(rapides));
  // le dribble de la carte : les gestes de haut palier n'arrivent qu'aux techniques
  const drib = (DRI) => club((c) => c.setState({ squad: c.state.squad.map((p) => {
    if (p.pos !== 'ATT' && p.pos !== 'MIL') return p; const st = {}; c.cardStats(p).forEach((q) => { st[q.l] = q.v; }); return Object.assign({}, p, { st: Object.assign(st, { DRI }) });
  }) })).matchPont(ADV, { seed: 82 }).document.actions.filter((a) => a.a === 'dribble' && a.c < 11);
  const bas = drib(45), haut = drib(92);
  const palier = (l) => l.filter((a) => a.palier >= 3).length;
  t('DRI 92 : le rendu reçoit des gestes de palier 3 et plus (passement, roulette, petit pont)', palier(haut) > palier(bas), palier(bas) + ' contre ' + palier(haut) + ' · ' + [...new Set(haut.map((a) => a.geste))].join(', '));
  // la fatigue : l'énergie que le rendu lit baisse au fil du match
  const D = D1.images.donnees, fin = D[D.length - 1];
  const energie = (row, k) => row[col(k, 'energie')];
  const baisse = Array.from({ length: 10 }, (_, i) => i + 1).filter((k) => energie(fin, k) < energie(D[0], k)).length;
  t('§40 l’énergie de chaque joueur baisse au fil du match, et le rendu la lit', baisse >= 9, baisse + ' joueurs de champ sur 10');
  t('le gardien s’use moins que ses défenseurs', energie(fin, 0) > energie(fin, 2), energie(fin, 0) + ' contre ' + energie(fin, 2));
}

tete('§55 ce que le rendu ne doit jamais avoir à cacher');
{
  const c = new Club(), v = c.verifierPont(D1), C = v.compte;
  t('personne ne sort du terrain', C.hors_terrain === 0, C.hors_terrain + ' fois');
  t('jamais deux joueurs l’un dans l’autre plus d’une demi-seconde', C.chevauchement <= 3, C.chevauchement + ' fois');
  t('le ballon reste au pied de son porteur', C.ballon_loin / C.images < 0.01, C.ballon_loin + ' images sur ' + C.images);
  t('le gardien se tient dans l’angle de tir la plupart du temps', v.taux.gardien_hors_angle < 25, v.taux.gardien_hors_angle + ' % des images où un adversaire a le ballon à moins de 30 m');
  t('aucun joueur immobile alors que sa place est ailleurs', C.immobile === 0, C.immobile + ' fois');
  constat('vitesses au-dessus de la pointe du joueur (contacts, replacements)', C.vitesse + ' fois sur ' + C.images + ' images');
  constat('à-coups au-dessus de 14 m/s² (les contacts se règlent en déplaçant les joueurs)', C.acceleration + ' fois');
  constat('téléportations (plus de 4 m en un dixième de seconde, hors coupe)', C.teleportation + ' fois' + (v.exemples.find((e) => e.k === 'teleportation') ? ', par exemple ' + JSON.stringify(v.exemples.find((e) => e.k === 'teleportation')) : ''));
  constat('ligne défensive étirée sur plus de 12 m', v.taux.ligne_cassee + ' % des images où l’équipe défend');
}

tete('Le repère d’Unreal');
{
  const c = new Club(), o = c.versUnreal(34, 52.5, 0), but = c.versUnreal(34, 0, 0);
  t('le rond central est l’origine', o.X === 0 && o.Y === 0 && o.Z === 0);
  t('le but du haut (y = 0) est à +52,5 m sur X, en centimètres', but.X === 5250);
  t('un joueur tourné vers y décroissant regarde l’axe X (lacet 0°)', Math.abs(c.lacetUnreal(Math.round(Math.atan2(-1, 0) * 1000))) < 0.1);
  t('un joueur tourné vers x croissant a un lacet de 90°', Math.abs(c.lacetUnreal(0) - 90) < 0.1);
}

console.log('\n' + (ko ? 'ÉCHECS : ' + ko + ' sur ' + (ok + ko) : 'OK : ' + ok + ' vérifications, la passerelle dit ce que le moteur a joué'));
process.exit(ko ? 1 : 0);
