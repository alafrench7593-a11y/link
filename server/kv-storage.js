// Le stockage du serveur, version hébergée (§29).
//
// Les routes multijoueur ne demandent que trois choses : get(id), put(id, valeur),
// del(id). FileStorage les rend avec des fichiers, ce qui marche sur une machine et
// nulle part ailleurs : une fonction sans serveur n'a pas de disque qui survit à
// l'appel suivant, et deux appels simultanés ne tournent pas sur la même machine.
//
// Ce fichier donne la même interface au-dessus d'un magasin clé-valeur HTTP. Il parle
// deux dialectes, parce que ce sont les deux qu'on rencontre en pratique :
//
//   Upstash Redis (REST)   KV_REST_API_URL + KV_REST_API_TOKEN
//   Vercel Blob            BLOB_READ_WRITE_TOKEN
//
// Et il garde MemoryStorage pour les tests : la même interface, sans réseau, ce qui
// permet de vérifier tout le serveur sans rien héberger.
//
// IMPORTANT : aucune règle du jeu ici. Ce fichier range et relit, c'est tout. Les
// probabilités, les plafonds et la vérification des scores restent dans
// online-routes.js, côté serveur, hors de portée du client (§29).

// ---------------------------------------------------------------- en mémoire
// Pour les tests, et pour faire tourner le serveur sur une seule machine.
export class MemoryStorage {
  constructor() { this.m = new Map(); }
  async get(id) { const v = this.m.get(String(id)); return v === undefined ? null : JSON.parse(v); }
  async put(id, payload) { this.m.set(String(id), JSON.stringify(payload)); }
  async del(id) { this.m.delete(String(id)); }
  get size() { return this.m.size; }
}

// ---------------------------------------------------------------- Upstash Redis
// Le plus simple des trois : une requête HTTP par opération, cohérence immédiate.
// C'est celui à préférer pour un serveur de jeu, parce qu'un classement lu une
// seconde après avoir été écrit doit être à jour.
export class RedisStorage {
  constructor(opts) {
    const o = opts || {};
    this.url = (o.url || '').replace(/\/+$/, '');
    this.token = o.token || '';
    if (!this.url || !this.token) throw new Error('RedisStorage : url et token requis');
    this.prefix = o.prefix || 'lf:';
    this.fetch = o.fetch || globalThis.fetch;
  }

  async cmd(parts) {
    const r = await this.fetch(this.url + '/' + parts.map(encodeURIComponent).join('/'), {
      headers: { Authorization: 'Bearer ' + this.token }
    });
    if (!r.ok) throw new Error('Redis ' + r.status + ' ' + (await r.text()).slice(0, 120));
    return (await r.json()).result;
  }

  async get(id) {
    const v = await this.cmd(['get', this.prefix + id]);
    return v == null ? null : JSON.parse(v);
  }

  async put(id, payload) {
    // SET passe par le corps de la requête : une sauvegarde fait plusieurs kilo-octets
    // et ne tiendrait pas dans une URL.
    const r = await this.fetch(this.url + '/set/' + encodeURIComponent(this.prefix + id), {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + this.token, 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('Redis set ' + r.status + ' ' + (await r.text()).slice(0, 120));
  }

  async del(id) { await this.cmd(['del', this.prefix + id]); }
}

// ---------------------------------------------------------------- Vercel Blob
// Utilisable s'il n'y a rien d'autre, avec une réserve qu'il faut connaître : l'écriture
// n'est pas immédiatement visible partout. Deux joueurs qui jouent à la seconde près
// peuvent lire un classement d'il y a quelques secondes. Acceptable pour commencer,
// pas pour un tournoi serré.
export class BlobStorage {
  constructor(opts) {
    const o = opts || {};
    this.token = o.token || '';
    if (!this.token) throw new Error('BlobStorage : token requis');
    this.prefix = o.prefix || 'linkfoot/';
    this.base = o.base || 'https://blob.vercel-storage.com';
    this.fetch = o.fetch || globalThis.fetch;
    this.urls = new Map();        // clé → URL publique, pour relire sans lister
  }

  chemin(id) { return this.prefix + String(id).replace(/[^\w.:-]/g, '_') + '.json'; }

  async get(id) {
    const u = this.urls.get(String(id));
    if (!u) {
      const l = await this.fetch(this.base + '/?prefix=' + encodeURIComponent(this.chemin(id)) + '&limit=1',
        { headers: { Authorization: 'Bearer ' + this.token } });
      if (!l.ok) return null;
      const j = await l.json();
      const b = (j.blobs || [])[0];
      if (!b) return null;
      this.urls.set(String(id), b.url);
    }
    const r = await this.fetch(this.urls.get(String(id)) + '?t=' + Date.now());
    if (!r.ok) { this.urls.delete(String(id)); return null; }
    return r.json();
  }

  async put(id, payload) {
    const r = await this.fetch(this.base + '/' + encodeURIComponent(this.chemin(id)), {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + this.token, 'x-content-type': 'application/json',
        'x-add-random-suffix': '0', 'x-cache-control-max-age': '0' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('Blob put ' + r.status + ' ' + (await r.text()).slice(0, 120));
    const j = await r.json();
    if (j && j.url) this.urls.set(String(id), j.url);
  }

  async del(id) {
    const u = this.urls.get(String(id));
    if (!u) { const v = await this.get(id); if (!v) return; }
    await this.fetch(this.base + '/delete', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + this.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [this.urls.get(String(id))] })
    });
    this.urls.delete(String(id));
  }
}

// Choisit tout seul d'après ce que l'hébergeur a mis dans l'environnement, et dit
// clairement lequel il a pris : un serveur qui tombe en mémoire sans prévenir perdrait
// les parties au premier redémarrage.
export function storageFromEnv(env) {
  const e = env || (typeof process !== 'undefined' ? process.env : {}) || {};
  if (e.KV_REST_API_URL && e.KV_REST_API_TOKEN) {
    return { kind: 'redis', storage: new RedisStorage({ url: e.KV_REST_API_URL, token: e.KV_REST_API_TOKEN }) };
  }
  if (e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN) {
    return { kind: 'redis', storage: new RedisStorage({ url: e.UPSTASH_REDIS_REST_URL, token: e.UPSTASH_REDIS_REST_TOKEN }) };
  }
  if (e.BLOB_READ_WRITE_TOKEN) {
    return { kind: 'blob', storage: new BlobStorage({ token: e.BLOB_READ_WRITE_TOKEN }) };
  }
  return { kind: 'memory', storage: new MemoryStorage() };
}
