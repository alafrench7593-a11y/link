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
t('l’empreinte des images (sur les entiers, celle que recalcule le lecteur C++ d’Unreal) est dans le document',
  typeof D1.empreinte_images === 'string' && D1.empreinte_images === new Club().empreinteImagesPont(D1.images.donnees) && D1.empreinte_images === D2.empreinte_images, D1.empreinte_images);
t('et elle change si un seul centimètre change', (() => {
  const copie = D1.images.donnees.map((r) => r.slice()); copie[1234][N + 7] += 1;
  return new Club().empreinteImagesPont(copie) !== D1.empreinte_images;
})());
{
  const rem = D1.actions.filter((a) => a.a === 'remplacement');
  t('un remplaçant entre avec ses attributs du moteur (il n’en avait pas au coup d’envoi)', rem.every((a) => a.vitesse_max > 4 && a.acceleration > 0 && a.agilite > 0),
    rem.length + ' remplacement(s)' + (rem[0] ? ', ' + rem[0].entrant + ' ' + rem[0].vitesse_max.toFixed(2) + ' m/s' : ''));
  // §57 et §91 : la fiche d'un titulaire porte les attributs avec lesquels le moteur l'a fait
  // jouer. Lue en fin de match, celle d'un titulaire remplacé portait ceux de son remplaçant
  // (qui reprend son code) : un défenseur recevait la vitesse et la défense d'un attaquant.
  const c = club(), ctx = c.ouvrirMatch(ADV, { seed: 77, pont: true });
  const R3 = (v) => Math.round(v * 1000) / 1000;
  const depart = Array.from({ length: 22 }, (_, k) => { const q = ctx.E.player(k); return [R3(q.vmax), q.pace, q.sht, q.pas, q.def].join('/'); });
  const fiches = D1.joueurs.filter((j) => j.code != null);
  const justes = fiches.filter((j) => [j.moteur.vitesse_max, j.moteur.vitesse, j.moteur.tir, j.moteur.passe, j.moteur.defense].join('/') === depart[j.code]).length;
  const remplaces = new Set(rem.map((a) => a.c));
  t('§57 un titulaire remplacé garde SES attributs du moteur, pas ceux de son remplaçant', justes === 22 && remplaces.size > 0,
    justes + ' fiches sur 22 conformes au moteur du coup d’envoi, dont ' + remplaces.size + ' titulaire(s) remplacé(s)');
}

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

tete('§71 en mode débogage, les délibérations du moteur');
{
  const dec = D1.decisions || [];
  t('chaque décision d’un porteur est dans le document, avec ce qu’il a écarté', dec.length > 1000 && dec.every((x) => x.choix && typeof x.choix.ev === 'number' && Array.isArray(x.autres) && x.rang >= 0),
    dec.length + ' décisions, ' + dec.filter((x) => x.rang === 0).length + ' au premier rang de ses options');
  let trie = true; for (let i = 1; i < dec.length; i++) if (dec[i].t < dec[i - 1].t) trie = false;
  t('   dans l’ordre du temps', trie);
  // une passe, une frappe, un centre, un dégagement choisis se jouent au même instant
  const actionsA = new Map();
  D1.actions.forEach((a) => { const k = a.c + ':' + Math.round(a.t * 10); if (!actionsA.has(k)) actionsA.set(k, []); actionsA.get(k).push(a.a); });
  const attendu = { pass: 'passe', cross: 'passe', shot: 'tir', clear: 'degagement' };
  const jouees = dec.filter((x) => attendu[x.choix.k]);
  const justes = jouees.filter((x) => (actionsA.get(x.c + ':' + Math.round(x.t * 10)) || []).some((a) => a === attendu[x.choix.k] || (x.choix.k === 'clear' && a === 'passe')));
  t('   chaque passe, frappe, centre ou dégagement choisi est joué au même instant', jouees.length > 500 && justes.length === jouees.length, justes.length + ' sur ' + jouees.length);
  // et réciproquement : une passe ou une frappe en jeu (hors coup de pied arrêté, hors frappe
  // de la phase du ballon, qui porte t0) vient d'une décision
  const decA = new Set(dec.map((x) => x.c + ':' + Math.round(x.t * 10)));
  const enJeu = D1.actions.filter((a) => (a.a === 'passe' || a.a === 'tir') && !a.cpa && a.t0 == null);
  t('   et chaque passe ou frappe en jeu vient d’une décision', enJeu.length > 500 && enJeu.every((a) => decA.has(a.c + ':' + Math.round(a.t * 10))),
    enJeu.filter((a) => decA.has(a.c + ':' + Math.round(a.t * 10))).length + ' sur ' + enJeu.length);
  const sans = club().matchPont(ADV, { seed: 77 });
  t('sans le mode débogage, le document n’en porte pas ; avec, le match est le même', sans.document.decisions === undefined
    && JSON.stringify([sans.resultat.score, sans.resultat.stats, sans.resultat.poss, sans.resultat.log]) === JSON.stringify([R1.score, R1.stats, R1.poss, R1.log]));
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

tete('Cahier « qualité visuelle » §5 à §10 et §27 : le corps, le visage, le caractère');
{
  const c = club();
  const MESURES = ['epaules', 'poitrine', 'ventre', 'bassin', 'bras', 'mains', 'jambes', 'cuisses', 'mollets', 'cou', 'tete', 'pieds', 'muscles', 'masse_grasse'];
  const tous = D1.joueurs;
  const complet = tous.every((j) => { const m = j.morphologie; return m && m.taille_cm >= 160 && m.taille_cm <= 210 && m.poids_kg > 50 && MESURES.every((k) => m[k] >= 0 && m[k] <= 1)
    && m.masse_grasse_pct >= 6 && m.masse_grasse_pct <= 15 && m.pointure >= 38 && m.pointure <= 50 && Math.abs(m.envergure_cm / m.taille_cm - 1) < 0.08; });
  t('§7 chaque joueur a les seize mesures de son corps, en proportions et en unités humaines', complet,
    tous.length + ' joueurs ; ' + JSON.stringify(tous[0].morphologie).slice(0, 110) + '…');
  // §8 deux joueurs du même poste : jamais la même silhouette
  let paires = 0, proches = 0, plusProche = 9;
  for (let i = 0; i < tous.length; i++) for (let k = i + 1; k < tous.length; k++) {
    if (tous[i].poste !== tous[k].poste) continue;
    const d = Math.hypot(...MESURES.map((m) => tous[i].morphologie[m] - tous[k].morphologie[m]));
    paires++; if (d < 0.1) proches++; plusProche = Math.min(plusProche, d);
  }
  t('§8 deux joueurs du même poste n’ont pas la même silhouette', paires > 50 && proches === 0, paires + ' paires, écart le plus faible ' + plusProche.toFixed(2));
  // §9 §10 la carte se lit dans le corps
  const p = c.state.squad.find((q) => q.pos === 'MIL');
  const rapide = c.morphologie(p, { VIT: 95, PHY: 60 }, 'LF-t'), lent = c.morphologie(p, { VIT: 45, PHY: 60 }, 'LF-t');
  t('§10 un joueur rapide : cuisses et mollets plus forts, moins de masse grasse', rapide.cuisses > lent.cuisses && rapide.mollets > lent.mollets && rapide.masse_grasse < lent.masse_grasse,
    'cuisses ' + lent.cuisses + ' → ' + rapide.cuisses + ', masse grasse ' + lent.masse_grasse_pct + ' → ' + rapide.masse_grasse_pct + ' %');
  const fort = c.morphologie(p, { VIT: 60, PHY: 92 }, 'LF-t'), frele = c.morphologie(p, { VIT: 60, PHY: 48 }, 'LF-t');
  t('   un physique fort : torse, cou et épaules', fort.poitrine > frele.poitrine && fort.cou > frele.cou && fort.epaules > frele.epaules);
  const moyenne = (pos, k, rap) => { let s = 0; for (let i = 0; i < 300; i++) { const m = c.morphologie({ id: 50000 + i, pos, ovr: 70 }, { VIT: 65, PHY: 70, PLO: 70, MAI: 70 }, 'LF-m' + i); s += rap ? m[k] / m.taille_cm : m[k]; } return s / 300; };
  t('   à statistiques égales, un défenseur a les épaules et le torse plus larges qu’un milieu', moyenne('DEF', 'epaules') > moyenne('MIL', 'epaules') + 0.05 && moyenne('DEF', 'poitrine') > moyenne('MIL', 'poitrine'));
  t('   un gardien a l’envergure, les bras et les mains', moyenne('GB', 'envergure_cm', true) > moyenne('MIL', 'envergure_cm', true) + 0.02 && moyenne('GB', 'mains') > moyenne('MIL', 'mains') + 0.1,
    'envergure ' + (100 * moyenne('GB', 'envergure_cm', true)).toFixed(1) + ' % de la taille, contre ' + (100 * moyenne('MIL', 'envergure_cm', true)).toFixed(1));
  // §5 §6 les coiffures et les barbes du cahier, sur 3 000 personnages
  const coiffures = new Set(), barbes = new Set(), teints = new Set(), parTeint = { clair: {}, fonce: {} };
  for (let i = 0; i < 3000; i++) {
    const a = c.apparencePont('LF-v' + i); coiffures.add(a.coiffure); barbes.add(a.barbe); teints.add(a.teint);
    const g = a.teint <= 2 ? 'clair' : a.teint >= 7 ? 'fonce' : null;
    if (g) parTeint[g][a.texture_cheveux] = (parTeint[g][a.texture_cheveux] || 0) + 1;
  }
  t('§5 toutes les coiffures : rasés, courts, dégradés, afro, boucles, frisés, dreadlocks, longs, attachés',
    ['ras', 'court', 'degrade', 'afro', 'boucles', 'frises', 'dreadlocks', 'long', 'attache'].every((x) => coiffures.has(x)), [...coiffures].join(', '));
  t('§6 toute la pilosité faciale : rasé, très courte, courte, moyenne, longue, moustache, bouc',
    ['aucune', 'tres_courte', 'courte', 'moyenne', 'longue', 'moustache', 'bouc'].every((x) => barbes.has(x)), [...barbes].join(', '));
  const part = (g, x) => (parTeint[g][x] || 0) / Object.values(parTeint[g]).reduce((s, v) => s + v, 0);
  t('les dix teints existent, et la texture des cheveux en tient compte sans rien exclure', teints.size === 10
    && ['raides', 'ondules', 'boucles', 'crepus'].every((x) => parTeint.clair[x] > 0 && parTeint.fonce[x] > 0) && part('fonce', 'crepus') > part('clair', 'crepus'),
    'cheveux crépus : ' + Math.round(100 * part('clair', 'crepus')) + ' % des teints clairs, ' + Math.round(100 * part('fonce', 'crepus')) + ' % des teints foncés');
  const ailleurs = club().matchPont(ADV, { seed: 78 }).document.joueurs, parPerso = new Map(ailleurs.map((j) => [j.personnage, j]));
  t('un personnage garde son corps, son visage et son caractère d’un match à l’autre', tous.every((j) => !parPerso.has(j.personnage)
    || JSON.stringify([j.morphologie, j.apparence, j.personnalite]) === JSON.stringify([parPerso.get(j.personnage).morphologie, parPerso.get(j.personnage).apparence, parPerso.get(j.personnage).personnalite])));
  // le tirage de l'apparence est figé : le changer change le visage de tous les joueurs, et
  // ceux des MetaHumans déjà fabriqués (Content/Python/metahumans_linkfoot.py) ; il faut que ce
  // soit voulu, et ces trois empreintes mises à jour en connaissance de cause
  const FIGEES = {
    'LF-00001': '{"graine":1671150789,"visage":[0.63,0.714,0.035,0.112,0.072,0.987,0.064,0.134],"teint":5,"texture_cheveux":"boucles","coiffure":"boucles","cheveux":"noir","barbe":"bouc","sourcils":5,"yeux":0}',
    'LF-00127': '{"graine":118399892,"visage":[0.754,0.351,0.13,0.482,0.02,0.596,0.25,0.576],"teint":1,"texture_cheveux":"ondules","coiffure":"degrade","cheveux":"chatain","barbe":"aucune","sourcils":1,"yeux":0}',
    'ADV-20815-09': '{"graine":1692492191,"visage":[0.034,0.61,0.516,0.132,0.464,0.09,0.073,0.455],"teint":4,"texture_cheveux":"raides","coiffure":"attache","cheveux":"brun_fonce","barbe":"courte","sourcils":4,"yeux":4}',
  };
  const changes = Object.keys(FIGEES).filter((k) => JSON.stringify(c.apparencePont(k)) !== FIGEES[k]);
  t('le visage d’un personnage est figé d’une version à l’autre (trois empreintes)', changes.length === 0, changes.length ? 'changé : ' + changes.join(', ') : 'LF-00001, LF-00127, ADV-20815-09');
  // §27 six tempéraments, subtils, qui prolongent la fiche
  const types = {}, parFiche = {};
  for (let i = 0; i < 3000; i++) {
    const q = { id: 60000 + i, pos: 'MIL', ovr: 70 }, k = c.personnalitePont(q, { VIT: 60, PHY: 60, 'DÉF': 55 }, 'LF-c' + i, []);
    types[k.type] = (types[k.type] || 0) + 1;
    const f = c.profile(q).perso; (parFiche[f] = parFiche[f] || []).push(k.expressivite);
  }
  const moy = (l) => l.reduce((a, b) => a + b, 0) / l.length;
  t('§27 six tempéraments : agressif, calme, expressif, réservé, énergique, confiant', ['agressif', 'calme', 'expressif', 'reserve', 'energique', 'confiant'].every((x) => types[x] > 30), JSON.stringify(types));
  t('   subtils, et la fiche se voit : un « Showman » est plus expressif qu’un « Discret »', tous.every((j) => ['agressivite', 'calme', 'expressivite', 'energie', 'confiance'].every((k) => j.personnalite[k] >= 0.1 && j.personnalite[k] <= 0.9))
    && moy(parFiche.Showman) > moy(parFiche.Discret) + 0.3, 'expressivité ' + moy(parFiche.Showman).toFixed(2) + ' contre ' + moy(parFiche.Discret).toFixed(2));
  const sans = c.personnalitePont(p, {}, 'LF-k', []), avec = c.personnalitePont(p, {}, 'LF-k', [{ eid: 'calme' }]);
  t('   une compétence aussi : le Sang-froid rend plus calme', avec.calme > sans.calme, sans.calme + ' → ' + avec.calme);
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
  // un tireur de corner ou de touche y était téléporté (jusqu'à 38 m) : il court au ballon
  t('aucune téléportation hors des coupes annoncées', C.teleportation === 0, C.teleportation + ' fois' + (v.exemples.find((e) => e.k === 'teleportation') ? ', par exemple ' + JSON.stringify(v.exemples.find((e) => e.k === 'teleportation')) : ''));
  // les matchs officiels partaient avec les vingt-deux joueurs sur le rond central
  const premiere = c.lireImagePont(D1, 0), auCentre = premiere.joueurs.filter((j) => Math.hypot(j.x - 34, j.y - 52.5) < 3).length;
  t('le coup d’envoi : chacun à sa place dès la première image, annoncée comme une coupe', premiere.coupe && auCentre <= 2, auCentre + ' joueur(s) dans le rond au départ');
  // chaque touche accordée finit par un lancer (et pas par un lanceur qui repart balle au pied)
  const iTouche = P.cpa.indexOf('throw'), Dm = D1.images.donnees;
  let accordees = 0; for (let i = 1; i < Dm.length; i++) if (Dm[i - 1][10] === iTouche && Dm[i][10] !== iTouche) accordees++;
  const touches = D1.actions.filter((a) => a.a === 'touche');
  t('une touche se lance toujours : le lanceur ne repart jamais balle au pied', accordees > 0 && touches.length === accordees && touches.every((a) => a.aerien),
    accordees + ' touches accordées, ' + touches.length + ' lancées, dont ' + touches.filter((a) => a.vers < 0).length + ' le long de la ligne');
  // le tireur d'un coup de pied arrêté frappe de sa place : il n'y bondit plus au dernier moment
  const ligne = new Map(D1.images.donnees.map((r) => [r[0], r]));
  const cpa = D1.actions.filter((a) => (a.a === 'passe' || a.a === 'tir' || a.a === 'degagement' || a.a === 'touche') && a.cpa && a.cpa !== 'ko');
  const bonds = cpa.map((a) => { const r0 = ligne.get(Math.round(a.t * 10)), r1 = ligne.get(Math.round(a.t * 10) + 1); if (!r0 || !r1) return 0;
    return Math.hypot(r1[col(a.c, 'x')] - r0[col(a.c, 'x')], r1[col(a.c, 'y')] - r0[col(a.c, 'y')]) / 100; });
  t('le tireur d’un coup de pied arrêté frappe de sa place : pas de bond au ballon', cpa.length > 20 && bonds.every((d) => d <= 0.8),
    cpa.length + ' coups de pied arrêtés, plus grand pas ' + Math.max(...bonds).toFixed(2) + ' m en 0,1 s');
  // une tête ou une volée part de la hauteur du ballon, au lieu de retomber d'un coup au sol
  // (un tir contré dure 0,15 s : le ballon rabattu au sol par le contreur, c'est voulu). L'image
  // de l'instant de l'action montre le ballon au point de frappe ; la suivante, le premier pas du vol.
  const enLAir = D1.actions.filter((a) => (a.a === 'passe' || a.a === 'tir' || a.a === 'degagement') && a.z0 > 0.5 && a.dur >= 0.3);
  const chutes = enLAir.map((a) => { const r0 = ligne.get(Math.round(a.t * 10)), r1 = ligne.get(Math.round(a.t * 10) + 1); return r0 && r1 ? (r0[6] - r1[6]) / 100 : 0; });
  const auPoint = enLAir.filter((a) => { const r0 = ligne.get(Math.round(a.t * 10)); return r0 && Math.abs(r0[6] / 100 - a.z0) <= 0.15; }).length;
  t('une tête ou une volée part de la hauteur du ballon (il ne perd plus 1,8 m en un pas)', enLAir.length > 10 && chutes.every((d) => d < 0.6) && auPoint === enLAir.length,
    enLAir.length + ' frappes au-dessus de 50 cm, ' + auPoint + ' au point de frappe à l’instant de l’action, plus forte chute ' + Math.max(...chutes).toFixed(2) + ' m au premier pas');
  // l'instant d'une action est celui de l'image qui la montre : le receveur a le ballon dans les
  // pieds au moment de son contrôle (le moteur règle le ballon après avoir déplacé les joueurs)
  const recus = D1.actions.filter((a) => a.a === 'controle').map((a) => { const r = ligne.get(Math.round(a.t * 10)); return r ? Math.hypot(r[4] - r[col(a.c, 'x')], r[5] - r[col(a.c, 'y')]) / 100 : 99; }).sort((x, y) => x - y);
  t('un contrôle se voit à l’image où le ballon arrive au receveur', recus.length > 300 && recus[Math.floor(recus.length * 0.9)] <= 1.2,
    recus.length + ' contrôles, ballon à ' + recus[Math.floor(recus.length / 2)].toFixed(2) + ' m du receveur en médiane, ' + recus[Math.floor(recus.length * 0.9)].toFixed(2) + ' m au 9e décile');
  // §22 la physique du ballon : un vol aérien du moteur est une courbe paramétrée (sommet,
  // durée), pas une chute libre. Son accélération verticale, 8 × sommet / durée², dit s'il
  // monte plus haut que la pesanteur ne le permet dans le temps qu'il passe en l'air.
  const aeriens = D1.actions.filter((a) => a.aerien && a.dur > 0 && a.apex > 0);
  const gs = aeriens.map((a) => 8 * a.apex / (a.dur * a.dur) / 9.81).sort((x, y) => x - y);
  constat('vols aériens plus hauts que la pesanteur ne le permet (au-delà de 1,5 g)', gs.filter((g) => g > 1.5).length + ' sur ' + gs.length
    + ', médiane ' + gs[Math.floor(gs.length / 2)].toFixed(1) + ' g, jusqu’à ' + gs[gs.length - 1].toFixed(1) + ' g (déviations de la tête courtes)');
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
