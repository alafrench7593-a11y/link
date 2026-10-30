# Assistant commercial WhatsApp

Fiches contacts, rubrique **Contacts contactés** tenue automatiquement, historique complet, relances, consentement et liste de suppression, tableau de bord. Envoi par le SDK officiel Kapso (`@kapso/whatsapp-cloud-api`), soit via Kapso, soit en direct sur la Cloud API de Meta.

Projet autonome : il ne dépend pas de LinkFoot et peut être sorti du dépôt tel quel (`git subtree split --prefix whatsapp-crm`).

## Règle centrale

Tout message sortant laisse une fiche et une ligne d'historique. Il n'existe qu'une porte d'écriture (`Crm.recordOutbound`), empruntée par :

- les envois manuels (tableau de bord, CLI) ;
- les brouillons validés, les relances, les campagnes ;
- les messages envoyés **hors du système** (boîte Kapso, autre outil) : le webhook `whatsapp.message.sent` les rattache à une fiche, créée si besoin.

Un contact = un numéro E.164 (`06 12 34 56 78`, `+33612345678`, `0033…` donnent la même fiche ; contrainte `UNIQUE` en base). Rien n'est jamais supprimé : changer de statut n'efface ni la fiche ni son historique.

## Démarrer

Node 22.5 ou plus (`node -v`). Testé sous Windows, macOS et Linux (workflow `Assistant WhatsApp`).

### Windows

1. Installer Node.js LTS (22 ou plus) depuis nodejs.org, et Git depuis git-scm.com.
2. Ouvrir PowerShell, puis :
   ```powershell
   git clone -b claude/great-bohr-98ryld https://github.com/alafrench7593-a11y/link.git
   ```
   ```powershell
   cd link\whatsapp-crm
   ```
   ```powershell
   npm install
   ```
   ```powershell
   copy .env.example .env
   ```
   ```powershell
   notepad .env
   ```
   ```powershell
   npm start
   ```
3. Ouvrir http://127.0.0.1:3020/. Pour les webhooks : `winget install Cloudflare.cloudflared`, puis `cloudflared tunnel --url http://127.0.0.1:3020` dans une seconde fenêtre.

### Mac / Linux

```bash
cd whatsapp-crm
```

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm start
```

Ouvrir http://127.0.0.1:3020/. Sans clé dans `.env`, le système tourne en **simulation** : bandeau orange, aucun message ne part, chaque envoi est marqué `simule`.

Importer des contacts : *Réglages et import* (CSV), ou :

```bash
npm run cli -- importer ~/contacts.csv
```

Colonnes reconnues : `telephone, prenom, nom, entreprise, categorie, source, notes, consentement (oui/non), preuve_consentement`. Un « oui » sans preuve est ignoré.

## Brancher Kapso (ce qui vous reste à faire)

1. Créer un compte sur app.kapso.ai (offre gratuite suffisante pour démarrer) et une clé API → `KAPSO_API_KEY`.
2. Connecter votre numéro WhatsApp Business (`kapso setup` ou l'interface). Récupérer le `phone_number_id` → `WA_PHONE_NUMBER_ID`.
3. Exposer le serveur pour les webhooks, par exemple :
   ```bash
   cloudflared tunnel --url http://127.0.0.1:3020
   ```
4. Dans Kapso, créer un **webhook de numéro** vers `https://<tunnel>/webhooks/kapso` avec les événements `whatsapp.message.received`, `.sent`, `.delivered`, `.read`, `.failed` (buffering désactivé). Copier le secret → `KAPSO_WEBHOOK_SECRET`.
5. Faire approuver par Meta au moins un modèle de premier contact et un modèle de relance (`{{1}}` = prénom) → `FOLLOWUP_TEMPLATE`.
6. Test réel sur **votre** téléphone uniquement :
   ```bash
   npm run cli -- connexion
   ```
   ```bash
   npm run cli -- test-reel 06XXXXXXXX
   ```
   (le numéro doit figurer dans `TEST_NUMBERS`). Répondez depuis le téléphone, puis vérifiez la fiche dans le tableau de bord.

Meta en direct : remplir `META_ACCESS_TOKEN`, `META_APP_SECRET`, `META_VERIFY_TOKEN` et pointer le webhook de l'app Meta sur `/webhooks/meta`.

## Statuts

| Statut | Quand |
|---|---|
| À contacter | fiche créée, jamais contactée |
| Contacté | contact touché hors WhatsApp (à poser à la main) |
| Message envoyé | l'API a accepté le message |
| En attente de réponse | message distribué ou lu, sans réponse |
| Relance à effectuer | l'échéance de relance est passée |
| Réponse reçue | la personne a répondu → relances annulées |
| Intéressé | réponse qui exprime de l'intérêt (détection par mots-clés, à confirmer) → action de suivi créée |
| Client / Partenaire | posé à la main ; un envoi ne le fait pas redescendre |
| Ne plus contacter | « STOP », « ne plus me contacter », « désinscrivez-moi »… → liste de suppression permanente |

## Garde-fous (appliqués avant chaque envoi)

- Liste de suppression : un numéro inscrit ne reçoit plus rien, même réimporté.
- Hors fenêtre de 24 h après le dernier message de la personne : modèle approuvé **et** consentement enregistré avec sa preuve, sinon refus.
- Plafond de contacts à l'initiative de l'entreprise par 24 h (`MAX_BUSINESS_INITIATED_PER_DAY`, 50 par défaut, sous le palier Meta de départ).
- Relances : 2 maximum (J+3, puis J+7), 3 jours minimum entre deux messages, entre 9 h et 20 h.
- Mode automatique : seuls les modèles listés dans `AUTO_TEMPLATES` partent seuls ; pause automatique si la qualité du numéro passe au rouge, si Meta signale du spam (131048/131049) ou si plus de 15 % des 40 derniers envois échouent.
- Campagnes : préparées en brouillons personnalisés, contacts sans consentement écartés, rien ne part avant « Valider et lancer ».
- Messages : un brouillon qui contient encore `[à compléter …]` ne peut pas partir. Les messages ne reprennent que le contenu de la fiche (notes, historique) : aucune rencontre ni aucun échange n'est inventé.

## Modes

- **Validation** (par défaut) : relances et reprises arrivent dans *À valider*. Vous relisez, choisissez une formulation, envoyez.
- **Automatique** : les relances avec un modèle autorisé partent seules si toutes les règles passent. Le planificateur tourne toutes les 15 minutes pendant que le serveur est lancé.

## Personnalisation

Par défaut, des formulations écrites à la main selon la relation (client : chaleureux ; partenaire : cordial ; prospects et professionnels : direct), le type de message et vos notes. Les trois propositions sont classées pour s'éloigner de ce qui a déjà été envoyé à la personne. Avec `ANTHROPIC_API_KEY`, Claude rédige les propositions sous les mêmes interdits, avec repli sur les règles en cas d'erreur.

## Tests

```bash
npm test
```

27 tests, tous verts : enregistrement automatique dans « Contacts contactés », absence de doublons, historique, statuts, interruption des relances, désinscription, intérêt, plafonds et heures, mode validation et automatique, campagnes, import, webhooks Kapso et Meta signés (et refus des signatures fausses, rejeu ignoré), message envoyé hors système, recherche, jeton du tableau de bord, et forme exacte des requêtes envoyées à Kapso et à Meta par le SDK.

Ce qui n'a **pas** été testé contre les vrais services : connexion Kapso, envoi réel, réception réelle. Voir `npm run cli -- test-reel`.

## Skill Kapso pour les agents

```bash
npm run skill:install
```

installe `integrate-whatsapp` et `observe-whatsapp` (dépôt officiel `gokapso/agent-skills`) dans `.claude/skills/`, où Claude Code les trouve quand il travaille dans ce dossier. Version vérifiée dans `skills-lock.json`. Les fichiers ne sont pas versionnés ici : le dépôt source ne publie pas de licence.

## CLI

```bash
npm run cli -- aide
```

## Fichiers

- `src/crm.js` — fiches, envois, historique, événements WhatsApp
- `src/compliance.js` — règles d'envoi, détection des refus et de l'intérêt
- `src/automation.js` — relances, reprise d'anciens clients, campagnes, qualité du numéro
- `src/personalize.js` — rédaction des messages
- `src/webhooks.js` — Kapso et Meta, signatures, idempotence
- `src/transport.js` — SDK Kapso (proxy Kapso ou Meta direct) ou simulation
- `src/start.js` — lancement (`npm start`)
- `src/server.js`, `public/index.html` — API et tableau de bord
- `data/crm.sqlite` — vos données (non versionnées)
