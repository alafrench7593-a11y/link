// Un numéro = une fiche. Toutes les entrées passent par normalizePhone, sinon
// « 06 12 34 56 78 » et « +33612345678 » créeraient deux contacts.

const COUNTRY_CODES = { FR: '33', BE: '32', CH: '41', LU: '352', MA: '212', SN: '221', CI: '225', CA: '1', US: '1' };

export function normalizePhone(raw, defaultCountry = 'FR') {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[\s.\-()/]/g, '');
  if (!s) return null;
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (!s.startsWith('+')) {
    const cc = COUNTRY_CODES[defaultCountry] ?? '33';
    // Les webhooks WhatsApp donnent le numéro sans « + » mais avec l'indicatif.
    if (s.startsWith(cc) && s.length > 10) s = '+' + s;
    else if (s.startsWith('0')) s = '+' + cc + s.slice(1);
    else s = '+' + s;
  }
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null;
  return s;
}
