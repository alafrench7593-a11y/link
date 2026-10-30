// Assemblage : base, transport, service. Partagé par le serveur, la CLI et les tests.
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { createTransport } from './transport.js';
import { Crm } from './crm.js';

export function createApp({ cfg = loadConfig(), transport, clock } = {}) {
  const db = openDb(cfg.dbFile);
  const crm = new Crm({ db, cfg, transport: transport || createTransport(cfg), clock });
  return { cfg, db, crm };
}
