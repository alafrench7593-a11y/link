// Ligne de commande : npm run cli -- <commande> [options]
import { readFileSync } from 'node:fs';
import { createApp } from './app.js';
import { setSetting } from './db.js';
import { normalizePhone } from './phone.js';
import { importContacts } from './importer.js';
import { runFollowups, setMode, checkQuality, createCampaign, approveCampaign, prepareReactivation } from './automation.js';

const HELP = `Commandes :
  etat                                   transport, mode, chiffres clés
  connexion                              teste la connexion réelle (qualité du numéro)
  test-reel <tel>                        envoie le modèle hello_world à un numéro de TEST_NUMBERS
  modeles <waba_id>                      liste les modèles Meta et leur statut
  importer <fichier.csv>                 importe des contacts (aucun envoi)
  ajouter --tel <n> [--prenom --nom --categorie --notes --consentement opt_in --preuve "…"]
  envoyer <tel> --texte "…"              texte libre (fenêtre de 24 h ouverte)
  envoyer <tel> --modele <nom> [--params a,b] [--langue fr]
  fiche <tel|id>                         fiche complète et historique
  brouillons                             messages à valider
  valider <id> [--texte "…"]             envoie un brouillon
  rejeter <id>
  relances                               traite les relances arrivées à échéance
  reprise [--jours 180]                  prépare la reprise des anciens clients (consentement requis)
  campagne --nom "…" [--rubrique a_contacter --categorie prospect --modele nom]
  lancer-campagne <id> --confirmer       envoie une campagne préparée
  mode validation|automatique
  offre "…"                              décrit votre offre (utilisée dans les messages)`;

function args(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      opt[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    } else pos.push(argv[i]);
  }
  return { pos, opt };
}

const print = (x) => console.log(typeof x === 'string' ? x : JSON.stringify(x, null, 2));

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, opt } = args(rest);
  if (!cmd || cmd === 'aide') return print(HELP);
  const { crm, db } = createApp();
  const t = crm.transport;
  if (t.manual && ['envoyer', 'valider', 'test-reel', 'connexion'].includes(cmd)) {
    return print('Mode lien (sans API) : les envois se font depuis le tableau de bord, bouton « Ouvrir dans WhatsApp ».');
  }
  if (t.simulated && ['envoyer', 'valider', 'lancer-campagne', 'relances'].includes(cmd)) {
    console.warn('⚠ SIMULATION : aucune clé Kapso/Meta configurée, rien ne partira réellement.');
  }
  switch (cmd) {
    case 'etat': {
      const s = crm.stats();
      return print({ transport: s.transport, simulation: !!t.simulated, mode: s.mode, pause_auto: s.auto_paused_reason, qualite: s.quality,
        contacts: s.total, contactes: s.contactes, messages_envoyes: s.messages_envoyes, dont_simules: s.messages_simules, reponses: s.reponses,
        interesses: s.interesses, relances_en_attente: s.relances_en_attente, brouillons_a_valider: s.brouillons_a_valider });
    }
    case 'connexion':
      if (t.simulated) return print('Simulation : configurez KAPSO_API_KEY (ou META_ACCESS_TOKEN) et WA_PHONE_NUMBER_ID dans .env.');
      return print(await checkQuality(crm));
    case 'test-reel': {
      // Bornée aux numéros de test déclarés : jamais de prospect réel par erreur.
      const allowed = (process.env.TEST_NUMBERS || '').split(',').map((n) => n.trim()).filter(Boolean);
      const target = normalizePhone(pos[0], crm.cfg.defaultCountry);
      if (t.simulated) return print('Simulation : configurez les clés avant un test réel.');
      if (!target || !allowed.map((n) => normalizePhone(n, crm.cfg.defaultCountry)).includes(target)) return print('Numéro absent de TEST_NUMBERS : test refusé.');
      crm.upsertContact({ phone: target, source: 'numéro de test (TEST_NUMBERS)' });
      const c = crm.getContact(target);
      if (c.consent !== 'opt_in') crm.setConsent(c.id, 'opt_in', { source: 'numéro de test du propriétaire (TEST_NUMBERS)' });
      const r = await crm.sendMessage({ contact: c.id, template: { name: opt.modele || 'hello_world', lang: opt.langue || 'en_US' }, kind: 'premier_contact' });
      print(r.ok ? { envoye: true, wamid: r.wamid, suite: 'Répondez depuis ce téléphone, puis : npm run cli -- fiche ' + target } : r);
      return;
    }
    case 'modeles':
      return print(await t.listTemplates(pos[0]));
    case 'importer':
      return print(importContacts(crm, readFileSync(pos[0], 'utf8'), { source: opt.source || `import ${pos[0]}` }));
    case 'ajouter':
      return print(crm.upsertContact({ phone: opt.tel, first_name: opt.prenom, last_name: opt.nom, company: opt.entreprise, category: opt.categorie, notes: opt.notes, source: opt.source || 'saisie manuelle', consent: opt.consentement, consent_source: opt.preuve }));
    case 'envoyer': {
      const template = opt.modele ? { name: opt.modele, lang: opt.langue, params: opt.params ? String(opt.params).split(',') : [] } : undefined;
      return print(await crm.sendMessage({ contact: pos[0], body: opt.texte, template, kind: opt.type || 'manuel', origin: 'manuel' }));
    }
    case 'fiche':
      return print(crm.contactSheet(crm.getContact(pos[0])?.id) ?? 'introuvable');
    case 'brouillons':
      return print(db.prepare("SELECT d.id, d.kind, c.first_name, c.phone, d.template_name, d.body, d.block_reason FROM drafts d JOIN contacts c ON c.id = d.contact_id WHERE d.status = 'a_valider' ORDER BY d.id").all());
    case 'valider':
      return print(await crm.approveDraft(Number(pos[0]), { body: opt.texte }));
    case 'rejeter':
      crm.rejectDraft(Number(pos[0]), opt.raison);
      return print('rejeté');
    case 'relances':
      return print(await runFollowups(crm));
    case 'reprise':
      return print(await prepareReactivation(crm, { days: Number(opt.jours || 180) }));
    case 'campagne':
      return print(await createCampaign(crm, { name: opt.nom, section: opt.rubrique, category: opt.categorie, template: opt.modele ? { name: opt.modele, lang: opt.langue || crm.cfg.templateLang } : undefined }));
    case 'lancer-campagne':
      if (!opt.confirmer) return print('Ajoutez --confirmer : une campagne n’est jamais lancée sans validation explicite.');
      return print(await approveCampaign(crm, Number(pos[0])));
    case 'mode':
      setMode(db, pos[0], t);
      return print(`mode : ${pos[0]}`);
    case 'offre':
      setSetting(db, 'pitch', pos.join(' '));
      return print('offre enregistrée');
    default:
      print(HELP);
      process.exitCode = 1;
  }
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; });
