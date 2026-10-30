// Serveur HTTP : tableau de bord, API JSON, webhooks. Aucune dépendance web.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { ROOT } from './config.js';
import { createApp } from './app.js';
import { getSetting, setSetting } from './db.js';
import { STATUSES, CATEGORIES, SECTIONS } from './statuses.js';
import { generateVariants } from './personalize.js';
import { importContacts } from './importer.js';
import { handleKapsoWebhook, handleMetaWebhook, verifyMetaSubscription } from './webhooks.js';
import { runFollowups, setMode, getMode, createCampaign, approveCampaign, checkQuality, prepareReactivation } from './automation.js';

const MAX_BODY = 2 * 1024 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error('corps trop gros')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function authorized(cfg, req, url) {
  if (!cfg.dashboardToken) return true;
  const given = req.headers['x-dashboard-token'] || url.searchParams.get('token')
    || /(?:^|;\s*)crm_token=([^;]+)/.exec(req.headers.cookie || '')?.[1] || '';
  const a = Buffer.from(String(given)), b = Buffer.from(cfg.dashboardToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createHandler({ cfg, db, crm }) {
  const html = readFileSync(join(ROOT, 'public', 'index.html'));
  const routes = [];
  const on = (method, pattern, fn) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), fn });

  on('GET', '/api/meta', () => ({ statuses: STATUSES, categories: CATEGORIES, sections: Object.fromEntries(Object.entries(SECTIONS).map(([k, v]) => [k, v.label])), mode: getMode(db), pitch: getSetting(db, 'pitch', ''), transport: crm.transport.name, simulated: !!crm.transport.simulated }));
  on('GET', '/api/stats', () => crm.stats());
  on('GET', '/api/contacts', ({ url }) => crm.listContacts(Object.fromEntries(url.searchParams)));
  on('POST', '/api/contacts', ({ json }) => crm.upsertContact(json, { origin: 'manuel' }));
  on('GET', '/api/contacts/:id', ({ params }) => crm.contactSheet(Number(params.id)) ?? { status: 404, error: 'introuvable' });
  on('POST', '/api/contacts/:id/status', ({ params, json }) => crm.setStatus(Number(params.id), json.status, json.reason || 'modifié depuis le tableau de bord'));
  on('POST', '/api/contacts/:id/consent', ({ params, json }) => { crm.setConsent(Number(params.id), json.consent, json); return crm.getContact(Number(params.id)); });
  on('POST', '/api/contacts/:id/notes', ({ params, json }) => { const c = crm.getContact(Number(params.id)); return crm.upsertContact({ phone: c.phone, notes: json.notes, category: json.category }); });
  on('POST', '/api/contacts/:id/send', ({ params, json }) => crm.sendMessage({ contact: Number(params.id), body: json.body, template: json.template, kind: json.kind || 'manuel', origin: 'manuel' }));
  on('POST', '/api/contacts/:id/suggest', async ({ params, json }) => {
    const sheet = crm.contactSheet(Number(params.id));
    return generateVariants({ contact: sheet.contact, kind: json.kind || 'premier_contact', cfg, history: sheet.messages, pitch: getSetting(db, 'pitch', '') });
  });
  on('POST', '/api/contacts/:id/draft', ({ params, json }) => ({ id: crm.createDraft(Number(params.id), { kind: json.kind || 'manuel', body: json.body, variants: json.variants || [], template: json.template }) }));
  on('GET', '/api/drafts', ({ url }) => db.prepare(`SELECT d.*, c.first_name, c.last_name, c.phone, c.status AS contact_status FROM drafts d JOIN contacts c ON c.id = d.contact_id
      WHERE d.status = ? ORDER BY d.id DESC LIMIT 300`).all(url.searchParams.get('status') || 'a_valider'));
  on('POST', '/api/drafts/:id/approve', ({ params, json }) => crm.approveDraft(Number(params.id), { body: json.body }));
  on('POST', '/api/drafts/:id/reject', ({ params, json }) => { crm.rejectDraft(Number(params.id), json.reason); return { ok: true }; });
  on('POST', '/api/import', ({ json }) => importContacts(crm, String(json.csv || '')));
  on('POST', '/api/settings', ({ json }) => {
    if (json.mode) setMode(db, json.mode);
    if (typeof json.pitch === 'string') setSetting(db, 'pitch', json.pitch);
    return { mode: getMode(db), pitch: getSetting(db, 'pitch', '') };
  });
  on('POST', '/api/followups/run', () => runFollowups(crm));
  on('POST', '/api/reactivation', ({ json }) => prepareReactivation(crm, json));
  on('GET', '/api/campaigns', () => db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM drafts d WHERE d.campaign_id = c.id) AS recipients FROM campaigns c ORDER BY id DESC`).all());
  on('POST', '/api/campaigns', ({ json }) => createCampaign(crm, json));
  on('POST', '/api/campaigns/:id/approve', ({ params, json }) => {
    if (json.confirm !== true) return { status: 400, error: 'Confirmation explicite requise : { "confirm": true }' };
    return approveCampaign(crm, Number(params.id));
  });
  on('POST', '/api/quality', () => checkQuality(crm));

  return async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname === '/webhooks/kapso' && req.method === 'POST') {
        const r = handleKapsoWebhook(crm, { rawBody: await readBody(req), headers: req.headers });
        return send(res, r.status, r.body, 'text/plain; charset=utf-8');
      }
      if (url.pathname === '/webhooks/meta') {
        const r = req.method === 'GET' ? verifyMetaSubscription(cfg, url.searchParams) : handleMetaWebhook(crm, { rawBody: await readBody(req), headers: req.headers });
        return send(res, r.status, r.body, 'text/plain; charset=utf-8');
      }
      if (url.pathname === '/health') return send(res, 200, { ok: true, transport: crm.transport.name });
      if (!authorized(cfg, req, url)) return send(res, 401, { error: 'jeton du tableau de bord requis' });
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        if (cfg.dashboardToken && url.searchParams.get('token')) res.setHeader('set-cookie', `crm_token=${encodeURIComponent(url.searchParams.get('token'))}; HttpOnly; SameSite=Strict; Path=/`);
        return send(res, 200, html, 'text/html; charset=utf-8');
      }
      for (const r of routes) {
        const m = r.method === req.method && r.re.exec(url.pathname);
        if (!m) continue;
        let json = {};
        if (req.method === 'POST') {
          // JSON obligatoire : un site tiers ne peut pas l'envoyer sans requête CORS préalable,
          // que ce serveur refuse. C'est la protection contre les requêtes forgées.
          if (!(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, { error: 'application/json requis' });
          const raw = await readBody(req);
          json = raw.length ? JSON.parse(raw.toString('utf8')) : {};
        }
        const out = await r.fn({ url, params: m.groups || {}, json });
        return send(res, out?.status && out?.error ? out.status : 200, out ?? null);
      }
      send(res, 404, { error: 'introuvable' });
    } catch (err) {
      crm.error('serveur', `${req.method} ${url.pathname} : ${err.message}`);
      send(res, 400, { error: err.message });
    }
  };
}

export function startScheduler({ cfg, crm }) {
  const tick = async () => {
    try { await runFollowups(crm); } catch (err) { crm.error('relances', err.message); }
  };
  const quality = async () => {
    if (crm.transport.simulated) return;
    try { await checkQuality(crm); } catch (err) { crm.error('qualite', err.message); }
  };
  tick(); quality();
  return [setInterval(tick, 15 * 60_000), setInterval(quality, 6 * 3_600_000)];
}
