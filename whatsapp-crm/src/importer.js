// Import CSV (export Google Contacts, Excel, CRM…). Séparateur , ou ; détecté.
// Une ligne déjà connue (même numéro) complète la fiche au lieu d'en créer une.

const ALIASES = {
  phone: ['phone', 'telephone', 'téléphone', 'numero', 'numéro', 'mobile', 'whatsapp', 'tel', 'phone 1 - value'],
  first_name: ['first_name', 'prenom', 'prénom', 'given name', 'firstname'],
  last_name: ['last_name', 'nom', 'family name', 'lastname', 'nom de famille'],
  company: ['company', 'entreprise', 'societe', 'société', 'organization 1 - name', 'organisation'],
  category: ['category', 'categorie', 'catégorie', 'type'],
  source: ['source', 'origine'],
  notes: ['notes', 'note', 'contexte', 'commentaire'],
  consent: ['consent', 'consentement', 'opt_in', 'optin'],
  consent_source: ['consent_source', 'preuve_consentement', 'preuve', 'preuve consentement'],
};

export function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows.filter((r) => r.some((c) => c.trim()));
  const keys = header.map((h) => {
    const n = h.trim().toLowerCase();
    return Object.entries(ALIASES).find(([, list]) => list.includes(n))?.[0] ?? null;
  });
  return data.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i]?.trim()]).filter(([k, v]) => k && v)));
}

function normConsent(v) {
  if (!v) return undefined;
  const s = v.toLowerCase();
  if (['oui', 'yes', 'true', '1', 'opt_in', 'opt-in', 'ok'].includes(s)) return 'opt_in';
  if (['non', 'no', 'false', '0', 'opt_out', 'opt-out', 'stop'].includes(s)) return 'opt_out';
  return undefined;
}

export function importContacts(crm, csvText, { source = 'import CSV' } = {}) {
  const report = { created: 0, updated: 0, errors: [], consentWithoutProof: 0 };
  for (const [i, r] of parseCsv(csvText).entries()) {
    try {
      const existed = !!crm.getContact(r.phone);
      let consent = normConsent(r.consent);
      if (consent === 'opt_in' && !r.consent_source) { consent = undefined; report.consentWithoutProof++; }
      crm.upsertContact({ ...r, category: r.category?.toLowerCase(), consent, source: r.source || source }, { origin: 'import' });
      existed ? report.updated++ : report.created++;
    } catch (err) {
      report.errors.push(`ligne ${i + 2} : ${err.message}`);
    }
  }
  return report;
}
