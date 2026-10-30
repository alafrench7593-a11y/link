// Contrat avec le SDK officiel Kapso : on intercepte fetch pour vérifier la
// requête exacte qui partirait vers Kapso ou Meta (URL, en-têtes, corps).
// Cela ne remplace pas un test avec une vraie clé : voir docs/TESTS.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransport } from '../src/transport.js';

function spyFetch(reply) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fn, calls };
}

const ok = { messaging_product: 'whatsapp', contacts: [{ input: '+33612345678', wa_id: '33612345678' }], messages: [{ id: 'wamid.REAL' }] };

test('Kapso : proxy api.kapso.ai, clé X-API-Key, charge utile Cloud API', async () => {
  const spy = spyFetch(ok);
  const t = createTransport({ provider: 'kapso', kapsoApiKey: 'kapso_key', kapsoBaseUrl: 'https://api.kapso.ai', graphVersion: 'v24.0', phoneNumberId: '1234567890' }, { fetchImpl: spy.fn });
  const r = await t.sendText('+33612345678', 'Bonjour Léa');
  assert.equal(r.wamid, 'wamid.REAL');
  const { url, init } = spy.calls[0];
  assert.equal(url, 'https://api.kapso.ai/meta/whatsapp/v24.0/1234567890/messages');
  const headers = new Headers(init.headers);
  assert.equal(headers.get('x-api-key'), 'kapso_key');
  const body = JSON.parse(init.body);
  assert.equal(body.messaging_product, 'whatsapp');
  assert.equal(body.to, '+33612345678');
  assert.equal(body.type, 'text');
  assert.equal(body.text.body, 'Bonjour Léa');
});

test('Kapso : modèle avec paramètres', async () => {
  const spy = spyFetch(ok);
  const t = createTransport({ provider: 'kapso', kapsoApiKey: 'k', kapsoBaseUrl: 'https://api.kapso.ai', graphVersion: 'v24.0', phoneNumberId: '1' }, { fetchImpl: spy.fn });
  await t.sendTemplate('+33612345678', 'relance_douce', 'fr', ['Léa']);
  const body = JSON.parse(spy.calls[0].init.body);
  assert.equal(body.type, 'template');
  assert.equal(body.template.name, 'relance_douce');
  assert.equal(body.template.language.code, 'fr');
  assert.deepEqual(body.template.components[0].parameters, [{ type: 'text', text: 'Léa' }]);
});

test('Meta direct : graph.facebook.com et jeton Bearer', async () => {
  const spy = spyFetch(ok);
  const t = createTransport({ provider: 'meta', metaAccessToken: 'EAAG', graphVersion: 'v24.0', phoneNumberId: '99' }, { fetchImpl: spy.fn });
  await t.sendText('+33612345678', 'x');
  assert.match(spy.calls[0].url, /^https:\/\/graph\.facebook\.com\/v24\.0\/99\/messages$/);
  assert.equal(new Headers(spy.calls[0].init.headers).get('authorization'), 'Bearer EAAG');
});

test('qualité du numéro : bons champs demandés', async () => {
  const spy = spyFetch({ quality_rating: 'GREEN', messaging_limit_tier: 'TIER_250' });
  const t = createTransport({ provider: 'kapso', kapsoApiKey: 'k', kapsoBaseUrl: 'https://api.kapso.ai', graphVersion: 'v24.0', phoneNumberId: '1' }, { fetchImpl: spy.fn });
  const q = await t.quality();
  assert.equal(q.quality_rating ?? q.qualityRating, 'GREEN');
  assert.match(spy.calls[0].url, /fields=.*quality_rating/);
});

test('simulation : marqué comme tel, rien ne sort', async () => {
  const t = createTransport({ provider: 'simulation' });
  assert.equal(t.simulated, true);
  assert.match((await t.sendText('+33', 'x')).wamid, /^sim\./);
});
