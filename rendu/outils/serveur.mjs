// Un petit serveur de fichiers pour le laboratoire : la racine du dépôt, et three.js depuis
// app/node_modules (le même que l'application).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.bin': 'application/octet-stream', '.png': 'image/png', '.css': 'text/css' };

export function demarrer(port = 0) {
  const serveur = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.startsWith('/three/')) p = '/app/node_modules/three/' + p.slice(7);
    const f = path.join(RACINE, path.normalize(p));
    if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('absent'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((ok) => serveur.listen(port, '127.0.0.1', () => ok({ serveur, port: serveur.address().port })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { port } = await demarrer(Number(process.argv[2] || 8765));
  console.log('http://127.0.0.1:' + port + '/rendu/labo/index.html');
}
