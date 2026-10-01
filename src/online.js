// LinkFoot : le client en ligne (§26, §29).
//
// Tout ce que ce fichier fait, c'est parler au serveur et rejouer ce qu'il annonce.
// Il ne décide rien : ni le score d'un match classé, ni les jetons gagnés, ni le
// contenu d'un pack. C'est la règle du §29, et c'est ce qui rend le jeu honnête
// quand deux personnes s'affrontent.
import { teamSnapshot, playVersus } from './versus.js';

export class OnlineClient {
  // url : la racine des routes en ligne, par exemple 'https://api.linkfoot.app/online'.
  // headers : ce que ton application met pour identifier le joueur (un jeton, un cookie).
  constructor(opts) {
    const o = opts || {};
    this.url = String(o.url || '').replace(/\/$/, '');
    this.headers = Object.assign({ 'Content-Type': 'application/json' }, o.headers || {});
    this.fetch = o.fetch || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    this.onError = o.onError || null;
  }

  async call(method, path, body) {
    if (!this.fetch) throw new Error('aucun fetch disponible');
    const r = await this.fetch(this.url + path, {
      method, headers: this.headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (r.status === 204) return { ok: true };
    let data = null;
    try { data = await r.json(); } catch (e) { data = null; }
    if (!r.ok) {
      const err = { ok: false, status: r.status, why: (data && data.error) || ('erreur ' + r.status) };
      if (this.onError) this.onError(err);
      return err;
    }
    return Object.assign({ ok: true }, data);
  }

  // Publier son équipe : sans ça, personne ne peut jouer contre toi, même hors ligne.
  publishTeam(club) { return this.call('PUT', '/team', teamSnapshot(club)); }
  team(id) { return this.call('GET', '/team/' + encodeURIComponent(id)); }

  // §26 un match classé. Le serveur rend (adversaire, graine) : le client rejoue
  // la rencontre et obtient exactement le même match, minute par minute.
  async versus(id) {
    const r = await this.call('POST', '/versus/' + encodeURIComponent(id));
    if (!r.ok) return r;
    return Object.assign(r, { replayWith: (homeTeam, awayTeam) => playVersus(homeTeam, awayTeam, r.replay.seed) });
  }

  // §29 : le pack est tiré par le serveur. Le client ne connaît pas les probabilités,
  // il reçoit le contenu et l'anime.
  openPack(free) { return this.call('POST', '/pack', { free: !!free }); }
  balance() { return this.call('GET', '/balance'); }

  ladder() { return this.call('GET', '/ladder'); }
  wallet() { return this.call('GET', '/wallet'); }

  createLeague(name, rounds) { return this.call('POST', '/leagues', { name, rounds }); }
  joinLeague(code) { return this.call('POST', '/leagues/join', { code }); }
  startLeague(id) { return this.call('POST', '/leagues/' + id + '/start'); }
  playLeagueDay(id) { return this.call('POST', '/leagues/' + id + '/play'); }
  league(id) { return this.call('GET', '/leagues/' + id); }
  myLeagues() { return this.call('GET', '/leagues'); }

  challenge(to, msg) { return this.call('POST', '/challenges', { to, msg }); }
  myChallenges() { return this.call('GET', '/challenges'); }
  acceptChallenge(id) { return this.call('POST', '/challenges/' + id + '/accept'); }

  createTournament(opts) { return this.call('POST', '/tournaments', opts); }
  playTournament(id) { return this.call('POST', '/tournaments/' + id + '/play'); }
  tournament(id) { return this.call('GET', '/tournaments/' + id); }
}

// Branche un club sur un serveur. Les méthodes ajoutées refusent clairement quand
// le serveur n'est pas joignable : le jeu solo continue de fonctionner sans lui.
export function connectOnline(club, online) {
  club.online = online;
  club.onlineState = { ladder: null, leagues: [], challenges: [], lastVersus: null, offline: false };

  const guard = async (fn) => {
    try { const r = await fn(); if (!r.ok) club.setState({ onlineError: r.why }); return r; }
    catch (e) { club.onlineState.offline = true; club.setState({ onlineError: 'serveur injoignable' }); return { ok: false, why: 'serveur injoignable' }; }
  };

  club.goOnline = () => guard(() => online.publishTeam(club));

  // Joue un match classé et applique au club ce que le SERVEUR a décidé, pas l'inverse.
  club.playRanked = async (opponentId) => {
    const r = await guard(() => online.versus(opponentId));
    if (!r.ok) return r;
    const s = club.state;
    club.setState({
      balance: s.balance + (r.tokens ? r.tokens.given : 0),
      elo: r.elo,
      lastVersus: { opponent: opponentId, score: r.score, res: r.res, delta: r.delta, seed: r.replay.seed },
      onlineError: null
    });
    club.logMoney(r.tokens ? r.tokens.given : 0, 'Match classé');
    return r;
  };

  // Ouvre un pack côté serveur et applique ce qu'il rend. Si le serveur est injoignable,
  // on le dit : on ne tire pas en local pour « dépanner », ce serait la porte ouverte.
  club.openPackOnline = async (free) => {
    const r = await guard(() => online.openPack(free));
    if (!r.ok) return r;
    club.commitPack({ ok: true, def: club.THE_PACK(), got: r.got, shards: r.shards, free: !!free });
    club.setState({ balance: r.balance, onlineError: null });
    return r;
  };

  club.refreshLadder = async () => { const r = await guard(() => online.ladder()); if (r.ok) club.onlineState.ladder = r.rows; return r; };
  club.refreshLeagues = async () => { const r = await guard(() => online.myLeagues()); if (r.ok) club.onlineState.leagues = r.leagues; return r; };
  club.refreshChallenges = async () => { const r = await guard(() => online.myChallenges()); if (r.ok) club.onlineState.challenges = r.challenges; return r; };

  return club;
}
