// Toutes les règles qui protègent le numéro et les personnes, en un seul endroit.
// canSend() est appelé avant CHAQUE envoi ; un refus est journalisé sur la fiche.
import { getSetting } from './db.js';

const DAY = 86_400_000;

// Frontières de mot compatibles avec les accents (\b de JavaScript ignore « é »).
const W = (src) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${src})(?![\\p{L}\\p{N}])`, 'iu');

// Demandes d'arrêt. On préfère un faux positif (on arrête d'écrire à quelqu'un
// qui ne le demandait pas) à un faux négatif (on relance quelqu'un qui a dit stop).
const OPT_OUT_PATTERNS = [
  /^\s*(stop|arr[eê]t|arr[eê]ter|arr[eê]tez|unsubscribe|d[ée]sabonnez|d[ée]sinscri\p{L}*)(?![\p{L}])/iu,
  W("ne (?:plus )?m['’ ]?(?:é|e)cri(?:vez|s|re) plus|ne plus (?:me )?contacter|ne me contactez plus|ne m['’ ]?envoyez plus|retire[zr]?[- ]moi|supprime[zr]?[- ]moi|d[ée]sinscri(?:vez|s)[- ]moi|plus de messages?|laissez[- ]moi tranquille"),
  /(?:^|\s)(stop|unsubscribe|opt[- ]?out)\s*[.!]*\s*$/iu,
];

const INTEREST_PATTERNS = [
  W("int[ée]ress[ée]e?s?|je suis partante?|ok pour|avec plaisir|volontiers|on peut (?:en )?(?:parler|discuter|s'appeler)|appelez[- ]moi|rappelez[- ]moi|m['’]appeler|quand (?:êtes|etes)[- ]vous dispo\\p{L}*|un devis|vos tarifs|combien|rendez[- ]vous|rdv"),
];

const NEGATIVE_INTEREST = W("pas int[ée]ress\\p{L}*|non merci|pas pour (?:le )?moment|pas besoin");

export function detectOptOut(text) {
  if (!text) return false;
  return OPT_OUT_PATTERNS.some((r) => r.test(text));
}

export function detectInterest(text) {
  if (!text || NEGATIVE_INTEREST.test(text)) return false;
  return INTEREST_PATTERNS.some((r) => r.test(text));
}

export function inServiceWindow(contact, now = Date.now()) {
  if (!contact.last_inbound_at) return false;
  return now - Date.parse(contact.last_inbound_at) < DAY;
}

export function isSuppressed(db, phone) {
  return !!db.prepare('SELECT 1 FROM suppression WHERE phone = ?').get(phone);
}

function businessInitiatedToday(db, now) {
  const since = new Date(now - DAY).toISOString();
  // Contacts distincts touchés hors fenêtre de service sur 24 h glissantes.
  return db.prepare(`SELECT COUNT(DISTINCT contact_id) AS n FROM messages
    WHERE direction = 'sortant' AND template_name IS NOT NULL AND status != 'echec' AND created_at >= ?`).get(since).n;
}

function hourIn(tz, now) {
  // formatToParts : en français, format() renvoie « 23 h », que Number() lit comme NaN.
  const part = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).formatToParts(now).find((p) => p.type === 'hour');
  return Number(part.value);
}

/**
 * @param {object} p
 * @param {'manuel'|'campagne'|'relance'|'automatique'} p.origin
 * @param {boolean} p.hasTemplate  le message est un modèle approuvé par Meta
 * @returns {{ok: true, windowOpen: boolean} | {ok: false, reason: string}}
 */
export function canSend(db, cfg, contact, { origin, hasTemplate, templateName }, now = Date.now()) {
  if (isSuppressed(db, contact.phone)) return { ok: false, reason: 'Numéro dans la liste de suppression permanente.' };
  if (contact.status === 'ne_plus_contacter' || contact.consent === 'opt_out') {
    return { ok: false, reason: 'Le contact a demandé à ne plus être contacté.' };
  }

  const quality = getSetting(db, 'quality', null);
  const automatic = origin !== 'manuel';
  if (automatic && getSetting(db, 'auto_paused', false)) {
    return { ok: false, reason: `Envois automatiques en pause : ${getSetting(db, 'auto_paused_reason', 'qualité du numéro')}.` };
  }
  if (automatic && quality?.rating === 'RED') return { ok: false, reason: 'Qualité du numéro ROUGE : envois automatiques suspendus.' };

  const windowOpen = inServiceWindow(contact, now);
  if (!windowOpen) {
    // Hors fenêtre de 24 h, WhatsApp n'accepte qu'un modèle approuvé, et seulement
    // vers une personne qui a donné son accord.
    if (!hasTemplate) {
      return { ok: false, reason: 'Hors fenêtre de 24 h : un modèle approuvé par Meta est obligatoire (texte libre refusé par WhatsApp, erreur 131047).' };
    }
    if (contact.consent !== 'opt_in') {
      return { ok: false, reason: 'Aucun consentement enregistré : pas de message à l’initiative de l’entreprise.' };
    }
    if (businessInitiatedToday(db, now) >= cfg.maxBusinessInitiatedPerDay) {
      return { ok: false, reason: `Plafond quotidien atteint (${cfg.maxBusinessInitiatedPerDay} contacts/24 h).` };
    }
    if (contact.last_outbound_at && automatic) {
      const gapDays = (now - Date.parse(contact.last_outbound_at)) / DAY;
      if (gapDays < cfg.minDaysBetweenBusinessMessages) {
        return { ok: false, reason: `Dernier message il y a ${gapDays.toFixed(1)} j : minimum ${cfg.minDaysBetweenBusinessMessages} j entre deux messages.` };
      }
    }
  }

  if (automatic) {
    const h = hourIn(cfg.timezone, now);
    if (h < cfg.quietHours.start || h >= cfg.quietHours.end) {
      return { ok: false, reason: `En dehors des heures d’envoi (${cfg.quietHours.start} h–${cfg.quietHours.end} h).` };
    }
    if (hasTemplate && origin === 'automatique' && !cfg.autoTemplates.includes(templateName)) {
      return { ok: false, reason: `Le modèle « ${templateName} » n’est pas autorisé en mode automatique (AUTO_TEMPLATES).` };
    }
  }
  return { ok: true, windowOpen };
}
