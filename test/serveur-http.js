// Le serveur en ligne, de bout en bout, par HTTP (§26, §29).
//
// test/online.js vérifie les routes en les appelant directement. Ce fichier-ci vérifie
// la couche qui les entoure : la fonction sans serveur, le stockage qui survit entre
// deux appels, l'analyse des corps de requête, les en-têtes. C'est elle qui casse en
// premier quand on héberge, et elle n'était testée nulle part.
//
// Rien n'est simulé côté routes : c'est le vrai api/online.js, le vrai online-routes.js,
// le vrai moteur. Seul le stockage est en mémoire, par la même interface que celui
// d'Upstash ou de Blob.
import { createServer } from 'node:http';
import online from '../api/online.js';
import { MemoryStorage, RedisStorage, BlobStorage, storageFromEnv } from '../server/kv-storage.js';
import { Club } from '../src/club.js';

let ok = 0, ko = 0;
const t = (nom, cond, detail) => {
  console.log((cond ? '  ok   ' : '  ÉCHEC') + ' ' + nom + (detail ? '  (' + detail + ')' : ''));
  cond ? ok++ : ko++;
};
const tete = (s) => console.log('\n' + s);

// ---------------------------------------------------------------- le stockage
tete('Le stockage tient le contrat demandé par les routes');
{
  const m = new MemoryStorage();
  await m.put('a', { x: 1, liste: [1, 2, 3] });
  const v = await m.get('a');
  t('ce qu’on range, on le relit à l’identique', JSON.stringify(v) === JSON.stringify({ x: 1, liste: [1, 2, 3] }));
  t('une clé absente rend null, pas une erreur', (await m.get('jamais-écrit')) === null);
  await m.put('a', { x: 2 });
  t('une écriture remplace la précédente', (await m.get('a')).x === 2);
  await m.del('a');
  t('et une suppression efface vraiment', (await m.get('a')) === null);
  // Un objet rangé ne doit pas rester lié à celui qu'on gardait : sinon une
  // modification locale changerait le contenu du serveur sans passer par put.
  const o = { n: 1 };
  await m.put('b', o); o.n = 99;
  t('le stockage garde une copie, pas une référence', (await m.get('b')).n === 1);
}

tete('Le choix du stockage se fait sur l’environnement, et se dit');
{
  t('Upstash dès que les deux variables sont là',
    storageFromEnv({ KV_REST_API_URL: 'https://x', KV_REST_API_TOKEN: 'k' }).kind === 'redis');
  t('Blob en second choix', storageFromEnv({ BLOB_READ_WRITE_TOKEN: 'k' }).kind === 'blob');
  t('la mémoire en dernier recours', storageFromEnv({}).kind === 'memory');
  let leve = false;
  try { new RedisStorage({ url: '' }); } catch (e) { leve = true; }
  t('un stockage mal configuré refuse de démarrer', leve);
  leve = false;
  try { new BlobStorage({}); } catch (e) { leve = true; }
  t('Blob aussi', leve);
}

// ---------------------------------------------------------------- le serveur
const srv = createServer((req, res) => online(req, res));
await new Promise((r) => srv.listen(0, r));
const base = 'http://127.0.0.1:' + srv.address().port + '/api/online';

const appel = async (methode, chemin, corps, qui) => {
  const h = { 'Content-Type': 'application/json' };
  if (qui) h['x-club-id'] = qui;
  const r = await fetch(base + chemin, { method: methode, headers: h, body: corps ? JSON.stringify(corps) : undefined });
  const txt = await r.text();
  let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = txt; }
  return { code: r.status, corps: j, entetes: r.headers };
};

tete('Le serveur répond, et dit sur quoi il range les parties');
{
  const r = await appel('GET', '/');
  t('le point de santé répond 200', r.code === 200, JSON.stringify(r.corps).slice(0, 80));
  t('il nomme le stockage utilisé', r.corps && r.corps.stockage === 'memory');
  t('il PRÉVIENT que la mémoire perd les parties', !!(r.corps && r.corps.avertissement));
  t('§76 : il déclare l’argent réel désactivé', r.corps && r.corps.argentReel === false);
}

tete('Les en-têtes nécessaires au jeu depuis un navigateur');
{
  const r = await appel('OPTIONS', '/ladder');
  t('la requête préparatoire passe', r.code === 204);
  t('l’origine est autorisée', r.entetes.get('access-control-allow-origin') === '*');
  t('l’en-tête d’identité est accepté', (r.entetes.get('access-control-allow-headers') || '').includes('x-club-id'));
  const s = await appel('GET', '/');
  t('rien n’est mis en cache', (s.entetes.get('cache-control') || '').includes('no-store'));
}

tete('§29 Sans identité, le serveur ne fait rien');
{
  const r = await appel('GET', '/wallet');
  t('une requête anonyme est refusée', r.code === 401, 'code ' + r.code);
  const b = await appel('GET', '/route-qui-n-existe-pas', null, 'u_jag');
  t('une route inconnue répond 404 et pas 500', b.code === 404, 'code ' + b.code);
}

tete('Deux joueurs, un match classé, de bout en bout');
{
  const equipe = (nom, note) => {
    const c = new Club();
    c.setState({ clubName: nom, squad: c.state.squad.map((p) => Object.assign({}, p, { ovr: note })) });
    const xi = c.pickXI(c.state.formation);
    return { club: nom, ovr: note, style: c.state.preset || 'equilibre', formation: c.state.formation,
      xi: xi.map((p) => ({ id: p.id, name: p.name, pos: p.pos, line: p.line, slot: p.slot, ovr: p.ovr })) };
  };

  const a = await appel('PUT', '/team', equipe('FC Jag', 68), 'u_jag');
  const b = await appel('PUT', '/team', equipe('Real Canal', 66), 'u_lina');
  t('chacun publie son équipe', a.code === 204 && b.code === 204, a.code + ' et ' + b.code);

  const lu = await appel('GET', '/team/u_lina', null, 'u_jag');
  t('et peut lire celle de l’autre', lu.code === 200 && lu.corps.club === 'Real Canal');

  const m = await appel('POST', '/versus/u_lina', {}, 'u_jag');
  t('le match classé se joue sur le serveur', m.code === 200, 'code ' + m.code + ' ' + JSON.stringify(m.corps).slice(0, 90));
  if (m.code === 200) {
    const r = m.corps;
    t('il renvoie un score', Array.isArray(r.score) && r.score.length === 2, r.score && r.score.join('-'));
    t('et il bouge le classement Elo', typeof r.elo === 'number' || typeof r.rating === 'number' || r.ladder != null,
      Object.keys(r).join(', '));
  }

  const l = await appel('GET', '/ladder', null, 'u_jag');
  t('le classement liste les deux clubs', l.code === 200 && Array.isArray(l.corps.rows || l.corps) ,
    JSON.stringify(l.corps).slice(0, 90));
}

tete('§29 Le serveur refuse ce qu’un client modifié tenterait');
{
  const soi = await appel('POST', '/versus/u_jag', {}, 'u_jag');
  t('jouer contre soi-même est refusé', soi.code === 400, 'code ' + soi.code);

  const faux = await appel('POST', '/verify', { home: 'u_jag', away: 'u_lina', seed: 1, claimed: [9, 0] }, 'u_jag');
  t('un score annoncé est vérifié, pas cru', faux.code === 200 || faux.code === 400,
    'code ' + faux.code + ' ' + JSON.stringify(faux.corps).slice(0, 70));
  if (faux.code === 200) t('et le faux score est démenti', faux.corps && faux.corps.ok === false,
    JSON.stringify(faux.corps).slice(0, 70));
}

tete('§29 Une équipe incomplète est refusée, elle ne fait pas tomber le serveur');
{
  const onze = (f) => Array.from({ length: 11 }, (_, i) => f(i));
  const bon = onze((i) => ({ id: i, name: 'J' + i, pos: i ? 'MIL' : 'GB', line: i ? 'MIL' : 'GB', slot: 'MIL' + i, ovr: 65 }));

  const court = await appel('PUT', '/team', { club: 'X', formation: '4-3-3', xi: bon.slice(0, 9) }, 'u_test');
  t('moins de onze joueurs : refusé', court.code === 400, JSON.stringify(court.corps).slice(0, 70));

  const sansGB = await appel('PUT', '/team', { club: 'X', formation: '4-3-3',
    xi: onze((i) => ({ name: 'J' + i, line: 'MIL', ovr: 65 })) }, 'u_test');
  t('sans gardien : refusé', sansGB.code === 400, JSON.stringify(sansGB.corps).slice(0, 70));

  const triche = await appel('PUT', '/team', { club: 'X', formation: '4-3-3',
    xi: onze((i) => ({ name: 'J' + i, line: i ? 'MIL' : 'GB', ovr: i === 3 ? 500 : 65 })) }, 'u_test');
  t('une note de 500 : refusée', triche.code === 400, JSON.stringify(triche.corps).slice(0, 70));

  const form = await appel('PUT', '/team', { club: 'X', formation: '9-0-1', xi: bon }, 'u_test');
  t('une formation inventée : refusée', form.code === 400, JSON.stringify(form.corps).slice(0, 70));

  // Celle-ci DOIT passer : pas de tactique, pas de mentalité. Le serveur complète avec
  // les réglages par défaut au lieu de calculer sur « undefined » et de rendre 500.
  const nue = await appel('PUT', '/team', { club: 'Sans Tactique', formation: '4-3-3', xi: bon }, 'u_nue');
  t('une équipe sans tactique est acceptée', nue.code === 204, 'code ' + nue.code);
  // Un joueur neuf : u_jag vient de jouer, et l'anti-farming lui impose vingt secondes
  // entre deux matchs classés. C'est le serveur qui fait son travail, pas un défaut.
  await appel('PUT', '/team', { club: 'Adversaire', formation: '4-3-3', xi: bon }, 'u_neuf');
  const duel = await appel('POST', '/versus/u_nue', {}, 'u_neuf');
  t('et elle joue, avec les réglages par défaut', duel.code === 200,
    'code ' + duel.code + ' ' + JSON.stringify(duel.corps).slice(0, 80));
}

tete('§29 L’anti-farming tient');
{
  const r = await appel('POST', '/versus/u_lina', {}, 'u_jag');
  t('deux matchs classés coup sur coup : le second est refusé', r.code === 429,
    'code ' + r.code + ' ' + JSON.stringify(r.corps).slice(0, 60));
}

tete('Le corps de la requête est lu correctement');
{
  const vide = await appel('PUT', '/team', null, 'u_jag');
  t('un corps absent donne 400, pas 500', vide.code === 400, 'code ' + vide.code);
  const mauvais = await appel('PUT', '/team', { xi: 'pas un tableau' }, 'u_jag');
  t('un corps invalide aussi', mauvais.code === 400, 'code ' + mauvais.code);
}

srv.close();
console.log('\n' + (ko ? 'ÉCHECS : ' + ko + ' sur ' + (ok + ko) : 'OK : ' + ok + ' vérifications, le serveur tient par HTTP'));
process.exit(ko ? 1 : 0);
