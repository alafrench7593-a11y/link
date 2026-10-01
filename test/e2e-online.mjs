// Le circuit complet, sans rien simuler : un vrai serveur HTTP, un vrai client fetch.
// Deux clubs se branchent, publient leur équipe, jouent un match classé, et le client
// rejoue la rencontre chez lui pour vérifier que c'est bien la même (§26, §29).
import { createServer } from 'node:http';
import { Club } from '../src/club.js';
import { teamSnapshot, playVersus } from '../src/versus.js';
import { OnlineClient, connectOnline } from '../src/online.js';
import { onlineRoutes } from '../server/online-routes.js';

let fails = 0;
const ok = (c, label, detail) => { console.log((c ? '  ok   ' : '  ÉCHEC') + ' ' + label + (detail ? '  (' + detail + ')' : '')); if (!c) fails++; };

const mem = new Map();
const storage = {
  async get(k) { return mem.has(k) ? JSON.parse(mem.get(k)) : null; },
  async put(k, v) { mem.set(k, JSON.stringify(v)); },
  async del(k) { mem.delete(k); }
};
const routes = onlineRoutes({ storage, auth: async (req) => (req.headers && req.headers['x-club-id']) || null });

const srv = createServer(async (req, res) => {
  let body = '';
  for await (const c of req) body += c;
  const shim = { method: req.method, path: req.url, url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null };
  const out = {
    status(c) { this._c = c; return this; },
    json(o) { res.writeHead(this._c || 200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(o)); return this; },
    end() { res.writeHead(this._c || 200).end(); return this; }
  };
  routes(shim, out, () => res.writeHead(404).end('{}'));
});

await new Promise((r) => srv.listen(0, r));
const port = srv.address().port;
const url = 'http://127.0.0.1:' + port;
console.log('serveur de test sur ' + url);

const mkClub = (name, id, seed) => {
  const c = new Club();
  c.createClub({ name, seed });
  connectOnline(c, new OnlineClient({ url, headers: { 'Content-Type': 'application/json', 'x-club-id': id } }));
  return c;
};

const alice = mkClub('FC Villejuif', 'alice', 11);
const bob = mkClub('AS Saint-Denis', 'bob', 22);

console.log('\nconnexion');
ok(alice.onlineSummary().connected === true, 'un club branché se dit en ligne', alice.onlineSummary().state);
const p1 = await alice.goOnline();
const p2 = await bob.goOnline();
ok(p1.ok && p2.ok, 'les deux équipes se publient par HTTP');

console.log('\n§26 match classé de bout en bout');
const soldeAvant = alice.state.balance;
const r = await alice.playRanked('bob');
ok(r.ok, 'le match se joue', r.score && r.score.join('-'));
ok(alice.state.balance > soldeAvant, 'le solde du club suit ce que le serveur a versé',
  soldeAvant + ' → ' + alice.state.balance);
ok(alice.state.lastVersus && alice.state.lastVersus.seed, 'la graine est conservée pour rejouer');

// le client rejoue la rencontre chez lui, sans rien demander au serveur
const ta = teamSnapshot(alice), tb = teamSnapshot(bob);
const local = playVersus(ta, tb, r.replay.seed);
ok(local.score[0] === r.score[0] && local.score[1] === r.score[1],
  '§26 : rejoué chez le client, c’est exactement le même match',
  'serveur ' + r.score.join('-') + ' · client ' + local.score.join('-'));

console.log('\n§29 le serveur reste maître');
const trop = await alice.playRanked('bob');
ok(!trop.ok, 'un second match immédiat est refusé, avec sa raison', trop.why);
ok(alice.state.onlineError === trop.why, 'et l’écran reçoit cette raison');

console.log('\nserveur coupé');
await new Promise((r2) => srv.close(r2));
const coupe = await alice.playRanked('bob');
ok(!coupe.ok, 'le client dit que le serveur est injoignable', coupe.why);
ok(alice.onlineSummary().state === 'Serveur injoignable', 'et l’écran l’affiche');
const solo = alice.playMatch({ club: 'Adversaire', ovr: 60, style: 'direct' }, { seed: 1 });
ok(solo.score.length === 2, 'le jeu solo continue de fonctionner sans serveur', solo.score.join('-'));

console.log(fails ? '\nÉCHEC : ' + fails + ' vérification(s)' : '\nOK : le circuit client-serveur tient de bout en bout');
process.exit(fails ? 1 : 0);
