// Le cahier « CORRECTION MAJEURE : LINKFOOT MATCH », section par section.
//
// Le joueur est le MANAGER. Il prépare son équipe, la regarde jouer seule, et intervient
// comme un entraîneur : formation, tactique, consignes, remplacements, à la main ou par
// l'AUTO COACH. Il ne contrôle jamais un footballeur. Ce fichier vérifie chaque promesse
// du cahier qui se mesure : une section qui ne bouge rien sur le terrain est un faux
// bouton (§47 du cahier précédent), et une section qui bouge dans le mauvais sens est un
// mensonge affiché à l'écran.
//
//   node test/match.js
import { readFileSync } from 'node:fs';
import { Club } from '../src/club.js';

let ok = 0, ko = 0;
const t = (nom, cond, detail) => {
  console.log((cond ? '  ok   ' : '  ÉCHEC') + ' ' + nom + (detail ? '  (' + detail + ')' : ''));
  cond ? ok++ : ko++;
};
const tete = (s) => console.log('\n' + s);
// un constat : mesuré et affiché, sans verdict (un effet trop petit pour sortir du bruit de
// six matchs ; le comportement, lui, est vérifié à côté)
const constat = (nom, detail) => console.log('  constat ' + nom + (detail ? '  (' + detail + ')' : ''));
// les compteurs du pressing (moteur, mesure seulement) : joueurs qui pressent par pas où
// l'équipe défend, et ceux d'entre eux qui pressent dans la moitié adverse
const presseurs = (cnt) => (cnt.presseurs_H || 0) / Math.max(1, cnt.def_H || 0);
const presseursHaut = (cnt) => (cnt.presseurs_haut_H || 0) / Math.max(1, cnt.def_H || 0);
const f2 = (v) => v.toFixed(2).replace('.', ',');
const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const ADV = { club: 'Référence', ovr: 66, style: 'blocmed' };
const FORT = { club: 'Costauds', ovr: 80, style: 'gegen' };
const club = (nom) => { const c = new Club(); c.createClub({ name: nom || 'FC Manager', seed: 4242 }); return c; };
// avancer un match en direct jusqu'à une minute de jeu
const jusqua = (d, m) => { while (!d.avancerPas(50).done && d.etat().minute < m) { /* le moteur joue */ } };

// ---------------------------------------------------------------- §1 §4
tete('§1 et §4 le match est 100 % automatique : aucun contrôle direct');
{
  const c = club(), d = c.matchEnDirect(ADV, { seed: 5, friendly: true });
  const api = Object.keys(d);
  const interdits = ['joystick', 'passer', 'tirer', 'dribbler', 'tacler', 'controler', 'changerJoueur', 'bouger', 'deplacer'];
  t('le match en direct n’offre que des décisions de manager', !api.some((k) => interdits.includes(k)),
    api.filter((k) => typeof d[k] === 'function').join(', '));
  d.terminer();
  const ecrans = ['canvas/Club.dc.html', 'app/src/direct.js', 'app/src/screens.js', 'app/src/terrain.js'].map(lire).join('\n');
  t('aucun joystick ni bouton PASS, SHOOT, DRIBBLE ou TACKLE dans les écrans',
    !/joystick|>\s*(PASS|SHOOT|DRIBBLE|TACKLE)\s*</i.test(ecrans));
}

// ---------------------------------------------------------------- §5
tete('§5 avant le match : formation, mentalité, pressing, bloc, rythme, largeur, style');
{
  const c = club();
  const F = c.FORMATIONS();
  t('les formations du cahier, et 4-2-4 pour forcer', ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2', '4-2-4'].every((f) => F.includes(f)), F.join(' '));
  t('   chacune a ses onze places', F.every((f) => c.lignesFormation(f).reduce((a, b) => a + b, 0) === 11));
  t('   et donne un onze complet', F.every((f) => c.pickXI(f).length === 11));
  const M = c.MENTALITES();
  t('les cinq mentalités du cahier', ['Défensive', 'Prudente', 'Équilibrée', 'Offensive', 'Très offensive'].every((m) => M.includes(m)), M.join(', '));
  const reglage = (k) => { let it = null; c.TAC_GROUPS().forEach((g) => g.items.forEach((x) => { if (x[0] === k) it = x; })); return it ? it[2] : []; };
  t('le pressing en quatre niveaux, jusqu’à très intense', reglage('press').length === 4 && reglage('press')[3] === 'Très intense', reglage('press').join(', '));
  t('le bloc, le rythme et la largeur en trois niveaux', reglage('line').length === 3 && reglage('tempo').length === 3 && reglage('width').length === 3);
  const S = c.styleList().map((x) => x.name);
  t('les styles du cahier, jeu axial compris', ['Tiki-taka', 'Jeu direct', 'Contre-attaque', 'Gegenpressing', 'Jeu sur les ailes', 'Jeu axial'].every((x) => S.includes(x)), S.length + ' styles');
  // le quatrième niveau de pressing se joue vraiment. On le vérifie sur ce que font les
  // joueurs (combien pressent, et où), que six matchs mesurent sans ambiguïté. Le nombre
  // de ballons récupérés dans la moitié adverse, lui, était vérifié jusqu'ici : sur 24
  // matchs il ne monte que de 279 (pressing bas) à 297 (très intense), un effet que six
  // matchs ne départagent pas ; le test basculait au moindre changement du moteur. Il
  // reste affiché, en constat.
  const EGAL = { club: 'Égaux', ovr: 60, style: 'blocmed' };
  const serie = (press) => {
    let haut = 0, fautes = 0;
    const cnt = {};
    for (const seed of [21, 22, 23, 24, 25, 26]) {
      const e = club(); e.setState({ tac: Object.assign({}, e.state.tac, { press }), preset: 'perso' });
      const r = e.playMatch(EGAL, { seed, friendly: true });
      haut += r.cnt.rec_H_haut || 0; fautes += r.stats.H.fou;
      Object.keys(r.cnt).forEach((k) => { cnt[k] = (cnt[k] || 0) + r.cnt[k]; });
    }
    return { haut, fautes, presseurs: presseurs(cnt), presseursHaut: presseursHaut(cnt) };
  };
  const intense = serie(2), tres = serie(3);
  t('pressing très intense : plus de joueurs pressent qu’en intense', tres.presseurs > intense.presseurs * 1.3,
    f2(intense.presseurs) + ' contre ' + f2(tres.presseurs) + ' joueurs au pressing quand l’équipe défend');
  t('   et ils pressent plus haut, dans la moitié adverse', tres.presseursHaut > intense.presseursHaut * 1.5,
    f2(intense.presseursHaut) + ' contre ' + f2(tres.presseursHaut));
  constat('ballons récupérés dans la moitié adverse, intense puis très intense', intense.haut + ' contre ' + tres.haut + ' sur six matchs');
}

// ---------------------------------------------------------------- §6
tete('§6 le coaching en direct : la tactique change pendant le match');
{
  const c = club(), d = c.matchEnDirect(ADV, { seed: 77, friendly: true });
  jusqua(d, 60);
  const e0 = d.etat();
  t('l’écran connaît la tactique en cours', e0.tactique && e0.tactique.formation === c.state.formation && e0.tactique.valeurs.pressing === 1, JSON.stringify(e0.tactique));
  t('passer en pressing très intense', d.tactique('pressing', 3).ok && d.etat().tactique.valeurs.pressing === 3);
  t('   un réglage déjà en cours est refusé, avec sa raison', d.tactique('pressing', 3).why === 'C’est déjà le réglage en cours');
  t('   une valeur hors limites aussi', !d.tactique('bloc', 7).ok);
  t('passer de 4-3-3 à 4-2-4', d.tactique('formation', c.FORMATIONS().indexOf('4-2-4')).ok);
  const lignes = (x) => x.reduce((a, p) => { a[p.line] = (a[p.line] || 0) + 1; return a; }, {});
  const L = lignes(d.etat().xi);
  t('   quatre joueurs passent devant, deux restent au milieu', L.ATT === 4 && L.MIL === 2 && L.DEF === 4, JSON.stringify(L));
  t('   chacun a une place à lui', new Set(d.etat().xi.map((p) => p.slot)).size === 11);
  t('mentalité très offensive', d.tactique('mentalite', 6).ok);
  jusqua(d, 70);
  t('   et elle tient : le score ne la corrige plus d’elle-même', d.etat().tactique.valeurs.mentalite === 6);
  const engage = JSON.parse(JSON.stringify(c.state.matchEngage));
  const r1 = d.terminer();
  t('chaque réglage entre dans le fil, à sa minute', r1.decisions.filter((x) => /^(Pressing|Formation|Mentalité) : /.test(x.texte)).length === 3,
    r1.decisions.map((x) => x.minute + "' " + x.texte).join(' · '));
  const c2 = new Club(JSON.parse(JSON.stringify(c.state))); c2.setState({ matchEngage: engage });
  const r2 = c2.reprendreMatch();
  t('un match interrompu se rejoue à l’identique, tactique comprise', r2 && r2.score.join('-') === r1.score.join('-') && JSON.stringify(r2.stats) === JSON.stringify(r1.stats),
    r1.score.join('-') + ' et ' + (r2 ? r2.score.join('-') : '?'));
  // l'effet sur le comportement (§40 « j'ai changé ma tactique, donc les comportements ont
  // changé ») : même match, même graine, un changement à l'heure de jeu ou pas. On compte ce
  // que font les joueurs dans la dernière demi-heure, pas le score.
  const EGAL = { club: 'Égaux', ovr: 60, style: 'blocmed' };
  // les compteurs de la dernière demi-heure, additionnés sur six matchs
  const apres = (changements) => {
    const n = {};
    for (const seed of [31, 32, 33, 34, 35, 36]) {
      const e = club(), dd = e.matchEnDirect(EGAL, { seed, friendly: true });
      jusqua(dd, 60);
      const c0 = dd.compteurs();
      changements.forEach(([kk, v]) => dd.tactique(kk, kk === 'formation' ? e.FORMATIONS().indexOf(v) : v));
      dd.avancer(1e9);
      const c1 = dd.compteurs(); dd.terminer();
      Object.keys(c1).forEach((k) => { n[k] = (n[k] || 0) + (c1[k] || 0) - (c0[k] || 0); });
    }
    return n;
  };
  const sans = apres([]);
  const surface1 = apres([['formation', '4-2-4']]);
  t('en 4-2-4, plus de ballons reçus dans la surface', (surface1.boxRcv_H || 0) > (sans.boxRcv_H || 0), (sans.boxRcv_H || 0) + ' sans changement contre ' + (surface1.boxRcv_H || 0));
  // comme au §5 : ce que font les joueurs se vérifie, les ballons récupérés s'affichent
  const tres = apres([['pressing', 3]]);
  t('pressing très intense : bien plus de joueurs pressent dans la dernière demi-heure', presseurs(tres) > presseurs(sans) * 1.5,
    f2(presseurs(sans)) + ' sans changement contre ' + f2(presseurs(tres)) + ' joueurs au pressing quand l’équipe défend');
  constat('ballons récupérés dans la moitié adverse, sans changement puis en pressing très intense', (sans.rec_H_haut || 0) + ' contre ' + (tres.rec_H_haut || 0));
  const bas = apres([['bloc', 0], ['pressing', 0]]), hautBloc = apres([['bloc', 2], ['pressing', 2]]);
  t('bloc haut et pressing intense contre bloc bas et pressing faible : on presse plus haut', presseursHaut(hautBloc) > presseursHaut(bas) * 1.5,
    f2(presseursHaut(bas)) + ' en bloc bas contre ' + f2(presseursHaut(hautBloc)) + ' joueurs au pressing dans la moitié adverse');
  constat('ballons récupérés dans la moitié adverse, bloc bas puis bloc haut', (bas.rec_H_haut || 0) + ' contre ' + (hautBloc.rec_H_haut || 0));
}

// ---------------------------------------------------------------- §7
tete('§7 remplacements manuels ou AUTO COACH');
{
  const joue = (mode, seed) => {
    const c = club('FC ' + mode); c.setState({ coachMode: mode });
    const d = c.matchEnDirect(FORT, { seed, friendly: true });
    const vus = [];
    while (!d.avancer(40).done) { const e = d.etat(); if (e.coach && e.coach.conseil) vus.push(e.coach.conseil); }
    const engage = JSON.parse(JSON.stringify(c.state.matchEngage));
    return { c, r: d.terminer(), vus, engage };
  };
  const manuel = joue('manuel', 11), auto = joue('auto', 11), aide = joue('assiste', 11);
  t('en manuel, le coach IA ne touche à rien', manuel.r.decisions.length === 0 && manuel.vus.length === 0);
  const ia = auto.r.decisions.filter((x) => x.auto);
  t('en auto, le coach IA décide seul', ia.length >= 3, ia.map((x) => x.minute + "' " + x.texte).join(' · '));
  t('   et chaque décision dit pourquoi', ia.every((x) => /\(.+\)$/.test(x.texte)));
  t('   il change la tactique quand l’équipe est menée', ia.some((x) => /Mentalité : Offensive|Formation : 4-2-4|Pressing/.test(x.texte)));
  t('   il ne dépasse jamais cinq changements', auto.r.decisions.filter((x) => / remplace /.test(x.texte)).length <= 5);
  t('en assisté, il propose sans décider', aide.vus.length > 0 && aide.r.decisions.length === 0, aide.vus[0] ? aide.vus[0].texte + ' : ' + aide.vus[0].pourquoi : '');
  const c2 = new Club(JSON.parse(JSON.stringify(auto.c.state))); c2.setState({ matchEngage: auto.engage });
  const r2 = c2.reprendreMatch();
  t('un match interrompu se rejoue avec les décisions du coach IA', r2 && r2.score.join('-') === auto.r.score.join('-') && r2.decisions.length === auto.r.decisions.length);
  // un remplacement de l'AUTO COACH : le plus fatigué sort, à son poste
  const c = club('FC Fatigue'); c.setState({ coachMode: 'auto', squad: c.state.squad.map((p) => Object.assign({}, p, { fit: 62 })) });
  const d = c.matchEnDirect(ADV, { seed: 3, friendly: true });
  while (!d.avancer(40).done) { /* le coach décide */ }
  const subs = d.terminer().decisions.filter((x) => x.auto && / remplace /.test(x.texte));
  t('une équipe fatiguée : le coach IA remplace les plus fatigués, au poste', subs.length >= 2 && subs.every((x) => /d’énergie/.test(x.texte)),
    subs.map((x) => x.minute + "' " + x.texte).join(' · '));
  t('   le mode se garde avec la partie', c.state.coachMode === 'auto');
}

console.log('\n' + (ko ? 'ÉCHECS : ' + ko + ' sur ' + (ok + ko) : 'OK : ' + ok + ' vérifications, le manager regarde et décide, il ne contrôle aucun joueur'));
process.exit(ko ? 1 : 0);
