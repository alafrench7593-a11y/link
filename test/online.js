// §26, §29 : le scénario multijoueur complet, de bout en bout.
// On monte le serveur en mémoire, on crée quatre clubs, et on vérifie que :
//   - un match classé est joué PAR LE SERVEUR et rejouable à l'identique chez le client
//   - un client qui annonce un faux score est démenti
//   - les ligues entre amis, les défis et le classement fonctionnent
//   - les plafonds et l'anti-farming refusent clairement, et disent pourquoi
//   - aucune récompense en argent réel ne peut être activée
import { Club } from '../src/club.js';
import { teamSnapshot, playVersus, verifyResult } from '../src/versus.js';
import { onlineRoutes, SERVER_CAPS, LIMITS } from '../server/online-routes.js';

let fails = 0;
const ok = (cond, label, detail) => {
  console.log((cond ? '  ok   ' : '  ÉCHEC') + ' ' + label + (detail ? '  (' + detail + ')' : ''));
  if (!cond) fails++;
};

// Un stockage en mémoire : le même contrat que FileStorage ou SqlStorage.
const mem = new Map();
const storage = {
  async get(k) { return mem.has(k) ? JSON.parse(mem.get(k)) : null; },
  async put(k, v) { mem.set(k, JSON.stringify(v)); },
  async del(k) { mem.delete(k); }
};

// Une graine fixe pour que le test soit reproductible.
let seedState = 20260101;
const rnd = () => { seedState = (seedState * 1103515245 + 12345) & 0x7fffffff; return seedState / 0x7fffffff; };

const handler = onlineRoutes({ storage, rnd, auth: async (req) => req.headers['x-club-id'] });

// Un appel HTTP simulé : pas de serveur à lancer, le routeur est une simple fonction.
function call(uid, method, path, body) {
  return new Promise((resolve) => {
    const res = {
      status(c) { this._c = c; return this; },
      json(b) { resolve({ status: this._c || 200, body: b }); return this; },
      end() { resolve({ status: this._c || 200, body: null }); return this; }
    };
    handler({ method, path, url: path, body, headers: { 'x-club-id': uid } }, res, () => resolve({ status: 404, body: { error: 'route inconnue' } }));
  });
}

// Quatre clubs, chacun avec son effectif.
const clubs = {};
['alice', 'bob', 'chloe', 'driss'].forEach((id, i) => {
  const c = new Club();
  c.createClub({ name: 'FC ' + id[0].toUpperCase() + id.slice(1), seed: 100 + i * 37 });
  clubs[id] = c;
});

(async () => {
  console.log('publication des équipes');
  for (const id of Object.keys(clubs)) {
    const r = await call(id, 'PUT', '/team', teamSnapshot(clubs[id]));
    if (id === 'alice') ok(r.status === 204, 'une équipe se publie');
  }
  const bad = await call('alice', 'PUT', '/team', { xi: [] });
  ok(bad.status === 400, 'une équipe incomplète est refusée', bad.body && bad.body.error);

  console.log('\n§26 match classé contre un vrai joueur');
  const v = await call('alice', 'POST', '/versus/bob');
  ok(v.status === 200, 'le match est joué par le serveur', v.body && (v.body.score || []).join('-'));
  ok(v.body.replay && typeof v.body.replay.seed === 'number', 'le serveur rend une graine, pas un film de match');
  // le client rejoue la même rencontre chez lui
  const ta = await storage.get('team_alice'), tb = await storage.get('team_bob');
  const local = playVersus(ta, tb, v.body.replay.seed);
  ok(local.score[0] === v.body.score[0] && local.score[1] === v.body.score[1],
    '§26 : le client rejoue exactement le même match', 'serveur ' + v.body.score.join('-') + ' · client ' + local.score.join('-'));
  ok(local.log.length > 10, 'avec le même rapport minute par minute', local.log.length + ' événements');
  ok(typeof v.body.elo === 'number' && v.body.delta !== 0, 'le classement bouge', 'Elo ' + v.body.elo + ' (' + (v.body.delta > 0 ? '+' : '') + v.body.delta + ')');
  ok(v.body.tokens && v.body.tokens.given > 0, 'les jetons sont versés par le serveur', '+' + v.body.tokens.given);

  console.log('\n§29 un faux score est démenti');
  const faux = await call('alice', 'POST', '/verify', { away: 'bob', seed: v.body.replay.seed, score: [9, 0] });
  ok(faux.status === 409 && faux.body.ok === false, 'le serveur refuse un score annoncé faux',
    'annoncé 9-0, réel ' + faux.body.real.join('-'));
  const vrai = await call('alice', 'POST', '/verify', { away: 'bob', seed: v.body.replay.seed, score: v.body.score });
  ok(vrai.status === 200 && vrai.body.ok === true, 'et accepte le vrai score');
  ok(verifyResult(ta, tb, v.body.replay.seed, [9, 0]).ok === false, 'la même vérification marche hors serveur');

  console.log('\n§29 anti-farming');
  const trop = await call('alice', 'POST', '/versus/chloe');
  ok(trop.status === 429, 'deux matchs coup sur coup sont refusés', trop.body && trop.body.error);
  // on avance l'horloge du serveur en remettant la dernière minute à zéro
  const caps = await storage.get('caps_alice'); caps.lastMatch = 0; await storage.put('caps_alice', caps);
  const ok2 = await call('alice', 'POST', '/versus/chloe');
  ok(ok2.status === 200, 'après le délai, le match passe');
  const soi = await call('alice', 'POST', '/versus/alice');
  ok(soi.status === 400, 'on ne joue pas contre soi-même');
  const c2b = await storage.get('caps_alice'); c2b.lastMatch = 0; await storage.put('caps_alice', c2b);
  const absent = await call('alice', 'POST', '/versus/personne');
  ok(absent.status === 404, 'on ne joue pas contre un club qui n’existe pas', absent.body && absent.body.error);

  console.log('\n§29 plafond quotidien, côté serveur');
  const c3 = await storage.get('caps_alice');
  c3.versus = SERVER_CAPS.versus - 10; c3.lastMatch = 0;
  await storage.put('caps_alice', c3);
  const presque = await call('alice', 'POST', '/versus/driss');
  ok(presque.body.tokens.given <= 10, 'le gain est rogné au plafond, pas refusé en silence',
    'demandé ' + presque.body.tokens.asked + ', versé ' + presque.body.tokens.given);
  ok(presque.body.tokens.capped !== null, 'et le serveur dit que le plafond a joué');
  const w = await call('alice', 'GET', '/wallet');
  ok(w.body.left && typeof w.body.left.total === 'number', 'le portefeuille dit ce qu’il reste pour la journée',
    w.body.left.total + ' jetons sur ' + SERVER_CAPS.total);
  ok(w.body.ledger.length > 0, 'chaque mouvement laisse une ligne', w.body.ledger.length + ' lignes');

  console.log('\n§29 le pack est tiré par le serveur');
  const sansSous = await call('chloe', 'POST', '/pack', {});
  ok(sansSous.status === 402, 'sans jetons reconnus par le serveur, pas de pack', sansSous.body && sansSous.body.error);
  const pk = await call('alice', 'POST', '/pack', { free: true });
  ok(pk.status === 200 && pk.body.got.length === 3, 'le serveur rend le contenu du pack', pk.body.got.map((g) => g.kind).join(', '));
  ok(pk.body.odds && Math.abs(pk.body.odds.reduce((a2, x) => a2 + x.pct, 0) - 100) < 1e-6, 'avec les probabilités qu’il a appliquées');
  ok(pk.body.got.every((g) => ['player', 'skill', 'shards'].indexOf(g.kind) >= 0), 'chaque lot est un joueur, une compétence ou des fragments');
  const capsP = await storage.get('caps_alice'); capsP.packs = LIMITS.packsPerDay; await storage.put('caps_alice', capsP);
  const tropPk = await call('alice', 'POST', '/pack', { free: true });
  ok(tropPk.status === 429, '§29 : le nombre de packs par jour est plafonné côté serveur', tropPk.body && tropPk.body.error);

  console.log('\n§26 ligue entre amis');
  const lg = await call('alice', 'POST', '/leagues', { name: 'Ligue du bureau', rounds: 1 });
  ok(lg.status === 200 && lg.body.code && lg.body.code.length === 6, 'une ligue se crée avec un code à partager', lg.body.code);
  for (const id of ['bob', 'chloe', 'driss']) await call(id, 'POST', '/leagues/join', { code: lg.body.code });
  const after = await call('alice', 'GET', '/leagues/' + lg.body.id);
  ok(after.body.members.length === 4, 'les amis rejoignent avec le code', after.body.members.length + ' clubs');
  const faux2 = await call('bob', 'POST', '/leagues/join', { code: 'ZZZZZZ' });
  ok(faux2.status === 404, 'un code inconnu est refusé');
  const pasOwner = await call('bob', 'POST', '/leagues/' + lg.body.id + '/start');
  ok(pasOwner.status === 403, 'seul le créateur lance la ligue');
  const start = await call('alice', 'POST', '/leagues/' + lg.body.id + '/start');
  ok(start.status === 200 && start.body.calendar.length === 3, 'le calendrier est tiré', start.body.calendar.length + ' journées');
  const tard = await call('bob', 'POST', '/leagues/join', { code: lg.body.code });
  ok(tard.status === 409, 'on ne rejoint plus une ligue commencée');
  let table = null;
  for (let d = 0; d < 3; d++) { const r = await call('alice', 'POST', '/leagues/' + lg.body.id + '/play'); table = r.body.table; }
  ok(table && table.length === 4, 'les journées se jouent et le classement se tient');
  ok(table[0].pts >= table[3].pts, 'le classement est trié', table.map((r) => r.name + ' ' + r.pts).join(' · '));
  const fini = await call('alice', 'POST', '/leagues/' + lg.body.id + '/play');
  ok(fini.status === 409, 'la saison finie, on ne rejoue pas');

  console.log('\n§26 défi entre amis');
  const ch = await call('alice', 'POST', '/challenges', { to: 'bob', msg: 'on se le fait ?' });
  ok(ch.status === 200, 'un défi part');
  const inbox = await call('bob', 'GET', '/challenges');
  ok(inbox.body.challenges.length >= 1, 'il arrive chez le destinataire');
  const pasMoi = await call('chloe', 'POST', '/challenges/' + ch.body.id + '/accept');
  ok(pasMoi.status === 403, 'un tiers ne peut pas accepter le défi d’un autre');
  const acc = await call('bob', 'POST', '/challenges/' + ch.body.id + '/accept');
  ok(acc.status === 200 && acc.body.score, 'le défi se joue', acc.body.score.join('-'));
  const deuxFois = await call('bob', 'POST', '/challenges/' + ch.body.id + '/accept');
  ok(deuxFois.status === 409, 'un défi ne se joue pas deux fois');

  console.log('\n§25, §26 marché des transferts en ligne');
  const joueur = { id: 777, name: 'R. Esperanza', pos: 'MIL', ovr: 74, plv: 9, rar: 'rare' };
  const ann = await call('bob', 'POST', '/market/list', { player: joueur, price: 1200 });
  ok(ann.status === 200 && ann.body.id, 'un joueur se met en vente', ann.body.sellerName + ' · ' + ann.body.price + ' jetons');
  const horsLimites = await call('bob', 'POST', '/market/list', { player: joueur, price: 1 });
  ok(horsLimites.status === 400, 'un prix hors limites est refusé', horsLimites.body.error);
  const liste = await call('alice', 'GET', '/market');
  ok(liste.body.items.length >= 1, 'il apparaît dans la liste');
  const soiMarche = await call('bob', 'POST', '/market/' + ann.body.id + '/buy');
  ok(soiMarche.status === 400, 'on n’achète pas son propre joueur');
  const pauvre = await call('chloe', 'POST', '/market/' + ann.body.id + '/buy');
  ok(pauvre.status === 402, 'sans jetons reconnus par le serveur, pas d’achat', pauvre.body.error);
  const avantVendeur = (await storage.get('u_bob')) || { balance: 0 };
  // alice a gagné des jetons en match classé : le serveur lui en reconnaît
  const uA = (await storage.get('u_alice')) || { balance: 0 };
  await storage.put('u_alice', Object.assign(uA, { balance: Math.max(uA.balance, 2000) }));
  const achat = await call('alice', 'POST', '/market/' + ann.body.id + '/buy');
  ok(achat.status === 200, 'un club qui a les jetons l’achète',
    achat.status === 200 ? achat.body.player.name + ' pour ' + achat.body.price : achat.body.error);
  const apresVendeur = await storage.get('u_bob');
  ok(apresVendeur.balance > (avantVendeur.balance || 0), 'le vendeur est payé par le serveur',
    (avantVendeur.balance || 0) + ' → ' + apresVendeur.balance);
  const encore = await call('alice', 'POST', '/market/' + ann.body.id + '/buy');
  ok(encore.status === 404, 'un joueur vendu ne se vend pas deux fois');
  const feed2 = await call('alice', 'GET', '/feed');
  ok((feed2.body.transfers || []).length >= 1, '§26 : le journal reprend le transfert',
    (feed2.body.transfers[0] || {}).player + ' → ' + (feed2.body.transfers[0] || {}).to);

  console.log('\n§26 le journal');
  ok((feed2.body.matches || []).length >= 1, 'le fil contient les matchs joués', feed2.body.matches.length + ' matchs');
  ok((feed2.body.players || []).length >= 1, 'et les meilleures notes', feed2.body.players.length + ' joueurs');
  ok((feed2.body.ladder || []).every((r) => r.name), 'le classement parle de clubs, pas d’identifiants',
    (feed2.body.ladder[0] || {}).name);
  const Club2 = (await import('../src/club.js')).Club;
  const red = new Club2();
  const arts = red.buildNews(feed2.body);
  ok(arts.length > 0, 'le journal produit des articles', arts.length + ' articles');
  ok(arts.some((a2) => a2.section === 'une'), 'avec une une');
  ok(arts.every((a2) => a2.title && a2.ago), 'chacun a un titre et une date');

  console.log('\n§26 classement général');
  const lad = await call('alice', 'GET', '/ladder');
  ok(lad.body.rows.length >= 2, 'le classement liste les clubs', lad.body.rows.length + ' clubs');
  ok(lad.body.rows[0].rank === 1 && lad.body.rows[0].elo >= lad.body.rows[1].elo, 'il est trié par Elo',
    lad.body.rows.slice(0, 3).map((r) => r.id + ' ' + r.elo).join(' · '));

  console.log('\n§73 à §76 tournoi entre vrais clubs');
  const ids = ['alice', 'bob', 'chloe', 'driss'];
  const huit = ids.concat(ids.map((x) => x));   // 8 participants, les mêmes équipes deux fois
  for (let i = 4; i < 8; i++) {
    const c = new Club(); c.createClub({ name: 'FC Invité ' + i, seed: 900 + i });
    huit[i] = 'invite' + i;
    await call(huit[i], 'PUT', '/team', teamSnapshot(c));
  }
  const tr = await call('alice', 'POST', '/tournaments', { size: 8, entrants: huit, name: 'Coupe LinkFoot' });
  ok(tr.status === 200 && tr.body.rounds[0].ties.length === 4, 'le tournoi est créé avec de vrais clubs');
  const payant = await call('alice', 'POST', '/tournaments', { size: 8, entrants: huit, payouts: { enabled: true } });
  ok(payant.status === 409, '§76 : le serveur refuse d’activer les récompenses en argent réel', payant.body.error.slice(0, 48) + '…');
  let done = false, rounds = 0;
  while (!done && rounds++ < 6) { const r = await call('alice', 'POST', '/tournaments/' + tr.body.id + '/play'); done = r.body.done; if (done) { ok(r.body.ranking[0].team.id, 'le tournoi se joue jusqu’au bout', 'vainqueur : ' + r.body.ranking[0].team.name); ok(r.body.rewards.cash.paid === false, 'et ne verse aucun argent réel', r.body.rewards.cash.reason.slice(0, 40) + '…'); } }
  ok(done, 'toutes les rencontres se sont jouées', rounds + ' tours');

  console.log('\nauthentification');
  const anon = await new Promise((resolve) => {
    const res = { status(c) { this._c = c; return this; }, json(b) { resolve({ status: this._c, body: b }); return this; }, end() { resolve({ status: this._c }); return this; } };
    handler({ method: 'GET', path: '/ladder', url: '/ladder', headers: {} }, res, () => resolve({ status: 404 }));
  });
  ok(anon.status === 401, 'sans identité, le serveur refuse');

  console.log(fails ? '\nÉCHEC : ' + fails + ' vérification(s)' : '\nOK : le multijoueur tient, et le serveur fait autorité');
  process.exit(fails ? 1 : 0);
})();
