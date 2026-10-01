// Serveur de démonstration sans dépendance : node server/demo-server.mjs
// Sert la démo et les routes de sauvegarde sur http://localhost:8787
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { FileStorage, saveRoutes } from './save-routes.js';
import { onlineRoutes } from './online-routes.js';

const root = new URL('..', import.meta.url).pathname;
const storage = new FileStorage(join(root, 'saves'));
const routes = saveRoutes({ storage });
// §26 et §29 : les routes multijoueur. Pour la démonstration, l'identité du joueur est
// simplement l'en-tête x-club-id. Dans une vraie application, c'est ton système de
// comptes qui répond ici, et lui seul.
const online = onlineRoutes({ storage, auth: async (req) => (req.headers && req.headers['x-club-id']) || null });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8' };

// Petit adaptateur : les routes parlent le dialecte d'Express, le serveur de démonstration
// est un serveur Node nu. Trente lignes suffisent à faire le pont.
const shimRes = (res) => ({
  status(c) { this._c = c; return this; },
  json(o) { res.writeHead(this._c || 200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(o)); return this; },
  end() { res.writeHead(this._c || 200).end(); return this; }
});

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-club-id');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  if (url.pathname.startsWith('/clubs/')) {
    let body = '';
    for await (const c of req) body += c;
    const shim = { method: req.method, path: url.pathname.slice('/clubs'.length), body: body ? JSON.parse(body) : null };
    const out = { status: (c) => ({ json: (o) => res.writeHead(c, { 'Content-Type': 'application/json' }).end(JSON.stringify(o)), end: () => res.writeHead(c).end() }),
                  json: (o) => res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(o)) };
    return routes(shim, out, () => res.writeHead(404).end());
  }

  if (url.pathname.startsWith('/online/')) {
    let body = '';
    for await (const c of req) body += c;
    const shim = { method: req.method, path: url.pathname.slice('/online'.length), url: url.pathname.slice('/online'.length), headers: req.headers, body: body ? JSON.parse(body) : null };
    return online(shim, shimRes(res), () => res.writeHead(404).end());
  }

  const p = url.pathname === '/' ? '/demo/demo.html' : url.pathname;
  try {
    const buf = await readFile(join(root, p));
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' }).end(buf);
  } catch (e) { res.writeHead(404).end('introuvable'); }
}).listen(8787, () => console.log('LinkFoot : http://localhost:8787'));
