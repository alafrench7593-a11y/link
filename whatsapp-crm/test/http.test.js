// Serveur réel sur un port local : webhooks signés (Kapso et Meta) et API du tableau de bord.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { makeApp } from './helpers.js';
import { createHandler } from '../src/server.js';

async function withServer(fn, overrides) {
  const app = makeApp(overrides);
  const server = createServer(createHandler(app));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn({ ...app, base }); } finally { server.close(); }
}

const kapso = (base, event, payload, { secret = 'whsec_test', key } = {}) => {
  const body = JSON.stringify(payload);
  const sig = createHmac('sha256', secret).update(body).digest('hex');
  return fetch(`${base}/webhooks/kapso`, { method: 'POST', body, headers: { 'content-type': 'application/json', 'x-webhook-event': event, 'x-webhook-signature': sig, ...(key ? { 'x-idempotency-key': key } : {}) } });
};

const inbound = (text, id) => ({
  message: { id, timestamp: '1730092800', type: 'text', text: { body: text }, kapso: { direction: 'inbound', status: 'received', content: text } },
  conversation: { id: 'conv_1', phone_number: '+33612345678', phone_number_id: '123', kapso: { contact_name: 'Léa Martin' } },
  is_new_conversation: true, phone_number_id: '123',
});

test('webhook Kapso : signature exigée, réponse enregistrée, rejeu ignoré', async () => {
  await withServer(async ({ base, crm }) => {
    let r = await kapso(base, 'whatsapp.message.received', inbound('Bonjour', 'wamid.A'), { secret: 'mauvais' });
    assert.equal(r.status, 401);
    assert.equal(crm.getContact('+33612345678'), undefined);
    r = await kapso(base, 'whatsapp.message.received', inbound('Bonjour', 'wamid.A'), { key: 'k1' });
    assert.equal(r.status, 200);
    const c = crm.getContact('+33612345678');
    assert.equal(c.first_name, 'Léa');
    assert.equal(c.replies_received, 1);
    r = await kapso(base, 'whatsapp.message.received', inbound('Bonjour', 'wamid.A'), { key: 'k1' });
    assert.equal(await r.text(), 'déjà traité');
    assert.equal(crm.getContact(c.id).replies_received, 1);
  });
});

test('webhook Kapso : statut d’un message envoyé ailleurs → fiche « Contacts contactés »', async () => {
  await withServer(async ({ base, crm }) => {
    const payload = {
      message: { id: 'wamid.OUT', type: 'text', text: { body: 'Message tapé dans la boîte Kapso' }, kapso: { direction: 'outbound', status: 'sent', content: 'Message tapé dans la boîte Kapso', statuses: [{ id: 'wamid.OUT', status: 'sent', recipient_id: '33677777777' }] } },
      conversation: { id: 'c2', phone_number: '+33677777777', phone_number_id: '123' }, phone_number_id: '123',
    };
    assert.equal((await kapso(base, 'whatsapp.message.sent', payload)).status, 200);
    const list = await (await fetch(`${base}/api/contacts?section=contactes`)).json();
    assert.equal(list.length, 1);
    assert.equal(list[0].last_outbound_text, 'Message tapé dans la boîte Kapso');
    const failed = structuredClone(payload);
    failed.message.kapso.statuses.push({ id: 'wamid.OUT', status: 'failed', recipient_id: '33677777777', errors: [{ code: 131047, title: 'Re-engagement message' }] });
    await kapso(base, 'whatsapp.message.failed', failed);
    const sheet = await (await fetch(`${base}/api/contacts/${list[0].id}`)).json();
    assert.equal(sheet.messages[0].status, 'echec');
    assert.match(sheet.messages[0].error, /131047/);
  });
});

test('webhook Meta : abonnement, signature X-Hub-Signature-256, désinscription', async () => {
  await withServer(async ({ base, crm }) => {
    let r = await fetch(`${base}/webhooks/meta?hub.mode=subscribe&hub.verify_token=verify_me&hub.challenge=42`);
    assert.equal(await r.text(), '42');
    r = await fetch(`${base}/webhooks/meta?hub.mode=subscribe&hub.verify_token=faux&hub.challenge=42`);
    assert.equal(r.status, 403);
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: {
      contacts: [{ wa_id: '33688888888', profile: { name: 'Paul' } }],
      messages: [{ from: '33688888888', id: 'wamid.M1', type: 'text', text: { body: 'Stop, ne plus me contacter' } }],
    } }] }] });
    const sig = 'sha256=' + createHmac('sha256', 'appsecret_test').update(body).digest('hex');
    r = await fetch(`${base}/webhooks/meta`, { method: 'POST', body, headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig } });
    assert.equal(r.status, 200);
    const c = crm.getContact('+33688888888');
    assert.equal(c.status, 'ne_plus_contacter');
    const list = await (await fetch(`${base}/api/contacts?section=ne_plus_contacter`)).json();
    assert.equal(list.length, 1);
  });
});

test('API : recherche par nom, numéro, catégorie et statut ; tableau de bord servi', async () => {
  await withServer(async ({ base, crm }) => {
    crm.upsertContact({ phone: '0612345678', first_name: 'Léa', last_name: 'Martin', category: 'client' });
    crm.upsertContact({ phone: '0698765432', first_name: 'Paul', category: 'partenaire' });
    const q = async (p) => (await (await fetch(`${base}/api/contacts?${new URLSearchParams(p)}`)).json()).map((c) => c.first_name);
    assert.deepEqual(await q({ q: 'martin' }), ['Léa']);
    assert.deepEqual(await q({ q: '06 98 76' }), ['Paul']);
    assert.deepEqual(await q({ category: 'client' }), ['Léa']);
    assert.deepEqual(await q({ status: 'a_contacter' }).then((x) => x.sort()), ['Léa', 'Paul']);
    assert.deepEqual(await q({ section: 'partenaires' }), ['Paul']);
    const html = await (await fetch(base + '/')).text();
    assert.match(html, /Assistant WhatsApp/);
    const stats = await (await fetch(base + '/api/stats')).json();
    assert.equal(stats.total, 2);
    // Requête forgée sans JSON refusée.
    const forged = await fetch(`${base}/api/contacts/1/status`, { method: 'POST', body: 'status=ne_plus_contacter', headers: { 'content-type': 'text/plain' } });
    assert.equal(forged.status, 415);
  });
});

test('jeton du tableau de bord', async () => {
  await withServer(async ({ base }) => {
    assert.equal((await fetch(base + '/api/stats')).status, 401);
    assert.equal((await fetch(base + '/api/stats', { headers: { 'x-dashboard-token': 'secret123' } })).status, 200);
    assert.equal((await fetch(base + '/health')).status, 200);
  }, { dashboardToken: 'secret123' });
});
