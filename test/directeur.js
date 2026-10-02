// Le parcours du directeur sportif (§21, §22), joué de bout en bout.
//
// Chaque autre fichier de test/ vérifie un système. Celui-ci suit le chemin que le
// cahier des charges décrit, dans l'ordre, sur UN club :
//
//   je crée mon club → je reçois 1 joueur rare → je possède surtout des normaux
//   → je développe mes joueurs lentement → je gagne de l'argent en jouant
//   → j'accomplis des quêtes → j'ouvre un seul type de pack → je récupère des
//   compétences → je les attribue aux joueurs compatibles → leurs statistiques et
//   compétences changent leur comportement → je regarde les 22 joueurs jouer seuls
//   → je progresse.
//
// Et il vérifie ce qui relie tout : le journal des finances explique le solde au
// jeton près, la sauvegarde rend la même partie, et les neuf entrées de la section
// DIRECTEUR SPORTIF existent dans l'écran Mon Club et dans l'app téléphone (§17).
import { readFileSync } from 'node:fs';
import { Club } from '../src/club.js';
import { serialize, deserialize } from '../src/save.js';

let ok = 0, ko = 0;
const t = (nom, cond, detail) => {
  console.log((cond ? '  ok   ' : '  ÉCHEC') + ' ' + nom + (detail ? '  (' + detail + ')' : ''));
  cond ? ok++ : ko++;
};
const tete = (s) => console.log('\n' + s);
const ADV = { club: 'Référence', ovr: 60, style: 'blocmed' };
// le journal doit expliquer le solde : la somme des lignes, c'est l'argent du club
const ecart = (c) => c.state.balance - (c.state.ledger || []).reduce((a, l) => a + l.a, 0);
// un générateur à graine, pour que chaque tirage de ce fichier soit reproductible
const graine = (g) => () => { g = (g * 1664525 + 1013904223) >>> 0; return g / 4294967296; };

const c = new Club();
c.createClub({ name: 'FC Parcours', seed: 4242 });

// ---------------------------------------------------------------- §4 §5 création
tete('§4 et §5 je crée mon club : un joueur rare, des normaux');
const rares = c.state.squad.filter((p) => p.rar === 'rare'), normaux = c.state.squad.filter((p) => p.rar === 'normal');
const rare = rares[0];
t('un seul joueur rare, et il est offert', rares.length === 1 && rare.gift === true, rare && rare.name);
t('tous les autres sont normaux', normaux.length === c.state.squad.length - 1, normaux.length + ' normaux');
t('le rare est le meilleur joueur du club', rare.ovr > Math.max(...normaux.map((p) => p.ovr)),
  rare.ovr + ' contre ' + Math.max(...normaux.map((p) => p.ovr)) + ' pour le meilleur normal');
t('   sans gagner seul : sa note reste sous 71', rare.ovr <= 70);
t('   il a un meilleur potentiel et une compétence qu’il peut porter',
  rare.pot > rare.ovr + 10 && rare.skills.length === 1 && c.canEquipRaw(rare, rare.skills[0]), 'potentiel ' + rare.pot);
t('les normaux ont un vrai potentiel à développer', normaux.every((p) => p.pot >= p.ovr + 10));
t('§7 le club démarre avec peu d’argent, et le journal le dit', c.state.balance === 600 && ecart(c) === 0);

// ---------------------------------------------------------------- §6 progression
tete('§6 la progression est lente, et de plus en plus');
const need = (l) => c.playerXpNeed(l);
t('chaque niveau coûte plus que le précédent', [1, 5, 10, 20, 30].every((l, i, a) => i === 0 || need(l) > need(a[i - 1])),
  [1, 5, 10, 20, 30].map((l) => l + '→' + (l + 1) + ' : ' + need(l)).join(', '));
t('20 → 21 coûte au moins quinze fois 1 → 2', need(20) >= 15 * need(1));
t('30 → 31 coûte au moins cinq fois 10 → 11', need(30) >= 5 * need(10));
t('l’argent ne remplace pas le jeu : la séance intensive est plafonnée par jour',
  c.SHARD_XP().perDay <= 6 && c.SHARD_XP().xp < need(1));

// ---------------------------------------------------------------- §7 argent
tete('§7 l’argent se gagne en jouant, et aucune source ne tourne sans fin');
{
  const e = new Club(); e.createClub({ name: 'FC Plafond', seed: 7 });
  const g1 = e.earn(5000, 'quest', 'essai');
  t('une source plafonnée ne donne jamais plus que son plafond', g1.given <= e.CAPS().quest, g1.given + ' versés sur 5000 demandés');
  e.earn(5000, 'vente', 'essai');
  t('le total du jour plafonne toutes les sources ensemble', e.state.caps.total <= e.CAPS().total, e.state.caps.total + ' / ' + e.CAPS().total);
  t('et chaque jeton versé a sa ligne au journal', ecart(e) === 0);
}

// ---------------------------------------------------------------- §8 §9 pack
tete('§8 et §9 j’ouvre un seul type de pack, dont les probabilités sont affichées');
c.setState({ balance: c.state.balance + 0 });
const kq = c.kiosque();
t('un seul pack dans tout le jeu', kq.length === 1 && kq[0].key === 'linkfoot', kq.map((x) => x.name).join(', '));
t('ses familles et ses raretés sont affichées avant l’ouverture',
  kq[0].familles.length === 3 && kq[0].odds.length === c.RARITY().length);
t('les taux de rareté sont ceux du réglage (70, 20, 7, 2, 0,9, 0,1)',
  kq[0].odds.map((o) => Math.round(o.pct * 10) / 10).join(' ') === '70 20 7 2 0.9 0.1');
// ouvrir des packs jusqu'à obtenir une compétence : tirages à graine, donc reproductibles
const rnd = graine(1234);
let skillLot = null, ouverts = 0, objets = 0;
const soldeAvantPacks = c.state.balance;
while (!skillLot && ouverts < 6) {
  const pk = c.openPack({ free: true, rnd });
  ouverts++;
  objets += pk.got.filter((g) => g.kind === 'objet').length;
  c.commitPack(pk);
  skillLot = pk.got.find((g) => g.kind === 'skill') || null;
}
t('§10 le pack m’a donné une compétence', !!skillLot, ouverts + ' pack(s) ouvert(s)' + (skillLot ? ' · ' + skillLot.name : ''));
t('un pack offert ne coûte rien, et le journal reste juste', c.state.balance === soldeAvantPacks && ecart(c) === 0);

// ---------------------------------------------------------------- §10 §11 §12 compétence
tete('§10 à §12 la compétence a une catégorie, une rareté, une puissance, des prérequis');
const inv = c.skillInventory();
const k = inv.find((x) => x.name === skillLot.name) || inv[0];
t('elle est dans l’inventaire', !!k);
t('catégorie, rareté, puissance et prérequis renseignés',
  !!(k.cat && k.rarLabel && k.power >= 0 && k.req && k.req.pos.length && k.req.lvl >= 1), k.cat + ' · ' + k.rarLabel + ' · puissance ' + k.power);
t('plus de 10 000 combinaisons dans le jeu', c.skillCount() > 10000, c.skillCount().toLocaleString('fr-FR'));
t('dix-sept catégories', new Set(c.SKILL_DEF().E.map((e) => e[2])).size === 17);

tete('§11 compatibilité : une compétence ne va pas sur n’importe qui');
const D = c.SKILL_DEF();
const gkSkill = c.makeSkill('gk_reflex', 0, 0, 0);
const attaquant = c.state.squad.find((p) => p.pos === 'ATT');
const refus = c.canEquip(attaquant, gkSkill);
t('une compétence de gardien est refusée à un attaquant, avec la raison', !refus.ok && !!refus.why, refus.why);

// ---------------------------------------------------------------- §22 attribution
tete('§22 je l’attribue au joueur compatible de mon choix');
// on donne au club une compétence modeste, que plusieurs joueurs peuvent porter
const modeste = c.SKILL_INDEX().normal.slice().sort((a, b) => a[4] - b[4])[0];
const sk = c.makeSkill(modeste[0], modeste[1], modeste[2], modeste[3]);
c.setState({ skillInv: c.state.skillInv.concat([Object.assign({}, sk, { uid: 7777, on: null })]) });
const k2 = c.skillInventory().find((x) => x.uid === 7777);
t('plusieurs joueurs peuvent la porter', k2.fitCount >= 2, k2.fitCount + ' compatibles');
const choisi = k2.fits[k2.fits.length - 1];          // pas le premier : c'est un choix
const eq = c.equipSkill(7777, choisi.id);
t('elle s’équipe sur le joueur choisi', eq.ok && c.equippedOn(choisi.id).some((x) => x.uid === 7777), choisi.name);
t('et apparaît sur sa fiche', c.skillsOf(c.state.squad.find((p) => p.id === choisi.id)).some((x) => x.eid === sk.eid));

// ---------------------------------------------------------------- §13 vrai effet
tete('§13 une carte +2 donne vraiment +2 dans le moteur');
{
  const e = new Club(); e.createClub({ name: 'FC Carte', seed: 4242 });
  e.setState({ inv: { up_TIR: 1 } });
  const xi = e.pickXI(e.state.formation);
  const cible = xi.find((p) => p.line !== 'GB' && p.ovr < e.hiddenOf(p).potReel);
  const lire = () => { const x2 = e.pickXI(e.state.formation), i = x2.findIndex((p) => p.id === cible.id);
    return e.engineCfg(ADV, x2, x2).sides.H.players[i].st.TIR; };
  const avant = lire();
  const r = e.useUpgrade(cible.id, 'TIR');
  t('la carte est acceptée', r.ok, r.why || cible.name);
  t('le moteur reçoit exactement +2 en tir', lire() === avant + 2, avant + ' → ' + lire());
}

tete('§13 une compétence équipée change le match, pas seulement un chiffre');
{
  const jouer = (avec) => {
    const e = new Club(); e.createClub({ name: 'FC Effet', seed: 4242 });
    const xi = e.pickXI(e.state.formation);
    const D2 = e.SKILL_DEF(), porteur = xi.find((p) => p.line === 'ATT');
    if (avec) {
      // la meilleure compétence d'attaque que ce joueur peut porter, active TOUT le
      // match : une compétence à condition (fin de match serré, équipe menée…) ne
      // joue que si sa condition arrive, et c'est voulu
      let best = null;
      Object.values(e.SKILL_INDEX()).forEach((l) => l.forEach((x) => {
        if ((D2.POSOK.ATT || []).indexOf(x[0]) < 0) return;
        const s2 = e.makeSkill(x[0], x[1], x[2], x[3]);
        if (s2.cid === 'always' && e.canEquip(porteur, s2).ok && (!best || s2.power > best.power)) best = s2;
      }));
      if (!best) return null;
      e.setState({ skillInv: [Object.assign({}, best, { uid: 1, on: porteur.id })] });
    }
    const r = e.playMatch(ADV, { seed: 909 });
    return JSON.stringify([r.score, r.stats.H.sh, r.stats.H.pa, r.cnt.drib || 0, r.cnt.dec]);
  };
  const sans = jouer(false), avec = jouer(true);
  t('à graine égale, le match n’est plus le même', !!avec && sans !== avec, sans + ' contre ' + avec);
}

// ---------------------------------------------------------------- §14 §15 §16 match
tete('§14 le match est 100 % automatique');
const avantMatch = { bal: c.state.balance, xp: c.state.squad.map((p) => p.pxp + p.plv * 1e6) };
const m1 = c.playMatch(ADV, { seed: 31 });
t('il se joue sans aucune intervention, jusqu’au bout', Array.isArray(m1.score) && m1.score.length === 2, m1.score.join('-'));
t('l’IA prend des milliers de décisions', (m1.cnt.dec || 0) > 1000, m1.cnt.dec + ' décisions');
t('passes, courses, tirs, centres : tout est décidé par l’IA',
  ['act_pass_pass', 'act_carry', 'act_shot', 'act_cross'].every((x) => (m1.cnt[x] || 0) > 0));
t('le moteur n’offre aucune commande de joueur', typeof c.makeEngine({ sides: { H: { players: [] }, A: { players: [] } } }).pass === 'undefined');

tete('§15 les statistiques changent les décisions');
{
  // même club, même graine ; seule la statistique de dribble du onze change
  const dribbles = (v, seed) => {
    const e = new Club(); e.createClub({ name: 'FC Dribble', seed: 4242 });
    if (v) e.setState({ squad: e.state.squad.map((p) => {
      if (p.pos !== 'ATT' && p.pos !== 'MIL') return p;
      const st = {}; e.cardStats(p).forEach((q) => { st[q.l] = q.v; });
      return Object.assign({}, p, { st: Object.assign(st, { DRI: v }) });
    }) });
    const r = e.playMatch(ADV, { seed });
    return { drib: r.cnt.drib || 0, haut: (r.cnt.g3 || 0) + (r.cnt.g4 || 0) + (r.cnt.g5 || 0) };
  };
  const S = [41, 42, 43];
  const bas = S.map((sd) => dribbles(0, sd)), haut = S.map((sd) => dribbles(92, sd));
  const somme = (l, k) => l.reduce((a, x) => a + x[k], 0);
  t('Dribble 92 : il tente des gestes avancés (palier 3 et plus) que l’effectif normal ne tente pas',
    somme(haut, 'haut') > somme(bas, 'haut') * 2 + 2, somme(bas, 'haut') + ' contre ' + somme(haut, 'haut'));
}

tete('§16 les animations ont des variantes, et les statistiques décident lesquelles');
{
  const vus = new Set(), tiers = new Set();
  [m1].concat([51, 52].map((sd) => { const e = new Club(); e.createClub({ name: 'FC Variantes', seed: 4242 }); return e.playMatch(ADV, { seed: sd }); }))
    .forEach((r) => Object.keys(r.cnt).forEach((x) => { if (/^sv_/.test(x)) vus.add(x); if (/^g\d$/.test(x)) tiers.add(x); }));
  t('plusieurs variantes de frappe en trois matchs', vus.size >= 4, [...vus].map((x) => x.slice(3)).join(', '));
  t('plusieurs paliers de gestes techniques', tiers.size >= 2, [...tiers].join(', '));
}

// ---------------------------------------------------------------- fatigue, XP, progression
tete('Fatigue, XP et progression après le match');
const joues = c.state.squad.filter((p) => p.fit != null && p.fit < 100);
t('les joueurs qui ont joué sont fatigués', joues.length >= 10, joues.length + ' joueurs sous 100 % d’énergie');
const xpApres = c.state.squad.map((p) => p.pxp + p.plv * 1e6);
t('jouer leur a donné de l’XP', xpApres.filter((v, i) => v > avantMatch.xp[i]).length >= 10);
t('§7 le match a rapporté de l’argent, ligne par ligne au journal',
  c.state.ledger.some((l) => /^Match : prime/.test(l.l)) && ecart(c) === 0, 'écart ' + ecart(c));

// ---------------------------------------------------------------- quêtes
tete('§8 les quêtes');
{
  const q = c.activeQuests()[0];
  const refus2 = c.claimQuest(q.id);
  t('une quête non terminée ne paie rien', q.prog >= q.goal || !refus2.ok, refus2.why || '');
  c.setState({ quests: c.state.quests.map((x) => (x.id === q.id ? Object.assign({}, x, { prog: x.goal }) : x)) });
  const av = c.state.balance, r = c.claimQuest(q.id);
  t('terminée, elle paie par le plafond et le journal', r.ok && c.state.balance > av && ecart(c) === 0, '+' + (c.state.balance - av));
}

// ---------------------------------------------------------------- transferts
tete('§17 Transferts : acheter et vendre');
{
  c.setState({ balance: c.state.balance });
  const av = c.state.balance, n = c.state.squad.length;
  const pauvre = c.marketList().slice().sort((a, b) => b.price - a.price)[0];
  c.setState({ balance: 0 });
  const nope = c.buyPlayer(pauvre.id);
  t('sans les jetons, l’achat est refusé et dit ce qui manque', !nope.ok && /manque/.test(nope.why), nope.why);
  c.setState({ balance: av + 20000 });
  c.logMoney(20000, 'Essai : apport pour le test');
  const m = c.marketList().slice().sort((a, b) => a.price - b.price)[0];
  const r = c.buyPlayer(m.id);
  t('acheté : le joueur entre dans l’effectif', r.ok && c.state.squad.length === n + 1 && c.state.squad.some((p) => p.id === m.id));
  t('   il quitte le marché', !c.marketList().some((x) => x.id === m.id));
  t('   et la dépense est au journal', c.state.ledger[0].l === 'Achat de ' + m.name && c.state.ledger[0].a === -m.price && ecart(c) === 0);
  const deux = c.buyPlayer(m.id);
  t('le même joueur ne s’achète pas deux fois', !deux.ok, deux.why);
  const vendu = c.state.squad.find((p) => !p.gift && p.id !== m.id);
  const v = c.sellPlayer(vendu.id);
  t('vendre rapporte, par le journal', v.ok && c.state.ledger[0].l === 'Vente de ' + vendu.name && ecart(c) === 0, '+' + v.price);
}

// ---------------------------------------------------------------- finances
tete('§17 Finances : le journal explique le solde, au jeton près');
{
  const av = c.state.balance;
  c.setState({ balance: av + 3000 }); c.logMoney(3000, 'Essai : apport pour le test');
  const lv = c.state.level;
  c.setState({ level: Math.max(lv, 3) });
  const h = c.hireStaff('kine');
  t('le staff se paie par le journal', h.ok && /^Staff : /.test(c.state.ledger[0].l) && ecart(c) === 0, h.why || c.state.ledger[0].l);
  const pr = c.PRONO_DEFS(ADV, c.pickXI(c.state.formation))[0];
  c.placeProno(pr.id, 40);
  c.playMatch(ADV, { seed: 77 });
  t('après un match avec pronostic, le solde est exactement la somme du journal', ecart(c) === 0, 'écart ' + ecart(c));
}

// ---------------------------------------------------------------- sauvegarde
tete('Sauvegarde : la même partie au rechargement');
{
  const data = JSON.parse(JSON.stringify(serialize(c)));
  const r = new Club(deserialize(data));
  const empreinte = (x) => JSON.stringify({ bal: x.state.balance, sq: x.state.squad.map((p) => [p.id, p.ovr, p.plv, p.pxp]),
    sk: (x.state.skillInv || []).map((s2) => [s2.uid, s2.on]), inv: x.state.inv, co: x.state.coachInv, led: (x.state.ledger || []).length,
    mk: x.marketList().map((m) => m.id) });
  t('effectif, compétences équipées, objets, solde, journal et marché identiques', empreinte(r) === empreinte(c));
}

// ---------------------------------------------------------------- §17 navigation
tete('§17 la section DIRECTEUR SPORTIF et ses neuf entrées');
{
  const canvas = readFileSync(new URL('../canvas/Club.dc.html', import.meta.url), 'utf8');
  const bloc = canvas.slice(canvas.indexOf('DIRECTEUR SPORTIF'), canvas.indexOf('COMPÉTITIONS'));
  const NEUF = ['Mon effectif', 'Compétences', 'Pack', 'Entraînement', 'Transferts', 'Quêtes', 'Finances', 'Tactique', 'Club'];
  t('Mon Club : la section existe', bloc.length > 100);
  t('   avec les neuf entrées, dans l’ordre', NEUF.every((x, i) => {
    const at = bloc.indexOf('font-weight: 700">' + x + '</span>');
    return at >= 0 && (i === 0 || at > bloc.indexOf('font-weight: 700">' + NEUF[i - 1] + '</span>'));
  }));
  t('   Quêtes et Finances ouvrent un vrai écran',
    /onClick="\{\{goQuests\}\}"/.test(bloc) && canvas.includes('<sc-if value="{{isQuests}}"')
    && /onClick="\{\{goFinances\}\}"/.test(bloc) && canvas.includes('<sc-if value="{{isFinances}}"'));
  const app = readFileSync(new URL('../app/src/screens.js', import.meta.url), 'utf8');
  const routes = readFileSync(new URL('../app/App.js', import.meta.url), 'utf8');
  const CLES = ['squad', 'skills', 'packs', 'train', 'transfers', 'quests', 'finances', 'tactic', 'club'];
  t('App téléphone : les neuf entrées sur l’accueil', NEUF.every((x, i) => app.includes("['" + CLES[i] + "', '" + x + "'")));
  t('   et chacune a son écran', CLES.every((x) => new RegExp('\\b' + x + ': [A-Z][A-Za-z]+Screen').test(routes)));
}

console.log('\n' + (ko ? 'ÉCHECS : ' + ko + ' sur ' + (ok + ko) : 'OK : ' + ok + ' vérifications, le parcours du directeur sportif tient'));
process.exit(ko ? 1 : 0);
