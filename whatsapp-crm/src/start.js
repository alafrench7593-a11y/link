// Point d'entrée de `npm start`. Séparé de server.js pour que les tests importent
// le serveur sans le lancer (et sans comparer des chemins, fragile sous Windows).
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { createHandler, startScheduler } from './server.js';

const app = createApp();
const server = createServer(createHandler(app));
server.listen(app.cfg.port, app.cfg.host, () => {
  const t = app.crm.transport;
  console.log(`Tableau de bord : http://${app.cfg.host}:${app.cfg.port}/`);
  console.log(`Transport : ${t.name}${t.simulated ? ' — SIMULATION : aucun message ne part réellement' : ''}`);
  console.log('Webhooks : POST /webhooks/kapso   GET+POST /webhooks/meta');
});
startScheduler(app);
