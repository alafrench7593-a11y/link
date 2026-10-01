// LinkFoot en ligne : la fonction qui expose le serveur multijoueur (§26, §29).
//
// Tout ce qui décide est déjà écrit dans server/online-routes.js : les probabilités, les
// plafonds quotidiens, la vérification des scores en rejouant le match. Ce fichier ne
// fait que deux choses :
//
//   1. brancher un stockage qui survit entre deux appels, parce qu'une fonction sans
//      serveur n'a pas de disque ;
//   2. traduire la requête HTTP de l'hébergeur dans le dialecte que les routes
//      attendent, et rien d'autre.
//
// Aucune règle du jeu ne doit jamais apparaître ici. Si une décision se prenait dans ce
// fichier, elle échapperait aux tests de server/ et le §29 tomberait.
//
// DÉPLOIEMENT
//   vercel --prod            depuis la racine du dépôt
//   les routes sortent sur   https://<projet>.vercel.app/api/online/...
//
// VARIABLES D'ENVIRONNEMENT
//   KV_REST_API_URL + KV_REST_API_TOKEN    Upstash Redis, le choix recommandé
//   BLOB_READ_WRITE_TOKEN                  Vercel Blob, acceptable pour commencer
//   (aucune)                               mémoire : la partie est perdue au
//                                          redémarrage, bon pour essayer, pas pour jouer
//   LINKFOOT_ORIGIN                        origine autorisée ; * par défaut
import { onlineRoutes } from '../server/online-routes.js';
import { storageFromEnv } from '../server/kv-storage.js';

// Un seul stockage pour toute la durée de vie de l'instance : le reconstruire à chaque
// appel jetterait le cache d'URL du stockage Blob et doublerait les requêtes.
const { kind, storage } = storageFromEnv(process.env);
const handler = onlineRoutes({
  storage,
  // L'identité du joueur. Pour l'instant, un en-tête : c'est assez pour jouer entre
  // amis, ce n'est PAS de l'authentification. Un joueur peut se faire passer pour un
  // autre en changeant l'en-tête. Avant d'ouvrir à des inconnus, il faut remplacer
  // cette ligne par la vérification d'un vrai jeton ; le reste du serveur ne bouge pas.
  auth: async (req) => (req.headers && (req.headers['x-club-id'] || req.headers['X-Club-Id'])) || null
});

const lire = async (req) => {
  if (req.body && typeof req.body === 'object') return req.body;        // l'hébergeur a déjà lu
  if (typeof req.body === 'string' && req.body) { try { return JSON.parse(req.body); } catch (e) { return null; } }
  let s = '';
  for await (const c of req) s += c;
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
};

export default async function online(req, res) {
  const origine = process.env.LINKFOOT_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origine);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-club-id');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const url = new URL(req.url, 'http://x');
  const chemin = url.pathname.replace(/^\/api\/online/, '') || '/';

  // Un point d'entrée qui dit si le serveur est debout et sur quoi il range les parties.
  // Sans ça, un serveur qui tourne en mémoire se tait et on perd les parties sans savoir
  // pourquoi.
  if (chemin === '/' || chemin === '/sante') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({
      ok: true, service: 'linkfoot-online', stockage: kind,
      avertissement: kind === 'memory'
        ? 'Stockage en mémoire : tout est perdu au redémarrage. Ajoute KV_REST_API_URL et KV_REST_API_TOKEN.'
        : null,
      argentReel: false        // §76 : désactivé tant que le cadre juridique n'est pas validé
    }));
  }

  const shim = { method: req.method, path: chemin, url: chemin, headers: req.headers, body: await lire(req) };
  const out = {
    status(c) { res.statusCode = c; return this; },
    json(o) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); return this; },
    end() { res.end(); return this; }
  };
  return handler(shim, out, () => { res.statusCode = 404; out.json({ error: 'route inconnue' }); });
}
