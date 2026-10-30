import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, DAY } from './helpers.js';
import { setSetting } from '../src/db.js';
import { runFollowups, setMode, createCampaign, approveCampaign } from '../src/automation.js';
import { detectOptOut, detectInterest } from '../src/compliance.js';
import { normalizePhone } from '../src/phone.js';
import { importContacts } from '../src/importer.js';

const optedIn = (crm, phone, extra = {}) => crm.upsertContact({ phone, first_name: 'Léa', category: 'prospect', consent: 'opt_in', consent_source: 'formulaire site 12/10', ...extra });

test('numéros : toutes les écritures donnent la même fiche', () => {
  assert.equal(normalizePhone('06 12 34 56 78'), '+33612345678');
  assert.equal(normalizePhone('+33 6 12 34 56 78'), '+33612345678');
  assert.equal(normalizePhone('0033612345678'), '+33612345678');
  assert.equal(normalizePhone('33612345678'), '+33612345678');
  assert.equal(normalizePhone('abc'), null);
});

test('premier envoi : la fiche apparaît dans « Contacts contactés » avec historique', async () => {
  const { crm, transport } = makeApp();
  const c = optedIn(crm, '0612345678');
  assert.equal(crm.listContacts({ section: 'contactes' }).length, 0);
  const r = await crm.sendMessage({ contact: c.id, template: { name: 'premier_contact', params: ['Léa'] }, kind: 'premier_contact' });
  assert.equal(r.ok, true, r.reason);
  assert.equal(transport.sent.length, 1);
  const list = crm.listContacts({ section: 'contactes' });
  assert.equal(list.length, 1);
  const s = crm.contactSheet(c.id);
  assert.equal(s.contact.messages_sent, 1);
  assert.equal(s.contact.status, 'message_envoye');
  assert.ok(s.contact.first_contacted_at);
  assert.ok(s.contact.last_outbound_text.includes('premier_contact'));
  assert.ok(s.contact.next_followup_at, 'une relance est programmée');
  assert.deepEqual(s.messages.map((m) => m.wamid), ['wamid.T1']);
  assert.ok(s.history.some((h) => h.type === 'ajoute_contacts_contactes'));
});

test('envoi direct à un numéro inconnu : la fiche est créée automatiquement', async () => {
  const { crm, clock } = makeApp();
  // La personne a écrit (fenêtre ouverte) ; on lui répond depuis le numéro seul.
  crm.recordInbound({ phone: '33699887766', wamid: 'wamid.IN1', text: 'Bonjour, vous faites des devis ?', name: 'Marc Petit' });
  clock.t += 3_600_000;
  const r = await crm.sendMessage({ contact: '+33699887766', body: 'Bonjour Marc, oui bien sûr.', kind: 'reponse' });
  assert.equal(r.ok, true, r.reason);
  const c = crm.getContact('+33699887766');
  assert.equal(c.first_name, 'Marc');
  assert.equal(c.messages_sent, 1);
  assert.ok(c.first_contacted_at);
});

test('aucun doublon : plusieurs envois enrichissent la même fiche', async () => {
  const { crm, clock, db } = makeApp();
  optedIn(crm, '+33612345678');
  crm.upsertContact({ phone: '06.12.34.56.78', company: 'ACME' });
  await crm.sendMessage({ contact: '0612345678', template: { name: 'premier_contact' }, kind: 'premier_contact' });
  clock.t += 4 * DAY;
  await crm.sendMessage({ contact: '+33 6 12 34 56 78', template: { name: 'relance_douce' }, kind: 'relance' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contacts').get().n, 1);
  const c = crm.getContact('0612345678');
  assert.equal(c.messages_sent, 2);
  assert.equal(c.company, 'ACME');
  assert.equal(crm.contactSheet(c.id).messages.length, 2);
});

test('réponse reçue : historique, compteur, statut, relances interrompues', async () => {
  const { crm, clock } = makeApp();
  const c = optedIn(crm, '0612345678');
  await crm.sendMessage({ contact: c.id, template: { name: 'premier_contact' }, kind: 'premier_contact' });
  crm.recordStatus({ wamid: 'wamid.T1', status: 'delivered' });
  assert.equal(crm.getContact(c.id).status, 'en_attente');
  clock.t += DAY;
  crm.recordInbound({ phone: '33612345678', wamid: 'wamid.IN1', text: 'Merci, je regarde ça.' });
  const after = crm.getContact(c.id);
  assert.equal(after.status, 'reponse_recue');
  assert.equal(after.replies_received, 1);
  assert.equal(after.next_followup_at, null);
  const s = crm.contactSheet(c.id);
  assert.ok(s.history.some((h) => h.type === 'relances_interrompues'));
  // L'échéance passe : aucune relance n'est créée.
  clock.t += 10 * DAY;
  const rep = await runFollowups(crm);
  assert.equal(rep.due, 0);
});

test('intérêt détecté : statut Intéressé + action de suivi', async () => {
  const { crm, db } = makeApp();
  const c = optedIn(crm, '0612345678');
  await crm.sendMessage({ contact: c.id, template: { name: 'premier_contact' }, kind: 'premier_contact' });
  const r = crm.recordInbound({ phone: '+33612345678', wamid: 'wamid.IN2', text: 'Oui je suis intéressé, vous pouvez m’appeler ?' });
  assert.equal(r.interested, true);
  assert.equal(crm.getContact(c.id).status, 'interesse');
  const pending = () => db.prepare("SELECT COUNT(*) AS n FROM drafts WHERE contact_id = ? AND kind = 'reponse' AND status = 'a_valider'").get(c.id).n;
  assert.equal(pending(), 1);
  // Répondre depuis la fiche clôt l'action de suivi.
  const sent = await crm.sendMessage({ contact: c.id, body: 'Merci, je vous appelle demain à 10 h.', kind: 'reponse' });
  assert.equal(sent.ok, true, sent.reason);
  assert.equal(pending(), 0);
  assert.equal(crm.getContact(c.id).status, 'interesse', 'un envoi ne fait pas redescendre un contact intéressé');
});

test('désinscription : Ne plus contacter, suppression permanente, plus aucun envoi', async () => {
  const { crm, transport } = makeApp();
  const c = optedIn(crm, '0612345678');
  await crm.sendMessage({ contact: c.id, template: { name: 'premier_contact' }, kind: 'premier_contact' });
  const r = crm.recordInbound({ phone: '33612345678', wamid: 'wamid.IN3', text: 'STOP' });
  assert.equal(r.optOut, true);
  const after = crm.getContact(c.id);
  assert.equal(after.status, 'ne_plus_contacter');
  assert.equal(after.consent, 'opt_out');
  assert.equal(after.next_followup_at, null);
  const blocked = await crm.sendMessage({ contact: c.id, body: 'Juste un dernier mot', kind: 'reponse' });
  assert.equal(blocked.ok, false);
  assert.equal(transport.sent.length, 1);
  // Réimporter le contact ne le fait pas revenir.
  crm.upsertContact({ phone: '0612345678', notes: 'réimporté' });
  assert.equal(crm.getContact(c.id).status, 'ne_plus_contacter');
  assert.throws(() => crm.setConsent(c.id, 'opt_in', { source: 'x' }));
  // La fiche et son historique restent consultables.
  assert.ok(crm.contactSheet(c.id).messages.length >= 2);
});

test('détection des refus et de l’intérêt', () => {
  for (const t of ['STOP', 'stop', 'Arrêt', 'Merci de ne plus me contacter', 'Désinscrivez-moi svp', 'Retirez-moi de votre liste', 'unsubscribe']) assert.ok(detectOptOut(t), t);
  for (const t of ['Bonjour, merci', 'On arrête pas le progrès !', 'Je regarde et je reviens vers vous']) assert.ok(!detectOptOut(t), t);
  assert.ok(detectInterest('Je suis intéressé'));
  assert.ok(!detectInterest('Pas intéressé, merci'));
});

test('conformité : pas de texte libre hors fenêtre, pas d’envoi sans consentement', async () => {
  const { crm, transport } = makeApp();
  const sans = crm.upsertContact({ phone: '0611111111', first_name: 'Sam' });
  let r = await crm.sendMessage({ contact: sans.id, template: { name: 'premier_contact' }, kind: 'premier_contact' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /consentement/);
  const avec = optedIn(crm, '0622222222');
  r = await crm.sendMessage({ contact: avec.id, body: 'Bonjour !', kind: 'premier_contact' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /24 h/);
  assert.equal(transport.sent.length, 0);
  assert.ok(crm.contactSheet(avec.id).history.some((h) => h.type === 'envoi_bloque'));
});

test('conformité : plafond quotidien et heures d’envoi', async () => {
  const { crm, clock } = makeApp({ maxBusinessInitiatedPerDay: 2 });
  for (const p of ['0610000001', '0610000002', '0610000003']) optedIn(crm, p);
  assert.equal((await crm.sendMessage({ contact: '0610000001', template: { name: 'a' }, kind: 'premier_contact' })).ok, true);
  assert.equal((await crm.sendMessage({ contact: '0610000002', template: { name: 'a' }, kind: 'premier_contact' })).ok, true);
  const r = await crm.sendMessage({ contact: '0610000003', template: { name: 'a' }, kind: 'premier_contact' });
  assert.match(r.reason, /Plafond/);
  clock.t = Date.parse('2026-10-29T22:30:00Z'); // 23 h 30 à Paris
  optedIn(crm, '0610000004');
  const night = await crm.sendMessage({ contact: '0610000004', template: { name: 'a' }, kind: 'campagne', origin: 'campagne' });
  assert.match(night.reason, /heures d’envoi/);
});

test('relances : mode validation → brouillon ; mode automatique → envoi avec modèle autorisé', async () => {
  const { crm, clock, transport, db } = makeApp();
  const c = optedIn(crm, '0612345678');
  await crm.sendMessage({ contact: c.id, template: { name: 'premier_contact' }, kind: 'premier_contact' });
  clock.t += 3 * DAY + 1000;
  let rep = await runFollowups(crm);
  assert.deepEqual([rep.due, rep.drafts, rep.sent], [1, 1, 0]);
  assert.equal(crm.getContact(c.id).status, 'relance_a_effectuer');
  const draft = db.prepare("SELECT * FROM drafts WHERE contact_id = ? AND kind = 'relance'").get(c.id);
  assert.equal(draft.template_name, 'relance_douce');
  assert.ok(draft.body.includes('Léa'), 'brouillon personnalisé');
  const ok = await crm.approveDraft(draft.id);
  assert.equal(ok.ok, true, ok.reason);
  assert.equal(crm.getContact(c.id).followup_step, 1);

  setMode(db, 'automatique');
  clock.t += 7 * DAY + 1000;
  rep = await runFollowups(crm);
  assert.equal(rep.sent, 1);
  assert.equal(transport.sent.at(-1).template, 'relance_douce');
  assert.equal(crm.getContact(c.id).next_followup_at, null, 'plus de relance après la dernière étape');
});

test('protection : échecs répétés ou signal Meta → automatique en pause', async () => {
  const { crm, db } = makeApp();
  const c = optedIn(crm, '0612345678');
  await crm.sendMessage({ contact: c.id, template: { name: 'premier_contact' }, kind: 'premier_contact' });
  crm.recordStatus({ wamid: 'wamid.T1', status: 'failed', error: '131048 Spam rate limit hit' });
  assert.equal(crm.stats().auto_paused, true);
  setSetting(db, 'auto_paused', true);
  optedIn(crm, '0633333333');
  const r = await crm.sendMessage({ contact: '0633333333', template: { name: 'relance_douce' }, kind: 'relance', origin: 'automatique' });
  assert.match(r.reason, /pause/);
});

test('message envoyé hors du système (vu par webhook) : fiche et historique créés', () => {
  const { crm } = makeApp();
  crm.recordStatus({ wamid: 'wamid.EXT1', status: 'sent', recipient: '33655555555', body: 'Envoyé depuis la boîte Kapso' });
  const c = crm.getContact('+33655555555');
  assert.ok(c, 'fiche créée');
  assert.ok(c.first_contacted_at);
  assert.equal(c.messages_sent, 1);
  assert.equal(c.last_outbound_text, 'Envoyé depuis la boîte Kapso');
  crm.recordStatus({ wamid: 'wamid.EXT1', status: 'delivered', recipient: '33655555555' });
  assert.equal(crm.getContact(c.id).messages_sent, 1, 'pas de double comptage');
});

test('échec d’envoi : message enregistré en échec et erreur visible', async () => {
  const { crm, transport } = makeApp();
  const c = optedIn(crm, '0612345678');
  transport.failNext = '(#131026) Message undeliverable';
  const r = await crm.sendMessage({ contact: c.id, template: { name: 'premier_contact' }, kind: 'premier_contact' });
  assert.equal(r.ok, false);
  const s = crm.contactSheet(c.id);
  assert.equal(s.messages[0].status, 'echec');
  assert.equal(crm.stats().erreurs.length, 1);
});

test('campagne : rien ne part avant validation, contacts sans consentement écartés', async () => {
  const { crm, transport } = makeApp();
  optedIn(crm, '0610000001', { first_name: 'Ana' });
  optedIn(crm, '0610000002', { first_name: 'Bob' });
  crm.upsertContact({ phone: '0610000003', first_name: 'Cid' });
  setSetting(crm.db, 'pitch', 'notre atelier de réparation de vélos');
  const r = await createCampaign(crm, { name: 'Rentrée', section: 'a_contacter', template: { name: 'offre_rentree', lang: 'fr' } });
  assert.deepEqual([r.recipients, r.excludedNoConsent], [2, 1]);
  assert.equal(transport.sent.length, 0);
  const draft = crm.db.prepare('SELECT id FROM drafts WHERE campaign_id = ?').get(r.campaignId);
  await assert.rejects(crm.approveDraft(draft.id), /validée/);
  const rep = await approveCampaign(crm, r.campaignId);
  assert.equal(rep.sent, 2);
  assert.equal(crm.listContacts({ section: 'contactes' }).length, 2);
});

test('import CSV : création, mise à jour, accord sans preuve ignoré', () => {
  const { crm } = makeApp();
  const csv = 'prenom;nom;telephone;categorie;consentement;preuve_consentement;notes\nLéa;Martin;06 12 34 56 78;client;oui;bon de commande 2025;cliente depuis 2024\nTom;Durand;0699999999;prospect;oui;;\nX;Y;pas-un-numero;;;;\n';
  const r = importContacts(crm, csv);
  assert.deepEqual([r.created, r.updated, r.consentWithoutProof, r.errors.length], [2, 0, 1, 1]);
  assert.equal(crm.getContact('0612345678').consent, 'opt_in');
  assert.equal(crm.getContact('0699999999').consent, 'inconnu');
  const r2 = importContacts(crm, 'telephone;entreprise\n+33612345678;Vélo Club\n');
  assert.equal(r2.updated, 1);
  assert.equal(crm.getContact('0612345678').company, 'Vélo Club');
});

test('personnalisation : aucun contexte inventé, pas de répétition, trou signalé', async () => {
  const { crm } = makeApp({ senderName: '' });
  const { generateVariants } = await import('../src/personalize.js');
  const c = optedIn(crm, '0612345678');
  const { variants } = await generateVariants({ contact: c, kind: 'premier_contact', cfg: crm.cfg, history: [], pitch: '' });
  assert.equal(variants.length, 3);
  assert.ok(variants.every((v) => !/rencontr|salon|recommand/i.test(v)), 'aucune rencontre inventée');
  assert.ok(variants.every((v) => v.includes('[à compléter')), 'les manques sont signalés, pas inventés');
  const blocked = await crm.sendMessage({ contact: c.id, body: variants[0], kind: 'reponse' });
  assert.equal(blocked.ok, false);
});
