// LinkFoot : le serveur multijoueur (§26, §29, §73 à §76).
//
// Trois idées tiennent tout ce fichier.
//
// 1. LE MOTEUR EST DÉTERMINISTE. Le serveur ne stocke pas un film de match, seulement
//    (club A, club B, graine). Il rejoue la rencontre pour en connaître le score, et
//    les deux joueurs la rejouent chez eux à l'identique. Un client qui annonce
//    « j'ai gagné 9-0 » est démenti par le serveur en une ligne (§29).
//
// 2. L'ARGENT ET LES PACKS SONT CALCULÉS ICI. Les probabilités ne sont jamais lues
//    depuis le client, les plafonds quotidiens sont comptés ici, et chaque mouvement
//    laisse une ligne. Un client modifié ne peut ni changer un taux, ni dépasser un
//    plafond, ni se payer deux fois la même récompense (§29).
//
// 3. RIEN NE DÉCLENCHE DE PAIEMENT. Les récompenses en argent réel restent désactivées
//    tant que le cadre juridique n'est pas validé : une demande d'activation est refusée
//    par le serveur, pas seulement masquée dans l'écran (§76).
import { Club } from '../src/club.js';
import { playVersus, verifyResult, verifierEquipe } from '../src/versus.js';
import { applyResult, standings, schedule } from '../src/league.js';
import { createTournament, pendingMatches, reportResult, finalRanking, rewards, PAYOUTS } from '../src/tournament.js';

const now = () => Date.now();
const dayKey = (t) => { const d = new Date(t || now()); return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate(); };
const code6 = (rnd) => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let o = ''; for (let i = 0; i < 6; i++) o += A[Math.floor((rnd || Math.random)() * A.length)]; return o; };

// Les plafonds du serveur. Ce sont EUX qui font foi : ceux du client ne servent
// qu'à afficher l'état, ils ne protègent rien.
export const SERVER_CAPS = { quest: 900, prono: 400, mission: 600, versus: 1200, tournoi: 1500, total: 3600 };

// Anti-farming (§29) : au delà, on refuse, on ne ralentit pas en silence.
export const LIMITS = {
  versusPerDay: 40,          // matchs classés par jour
  packsPerDay: 30,           // ouvertures de pack par jour
  minSecondsBetweenMatches: 20,   // un match dure ~90 minutes de jeu : plus vite, c'est un robot
  leaguesPerUser: 6,
  challengesPending: 10
};

// ---------- stockage ----------
// Le même contrat que FileStorage/SqlStorage : get(id), put(id, valeur), del(id).
// Tout ce qui suit est rangé sous des clés préfixées, donc une seule table suffit.
const K = {
  user: (id) => 'u_' + id,
  team: (id) => 'team_' + id,
  league: (id) => 'lg_' + id,
  leagueByCode: (c) => 'lgc_' + c,
  challenge: (id) => 'ch_' + id,
  inbox: (id) => 'inbox_' + id,
  ladder: () => 'ladder',
  tournament: (id) => 'tr_' + id,
  caps: (id) => 'caps_' + id,
  ledger: (id) => 'led_' + id,
  feed: () => 'feed',
  market: () => 'market'
};

async function getOr(storage, key, fallback) {
  const v = await storage.get(key);
  return v == null ? fallback : v;
}

// ---------- économie, côté serveur ----------
async function loadCaps(storage, uid) {
  const c = await getOr(storage, K.caps(uid), {});
  if (c.day !== dayKey()) return { day: dayKey() };
  return c;
}

async function earn(storage, uid, amount, source, label) {
  const caps = await loadCaps(storage, uid);
  let give = Math.max(0, Math.round(amount));
  const capped = [];
  const lim = SERVER_CAPS[source];
  if (lim != null) {
    const used = caps[source] || 0;
    if (used + give > lim) { give = Math.max(0, lim - used); capped.push(source); }
    caps[source] = (caps[source] || 0) + give;
  }
  const usedT = caps.total || 0;
  if (usedT + give > SERVER_CAPS.total) { give = Math.max(0, SERVER_CAPS.total - usedT); capped.push('total'); }
  caps.total = usedT + give;
  await storage.put(K.caps(uid), caps);
  const led = await getOr(storage, K.ledger(uid), []);
  led.unshift({ at: now(), a: give, l: label || source, src: source });
  await storage.put(K.ledger(uid), led.slice(0, 200));
  // le solde que le serveur reconnaît : c'est lui qui paie les packs en ligne
  const u = await getOr(storage, K.user(uid), { balance: 0, collected: [] });
  u.balance += give;
  await storage.put(K.user(uid), u);
  return { given: give, asked: Math.round(amount), capped: capped.length ? capped : null };
}

async function bump(storage, uid, key, n) {
  const caps = await loadCaps(storage, uid);
  caps[key] = (caps[key] || 0) + (n || 1);
  await storage.put(K.caps(uid), caps);
  return caps[key];
}

// ---------- le classement général (§26) ----------
// Elo simplifié : une victoire contre plus fort rapporte davantage. Le classement
// est la seule donnée que tout le monde lit, donc il est tenu dans une seule clé.
const eloDelta = (ra, rb, score) => Math.round(28 * (score - 1 / (1 + Math.pow(10, (rb - ra) / 400))));

async function updateLadder(storage, a, b, res) {
  const L = await getOr(storage, K.ladder(), { rows: {} });
  const ra = L.rows[a] || { id: a, elo: 1000, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
  const rb = L.rows[b] || { id: b, elo: 1000, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
  const sa = res.res === 'h' ? 1 : res.res === 'd' ? 0.5 : 0;
  const da = eloDelta(ra.elo, rb.elo, sa), db = eloDelta(rb.elo, ra.elo, 1 - sa);
  ra.elo += da; rb.elo += db;
  ra.p++; rb.p++;
  ra.gf += res.score[0]; ra.ga += res.score[1]; rb.gf += res.score[1]; rb.ga += res.score[0];
  if (sa === 1) { ra.w++; rb.l++; } else if (sa === 0) { ra.l++; rb.w++; } else { ra.d++; rb.d++; }
  L.rows[a] = ra; L.rows[b] = rb;
  await storage.put(K.ladder(), L);
  return { a: ra, b: rb, da, db };
}

// §26 : alimenter le journal. On y range le score, les meilleures notes du match et
// les mouvements au classement. Vingt lignes gardées de chaque, pas plus : le journal
// raconte la semaine, pas l'histoire du jeu.
async function pushFeed(storage, home, away, res, comp) {
  const F = await getOr(storage, K.feed(), { matches: [], players: [], transfers: [], movers: [] });
  F.matches.unshift({ at: now(), home: home.club, away: away.club, score: res.score, comp });
  // l'homme du match de chaque côté, s'il y a des notes
  ['H', 'A'].forEach((sd) => {
    const r = res.rat && res.rat[sd];
    if (!r || !r.length) return;
    let bi = 0; r.forEach((v, i) => { if (v > r[bi]) bi = i; });
    const team = sd === 'H' ? home : away;
    const p = team.xi && team.xi[bi];
    if (!p) return;
    const goals = (res.log || []).filter((l) => l.k === 'G' && l.s === sd && l.text.indexOf(p.name) >= 0).length;
    F.players.unshift({ at: now(), name: p.name, club: team.club, rating: r[bi], goals });
  });
  await storage.put(K.feed(), {
    matches: F.matches.slice(0, 40), players: F.players.slice(0, 40),
    transfers: (F.transfers || []).slice(0, 60), movers: (F.movers || []).slice(0, 20),
    tournaments: F.tournaments || []
  });
}

// ---------- le routeur ----------
// Monté tel quel dans un Express : app.use('/online', onlineRoutes({ storage, auth }));
// `auth(req)` doit rendre l'identifiant du joueur, ou null. Le serveur ne gère ni mot
// de passe ni jeton : cette partie appartient à ton application.
export function onlineRoutes(opts) {
  const o = opts || {};
  const storage = o.storage;
  if (!storage) throw new Error('onlineRoutes : storage manquant');
  const auth = o.auth || (async (req) => (req.headers && req.headers['x-club-id']) || null);
  const rnd = o.rnd || Math.random;

  const routes = {

    // Publie son équipe pour que les autres puissent jouer contre elle, même hors ligne.
    'PUT /team': async (uid, body) => {
      // On refuse à la porte, avec la raison. Avant, une équipe sans tactique passait
      // ici et faisait tomber le match en 500 : le serveur était donc à la merci du
      // premier client incomplet ou bricolé (§29).
      const faute = verifierEquipe(body);
      if (faute) return [400, { error: 'équipe invalide : ' + faute }];
      await storage.put(K.team(uid), Object.assign({}, body, { uid, at: now() }));
      return [204, null];
    },
    'GET /team/:id': async (uid, body, p) => {
      const t = await storage.get(K.team(p.id));
      return t ? [200, t] : [404, { error: 'équipe introuvable' }];
    },

    // §26 un match classé contre un vrai joueur. Le serveur choisit la graine,
    // rejoue la rencontre et met le classement à jour. Le client ne fait que l'afficher.
    'POST /versus/:id': async (uid, body, p) => {
      if (p.id === uid) return [400, { error: 'on ne joue pas contre soi-même' }];
      const caps = await loadCaps(storage, uid);
      if ((caps.versusCount || 0) >= LIMITS.versusPerDay) return [429, { error: 'limite de ' + LIMITS.versusPerDay + ' matchs classés par jour atteinte' }];
      if (caps.lastMatch && now() - caps.lastMatch < LIMITS.minSecondsBetweenMatches * 1000) {
        return [429, { error: 'trop rapide : attends ' + Math.ceil((LIMITS.minSecondsBetweenMatches * 1000 - (now() - caps.lastMatch)) / 1000) + ' s' }];
      }
      const me = await storage.get(K.team(uid)), them = await storage.get(K.team(p.id));
      if (!me) return [409, { error: 'publie d’abord ton équipe' }];
      if (!them) return [404, { error: 'ce joueur n’a pas publié d’équipe' }];
      const seed = Math.floor(rnd() * 1e9);
      const res = playVersus(me, them, seed);
      const lad = await updateLadder(storage, uid, p.id, res);
      const gain = res.res === 'h' ? 140 : res.res === 'd' ? 60 : 25;
      const got = await earn(storage, uid, gain, 'versus', 'Match classé contre ' + them.club);
      const c2 = await loadCaps(storage, uid);
      c2.versusCount = (c2.versusCount || 0) + 1; c2.lastMatch = now();
      await storage.put(K.caps(uid), c2);
      await pushFeed(storage, me, them, res, 'Match classé');
      // le replay tient en trois nombres : les deux joueurs le rejouent à l'identique
      return [200, { replay: { home: uid, away: p.id, seed }, score: res.score, res: res.res, elo: lad.a.elo, delta: lad.da, tokens: got }];
    },

    // §29 : un client peut proposer son résultat, le serveur le vérifie avant de l'accepter.
    'POST /verify': async (uid, body) => {
      if (!body || !body.seed || !body.away || !Array.isArray(body.score)) return [400, { error: 'requête invalide' }];
      const me = await storage.get(K.team(uid)), them = await storage.get(K.team(body.away));
      if (!me || !them) return [404, { error: 'équipe introuvable' }];
      const v = verifyResult(me, them, body.seed, body.score);
      return [v.ok ? 200 : 409, v];
    },

    'GET /ladder': async () => {
      const L = await getOr(storage, K.ladder(), { rows: {} });
      const rows = Object.values(L.rows).sort((a, b) => b.elo - a.elo).slice(0, 100)
        .map((r, i) => Object.assign({ rank: i + 1 }, r));
      return [200, { rows }];
    },

    // §26 les ligues entre amis. On en crée une, on partage le code, les autres rejoignent.
    'POST /leagues': async (uid, body) => {
      const mine = await getOr(storage, K.inbox(uid), { leagues: [], challenges: [] });
      if ((mine.leagues || []).length >= LIMITS.leaguesPerUser) return [429, { error: 'maximum ' + LIMITS.leaguesPerUser + ' ligues par joueur' }];
      const id = 'lg' + Math.floor(rnd() * 1e9).toString(36);
      const code = code6(rnd);
      const lg = { id, code, name: (body && body.name) || 'Ligue entre amis', owner: uid, members: [uid], rows: [], played: [], rounds: (body && body.rounds) || 2, created: now(), closed: false };
      await storage.put(K.league(id), lg);
      await storage.put(K.leagueByCode(code), id);
      mine.leagues = (mine.leagues || []).concat([id]);
      await storage.put(K.inbox(uid), mine);
      return [200, lg];
    },

    'POST /leagues/join': async (uid, body) => {
      const code = String((body && body.code) || '').toUpperCase();
      const id = await storage.get(K.leagueByCode(code));
      if (!id) return [404, { error: 'code inconnu' }];
      const lg = await storage.get(K.league(id));
      if (!lg) return [404, { error: 'ligue introuvable' }];
      if (lg.closed) return [409, { error: 'cette ligue a commencé' }];
      if (lg.members.indexOf(uid) >= 0) return [200, lg];
      if (lg.members.length >= 20) return [409, { error: 'ligue complète (20 clubs)' }];
      lg.members.push(uid);
      await storage.put(K.league(id), lg);
      const mine = await getOr(storage, K.inbox(uid), { leagues: [], challenges: [] });
      mine.leagues = (mine.leagues || []).concat([id]);
      await storage.put(K.inbox(uid), mine);
      return [200, lg];
    },

    // Lance le calendrier : à partir de là, plus personne n'entre.
    'POST /leagues/:id/start': async (uid, body, p) => {
      const lg = await storage.get(K.league(p.id));
      if (!lg) return [404, { error: 'ligue introuvable' }];
      if (lg.owner !== uid) return [403, { error: 'seul le créateur lance la ligue' }];
      if (lg.members.length < 3) return [409, { error: 'il faut au moins 3 clubs' }];
      lg.closed = true;
      lg.calendar = schedule(lg.members, lg.rounds);
      await storage.put(K.league(p.id), lg);
      return [200, lg];
    },

    // Joue une journée de ligue : le serveur rejoue chaque rencontre et tient le classement.
    'POST /leagues/:id/play': async (uid, body, p) => {
      const lg = await storage.get(K.league(p.id));
      if (!lg) return [404, { error: 'ligue introuvable' }];
      if (!lg.closed) return [409, { error: 'la ligue n’a pas commencé' }];
      const day = (lg.calendar || [])[lg.played.length];
      if (!day) return [409, { error: 'saison terminée' }];
      const teams = {};
      for (const m of lg.members) teams[m] = await storage.get(K.team(m));
      const missing = lg.members.filter((m) => !teams[m]);
      if (missing.length) return [409, { error: missing.length + ' club(s) n’ont pas publié leur équipe' }];
      const results = [];
      for (const fx of day) {
        const seed = Math.floor(rnd() * 1e9);
        const r = playVersus(teams[fx.home], teams[fx.away], seed);
        applyResult(lg.rows, fx.home, fx.away, r.score[0], r.score[1]);
        results.push({ home: fx.home, away: fx.away, seed, score: r.score });
      }
      lg.played.push(results);
      lg.rows.forEach((row) => { const t = teams[row.id]; if (t) row.name = t.club; });
      await storage.put(K.league(p.id), lg);
      return [200, { day: lg.played.length, results, table: standings(lg.rows) }];
    },

    'GET /leagues/:id': async (uid, body, p) => {
      const lg = await storage.get(K.league(p.id));
      return lg ? [200, Object.assign({}, lg, { table: standings(lg.rows) })] : [404, { error: 'ligue introuvable' }];
    },

    'GET /leagues': async (uid) => {
      const mine = await getOr(storage, K.inbox(uid), { leagues: [] });
      const out = [];
      for (const id of mine.leagues || []) { const lg = await storage.get(K.league(id)); if (lg) out.push({ id: lg.id, name: lg.name, code: lg.code, members: lg.members.length, closed: lg.closed, days: lg.played.length }); }
      return [200, { leagues: out }];
    },

    // §26 les défis entre amis : un match amical, sans effet sur le classement.
    'POST /challenges': async (uid, body) => {
      const to = body && body.to;
      if (!to || to === uid) return [400, { error: 'destinataire invalide' }];
      const inbox = await getOr(storage, K.inbox(to), { leagues: [], challenges: [] });
      if ((inbox.challenges || []).length >= LIMITS.challengesPending) return [429, { error: 'ce joueur a trop de défis en attente' }];
      const id = 'ch' + Math.floor(rnd() * 1e9).toString(36);
      const ch = { id, from: uid, to, msg: String((body && body.msg) || '').slice(0, 120), at: now(), state: 'pending' };
      await storage.put(K.challenge(id), ch);
      inbox.challenges = (inbox.challenges || []).concat([id]);
      await storage.put(K.inbox(to), inbox);
      return [200, ch];
    },

    'GET /challenges': async (uid) => {
      const inbox = await getOr(storage, K.inbox(uid), { challenges: [] });
      const out = [];
      for (const id of inbox.challenges || []) { const ch = await storage.get(K.challenge(id)); if (ch) out.push(ch); }
      return [200, { challenges: out }];
    },

    'POST /challenges/:id/accept': async (uid, body, p) => {
      const ch = await storage.get(K.challenge(p.id));
      if (!ch) return [404, { error: 'défi introuvable' }];
      if (ch.to !== uid) return [403, { error: 'ce défi ne t’est pas adressé' }];
      if (ch.state !== 'pending') return [409, { error: 'défi déjà réglé' }];
      const a = await storage.get(K.team(ch.from)), b = await storage.get(K.team(ch.to));
      if (!a || !b) return [409, { error: 'les deux clubs doivent avoir publié leur équipe' }];
      const seed = Math.floor(rnd() * 1e9);
      const r = playVersus(a, b, seed);
      ch.state = 'played'; ch.seed = seed; ch.score = r.score; ch.playedAt = now();
      await storage.put(K.challenge(p.id), ch);
      return [200, { replay: { home: ch.from, away: ch.to, seed }, score: r.score, res: r.res }];
    },

    // §73 à §76 les tournois. Les rencontres sont jouées par le serveur entre de vrais clubs.
    'POST /tournaments': async (uid, body) => {
      const size = (body && body.size) || 8;
      const ids = ((body && body.entrants) || []).slice(0, size);
      if (ids.length !== size) return [400, { error: 'il faut exactement ' + size + ' participants' }];
      const entrants = [];
      for (const id of ids) { const t = await storage.get(K.team(id)); if (!t) return [409, { error: 'le club ' + id + ' n’a pas publié d’équipe' }]; entrants.push({ id, name: t.club }); }
      if (body && body.payouts && body.payouts.enabled) return [409, { error: PAYOUTS.reason }];
      const T = createTournament({ size, entrants, format: (body && body.format) || 'knockout', entry: (body && body.entry) || 0, name: (body && body.name) || 'Tournoi LinkFoot', rnd });
      await storage.put(K.tournament(T.id), T);
      return [200, T];
    },

    // Joue toutes les rencontres en attente. Les égalités se départagent aux tirs au but,
    // joués par le même moteur, donc vérifiables eux aussi.
    'POST /tournaments/:id/play': async (uid, body, p) => {
      const T = await storage.get(K.tournament(p.id));
      if (!T) return [404, { error: 'tournoi introuvable' }];
      const pend = pendingMatches(T);
      if (!pend.length) return [409, { error: T.done ? 'tournoi terminé' : 'rien à jouer' }];
      const played = [];
      for (const ref of pend) {
        const a = await storage.get(K.team(ref.home.id)), b = await storage.get(K.team(ref.away.id));
        const seed = Math.floor(rnd() * 1e9);
        // en élimination directe, le moteur joue aussi la séance de tirs au but
        const r = playVersus(a, b, seed, { shootout: T.stage !== 'groups' });
        reportResult(T, ref, r.score[0], r.score[1], r.pso);
        played.push({ home: ref.home.id, away: ref.away.id, seed, score: r.score, pso: r.pso });
      }
      await storage.put(K.tournament(p.id), T);
      const out = { played, done: T.done, stage: T.stage };
      if (T.done) {
        out.ranking = finalRanking(T);
        const rw = rewards(T);
        out.rewards = rw;
        for (const line of rw.tokens) await earn(storage, line.team.id, line.tokens, 'tournoi', 'Tournoi : ' + line.rank + 'e place');
      }
      return [200, out];
    },

    'GET /tournaments/:id': async (uid, body, p) => {
      const T = await storage.get(K.tournament(p.id));
      return T ? [200, T] : [404, { error: 'tournoi introuvable' }];
    },

    // §29 : l'ouverture d'un pack est calculée ICI. Les probabilités ne sont jamais lues
    // depuis le client, et un client modifié ne peut donc ni les changer, ni rejouer
    // un tirage jusqu'à obtenir ce qu'il veut. Le client reçoit le résultat et l'anime.
    'POST /pack': async (uid, body) => {
      const caps = await loadCaps(storage, uid);
      if ((caps.packs || 0) >= LIMITS.packsPerDay) return [429, { error: 'limite de ' + LIMITS.packsPerDay + ' packs par jour atteinte' }];
      const ref = new Club();
      const def = ref.THE_PACK();
      const free = !!(body && body.free);
      // l'état du joueur fait foi côté serveur : on lit son solde et sa collection ici
      const u = await getOr(storage, K.user(uid), { balance: 0, collected: [] });
      if (!free && u.balance < def.cost) return [402, { error: 'il te manque ' + (def.cost - u.balance) + ' jetons' }];
      ref.setState({ balance: u.balance, collected: u.collected || [], squad: [] });
      const res = ref.openPack({ free: true, rnd });
      if (!res.ok) return [409, { error: res.why }];
      if (!free) u.balance -= def.cost;
      u.collected = (u.collected || []).concat(res.got.filter((g) => g.kind === 'player').map((g) => g.id));
      await storage.put(K.user(uid), u);
      await bump(storage, uid, 'packs', 1);
      const led = await getOr(storage, K.ledger(uid), []);
      led.unshift({ at: now(), a: free ? 0 : -def.cost, l: 'Ouverture ' + def.name, src: 'pack' });
      await storage.put(K.ledger(uid), led.slice(0, 200));
      return [200, { got: res.got, shards: res.shards, cost: free ? 0 : def.cost, balance: u.balance, odds: ref.packOdds(def), familles: ref.packFamilies() }];
    },

    // Le solde que le serveur reconnaît à ce joueur. C'est lui qui compte pour tout
    // ce qui se joue en ligne : un solde gonflé côté client ne s'achète rien ici.
    'GET /balance': async (uid) => {
      const u = await getOr(storage, K.user(uid), { balance: 0, collected: [] });
      return [200, { balance: u.balance, collected: (u.collected || []).length }];
    },

    // §26 : le fil du journal. Le serveur garde les derniers résultats, les meilleures
    // notes et les transferts, et le client en fait des articles. Rien n'est inventé :
    // chaque ligne vient d'un match ou d'un transfert qui a réellement eu lieu.
    'GET /feed': async (uid) => {
      const F = await getOr(storage, K.feed(), { matches: [], players: [], transfers: [], movers: [] });
      const L = await getOr(storage, K.ladder(), { rows: {} });
      const rows = Object.values(L.rows).sort((a, b) => b.elo - a.elo).slice(0, 20).map((r, i) => Object.assign({ rank: i + 1 }, r));
      // les noms de club, pour que le journal parle de clubs et pas d'identifiants
      for (const r of rows) { const t = await storage.get(K.team(r.id)); r.name = t ? t.club : r.id; }
      const mine = await getOr(storage, K.inbox(uid), { leagues: [] });
      const leagues = [];
      for (const id of mine.leagues || []) { const lg = await storage.get(K.league(id)); if (lg) leagues.push({ id: lg.id, name: lg.name, code: lg.code, members: lg.members.length, closed: lg.closed, days: lg.played.length, table: standings(lg.rows).slice(0, 6) }); }
      return [200, {
        matches: F.matches.slice(0, 20), players: F.players.slice(0, 20),
        transfers: F.transfers.slice(0, 12), movers: F.movers.slice(0, 10),
        ladder: rows, leagues, tournaments: F.tournaments || []
      }];
    },

    // §25, §26 : le marché des transferts entre vrais clubs. On met un joueur en vente,
    // les autres l'achètent. Le serveur tient la liste et encaisse : un prix changé
    // côté client ne vaut rien ici (§29).
    'POST /market/list': async (uid, body) => {
      if (!body || !body.player || typeof body.price !== 'number') return [400, { error: 'annonce invalide' }];
      const M = await getOr(storage, K.market(), { items: [] });
      const mine = M.items.filter((x) => x.seller === uid);
      if (mine.length >= 5) return [429, { error: 'cinq joueurs en vente au maximum' }];
      if (body.price < 50 || body.price > 200000) return [400, { error: 'prix hors limites (50 à 200 000 jetons)' }];
      const t = await storage.get(K.team(uid));
      const item = {
        id: 'tf' + Math.floor(rnd() * 1e9).toString(36),
        seller: uid, sellerName: t ? t.club : uid,
        player: body.player, price: Math.round(body.price), at: now()
      };
      M.items.unshift(item);
      await storage.put(K.market(), { items: M.items.slice(0, 400) });
      return [200, item];
    },

    'GET /market': async (uid) => {
      const M = await getOr(storage, K.market(), { items: [] });
      return [200, { items: M.items.slice(0, 60), mine: M.items.filter((x) => x.seller === uid) }];
    },

    'POST /market/:id/buy': async (uid, body, p) => {
      const M = await getOr(storage, K.market(), { items: [] });
      const i = M.items.findIndex((x) => x.id === p.id);
      if (i < 0) return [404, { error: 'annonce introuvable ou déjà vendue' }];
      const item = M.items[i];
      if (item.seller === uid) return [400, { error: 'on n’achète pas son propre joueur' }];
      const u = await getOr(storage, K.user(uid), { balance: 0, collected: [] });
      if (u.balance < item.price) return [402, { error: 'il te manque ' + (item.price - u.balance) + ' jetons' }];
      u.balance -= item.price;
      await storage.put(K.user(uid), u);
      await earn(storage, item.seller, item.price, 'vente', 'Vente de ' + item.player.name);
      M.items.splice(i, 1);
      await storage.put(K.market(), { items: M.items });
      const led = await getOr(storage, K.ledger(uid), []);
      led.unshift({ at: now(), a: -item.price, l: 'Achat de ' + item.player.name, src: 'achat' });
      await storage.put(K.ledger(uid), led.slice(0, 200));
      // le journal s'en fait l'écho
      const F = await getOr(storage, K.feed(), { matches: [], players: [], transfers: [], movers: [] });
      const me = await storage.get(K.team(uid));
      F.transfers.unshift({ at: now(), player: item.player.name, from: item.sellerName, to: me ? me.club : uid, price: item.price });
      await storage.put(K.feed(), Object.assign(F, { transfers: F.transfers.slice(0, 60) }));
      return [200, { ok: true, player: item.player, price: item.price, balance: u.balance }];
    },

    'POST /market/:id/cancel': async (uid, body, p) => {
      const M = await getOr(storage, K.market(), { items: [] });
      const i = M.items.findIndex((x) => x.id === p.id);
      if (i < 0) return [404, { error: 'annonce introuvable' }];
      if (M.items[i].seller !== uid) return [403, { error: 'ce n’est pas ton annonce' }];
      M.items.splice(i, 1);
      await storage.put(K.market(), { items: M.items });
      return [204, null];
    },

    // Ce que le serveur a versé à ce joueur, et ce qu'il lui reste pour la journée (§29).
    'GET /wallet': async (uid) => {
      const caps = await loadCaps(storage, uid);
      const led = await getOr(storage, K.ledger(uid), []);
      const left = {};
      Object.keys(SERVER_CAPS).forEach((k) => { left[k] = Math.max(0, SERVER_CAPS[k] - (caps[k] || 0)); });
      return [200, { caps, left, ledger: led.slice(0, 40), limits: LIMITS }];
    }
  };

  // Table de routage simple : pas de dépendance, montable dans Express comme dans un
  // serveur Node nu (voir server/demo-server.mjs).
  const compiled = Object.keys(routes).map((k) => {
    const [method, path] = k.split(' ');
    const names = [];
    const rx = new RegExp('^' + path.replace(/:(\w+)/g, (m2, n) => { names.push(n); return '([\\w.-]+)'; }) + '/?$');
    return { method, rx, names, fn: routes[k] };
  });

  return async function handler(req, res, next) {
    const uid = await auth(req);
    if (!uid) return res.status(401).json({ error: 'non authentifié' });
    const path = (req.path || req.url || '').split('?')[0];
    for (const r of compiled) {
      if (r.method !== req.method) continue;
      const m = r.rx.exec(path);
      if (!m) continue;
      const params = {};
      r.names.forEach((n, i) => { params[n] = m[i + 1]; });
      try {
        const [code, body] = await r.fn(uid, req.body, params);
        if (code === 204) return res.status(204).end();
        return res.status(code).json(body);
      } catch (e) {
        return res.status(500).json({ error: String((e && e.message) || e) });
      }
    }
    return next ? next() : res.status(404).json({ error: 'route inconnue' });
  };
}
