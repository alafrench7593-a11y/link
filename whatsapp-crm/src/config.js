import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function loadConfig(overrides = {}) {
  const envFile = join(ROOT, '.env');
  if (!overrides.skipEnvFile && existsSync(envFile)) process.loadEnvFile(envFile);
  const e = process.env;
  const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
  const cfg = {
    // Transport : kapso | meta | simulation. Sans clé, on reste en simulation :
    // aucun message ne part et chaque envoi est marqué « simule » dans l'historique.
    provider: e.WA_PROVIDER || (e.KAPSO_API_KEY ? 'kapso' : e.META_ACCESS_TOKEN ? 'meta' : 'simulation'),
    kapsoApiKey: e.KAPSO_API_KEY || '',
    kapsoBaseUrl: e.KAPSO_API_BASE_URL || 'https://api.kapso.ai',
    kapsoWebhookSecret: e.KAPSO_WEBHOOK_SECRET || '',
    metaAccessToken: e.META_ACCESS_TOKEN || '',
    metaAppSecret: e.META_APP_SECRET || '',
    metaVerifyToken: e.META_VERIFY_TOKEN || '',
    graphVersion: e.META_GRAPH_VERSION || 'v24.0',
    phoneNumberId: e.WA_PHONE_NUMBER_ID || '',
    defaultCountry: e.DEFAULT_COUNTRY || 'FR',
    timezone: e.TZ_BUSINESS || 'Europe/Paris',

    dbFile: e.DB_FILE || join(ROOT, 'data', 'crm.sqlite'),
    port: num(e.PORT, 3020),
    host: e.HOST || '127.0.0.1',
    dashboardToken: e.DASHBOARD_TOKEN || '',

    // Garde-fous d'envoi
    maxBusinessInitiatedPerDay: num(e.MAX_BUSINESS_INITIATED_PER_DAY, 50),
    followupDelaysDays: (e.FOLLOWUP_DELAYS_DAYS || '3,7').split(',').map(Number).filter((n) => n > 0),
    minDaysBetweenBusinessMessages: num(e.MIN_DAYS_BETWEEN_MESSAGES, 3),
    quietHours: { start: num(e.SEND_HOUR_START, 9), end: num(e.SEND_HOUR_END, 20) },
    // Modèles approuvés par Meta qu'on autorise en mode automatique.
    autoTemplates: (e.AUTO_TEMPLATES || '').split(',').map((s) => s.trim()).filter(Boolean),
    templateLang: e.TEMPLATE_LANG || 'fr',
    // Modèle Meta utilisé pour les relances hors fenêtre de 24 h ({{1}} = prénom).
    followupTemplate: e.FOLLOWUP_TEMPLATE || '',

    anthropicApiKey: e.ANTHROPIC_API_KEY || '',
    anthropicModel: e.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    senderName: e.SENDER_NAME || '',
    senderBusiness: e.SENDER_BUSINESS || '',
    ...overrides,
  };
  return cfg;
}
