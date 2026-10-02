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
{
  // La vitesse, la passe et la finition, chacune seule, sur les seuls joueurs concernés.
  // Les compteurs sont ceux de NOTRE équipe (suffixe _H) : ce que fait l'adversaire ne
  // s'y mélange pas. Mesuré d'abord sur six graines (vitesse : 19 ballons en profondeur
  // contre 165 ; passe : 46 contre 68 ; finition : 28 % de tirs cadrés contre 46 %).
  // Les buts, eux, sont trop rares pour six matchs : sur vingt graines, la finition à 95
  // en marque 21 contre 11 à 40, mais sur six le hasard peut inverser l'ordre. Le test
  // regarde donc la décision (frapper) et l'exécution (cadrer), pas le score.
  const jouerAvec = (champs, postes, seed) => {
    const e = new Club(); e.createClub({ name: 'FC Stat', seed: 4242 });
    e.setState({ squad: e.state.squad.map((p) => {
      if (!postes.includes(p.pos)) return p;
      const st = {}; e.cardStats(p).forEach((q) => { st[q.l] = q.v; });
      return Object.assign({}, p, { st: Object.assign(st, champs) });
    }) });
    return e.playMatch(ADV, { seed });
  };
  const S6 = [41, 42, 43, 44, 45, 46];
  const total = (champs, postes, f) => S6.reduce((a, sd) => a + f(jouerAvec(champs, postes, sd)), 0);
  const prof = (r) => r.cnt.act_pass_through_H || 0;
  const lents = total({ VIT: 40 }, ['ATT'], prof), rapides = total({ VIT: 95 }, ['ATT'], prof);
  t('Vitesse 95 en attaque : on le cherche dans la profondeur bien plus qu’à 40', rapides > lents * 2, lents + ' passes en profondeur contre ' + rapides);
  const fine = total({ PAS: 40 }, ['MIL'], prof), laser = total({ PAS: 95 }, ['MIL'], prof);
  t('Passe 95 au milieu : il tente les passes qui cassent une ligne', laser > fine * 1.2, fine + ' contre ' + laser);
  const cad = (champs) => { let sh = 0, on = 0; S6.forEach((sd) => { const r = jouerAvec(champs, ['ATT'], sd); sh += r.stats.H.sh; on += r.stats.H.on; }); return { sh, on, taux: on / Math.max(1, sh) }; };
  const maladroit = cad({ TIR: 40, ATQ: 40 }), buteur = cad({ TIR: 95, ATQ: 95 });
  t('Tir 95 en attaque : il frappe plus souvent, et cadre bien mieux', buteur.sh >= maladroit.sh && buteur.taux > maladroit.taux + 0.08,
    Math.round(maladroit.taux * 100) + ' % cadrés sur ' + maladroit.sh + ' tirs contre ' + Math.round(buteur.taux * 100) + ' % sur ' + buteur.sh);
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
  const titulaire = c.pickXI(c.state.formation)[0];
  const refusTit = c.sellPlayer(titulaire.id);
  t('un titulaire ne se vend pas tant qu’il est dans le onze', !refusTit.ok && /Titulaire/.test(refusTit.why), refusTit.why);
  const xiIds = new Set(c.pickXI(c.state.formation).map((p) => p.id));
  const vendu = c.state.squad.find((p) => !p.gift && p.id !== m.id && !xiIds.has(p.id));
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

// ---------------------------------------------------------------- §22 la division
tete('§22 je progresse dans les divisions : un vrai championnat');
{
  const d = new Club(); d.createClub({ name: 'FC Division', seed: 4242 });
  const lg0 = d.divisionCourante(), R = d.DIVISION_RULES();
  t('six clubs, cinq journées', lg0.rows.length === R.clubs && lg0.days.length === R.clubs - 1);
  const paires = new Set();
  lg0.days.forEach((j) => j.forEach((m) => paires.add([m.home, m.away].sort().join('-'))));
  t('chaque club rencontre chacun des autres exactement une fois', paires.size === R.clubs * (R.clubs - 1) / 2);
  t('chaque journée, tout le monde joue', lg0.days.every((j) => j.length === R.clubs / 2));
  const pm = d.prochainMatch();
  t('le prochain match est celui du calendrier', !!pm.opp.club && pm.day === 1, pm.opp.club + (pm.domicile ? ', à domicile' : ', à l’extérieur'));

  // un adversaire hors calendrier : c'est un amical, il ne touche ni au bilan ni à la saison
  const am = d.playMatch({ club: 'Hors calendrier', ovr: 50, style: 'blocmed' }, { seed: 5 });
  t('un adversaire hors calendrier est un amical', am.amical === true && d.state.seasonP === 0
    && d.state.record.w + d.state.record.d + d.state.record.l === 0, 'saison ' + d.state.seasonP);
  t('   moitié de la prime', am.reward === (am.res === 'w' ? 60 : am.res === 'd' ? 25 : 10), '+' + am.reward);
  t('   et la division n’a pas bougé', d.divisionCourante().day === 0);

  const r1 = d.playMatch(pm.opp, { seed: 6 });
  const lg1 = d.divisionCourante(), tbl = d.table(lg1), moi = tbl.find((x) => x.me);
  t('le match du calendrier compte', !r1.amical && lg1.day === 1 && d.state.seasonP === 1);
  t('   les six clubs ont joué la journée', tbl.every((x) => x.p === 1), tbl.map((x) => x.club + ' ' + x.p).join(', '));
  t('   ton score est celui du moteur', moi.gf === r1.score[0] && moi.ga === r1.score[1], r1.score.join('-'));
  t('   les points suivent les résultats, pour tous', tbl.every((x) => x.pts === x.w * 3 + x.d));
  t('   et le bilan de la saison aussi', d.state.record[r1.res] === 1);
  t('les trois résultats de la journée sont lisibles', d.resultatsDeJournee(1).length === 3 && d.resultatsDeJournee(1).filter((x) => x.moi).length === 1);

  // les matchs simulés pèsent la note : le plus fort gagne nettement plus souvent
  let fort = 0, faible = 0;
  for (let i = 0; i < 400; i++) {
    const x = d.resultatRapide({ ovr: 60, style: 'blocmed' }, { ovr: 52, style: 'blocmed' }, 1000 + i);
    if (x.hs > x.as) fort++; else if (x.hs < x.as) faible++;
  }
  t('un match simulé favorise la meilleure note, sans être joué d’avance', fort > faible * 3 && faible > 0, fort + ' victoires du plus fort, ' + faible + ' du plus faible');

  // fin de saison : le classement décide, et une nouvelle saison commence
  const saison0 = d.state.saison || 1, div0 = d.state.division;
  for (let j = 2; j <= 5; j++) d.playMatch(d.prochainMatch().opp, { seed: 6 + j });
  const fin = d.state.lastSeason;
  t('après cinq journées, la saison est close et lisible', !!fin && fin.saison === saison0 && fin.table.length === R.clubs, fin && fin.rank + 'e');
  const attendu = fin.rank <= R.up && div0 > R.top ? div0 - 1 : fin.rank > R.clubs - R.down && div0 < R.bottom ? div0 + 1 : div0;
  t('montée, descente ou maintien selon le rang', d.state.division === attendu, 'rang ' + fin.rank + ', division ' + div0 + ' → ' + d.state.division);
  const lg2 = d.divisionCourante();
  t('la saison suivante repart d’un nouveau calendrier', d.state.saison === saison0 + 1 && lg2.day === 0 && lg2.rows.every((x) => x.p === 0)
    && d.state.seasonP === 0 && d.state.record.w + d.state.record.d + d.state.record.l === 0);

  // la phrase de situation lit le calendrier et les points en jeu, au lieu de dire
  // « bats-le » à un club déjà joué
  {
    const s = new Club(); s.createClub({ name: 'FC Situation', seed: 4242 });
    const base = s.divisionCourante();
    t('avant la première journée, la phrase présente la saison', /^Saison 1 : 5 journées/.test(s.situationDivision(base)), s.situationDivision(base));
    // la division arrêtée après trois journées, aux points choisis (aucune égalité)
    const fige = (pts) => {
      const lg = JSON.parse(JSON.stringify(base)); lg.day = 3;
      lg.rows.forEach((r) => {
        const v = pts[r.id], w = Math.floor(v / 3), dd = v % 3;
        Object.assign(r, { p: 3, w, d: dd, l: 3 - w - dd, pts: v, gf: v, ga: 3 });
      });
      return lg;
    };
    const adv = (j) => { const m = base.days[j].find((x) => x.home === 'moi' || x.away === 'moi'); return m.home === 'moi' ? m.away : m.home; };
    const nom = (id) => base.clubs.find((x) => x.id === id).club;
    const joue = adv(0), aVenir = adv(3);
    const [a, b, e] = base.clubs.map((x) => x.id).filter((id) => id !== joue && id !== aVenir);
    const p1 = s.situationDivision(fige({ [a]: 9, moi: 7, [aVenir]: 6, [joue]: 4, [b]: 3, [e]: 1 }));
    t('dans la zone de montée : qui suit, à combien, et quand on le joue',
      /^Tu es 2e, dans la zone de montée/.test(p1) && p1.includes(nom(aVenir) + ' (3e) est à 1 pt derrière') && p1.includes('journée 4'), p1);
    const p2 = s.situationDivision(fige({ [a]: 9, [joue]: 7, moi: 5, [aVenir]: 4, [b]: 3, [e]: 1 }));
    t('derrière un club déjà joué : la phrase ne dit plus « bats-le »',
      p2.includes('La montée est à 2 pts : ' + nom(joue)) && /déjà joué/.test(p2) && !/bats/.test(p2), p2);
    const p3 = s.situationDivision(fige({ [a]: 9, [aVenir]: 7, moi: 5, [joue]: 4, [b]: 3, [e]: 1 }));
    t('derrière un club encore à jouer : la journée du duel', p3.includes(nom(aVenir)) && p3.includes('Tu le joues à la journée 4'), p3);
    const p4 = s.situationDivision(fige({ [a]: 9, [b]: 9, moi: 1, [joue]: 4, [aVenir]: 3, [e]: 0 }));
    t('quand il manque plus de points qu’il n’en reste, la montée est dite perdue', /n’est plus possible/.test(p4) && /6 points en jeu/.test(p4), p4);
    const p5 = s.situationDivision(fige({ [a]: 9, [b]: 7, [joue]: 5, [aVenir]: 4, [e]: 3, moi: 1 }));
    t('dernier : la descente est annoncée', /Tu es dernier, et le dernier descend/.test(p5), p5);
  }

  // une ancienne sauvegarde (sans calendrier) reprend ses résultats de la saison
  const old = new Club(); old.setState({ league: undefined, seasonP: 2, record: { w: 1, d: 1, l: 0 } });
  const lgOld = old.divisionCourante(), me = old.table(lgOld).find((x) => x.me);
  t('une ancienne partie reprend sa saison au lieu de repartir de zéro', lgOld.day === 2 && me.w === 1 && me.d === 1 && me.p === 2);
}

// ---------------------------------------------------------------- §2 composition
tete('§2 je choisis le onze');
{
  const k = new Club(); k.createClub({ name: 'FC Onze', seed: 4242 });
  const xi0 = k.pickXI(k.state.formation), banc = k.benchOf(xi0);
  const slot = xi0.find((p) => p.line === 'MIL').slot, rempl = banc.find((p) => p.pos === 'MIL') || banc[0];
  const titulaire = xi0.find((p) => p.slot === slot);
  const r = k.assignSlot(slot, rempl.id);
  const xi1 = k.pickXI(k.state.formation);
  t('un remplaçant mis à un poste joue à ce poste', r.ok && xi1.find((p) => p.slot === slot).id === rempl.id, rempl.name);
  t('   et le titulaire qu’il remplace passe sur le banc', !xi1.some((p) => p.id === titulaire.id));
  const att = xi1.find((p) => p.line === 'ATT'), def = xi1.find((p) => p.line === 'DEF');
  k.assignSlot(att.slot, def.id);
  const xi2 = k.pickXI(k.state.formation);
  t('deux titulaires échangent leurs postes, et le hors-poste coûte des points',
    xi2.find((p) => p.slot === att.slot).id === def.id && xi2.find((p) => p.slot === def.slot).id === att.id && xi2.find((p) => p.slot === att.slot).pen > 0,
    'pénalité ' + xi2.find((p) => p.slot === att.slot).pen);
  const bl = banc.find((p) => p.id !== rempl.id);
  k.setState({ squad: k.state.squad.map((p) => (p.id === bl.id ? Object.assign({}, p, { inj: 2 }) : p)) });
  const refus = k.assignSlot(slot, bl.id), cand = k.candidatsPoste(slot).find((x) => x.p.id === bl.id);
  t('un blessé est refusé, et le choix dit pourquoi', !refus.ok && /blessé/.test(refus.why) && cand && !cand.can && /Blessé/.test(cand.why), refus.why);
  k.setState({ lineup: Object.assign({}, k.state.lineup, { [slot]: bl.id }) });
  t('un blessé inscrit au onze n’y joue pas', !k.pickXI(k.state.formation).some((p) => p.id === bl.id));
  k.compositionAuto();
  t('le onze redevient automatique', !Object.keys(k.state.lineup).length);
}

// ---------------------------------------------------------------- §2 décisions pendant le match
tete('§2 pendant le match, je décide depuis le banc');
{
  const neuf = () => { const k = new Club(); k.createClub({ name: 'FC Banc', seed: 4242 }); return k; };
  const jusqua = (d, m) => { let r; do { r = d.avancer(10); } while (!r.done && r.minute < m); return r; };
  const bloc = neuf().playMatch(ADV, { seed: 501 });
  const d1 = neuf().matchEnDirect(ADV, { seed: 501 }); jusqua(d1, 99);
  const r1 = d1.terminer();
  t('sans décision, le direct est le même match qu’en un bloc', JSON.stringify(bloc.stats) === JSON.stringify(r1.stats) && bloc.log.length === r1.log.length, bloc.score.join('-'));

  const d2 = neuf().matchEnDirect(ADV, { seed: 501 }); jusqua(d2, 20);
  t('une consigne de la voix est prise', d2.crier('exiger').ok);
  t('   la même, deux fois de suite, est refusée', !d2.crier('exiger').ok);
  jusqua(d2, 99);
  const r2 = d2.terminer();
  t('la consigne change le match, à graine égale', JSON.stringify(r2.stats) !== JSON.stringify(bloc.stats), bloc.score.join('-') + ' sans, ' + r2.score.join('-') + ' avec');

  const k3 = neuf(), d3 = k3.matchEnDirect(ADV, { seed: 501 }); jusqua(d3, 60);
  // un joueur de champ encore sur le terrain (un expulsé ne se remplace pas)
  const e3 = d3.etat(), sort = e3.xi.find((p) => !p.red && p.line !== 'GB'), entre = e3.banc[0];
  const avant = (id) => { const p = k3.state.squad.find((x) => x.id === id); return p.pxp + p.plv * 1e6; };
  const xpS = avant(sort.id), xpE = avant(entre.id);
  t('un remplacement à la 60e', d3.remplacer(sort.slot, entre.id).ok && d3.etat().xi.some((p) => p.id === entre.id) && d3.etat().faits === 1, entre.name + ' pour ' + sort.name);
  t('   le joueur sorti ne revient pas', !d3.remplacer(d3.etat().xi.find((p) => !p.red && p.id !== entre.id && p.line !== 'GB').slot, sort.id).ok);
  jusqua(d3, 99);
  const r3 = d3.terminer();
  const pS = k3.state.squad.find((p) => p.id === sort.id), pE = k3.state.squad.find((p) => p.id === entre.id);
  t('le remplacé et l’entrant ont tous deux joué : match compté, XP gagnée', pS.carriere.m === 1 && pE.carriere.m === 1 && avant(sort.id) > xpS && avant(entre.id) > xpE);
  t('   le remplacé est fatigué comme un joueur qui a joué', pS.fit < 100, pS.fit + ' %');
  t('   et le résultat garde la trace des décisions', (r3.decisions || []).some((x) => /remplace/.test(x.texte)));

  const k4 = neuf();
  t('cinq changements, pas un de plus', !k4.remplacementInfo({ xi: [{ slot: 'MIL0', name: 'X' }], banc: [{ id: 1 }], faits: 5 }, 'MIL0', 1).can);
  const exclu = k4.remplacementInfo({ xi: [{ slot: 'MIL0', name: 'X', red: true }], banc: [{ id: 1 }], faits: 0 }, 'MIL0', 1);
  t('un joueur expulsé ne se remplace pas : l’équipe reste à dix', !exclu.can, exclu.why);
  const rare5 = k4.state.squad.find((p) => p.gift);
  const desc = k4.joueurMoteur(k4.entrant({ line: rare5.pos, slot: rare5.pos + '0' }, rare5));
  t('le remplaçant entre avec ses compétences, sa forme et son moral', desc.skills.length === k4.skillsOf(rare5).length && desc.skills.length > 0
    && desc.form != null && desc.morale != null, desc.skills.map((x) => x.name).join(', '));

  const k6 = neuf(); k6.setState({ inv: { energie: 1 } });
  const d6 = k6.matchEnDirect(ADV, { seed: 502 }); jusqua(d6, 70);
  const e6a = d6.etat().xi.map((p) => p.energy), c6 = d6.carte('energie'), e6b = d6.etat().xi.map((p) => p.energy);
  t('une carte de match se joue, et elle se consomme', c6.ok && !(k6.state.inv.energie > 0));
  t('   Boost énergie : +15 % lus dans le moteur', e6b.every((e, i) => e >= Math.min(100, e6a[i] + 15) - 0.01), Math.round(e6a[0]) + ' → ' + Math.round(e6b[0]));
  t('   sans carte en réserve, refusée', !d6.carte('energie').ok);
  let second = '';
  try { k6.playMatch(ADV, { seed: 1 }); } catch (x) { second = x.message; }
  t('un second match pendant le direct est refusé : la journée ne compte pas deux fois', /déjà en cours/.test(second), second);
  jusqua(d6, 99); d6.terminer();
  t('le match fini, le club est libre', !k6.enDirect);

  const k7 = neuf(), xi7 = k7.pickXI(k7.state.formation), sort7 = xi7[9], ent7 = k7.benchOf(xi7)[0];
  const J = k7.joueursDuMatch(xi7.map((p, i) => (i === 9 ? k7.entrant(p, ent7) : p)), null, [Object.assign({}, sort7, { min: 55, note: 7.2 })], { [ent7.id]: 55 });
  t('un but marqué avant de sortir reste au buteur', k7.buteursDuMatch([{ k: 'G', s: 'H', text: "30' BUT ! " + sort7.name + ' du gauche' }], J.xi).scorers.includes(sort7.id));
  t('   chacun a ses minutes : 55 pour le remplacé, 35 pour l’entrant', J.xi.find((p) => p.id === sort7.id).min === 55 && J.xi.find((p) => p.id === ent7.id).min === 35);

  let nul = null;
  for (let g = 600; g < 700 && !nul; g++) { const r = neuf().playMatch(ADV, { seed: g, friendly: true }); if (r.score[0] === r.score[1]) nul = r; }
  t('§51 un amical nul se départage aux tirs au but, dans l’app comme dans l’écran Mon Club',
    !!nul && !!nul.pso && nul.res !== 'd' && nul.reward === (nul.res === 'w' ? 60 : 10), nul && nul.score.join('-') + ', tirs au but ' + nul.pso.H + '-' + nul.pso.A);
}

// ---------------------------------------------------------------- sauvegarde
tete('Sauvegarde : la même partie au rechargement');
{
  const data = JSON.parse(JSON.stringify(serialize(c)));
  const r = new Club(deserialize(data));
  const empreinte = (x) => JSON.stringify({ bal: x.state.balance, sq: x.state.squad.map((p) => [p.id, p.ovr, p.plv, p.pxp]),
    sk: (x.state.skillInv || []).map((s2) => [s2.uid, s2.on]), inv: x.state.inv, co: x.state.coachInv, led: (x.state.ledger || []).length,
    mk: x.marketList().map((m) => m.id), lg: JSON.stringify(x.divisionCourante()) });
  t('effectif, compétences équipées, objets, solde, journal, marché et division identiques', empreinte(r) === empreinte(c));
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
