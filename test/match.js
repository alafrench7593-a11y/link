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
  // le quatrième niveau de pressing se joue vraiment
  const EGAL = { club: 'Égaux', ovr: 60, style: 'blocmed' };
  const serie = (press) => {
    let haut = 0, fautes = 0;
    for (const seed of [21, 22, 23, 24, 25, 26]) {
      const e = club(); e.setState({ tac: Object.assign({}, e.state.tac, { press }), preset: 'perso' });
      const r = e.playMatch(EGAL, { seed, friendly: true });
      haut += r.cnt.rec_H_haut || 0; fautes += r.stats.H.fou;
    }
    return { haut, fautes };
  };
  const intense = serie(2), tres = serie(3);
  t('pressing très intense : on récupère plus haut qu’en intense', tres.haut > intense.haut, intense.haut + ' contre ' + tres.haut + ' récupérations dans la moitié adverse');
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
  const apres = (changements, k) => {
    let n = 0;
    for (const seed of [31, 32, 33, 34, 35, 36]) {
      const e = club(), dd = e.matchEnDirect(EGAL, { seed, friendly: true });
      jusqua(dd, 60);
      const c0 = dd.compteurs();
      changements.forEach(([kk, v]) => dd.tactique(kk, kk === 'formation' ? e.FORMATIONS().indexOf(v) : v));
      dd.avancer(1e9);
      const c1 = dd.compteurs(); dd.terminer();
      n += (c1[k] || 0) - (c0[k] || 0);
    }
    return n;
  };
  const surface0 = apres([], 'boxRcv_H'), surface1 = apres([['formation', '4-2-4']], 'boxRcv_H');
  t('en 4-2-4, plus de ballons reçus dans la surface', surface1 > surface0, surface0 + ' sans changement contre ' + surface1);
  const haut0 = apres([], 'rec_H_haut'), haut1 = apres([['pressing', 3]], 'rec_H_haut');
  t('pressing très intense : plus de ballons récupérés dans la moitié adverse', haut1 > haut0, haut0 + ' contre ' + haut1);
  const bas = apres([['bloc', 0], ['pressing', 0]], 'rec_H_haut'), hautBloc = apres([['bloc', 2], ['pressing', 2]], 'rec_H_haut');
  t('bloc haut et pressing intense contre bloc bas et pressing faible : on récupère plus haut', hautBloc > bas, bas + ' en bloc bas contre ' + hautBloc + ' en bloc haut');
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
