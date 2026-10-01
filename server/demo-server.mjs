// Serveur de démonstration sans dépendance : node server/demo-server.mjs
// Sert la démo et les routes de sauvegarde sur http://localhost:8787
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { FileStorage, saveRoutes } from './save-routes.js';

const root = new URL('..', import.meta.url).pathname;
const routes = saveRoutes({ storage: new FileStorage(join(root, 'saves')) });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  if (url.pathname.startsWith('/clubs/')) {
    let body = '';
    for await (const c of req) body += c;
    const shim = { method: req.method, path: url.pathname.slice('/clubs'.length), body: body ? JSON.parse(body) : null };
    const out = { status: (c) => ({ json: (o) => res.writeHead(c, { 'Content-Type': 'application/json' }).end(JSON.stringify(o)), end: () => res.writeHead(c).end() }),
                  json: (o) => res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(o)) };
    return routes(shim, out, () => res.writeHead(404).end());
  }

  const p = url.pathname === '/' ? '/demo/demo.html' : url.pathname;
  try {
    const buf = await readFile(join(root, p));
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' }).end(buf);
  } catch (e) { res.writeHead(404).end('introuvable'); }
}).listen(8787, () => console.log('LinkFoot : http://localhost:8787'));
