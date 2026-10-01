// LinkFoot : sauvegarde. Sérialise l'état du club, le relit, et le range
// où tu veux : mémoire, navigateur, ou ton serveur.

export const SAVE_VERSION = 3;

// Ce qui est conservé d'une session à l'autre. Tout le reste (vue courante, match en cours,
// animation de pack, horodatages d'affichage) est volatil et recalculé au chargement.
const PERSIST = [
  'formation', 'balance', 'preset', 'mentality', 'tac', 'roles', 'duties', 'lineup',
  'squad', 'nextId', 'record', 'kit', 'xp', 'level', 'dayStreak', 'dayClaimed',
  'winStreak', 'freePackAt', 'freeQueue', 'division', 'seasonP', 'missions',
  'staff', 'stade', 'academy', 'youth', 'inv', 'coach', 'coachMode', 'cohBonus', 'trainDone',
  // directeur sportif : inventaire de compétences, économie encadrée, quêtes, identité du club
  'skillInv', 'nextSkillUid', 'collected', 'seenPlayers', 'shards',
  'caps', 'ledger', 'quests', 'clubName', 'country', 'created'
];

export function serialize(club) {
  const s = club.state || club, out = {};
  PERSIST.forEach((k) => { if (s[k] !== undefined) out[k] = s[k]; });
  return { v: SAVE_VERSION, at: new Date().toISOString(), state: out };
}

// Les sauvegardes d'une version antérieure sont remontées une étape à la fois.
const MIGRATIONS = {
  // v1 : avant le staff, le stade et le centre de formation
  1: (st) => Object.assign({}, st, {
    staff: st.staff || { adjoint: 0, physique: 0, recruteur: 0, kine: 0 },
    stade: st.stade || 0, academy: st.academy || 0, youth: st.youth || []
  }),
  // v2 : avant l'inventaire de compétences, les quêtes et le journal des transactions.
  // Les anciennes parties repartent avec un effectif au niveau 1 et aucune compétence
  // en réserve ; rien n'est perdu, les joueurs gardent leurs statistiques.
  2: (st) => Object.assign({}, st, {
    skillInv: st.skillInv || [], nextSkillUid: st.nextSkillUid || 1,
    collected: st.collected || [], seenPlayers: st.seenPlayers || [],
    shards: st.shards || 0, caps: st.caps || {}, ledger: st.ledger || [],
    quests: st.quests || null, clubName: st.clubName || 'FC TonPseudo',
    country: st.country || 'fr', created: st.created !== false,
    squad: (st.squad || []).map((p) => Object.assign({ plv: 1, pxp: 0 }, p)),
    // les anciennes clés de packs n'existent plus : tout devient le pack unique
    freeQueue: (st.freeQueue || []).map(() => 'linkfoot')
  })
};

export function deserialize(data) {
  if (!data || typeof data !== 'object') return null;
  if (!data.state) return null;
  let v = data.v || 1, st = data.state;
  while (v < SAVE_VERSION) { const m = MIGRATIONS[v]; if (m) st = m(st); v++; }
  return st;
}

// ---------- stockages ----------

// Mémoire : utile pour les tests et pour un serveur qui garde l'état en RAM.
export class MemoryStore {
  constructor() { this.data = null; }
  async load() { return this.data; }
  async save(payload) { this.data = payload; }
  async clear() { this.data = null; }
}

// Navigateur. Tout est protégé : en navigation privée ou si le stockage est bloqué,
// load renvoie null et save échoue sans casser le jeu.
export class LocalStore {
  constructor(key) { this.key = key || 'linkfoot.save'; }
  async load() {
    try { const raw = localStorage.getItem(this.key); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  async save(payload) {
    try { localStorage.setItem(this.key, JSON.stringify(payload)); return true; }
    catch (e) { return false; }
  }
  async clear() { try { localStorage.removeItem(this.key); } catch (e) {} }
}

// Ton serveur. Attend GET qui renvoie le payload (ou 404), PUT qui l'enregistre,
// DELETE qui l'efface. Passe tes en-têtes d'authentification dans headers.
export class HttpStore {
  constructor(opts) {
    const o = opts || {};
    this.url = o.url;
    this.headers = Object.assign({ 'Content-Type': 'application/json' }, o.headers || {});
    this.fetch = o.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    if (!this.url) throw new Error('HttpStore : url manquante');
    if (!this.fetch) throw new Error('HttpStore : aucune implémentation de fetch disponible');
  }
  async load() {
    const r = await this.fetch(this.url, { method: 'GET', headers: this.headers });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('HttpStore load ' + r.status);
    return r.json();
  }
  async save(payload) {
    const r = await this.fetch(this.url, { method: 'PUT', headers: this.headers, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error('HttpStore save ' + r.status);
    return true;
  }
  async clear() { await this.fetch(this.url, { method: 'DELETE', headers: this.headers }); }
}

// ---------- gestionnaire ----------
// Relie un Club à un stockage : charge au démarrage, enregistre après chaque changement,
// avec un délai pour ne pas écrire à chaque image.
export class SaveManager {
  constructor(club, store, opts) {
    const o = opts || {};
    this.club = club; this.store = store;
    this.delay = o.delay != null ? o.delay : 800;
    this.onError = o.onError || (() => {});
    this._t = null; this._off = null; this.lastSavedAt = null;
  }
  async load() {
    try {
      const raw = await this.store.load();
      const st = deserialize(raw);
      if (st) this.club.setState(st);
      return !!st;
    } catch (e) { this.onError(e); return false; }
  }
  async save() {
    try { await this.store.save(serialize(this.club)); this.lastSavedAt = Date.now(); return true; }
    catch (e) { this.onError(e); return false; }
  }
  start() {
    if (this._off) return this;
    this._off = this.club.onChange(() => {
      clearTimeout(this._t);
      this._t = setTimeout(() => this.save(), this.delay);
    });
    return this;
  }
  stop() { clearTimeout(this._t); if (this._off) { this._off(); this._off = null; } return this; }
}
