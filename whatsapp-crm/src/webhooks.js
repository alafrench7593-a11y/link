// Réception des événements WhatsApp, au format Kapso (v2) ou Meta (brut).
// La signature est vérifiée sur les octets bruts AVANT toute lecture du JSON.
import { createHash } from 'node:crypto';
import { verifyKapsoWebhookSignature, verifySignature } from '@kapso/whatsapp-cloud-api/server';

function alreadySeen(db, key, event) {
  const r = db.prepare('INSERT INTO webhook_events(key, event, received_at) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING')
    .run(key, event, new Date().toISOString());
  return r.changes === 0;
}

function errorText(statuses = []) {
  const e = statuses.flatMap((s) => s.errors || [])[0];
  return e ? `${e.code} ${e.title || ''} ${e.message || e.error_data?.details || ''}`.trim() : undefined;
}

function messageText(m) {
  return m?.kapso?.content ?? m?.text?.body ?? m?.button?.text ?? m?.interactive?.button_reply?.title
    ?? m?.interactive?.list_reply?.title ?? (m?.type ? `[${m.type}]` : '');
}

/** Webhook Kapso : en-têtes X-Webhook-Event / X-Webhook-Signature / X-Idempotency-Key. */
export function handleKapsoWebhook(crm, { rawBody, headers }) {
  const secret = crm.cfg.kapsoWebhookSecret;
  if (!secret) return { status: 503, body: 'KAPSO_WEBHOOK_SECRET non configuré' };
  if (!verifyKapsoWebhookSignature({ secret, rawBody, signatureHeader: headers['x-webhook-signature'] })) {
    return { status: 401, body: 'signature invalide' };
  }
  const key = headers['x-idempotency-key'] || createHash('sha256').update(rawBody).digest('hex');
  const event = headers['x-webhook-event'] || '';
  if (alreadySeen(crm.db, `kapso:${key}`, event)) return { status: 200, body: 'déjà traité' };

  const payload = JSON.parse(rawBody.toString('utf8'));
  const items = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [payload];
  const results = [];
  for (const item of items) {
    try {
      results.push(applyKapsoEvent(crm, item.event || event, item));
    } catch (err) {
      crm.error('webhook', `${event} : ${err.message}`);
      results.push({ error: err.message });
    }
  }
  // Réponse minimale : Kapso n'a pas besoin de recevoir le contenu des fiches.
  return { status: 200, body: JSON.stringify({ traites: results.length, erreurs: results.filter((r) => r?.error).length }) };
}

function applyKapsoEvent(crm, event, p) {
  const m = p.message || {};
  const phone = p.conversation?.phone_number || m.from;
  switch (event) {
    case 'whatsapp.message.received':
      return crm.recordInbound({ phone, wamid: m.id, text: messageText(m), name: p.conversation?.kapso?.contact_name });
    case 'whatsapp.message.sent':
    case 'whatsapp.message.delivered':
    case 'whatsapp.message.read':
    case 'whatsapp.message.failed': {
      const status = event.split('.').pop();
      const recipient = m.kapso?.statuses?.at(-1)?.recipient_id || phone;
      return crm.recordStatus({ wamid: m.id, status, error: errorText(m.kapso?.statuses), recipient, body: messageText(m) });
    }
    default:
      return { ignored: event };
  }
}

/** Vérification de l'abonnement Meta (GET hub.challenge). */
export function verifyMetaSubscription(cfg, query) {
  if (query.get('hub.mode') === 'subscribe' && cfg.metaVerifyToken && query.get('hub.verify_token') === cfg.metaVerifyToken) {
    return { status: 200, body: query.get('hub.challenge') || '' };
  }
  return { status: 403, body: 'jeton de vérification invalide' };
}

/** Webhook Meta brut (Cloud API en direct, ou « Meta webhook » transmis par Kapso). */
export function handleMetaWebhook(crm, { rawBody, headers }) {
  const appSecret = crm.cfg.metaAppSecret;
  if (!appSecret) return { status: 503, body: 'META_APP_SECRET non configuré' };
  if (!verifySignature({ appSecret, rawBody, signatureHeader: headers['x-hub-signature-256'] })) {
    return { status: 401, body: 'signature invalide' };
  }
  const key = headers['x-idempotency-key'] || createHash('sha256').update(rawBody).digest('hex');
  if (alreadySeen(crm.db, `meta:${key}`, 'meta')) return { status: 200, body: 'déjà traité' };
  const payload = JSON.parse(rawBody.toString('utf8'));
  const results = applyMetaPayload(crm, payload);
  return { status: 200, body: JSON.stringify({ traites: results.length, erreurs: results.filter((r) => r?.error).length }) };
}

export function applyMetaPayload(crm, payload) {
  const out = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const v = change.value || {};
      try {
        if (change.field === 'phone_number_quality_update') {
          crm.error('qualite', `Mise à jour qualité Meta : ${JSON.stringify(v)}`);
          if (/FLAGGED|DOWNGRADE|RED/i.test(v.event || '')) crm.pauseAuto(`Meta : ${v.event}`);
          out.push({ quality: v.event });
          continue;
        }
        if (change.field !== 'messages') continue;
        const names = Object.fromEntries((v.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
        for (const m of v.messages || []) {
          out.push(crm.recordInbound({ phone: m.from, wamid: m.id, text: messageText(m), name: names[m.from] }));
        }
        for (const s of v.statuses || []) {
          out.push(crm.recordStatus({ wamid: s.id, status: s.status, error: errorText([s]), recipient: s.recipient_id }));
        }
      } catch (err) {
        crm.error('webhook', `meta ${change.field} : ${err.message}`);
        out.push({ error: err.message });
      }
    }
  }
  return out;
}
