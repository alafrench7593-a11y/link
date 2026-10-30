// Scénarios automatiques : relances, reprise d'anciens clients, campagnes.
// En mode validation, tout finit en brouillon à valider. En mode automatique,
// seuls les messages qui passent canSend() avec un modèle autorisé partent.
import { getSetting, setSetting } from './db.js';
import { isFollowupEligible } from './statuses.js';
import { generateVariants } from './personalize.js';
import { SECTIONS } from './statuses.js';

const iso = (t) => new Date(t).toISOString();

export function getMode(db) {
  return getSetting(db, 'mode', 'validation');
}

export function setMode(db, mode, transport) {
  if (!['validation', 'automatique'].includes(mode)) throw new Error('Mode : validation ou automatique');
  if (mode === 'automatique' && transport?.manual) throw new Error('Mode lien : chaque message part de votre WhatsApp, l’envoi automatique est impossible.');
  setSetting(db, 'mode', mode);
  if (mode === 'automatique') { setSetting(db, 'auto_paused', false); setSetting(db, 'auto_paused_reason', null); }
}

function followupTemplate(cfg, contact) {
  const name = cfg.followupTemplate;
  return name ? { name, lang: cfg.templateLang, params: [contact.first_name || 'Bonjour'] } : undefined;
}

/** Passe en revue les relances arrivées à échéance. À lancer toutes les heures. */
export async function runFollowups(crm) {
  const { db, cfg } = crm;
  const now = crm.now();
  const due = db.prepare('SELECT * FROM contacts WHERE next_followup_at IS NOT NULL AND next_followup_at <= ?').all(iso(now));
  const mode = getMode(db);
  const report = { due: due.length, drafts: 0, sent: 0, blocked: 0, skipped: 0 };
  for (const c of due) {
    if (!isFollowupEligible(c.status) || c.last_inbound_at && c.last_inbound_at > c.last_outbound_at) {
      db.prepare('UPDATE contacts SET next_followup_at = NULL WHERE id = ?').run(c.id);
      crm.log(c.id, 'relances_interrompues', `statut ${c.status}`);
      report.skipped++;
      continue;
    }
    db.prepare("UPDATE contacts SET status = 'relance_a_effectuer', next_followup_at = NULL, updated_at = ? WHERE id = ?").run(iso(now), c.id);
    crm.log(c.id, 'statut', { de: c.status, vers: 'relance_a_effectuer', raison: `échéance de relance n° ${c.followup_step + 1}` });
    const history = db.prepare('SELECT * FROM messages WHERE contact_id = ? ORDER BY id').all(c.id);
    const fresh = crm.getContact(c.id);
    const { variants } = await generateVariants({ contact: fresh, kind: 'relance', cfg, history, pitch: getSetting(db, 'pitch', '') });
    const template = followupTemplate(cfg, fresh);
    const draftId = crm.createDraft(c.id, {
      kind: 'relance', body: variants[0], variants: variants.slice(1), template,
      note: template ? null : 'Aucun modèle de relance (FOLLOWUP_TEMPLATE) : hors fenêtre de 24 h, ce texte ne peut partir que si la personne a écrit entre-temps.',
    });
    report.drafts++;
    if (mode === 'automatique' && template) {
      const r = await crm.approveDraft(draftId, { origin: 'automatique' });
      r.ok ? report.sent++ : report.blocked++;
    }
  }
  return report;
}

/** Anciens clients sans échange depuis N jours : propose une reprise de contact (consentement requis). */
export async function prepareReactivation(crm, { days = 180 } = {}) {
  const { db, cfg } = crm;
  const limit = iso(crm.now() - days * 86_400_000);
  const rows = db.prepare(`SELECT * FROM contacts WHERE category = 'client' AND consent = 'opt_in' AND status != 'ne_plus_contacter'
    AND COALESCE(last_inbound_at, last_outbound_at, created_at) < ?
    AND NOT EXISTS (SELECT 1 FROM drafts d WHERE d.contact_id = contacts.id AND d.status = 'a_valider')`).all(limit);
  const ids = [];
  for (const c of rows) {
    const history = db.prepare('SELECT * FROM messages WHERE contact_id = ? ORDER BY id').all(c.id);
    const { variants } = await generateVariants({ contact: c, kind: 'reprise', cfg, history, pitch: getSetting(db, 'pitch', '') });
    ids.push(crm.createDraft(c.id, { kind: 'reprise', body: variants[0], variants: variants.slice(1), template: followupTemplate(cfg, c) }));
  }
  return ids;
}

/**
 * Prépare une campagne : un brouillon personnalisé par destinataire autorisé.
 * Rien ne part avant approveCampaign(). Les contacts sans consentement sont écartés.
 */
export async function createCampaign(crm, { name, section = 'a_contacter', category, template, kind = 'premier_contact' }) {
  const { db, cfg } = crm;
  const now = iso(crm.now());
  const where = [`(${(SECTIONS[section] || SECTIONS.a_contacter).where})`, "status != 'ne_plus_contacter'"];
  const args = [];
  if (category) { where.push('category = ?'); args.push(category); }
  const all = db.prepare(`SELECT * FROM contacts WHERE ${where.join(' AND ')}`).all(...args);
  const eligible = all.filter((c) => c.consent === 'opt_in');
  const r = db.prepare("INSERT INTO campaigns(name, filter, status, created_at) VALUES (?, ?, 'a_valider', ?)")
    .run(name, JSON.stringify({ section, category, template: template?.name }), now);
  const campaignId = Number(r.lastInsertRowid);
  for (const c of eligible) {
    const history = db.prepare('SELECT * FROM messages WHERE contact_id = ? ORDER BY id').all(c.id);
    const { variants } = await generateVariants({ contact: c, kind, cfg, history, pitch: getSetting(db, 'pitch', '') });
    const params = template ? [c.first_name || 'Bonjour'] : undefined;
    crm.createDraft(c.id, { kind: 'campagne', campaignId, body: variants[0], variants: variants.slice(1), template: template && { ...template, params } });
  }
  return { campaignId, recipients: eligible.length, excludedNoConsent: all.length - eligible.length };
}

export async function approveCampaign(crm, campaignId) {
  const { db } = crm;
  const camp = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!camp) throw new Error('Campagne introuvable');
  db.prepare("UPDATE campaigns SET status = 'validee', approved_at = ? WHERE id = ?").run(iso(crm.now()), campaignId);
  if (crm.transport.manual) {
    // Mode lien : la campagne est validée, chaque message s'envoie d'un clic dans « À valider ».
    const n = db.prepare("SELECT COUNT(*) AS n FROM drafts WHERE campaign_id = ? AND status = 'a_valider'").get(campaignId).n;
    return { sent: 0, blocked: 0, reasons: {}, manual: n };
  }
  const drafts = db.prepare("SELECT id FROM drafts WHERE campaign_id = ? AND status = 'a_valider'").all(campaignId);
  const report = { sent: 0, blocked: 0, reasons: {} };
  for (const d of drafts) {
    const r = await crm.approveDraft(d.id, { origin: 'campagne' });
    if (r.ok) report.sent++;
    else { report.blocked++; report.reasons[r.reason] = (report.reasons[r.reason] || 0) + 1; }
  }
  db.prepare("UPDATE campaigns SET status = 'terminee' WHERE id = ?").run(campaignId);
  return report;
}

/** Relève la qualité du numéro et met l'automatique en pause si elle se dégrade. */
export async function checkQuality(crm) {
  const q = await crm.transport.quality();
  if (q?.simulated || q?.manual) return q;
  const quality = { rating: q.quality_rating || q.qualityRating, tier: q.messaging_limit_tier || q.messagingLimitTier, name: q.verified_name || q.verifiedName, number: q.display_phone_number || q.displayPhoneNumber, at: new Date(crm.now()).toISOString() };
  setSetting(crm.db, 'quality', quality);
  if (quality.rating === 'RED') crm.pauseAuto('qualité du numéro passée au ROUGE');
  if (quality.rating === 'YELLOW') crm.error('qualite', 'Qualité du numéro JAUNE : ralentir les envois et vérifier les refus.');
  return quality;
}
