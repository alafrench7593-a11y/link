# Site BTS DÉBARRAT

Site multipage de BTS DÉBARRAT (débarras à Paris et en Île-de-France) : Next.js 16, React 19, TypeScript, Tailwind CSS 4, Motion.

## Identité

- **Logo** : le premier « A » de DÉBARRAT devient un toit, une porte ouverte dessous (l'espace libéré). Fichiers SVG dans `public/brand/` (horizontal clair/sombre, compact, symbole, favicon, monochromes noir/blanc), régénérables avec `npm run logo` (`scripts/logo.mjs`, texte vectorisé depuis Jost). Planche complète et pistes explorées : `/marque/` (non indexée).
- **Couleurs** : anthracite `#17181A`, blanc cassé `#F4F3EF`, gris minéral `#8C8F91`, une seule couleur d'accent : l'ocre (`#B0823E` logo, `#8A6428` texte).
- **Typographie** : Inter Tight (titres), Inter (texte), hébergées sur le site.

> **État : prêt techniquement, pas publiable en l'état.** 8 informations obligatoires manquent (numéros, adresse, SIRET, zones, envoi des e-mails…). Un bandeau jaune les signale sur chaque page et `npm run check:config` les liste. Rien n'a été déployé.

## Démarrer

```bash
cd bts-debarrat
npm install
cp .env.example .env.local    # puis remplir
npm run dev                   # http://localhost:3000
npm run build && npm start    # version de production
npm run check:config          # ce qui manque avant la mise en ligne
npm test                      # tests navigateur (après npm run build)
```

Node 22.18 ou plus récent. Les tests utilisent Chromium (`CHROMIUM_PATH`, par défaut `/opt/pw-browsers/chromium`).

## Où modifier quoi

| Élément | Fichier |
|---|---|
| Téléphone, WhatsApp, e-mail, adresse, SIRET, horaires, liens Google, logo, avis, assurance, engagements confirmés | `src/config/site.ts` |
| Prestations (activer/désactiver, textes, FAQ, message WhatsApp) | `src/config/services.ts` |
| Départements et communes desservis | `src/config/zones.ts` |
| Réalisations avant/après | `src/config/realisations.ts` + `public/photos/realisations/` |
| FAQ de l'accueil | `src/content/faq.ts` |
| Arguments, bandeau de réassurance, étapes | `src/content/engagements.ts` |
| Liste de contrôle avant publication | `src/config/checklist.ts` (affichée sur `/espace-pro/`, non indexée) |

Règle appliquée partout : une valeur inconnue reste `null` et le site masque l'élément correspondant. Rien n'est inventé (numéro, note, avis, chantier, certification, délai).

## Formulaire de devis

`/devis/` → `POST /api/devis/` → e-mail via [Resend](https://resend.com) à `DEVIS_DESTINATAIRE`, photos en pièces jointes.

- Validation côté navigateur **et** côté serveur, piège à robots, limite de 5 envois / 10 min par IP, clé d'idempotence contre la double soumission.
- Photos : 6 maximum, redimensionnées à 1 600 px dans le navigateur, signature binaire vérifiée côté serveur (JPEG, PNG, WebP), 4 Mo au total (limite Vercel : 4,5 Mo par requête).
- Le site ne stocke aucune demande. Si l'envoi n'est pas configuré ou échoue, le visiteur voit une erreur et les autres moyens de contact. Jamais de faux succès.

Variables : `RESEND_API_KEY`, `DEVIS_DESTINATAIRE`, `DEVIS_EXPEDITEUR` (adresse d'un domaine vérifié dans Resend). Offre gratuite Resend : 3 000 e-mails/mois.

## Mise en ligne (Vercel)

Ce dossier vit dans le dépôt `link`, à côté d'un autre projet. Sur Vercel :

1. *Add New Project* → importer le dépôt → **Root Directory : `bts-debarrat`**.
2. Variables d'environnement : `NEXT_PUBLIC_SITE_URL` (ex. `https://www.bts-debarrat.fr`), `RESEND_API_KEY`, `DEVIS_DESTINATAIRE`, `DEVIS_EXPEDITEUR`.
3. Ajouter le domaine (Settings → Domains), puis configurer les DNS chez le registrar.
4. Dans Resend : vérifier le domaine (enregistrements DNS SPF/DKIM fournis par Resend).
5. Remplir `src/config/`, vérifier `npm run check:config -- --strict` (sortie 0), puis pousser.
6. Faire une vraie demande de devis depuis un téléphone et vérifier sa réception.

## Google Search Console

1. search.google.com/search-console → *Ajouter une propriété* → type **Domaine** → valider par l'enregistrement DNS TXT proposé (ou type « Préfixe d'URL » et coller le code dans `site.googleSiteVerification`).
2. *Sitemaps* → soumettre `https://<domaine>/sitemap.xml`.
3. *Inspection de l'URL* → demander l'indexation de l'accueil et des 8 pages de prestations.
4. Suivre *Pages* (indexation) et *Performances* (requêtes) chaque semaine les deux premiers mois.

## Google Business Profile

1. business.google.com → créer ou revendiquer la fiche « BTS DÉBARRAT », catégorie principale « Service de débarras » (ou la plus proche proposée).
2. Sans accueil du public : choisir **entreprise de services de proximité**, masquer l'adresse, définir la zone desservie (mêmes zones que `zones.ts`).
3. Nom, téléphone et site **identiques** à ceux du site.
4. Copier l'URL publique de la fiche dans `site.lienGoogleBusiness`, et le lien *Demander des avis* dans `site.lienAvisGoogle`.

## Avis clients

- **Manuel (recommandé au départ)** : recopier chaque avis authentique dans `site.avis` (auteur avec son accord, note, texte exact, date, source, lien). Pour la note globale, remplir `site.releveGoogle` avec la date du relevé : le site l'affiche comme relevé manuel, jamais comme synchronisation.
- **Automatique** : l'API Google Places renvoie au plus 5 avis par fiche, impose l'affichage des mentions Google et est payante au-delà du crédit mensuel gratuit. L'API Business Profile (tous les avis de sa propre fiche) demande une validation d'accès par Google. Non branché : ce serait un développement à part.
- Aucun balisage `AggregateRating` n'est publié : Google n'affiche pas les étoiles pour des avis qu'une entreprise publie sur son propre site.
- Message de demande d'avis prêt à copier (WhatsApp / e-mail) sur `/espace-pro/`. L'envoyer à tous les clients, sans contrepartie ni tri.

## Photographies

Toutes les images passent par `src/config/photos.ts` : un emplacement par sujet (hero, équipe, pièce vide, une par prestation, contact). Tant qu'un emplacement n'a pas de fichier, le site affiche un dessin monochrome légendé « Photo à venir · sujet » : rien n'est simulé.

- **Photo de banque d'images** (Unsplash, Pexels — usage commercial gratuit) : renseigner `credit` (auteur, page, licence, URL du fichier), lancer `npm run photos` (télécharge, redimensionne à 2 000 px, convertit en WebP dans `public/photos/`), puis `src: "/photos/<id>.webp"`. Elle s'affiche avec la légende « Photo d'illustration ».
- **Photo de BTS DÉBARRAT** : déposer le fichier dans `public/photos/`, `src` renseigné, `demonstration: false`.
- Les comparaisons avant/après n'utilisent **jamais** de photos de banque : uniquement deux photos réelles du même lieu, même angle (voir ci-dessous).

## Remplacer les dessins avant/après par de vraies photos

Les comparaisons actuelles sont des **dessins**, étiquetés « Dessin d'illustration — en attente des photos de chantier ». Ce ne sont pas des photos de chantiers.

1. Photos en 3:2, 1 600 × 1 067 px, WebP ou JPEG, sans visage, plaque, nom, courrier ni objet identifiant. Accord écrit du client.
2. Réalisations : `public/photos/realisations/<slug>/avant.webp` et `apres.webp`, puis une entrée dans `realisations.ts` (modèle en commentaire). La galerie de l'accueil, la page `/realisations/` et la page individuelle se mettent à jour seules.
3. Prestations : `public/photos/services/<slug>.webp` et renseigner `photo` + `photoAlt` dans `services.ts`.
4. Logo : `public/logo.svg` puis `site.logo = "/logo.svg"`.

Next.js convertit automatiquement en AVIF/WebP aux bonnes tailles.

## Mesure d'audience

Aucune par défaut. `site.analytics.fournisseur` :
- `"plausible"` : sans cookie, pas de bannière (≈ 9 €/mois) ;
- `"ga4"` : bannière de consentement affichée, rien n'est chargé avant acceptation.

Événements : `whatsapp_clic`, `telephone_clic`, `devis_ouverture`, `devis_debut`, `devis_transmis` (uniquement après réponse positive du serveur), `service_consultation`, `realisations_consultation`, `avis_google_clic`. À déclarer comme conversions dans l'outil choisi.

## Pages locales

`/zone-intervention/<commune>/` n'est générée que si la commune est `confirmee: true` **et** a un `contenu` rédigé spécifiquement (contraintes réelles, quartiers, accès). Pas de pages générées en série.
