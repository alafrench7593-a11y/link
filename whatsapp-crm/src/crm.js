// Cœur du système. Règle centrale : tout message sortant, qu'il parte d'ici
// (manuel, campagne, relance) ou d'ailleurs (boîte Kapso, autre outil, vu par
// webhook), passe par recordOutbound() et laisse une fiche et une ligne
// d'historique. Il n'existe pas d'autre chemin d'écriture dans `messages`.
import { tx, getSetting, setSetting } from './db.js';
import { normalizePhone } from './phone.js';
import { STATUSES, CATEGORIES, SECTIONS, statusAfterOutbound, statusAfterDelivery, statusAfterInbound } from './statuses.js';
import { canSend, detectOptOut, detectInterest, isSuppressed } from './compliance.js';
import { MISSING } from './personalize.js';

const DAY = 86_400_000;
const iso = (t = Date.now()) => new Date(t).toISOString();

export class Crm {
  constructor({ db, cfg, transport, clock = () => Date.now() }) {
    this.db = db;
    this.cfg = cfg;
    this.transport = transport;
    this.now = clock;
  }

  // ---------- Fiches ----------

  log(contactId, type, detail) {
    this.db.prepare('INSERT INTO history(contact_id, type, detail, at) VALUES (?, ?, ?, ?)')
      .run(contactId, type, typeof detail === 'string' ? detail : JSON.stringify(detail ?? null), iso(this.now()));
  }

  error(scope, message, contactId = null) {
    this.db.prepare('INSERT INTO errors(scope, message, contact_id, at) VALUES (?, ?, ?, ?)')
      .run(scope, String(message).slice(0, 1000), contactId, iso(this.now()));
  }

  getContact(idOrPhone) {
    if (typeof idOrPhone === 'number' || /^\d+$/.test(String(idOrPhone))) {
      const byId = this.db.prepare('SELECT * FROM contacts WHERE id = ?').get(Number(idOrPhone));
      if (byId) return byId;
    }
    const phone = normalizePhone(idOrPhone, this.cfg.defaultCountry);
    return phone ? this.db.prepare('SELECT * FROM contacts WHERE phone = ?').get(phone) : undefined;
  }

  /** Crée la fiche ou complète celle qui existe. Jamais de doublon (UNIQUE sur phone). */
  upsertContact(input, { origin = 'manuel' } = {}) {
    const phone = normalizePhone(input.phone, this.cfg.defaultCountry);
    if (!phone) throw new Error(`Numéro invalide : ${input.phone}`);
    if (input.category && !CATEGORIES.includes(input.category)) throw new Error(`Catégorie inconnue : ${input.category}`);
    const now = iso(this.now());
    const existing = this.db.prepare('SELECT * FROM contacts WHERE phone = ?').get(phone);
    const fields = ['first_name', 'last_name', 'company', 'category', 'source', 'notes'];
    if (!existing) {
      const r = this.db.prepare(`INSERT INTO contacts(phone, first_name, last_name, company, category, source, notes, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        phone, input.first_name || null, input.last_name || null, input.company || null,
        input.category || 'prospect', input.source || origin, input.notes || null,
        isSuppressed(this.db, phone) ? 'ne_plus_contacter' : (input.status || 'a_contacter'), now, now);
      const id = Number(r.lastInsertRowid);
      this.log(id, 'fiche_creee', { origine: origin, source: input.source || origin });
      if (input.consent) this.setConsent(id, input.consent, { scope: input.consent_scope, source: input.consent_source || input.source });
      return this.getContact(id);
    }
    const changes = {};
    for (const f of fields) {
      if (input[f] && input[f] !== existing[f]) changes[f] = input[f];
    }
    if (Object.keys(changes).length) {
      const sets = Object.keys(changes).map((k) => `${k} = ?`).join(', ');
      this.db.prepare(`UPDATE contacts SET ${sets}, updated_at = ? WHERE id = ?`).run(...Object.values(changes), now, existing.id);
      this.log(existing.id, 'fiche_mise_a_jour', changes);
    }
    if (input.consent && input.consent !== existing.consent) {
      this.setConsent(existing.id, input.consent, { scope: input.consent_scope, source: input.consent_source || input.source });
    }
    return this.getContact(existing.id);
  }

  setConsent(contactId, consent, { scope, source } = {}) {
    if (!['opt_in', 'opt_out', 'inconnu'].includes(consent)) throw new Error(`Consentement invalide : ${consent}`);
    if (consent === 'opt_in' && !source) throw new Error('Un consentement doit avoir une preuve (consent_source : formulaire, contrat, message…).');
    const c = this.getContact(contactId);
    if (consent === 'opt_in' && isSuppressed(this.db, c.phone)) {
      throw new Error('Ce numéro est dans la liste de suppression : seul un nouvel accord écrit de la personne, retiré manuellement de la liste, peut le réactiver.');
    }
    this.db.prepare('UPDATE contacts SET consent = ?, consent_scope = ?, consent_source = ?, consent_at = ?, updated_at = ? WHERE id = ?')
      .run(consent, scope || null, source || null, iso(this.now()), iso(this.now()), contactId);
    this.log(contactId, 'consentement', { consent, scope, source });
    if (consent === 'opt_out') this.suppress(c.phone, source || 'retrait du consentement');
  }

  setStatus(contactId, status, reason = 'manuel') {
    if (!STATUSES[status]) throw new Error(`Statut inconnu : ${status}`);
    const c = this.getContact(contactId);
    if (!c) throw new Error('Contact introuvable');
    if (c.status === status) return c;
    const stopFollowups = ['reponse_recue', 'interesse', 'client', 'partenaire', 'ne_plus_contacter'].includes(status);
    this.db.prepare(`UPDATE contacts SET status = ?, ${stopFollowups ? 'next_followup_at = NULL,' : ''} updated_at = ? WHERE id = ?`)
      .run(status, iso(this.now()), c.id);
    this.log(c.id, 'statut', { de: c.status, vers: status, raison: reason });
    if (stopFollowups && c.next_followup_at) this.log(c.id, 'relances_interrompues', `statut ${STATUSES[status]}`);
    if (status === 'ne_plus_contacter') {
      this.suppress(c.phone, reason);
      this.cancelDrafts(c.id, 'Contact en « Ne plus contacter »');
    }
    return this.getContact(c.id);
  }

  suppress(phone, reason) {
    const now = iso(this.now());
    this.db.prepare('INSERT INTO suppression(phone, reason, at) VALUES (?, ?, ?) ON CONFLICT(phone) DO NOTHING').run(phone, reason, now);
    const c = this.db.prepare('SELECT * FROM contacts WHERE phone = ?').get(phone);
    if (c && c.status !== 'ne_plus_contacter') {
      this.db.prepare("UPDATE contacts SET status = 'ne_plus_contacter', consent = 'opt_out', next_followup_at = NULL, updated_at = ? WHERE id = ?").run(now, c.id);
      this.log(c.id, 'statut', { de: c.status, vers: 'ne_plus_contacter', raison: reason });
      this.log(c.id, 'liste_suppression', reason);
      this.cancelDrafts(c.id, 'Contact en « Ne plus contacter »');
    }
  }

  cancelDrafts(contactId, reason) {
    this.db.prepare("UPDATE drafts SET status = 'bloque', block_reason = ?, updated_at = ? WHERE contact_id = ? AND status IN ('a_valider','approuve')")
      .run(reason, iso(this.now()), contactId);
  }

  // ---------- Envoi ----------

  /**
   * Envoie un message et l'enregistre. Refuse si une règle de conformité bloque.
   * @param {object} p
   * @param {number|string} p.contact   id ou numéro (la fiche est créée si besoin)
   * @param {string} [p.body]           texte libre (seulement dans la fenêtre de 24 h)
   * @param {{name: string, lang?: string, params?: string[]}} [p.template]
   * @param {'premier_contact'|'relance'|'reprise'|'reponse'|'campagne'|'manuel'} [p.kind]
   * @param {'manuel'|'campagne'|'automatique'} [p.origin]
   */
  async sendMessage({ contact, body, template, kind = 'manuel', origin = 'manuel', contactInput, draftId }) {
    let c = typeof contact === 'object' && contact ? contact : this.getContact(contact);
    if (!c && (contactInput || typeof contact === 'string')) c = this.upsertContact(contactInput || { phone: contact }, { origin });
    if (!c) throw new Error('Contact introuvable');
    c = this.getContact(c.id);

    const check = canSend(this.db, this.cfg, c, { origin, hasTemplate: !!template, templateName: template?.name }, this.now());
    if (!check.ok) {
      this.log(c.id, 'envoi_bloque', { raison: check.reason, kind, origin });
      if (draftId) this.db.prepare("UPDATE drafts SET status = 'bloque', block_reason = ?, updated_at = ? WHERE id = ?").run(check.reason, iso(this.now()), draftId);
      return { ok: false, reason: check.reason, contact: c };
    }
    // Dans la fenêtre de 24 h, on préfère le texte libre personnalisé.
    const useTemplate = template && !(check.windowOpen && body);
    if (!useTemplate && !body) throw new Error('Message vide');
    if (!useTemplate && body.includes(MISSING)) {
      const reason = 'Le message contient encore un passage « [à compléter …] ».';
      this.log(c.id, 'envoi_bloque', { raison: reason, kind, origin });
      return { ok: false, reason, contact: c };
    }

    let wamid;
    try {
      const res = useTemplate
        ? await this.transport.sendTemplate(c.phone, template.name, template.lang || this.cfg.templateLang, template.params || [])
        : await this.transport.sendText(c.phone, body);
      wamid = res.wamid;
    } catch (err) {
      const msg = err?.message || String(err);
      tx(this.db, () => {
        this.insertMessage(c.id, { direction: 'sortant', wamid: null, body: useTemplate ? null : body, template: useTemplate ? template.name : null, origin: kind, status: 'echec', error: msg });
        this.log(c.id, 'envoi_echec', { erreur: msg, kind });
        if (draftId) this.db.prepare("UPDATE drafts SET status = 'bloque', block_reason = ?, updated_at = ? WHERE id = ?").run(msg, iso(this.now()), draftId);
      });
      this.error('envoi', msg, c.id);
      this.watchFailures();
      return { ok: false, reason: msg, contact: c };
    }

    // On enregistre ce qui est réellement parti, pas le brouillon.
    const text = useTemplate ? renderTemplatePreview(template) : body;
    tx(this.db, () => {
      this.recordOutbound(c, { wamid, body: text, template: useTemplate ? template.name : null, kind, simulated: this.transport.simulated });
      if (draftId) this.db.prepare("UPDATE drafts SET status = 'envoye', updated_at = ? WHERE id = ?").run(iso(this.now()), draftId);
    });
    return { ok: true, wamid, simulated: !!this.transport.simulated, contact: this.getContact(c.id) };
  }

  insertMessage(contactId, { direction, wamid, body, template, origin, status, error }) {
    const now = iso(this.now());
    this.db.prepare(`INSERT INTO messages(contact_id, direction, wamid, body, template_name, origin, status, error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(contactId, direction, wamid, body, template, origin, status, error || null, now, now);
  }

  /** Enregistre un message sortant sur la fiche : la seule porte d'entrée. */
  recordOutbound(c, { wamid, body, template, kind, simulated = false, external = false }) {
    if (wamid && this.db.prepare('SELECT 1 FROM messages WHERE wamid = ?').get(wamid)) return; // déjà connu
    const now = this.now();
    this.insertMessage(c.id, { direction: 'sortant', wamid, body, template, origin: external ? 'externe' : kind, status: simulated ? 'simule' : 'accepte' });

    const status = statusAfterOutbound(c.status);
    // Une relance fait avancer le compteur ; un nouveau premier contact repart de zéro.
    let step = c.followup_step;
    if (kind === 'relance') step += 1;
    else if (['premier_contact', 'reprise', 'campagne'].includes(kind)) step = 0;
    const delays = this.cfg.followupDelaysDays;
    // Pas de relance automatique après une réponse de notre part dans une conversation en cours.
    const schedule = status === 'message_envoye' && kind !== 'reponse' && !external && step < delays.length;
    const next = schedule ? iso(now + delays[step] * DAY) : null;

    this.db.prepare(`UPDATE contacts SET
        first_contacted_at = COALESCE(first_contacted_at, ?),
        last_outbound_at = ?, last_outbound_text = ?,
        messages_sent = messages_sent + 1,
        status = ?, followup_step = ?, next_followup_at = ?, updated_at = ?
      WHERE id = ?`).run(iso(now), iso(now), body, status, step, next, iso(now), c.id);

    // Une réponse partie (d'ici ou d'ailleurs) clôt les actions « répondre » en attente.
    this.db.prepare("UPDATE drafts SET status = 'traite', block_reason = 'Réponse déjà envoyée', updated_at = ? WHERE contact_id = ? AND kind = 'reponse' AND status = 'a_valider' AND body IS NULL")
      .run(iso(now), c.id);
    if (!c.first_contacted_at) this.log(c.id, 'ajoute_contacts_contactes', { premier_message: iso(now) });
    this.log(c.id, 'message_envoye', { kind, origine: external ? 'externe' : kind, modele: template || undefined, wamid, simule: simulated || undefined, texte: body });
    if (status !== c.status) this.log(c.id, 'statut', { de: c.status, vers: status, raison: 'message envoyé' });
    if (next) this.log(c.id, 'relance_programmee', { le: next, etape: step + 1 });
  }

  // ---------- Événements WhatsApp (webhooks) ----------

  recordInbound({ phone, wamid, text, name }) {
    const p = normalizePhone(phone, this.cfg.defaultCountry);
    if (!p) throw new Error(`Numéro entrant invalide : ${phone}`);
    if (wamid && this.db.prepare('SELECT 1 FROM messages WHERE wamid = ?').get(wamid)) return { duplicate: true };
    return tx(this.db, () => {
      let c = this.db.prepare('SELECT * FROM contacts WHERE phone = ?').get(p);
      if (!c) {
        const [first, ...rest] = (name || '').split(' ');
        c = this.upsertContact({ phone: p, first_name: first || null, last_name: rest.join(' ') || null, source: 'message entrant WhatsApp' }, { origin: 'entrant' });
      }
      const now = iso(this.now());
      this.insertMessage(c.id, { direction: 'entrant', wamid, body: text, template: null, origin: 'entrant', status: 'recu' });
      this.db.prepare(`UPDATE contacts SET last_inbound_at = ?, last_inbound_text = ?, replies_received = replies_received + 1,
        next_followup_at = NULL, updated_at = ? WHERE id = ?`).run(now, text, now, c.id);
      this.log(c.id, 'reponse_recue', { texte: text, wamid });
      if (c.next_followup_at) this.log(c.id, 'relances_interrompues', 'réponse reçue');
      this.db.prepare("UPDATE drafts SET status = 'bloque', block_reason = 'Réponse reçue : relance annulée', updated_at = ? WHERE contact_id = ? AND kind = 'relance' AND status IN ('a_valider','approuve')")
        .run(now, c.id);

      if (detectOptOut(text)) {
        this.suppress(c.phone, `demande d’arrêt : « ${String(text).slice(0, 80)} »`);
        return { contact: this.getContact(c.id), optOut: true };
      }
      const next = statusAfterInbound(c.status);
      if (next !== c.status) {
        this.db.prepare('UPDATE contacts SET status = ? WHERE id = ?').run(next, c.id);
        this.log(c.id, 'statut', { de: c.status, vers: next, raison: 'réponse reçue' });
      }
      let interested = false;
      if (detectInterest(text) && next === 'reponse_recue') {
        interested = true;
        this.db.prepare("UPDATE contacts SET status = 'interesse' WHERE id = ?").run(c.id);
        this.log(c.id, 'statut', { de: next, vers: 'interesse', raison: 'intérêt détecté dans la réponse (à confirmer)' });
        this.createDraft(c.id, { kind: 'reponse', body: null, note: 'Action de suivi : la personne semble intéressée, répondre sous 24 h.' });
      }
      return { contact: this.getContact(c.id), interested };
    });
  }

  /** Statut d'un message (sent / delivered / read / failed). */
  recordStatus({ wamid, status, error, recipient, body, external }) {
    const map = { sent: 'envoye', delivered: 'distribue', read: 'lu', failed: 'echec' };
    const s = map[status] || status;
    let m = wamid ? this.db.prepare('SELECT * FROM messages WHERE wamid = ?').get(wamid) : null;
    if (!m) {
      // Message parti hors du système (boîte Kapso, autre appareil, autre outil) :
      // on crée quand même la fiche et la ligne d'historique.
      if (!recipient || s === 'echec') return { unknown: true };
      const p = normalizePhone(recipient, this.cfg.defaultCountry);
      if (!p) return { unknown: true };
      tx(this.db, () => {
        let c = this.db.prepare('SELECT * FROM contacts WHERE phone = ?').get(p) || this.upsertContact({ phone: p, source: 'envoi hors système (webhook)' }, { origin: 'externe' });
        this.recordOutbound(c, { wamid, body: body ?? '(contenu envoyé hors du système, non transmis par WhatsApp)', template: null, kind: 'manuel', external: true });
      });
      m = this.db.prepare('SELECT * FROM messages WHERE wamid = ?').get(wamid);
      if (!m) return { unknown: true };
    }
    const rank = { simule: 0, accepte: 1, envoye: 2, distribue: 3, lu: 4 };
    if (s !== 'echec' && (rank[s] ?? 0) <= (rank[m.status] ?? 0)) return { ignored: true }; // statuts reçus dans le désordre
    const now = iso(this.now());
    this.db.prepare('UPDATE messages SET status = ?, error = ?, updated_at = ? WHERE id = ?').run(s, error || null, now, m.id);
    const c = this.getContact(m.contact_id);
    if (s === 'echec') {
      this.log(c.id, 'envoi_echec', { wamid, erreur: error });
      this.error('webhook', `Échec de distribution vers ${c.phone} : ${error || 'inconnu'}`, c.id);
      this.watchFailures();
      // Signaux de spam renvoyés par Meta : on coupe l'automatique tout de suite.
      if (/131048|131049|spam|ecosystem/i.test(error || '')) this.pauseAuto(`signal Meta : ${error}`);
    } else if (s === 'distribue' || s === 'lu') {
      const next = statusAfterDelivery(c.status);
      if (next !== c.status) {
        this.db.prepare('UPDATE contacts SET status = ?, updated_at = ? WHERE id = ?').run(next, now, c.id);
        this.log(c.id, 'statut', { de: c.status, vers: next, raison: s === 'lu' ? 'message lu' : 'message distribué' });
      }
    }
    return { ok: true };
  }

  pauseAuto(reason) {
    if (getSetting(this.db, 'auto_paused', false)) return;
    setSetting(this.db, 'auto_paused', true);
    setSetting(this.db, 'auto_paused_reason', reason);
    this.error('protection', `Envois automatiques mis en pause : ${reason}`);
  }

  watchFailures() {
    const last = this.db.prepare("SELECT status FROM messages WHERE direction = 'sortant' ORDER BY id DESC LIMIT 40").all();
    if (last.length < 20) return;
    const failed = last.filter((m) => m.status === 'echec').length;
    if (failed / last.length > 0.15) this.pauseAuto(`${failed} échecs sur les ${last.length} derniers envois`);
  }

  // ---------- Brouillons (mode validation) ----------

  createDraft(contactId, { kind, body, variants = [], template, campaignId = null, note }) {
    const now = iso(this.now());
    const r = this.db.prepare(`INSERT INTO drafts(contact_id, kind, campaign_id, body, variants, template_name, template_lang, template_params, status, block_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'a_valider', ?, ?, ?)`).run(
      contactId, kind, campaignId, body, JSON.stringify(variants), template?.name || null, template?.lang || null,
      JSON.stringify(template?.params || []), note || null, now, now);
    const id = Number(r.lastInsertRowid);
    this.log(contactId, 'brouillon_prepare', { id, kind, note });
    return id;
  }

  async approveDraft(draftId, { body, origin = 'manuel' } = {}) {
    const d = this.db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId);
    if (!d) throw new Error('Brouillon introuvable');
    if (!['a_valider', 'approuve'].includes(d.status)) throw new Error(`Brouillon déjà ${d.status}`);
    if (d.campaign_id) {
      const camp = this.db.prepare('SELECT status FROM campaigns WHERE id = ?').get(d.campaign_id);
      if (camp.status !== 'validee') throw new Error('La campagne doit être validée avant tout envoi.');
    }
    const text = body ?? d.body;
    if (body && body !== d.body) this.db.prepare('UPDATE drafts SET body = ? WHERE id = ?').run(body, d.id);
    this.db.prepare("UPDATE drafts SET status = 'approuve', updated_at = ? WHERE id = ?").run(iso(this.now()), d.id);
    const template = d.template_name ? { name: d.template_name, lang: d.template_lang, params: JSON.parse(d.template_params || '[]') } : undefined;
    return this.sendMessage({ contact: d.contact_id, body: text, template, kind: d.kind, origin, draftId: d.id });
  }

  rejectDraft(draftId, reason = 'rejeté') {
    const d = this.db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId);
    if (!d) throw new Error('Brouillon introuvable');
    this.db.prepare("UPDATE drafts SET status = 'rejete', block_reason = ?, updated_at = ? WHERE id = ?").run(reason, iso(this.now()), d.id);
    this.log(d.contact_id, 'brouillon_rejete', { id: d.id, raison: reason });
  }

  // ---------- Lecture ----------

  listContacts({ section = 'tous', q, category, status, limit = 200 } = {}) {
    const sec = SECTIONS[section] || SECTIONS.tous;
    const where = [`(${sec.where})`];
    const args = [];
    if (q) {
      const like = `%${q.trim().toLowerCase()}%`;
      const digits = q.replace(/\D/g, '');
      where.push(`(lower(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) LIKE ? OR lower(coalesce(company,'')) LIKE ?${digits ? ' OR phone LIKE ?' : ''})`);
      args.push(like, like);
      if (digits) args.push(`%${digits.replace(/^0/, '')}%`);
    }
    if (category) { where.push('category = ?'); args.push(category); }
    if (status) { where.push('status = ?'); args.push(status); }
    return this.db.prepare(`SELECT * FROM contacts WHERE ${where.join(' AND ')}
      ORDER BY COALESCE(last_inbound_at, last_outbound_at, updated_at) DESC LIMIT ?`).all(...args, limit);
  }

  contactSheet(id) {
    const c = this.getContact(id);
    if (!c) return null;
    return {
      contact: c,
      suppressed: isSuppressed(this.db, c.phone),
      messages: this.db.prepare('SELECT * FROM messages WHERE contact_id = ? ORDER BY id').all(c.id),
      history: this.db.prepare('SELECT * FROM history WHERE contact_id = ? ORDER BY id').all(c.id),
      drafts: this.db.prepare('SELECT * FROM drafts WHERE contact_id = ? ORDER BY id DESC').all(c.id),
    };
  }

  stats() {
    const one = (sql, ...a) => this.db.prepare(sql).get(...a).n;
    const counts = {};
    for (const [k, s] of Object.entries(SECTIONS)) counts[k] = one(`SELECT COUNT(*) AS n FROM contacts WHERE ${s.where}`);
    return {
      total: counts.tous,
      contactes: counts.contactes,
      messages_envoyes: one("SELECT COUNT(*) AS n FROM messages WHERE direction = 'sortant' AND status != 'echec'"),
      messages_simules: one("SELECT COUNT(*) AS n FROM messages WHERE status = 'simule'"),
      reponses: one("SELECT COUNT(*) AS n FROM messages WHERE direction = 'entrant'"),
      interesses: counts.interesses,
      relances_en_attente: one("SELECT COUNT(*) AS n FROM contacts WHERE next_followup_at IS NOT NULL") + counts.relances,
      brouillons_a_valider: one("SELECT COUNT(*) AS n FROM drafts WHERE status = 'a_valider'"),
      sections: counts,
      dernieres_conversations: this.db.prepare(`SELECT m.*, c.first_name, c.last_name, c.phone, c.status AS contact_status FROM messages m
        JOIN contacts c ON c.id = m.contact_id ORDER BY m.id DESC LIMIT 12`).all(),
      erreurs: this.db.prepare('SELECT * FROM errors ORDER BY id DESC LIMIT 10').all(),
      mode: getSetting(this.db, 'mode', 'validation'),
      auto_paused: getSetting(this.db, 'auto_paused', false),
      auto_paused_reason: getSetting(this.db, 'auto_paused_reason', null),
      quality: getSetting(this.db, 'quality', null),
      transport: this.transport.name,
    };
  }
}

function renderTemplatePreview(template) {
  const params = (template.params || []).join(' | ');
  return `[modèle ${template.name}${params ? ' : ' + params : ''}]`;
}
