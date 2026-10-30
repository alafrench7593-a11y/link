import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';

export const T0 = Date.parse('2026-10-28T09:00:00Z'); // mercredi, 10 h à Paris
export const DAY = 86_400_000;

// Transport de test : enregistre ce qui « part », peut échouer sur commande.
export function fakeTransport() {
  const sent = [];
  let n = 0;
  return {
    name: 'test', simulated: false, sent, failNext: null,
    async sendText(to, body) { if (this.failNext) { const e = this.failNext; this.failNext = null; throw new Error(e); } sent.push({ to, body }); return { wamid: `wamid.T${++n}` }; },
    async sendTemplate(to, name, lang, params) { if (this.failNext) { const e = this.failNext; this.failNext = null; throw new Error(e); } sent.push({ to, template: name, lang, params }); return { wamid: `wamid.T${++n}` }; },
    async quality() { return { quality_rating: 'GREEN', messaging_limit_tier: 'TIER_250' }; },
  };
}

export function makeApp(overrides = {}) {
  const clock = { t: T0 };
  const transport = fakeTransport();
  const cfg = loadConfig({ skipEnvFile: true, provider: 'test', dbFile: ':memory:', kapsoWebhookSecret: 'whsec_test', metaAppSecret: 'appsecret_test', metaVerifyToken: 'verify_me', anthropicApiKey: '', senderName: 'Alex', senderBusiness: 'Atelier Test', followupTemplate: 'relance_douce', autoTemplates: ['relance_douce'], followupDelaysDays: [3, 7], maxBusinessInitiatedPerDay: 50, ...overrides });
  const app = createApp({ cfg, transport, clock: () => clock.t });
  return { ...app, transport, clock };
}
