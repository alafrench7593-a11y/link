// Base locale SQLite (node:sqlite, intégré à Node 22.5+). Un seul fichier,
// transactions ACID, et une contrainte UNIQUE sur le numéro : c'est elle qui
// garantit qu'un contact n'existe jamais en double, même sous deux webhooks
// simultanés.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS contacts (
  id                 INTEGER PRIMARY KEY,
  phone              TEXT NOT NULL UNIQUE,          -- E.164, ex. +33612345678
  first_name         TEXT,
  last_name          TEXT,
  company            TEXT,
  category           TEXT NOT NULL DEFAULT 'prospect',
  status             TEXT NOT NULL DEFAULT 'a_contacter',
  consent            TEXT NOT NULL DEFAULT 'inconnu', -- inconnu | opt_in | opt_out
  consent_scope      TEXT,                           -- ce qui a été accepté (ex. "offres et suivi commercial")
  consent_source     TEXT,                           -- preuve : formulaire, contrat, message entrant…
  consent_at         TEXT,
  source             TEXT,                           -- d'où vient le contact
  notes              TEXT,
  first_contacted_at TEXT,                           -- non NULL = présent dans « Contacts contactés »
  last_outbound_at   TEXT,
  last_outbound_text TEXT,
  last_inbound_at    TEXT,
  last_inbound_text  TEXT,
  messages_sent      INTEGER NOT NULL DEFAULT 0,
  replies_received   INTEGER NOT NULL DEFAULT 0,
  followup_step      INTEGER NOT NULL DEFAULT 0,     -- relances déjà faites
  next_followup_at   TEXT,                           -- NULL = aucune relance prévue
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS contacts_followup ON contacts(next_followup_at);

CREATE TABLE IF NOT EXISTS messages (
  id            INTEGER PRIMARY KEY,
  contact_id    INTEGER NOT NULL REFERENCES contacts(id),
  direction     TEXT NOT NULL,                       -- sortant | entrant
  wamid         TEXT UNIQUE,                         -- identifiant WhatsApp
  body          TEXT,
  template_name TEXT,
  origin        TEXT,                                -- manuel | campagne | relance | externe | entrant
  status        TEXT NOT NULL,                       -- accepte | envoye | distribue | lu | echec | recu | simule
  error         TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_contact ON messages(contact_id, created_at);

-- Journal de tout ce qui arrive à une fiche. On n'y supprime jamais rien.
CREATE TABLE IF NOT EXISTS history (
  id         INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL REFERENCES contacts(id),
  type       TEXT NOT NULL,
  detail     TEXT,
  at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS history_contact ON history(contact_id, at);

-- Liste de suppression permanente : un numéro inscrit ici ne reçoit plus rien,
-- même si la fiche est modifiée ou réimportée.
CREATE TABLE IF NOT EXISTS suppression (
  phone  TEXT PRIMARY KEY,
  reason TEXT,
  at     TEXT NOT NULL
);

-- Messages préparés (mode validation, relances, campagnes).
CREATE TABLE IF NOT EXISTS drafts (
  id            INTEGER PRIMARY KEY,
  contact_id    INTEGER NOT NULL REFERENCES contacts(id),
  kind          TEXT NOT NULL,                       -- premier_contact | relance | reprise | reponse | campagne
  campaign_id   INTEGER REFERENCES campaigns(id),
  body          TEXT,
  variants      TEXT,                                -- JSON : autres formulations proposées
  template_name TEXT,
  template_lang TEXT,
  template_params TEXT,                              -- JSON
  status        TEXT NOT NULL DEFAULT 'a_valider',   -- a_valider | approuve | envoye | rejete | bloque | traite
  block_reason  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS drafts_status ON drafts(status);

CREATE TABLE IF NOT EXISTS campaigns (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  filter      TEXT,                                  -- JSON
  status      TEXT NOT NULL DEFAULT 'a_valider',     -- a_valider | validee | terminee | annulee
  created_at  TEXT NOT NULL,
  approved_at TEXT
);

-- Idempotence des webhooks : un événement rejoué n'est traité qu'une fois.
CREATE TABLE IF NOT EXISTS webhook_events (
  key         TEXT PRIMARY KEY,
  event       TEXT,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS errors (
  id         INTEGER PRIMARY KEY,
  scope      TEXT NOT NULL,
  message    TEXT NOT NULL,
  contact_id INTEGER,
  at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`;

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  return db;
}

export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getSetting(db, key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : fallback;
}

export function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));
}
