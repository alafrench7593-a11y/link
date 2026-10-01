// Routes de sauvegarde prêtes à monter dans un Express existant.
//
//   import express from 'express';
//   import { saveRoutes, FileStorage } from 'linkfoot-engine/server';
//   app.use('/clubs', saveRoutes({ storage: new FileStorage('./saves'), auth: myAuth }));
//
// Le contrat correspond exactement à ce qu'attend HttpStore côté client :
//   GET    /clubs/:id/save
//   PUT    /clubs/:id/save
//   DELETE /clubs/:id/save
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

export class FileStorage {
  constructor(dir) { this.dir = dir || './saves'; }
  file(id) { return join(this.dir, String(id).replace(/[^\w.-]/g, '_') + '.json'); }
  async get(id) {
    try { return JSON.parse(await readFile(this.file(id), 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  }
  async put(id, payload) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.file(id), JSON.stringify(payload));
  }
  async del(id) { try { await unlink(this.file(id)); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
}

// Remplace FileStorage par ceci si tu as déjà une base.
// La sauvegarde est un JSON opaque d'environ 8 ko : une colonne jsonb ou text suffit.
export class SqlStorage {
  constructor(query) { this.query = query; }   // query(sql, params) -> rows
  async get(id) { const r = await this.query('select payload from club_saves where club_id = $1', [id]); return r[0] ? r[0].payload : null; }
  async put(id, payload) { await this.query('insert into club_saves (club_id, payload, updated_at) values ($1, $2, now()) on conflict (club_id) do update set payload = excluded.payload, updated_at = now()', [id, payload]); }
  async del(id) { await this.query('delete from club_saves where club_id = $1', [id]); }
}

export function saveRoutes(opts) {
  const o = opts || {};
  const storage = o.storage || new FileStorage();
  const maxBytes = o.maxBytes || 256 * 1024;
  // auth(req, id) doit renvoyer true si l'appelant a le droit de lire ou d'écrire ce club.
  const auth = o.auth || (() => true);

  return async function handler(req, res, next) {
    const m = /^\/([\w.-]+)\/save\/?$/.exec(req.path || req.url);
    if (!m) return next ? next() : res.status(404).end();
    const id = m[1];
    if (!(await auth(req, id))) return res.status(403).json({ error: 'interdit' });
    try {
      if (req.method === 'GET') {
        const p = await storage.get(id);
        return p ? res.json(p) : res.status(404).json({ error: 'aucune sauvegarde' });
      }
      if (req.method === 'PUT') {
        const body = req.body;
        if (!body || typeof body !== 'object' || !body.state) return res.status(400).json({ error: 'payload invalide' });
        if (JSON.stringify(body).length > maxBytes) return res.status(413).json({ error: 'sauvegarde trop grande' });
        await storage.put(id, body);
        return res.status(204).end();
      }
      if (req.method === 'DELETE') { await storage.del(id); return res.status(204).end(); }
      return res.status(405).end();
    } catch (e) { return res.status(500).json({ error: String(e && e.message || e) }); }
  };
}
