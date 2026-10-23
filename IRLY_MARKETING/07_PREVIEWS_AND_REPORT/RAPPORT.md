# IRLY — Campagne de lancement : rapport de production

Date : 23 octobre 2026. Toutes les mesures ci-dessous ont été relevées sur les fichiers livrés.

## 1. Version d'IRLY inspectée

- Dépôt `alafrench7593-a11y/irly`, branche par défaut, commit `d09b2cc` (23/10/2026 02:59 UTC), `package.json` version 3.0.0, Expo SDK 57.
- Ce qui a réellement été inspecté :
  - le code : `src/theme/tokens.ts`, `features/girl/theme.ts`, `DESIGN_SYSTEM.md`, `src/brand/dots.ts`, routes `src/app/` ;
  - la **build web de démonstration** de cette version (`EXPO_PUBLIC_DEMO=1 npx expo export --platform web`), servie en local et pilotée avec Chromium (Playwright) en téléphone 390 × 844, locale fr-FR, fuseau Asia/Dubai.
- La démo n'utilise **aucun serveur et aucun compte** : les personnes, activités et événements sont les exemples intégrés au code (`src/data/content`). Les portraits viennent de Pixabay, StockSnap ou Rawpixel, ou ont été fournis par IRLY (`public-photos/faces/CREDITS.md`). Aucune donnée de production n'a été lue ou modifiée.
- Ce qui n'a pas été inspecté :
  - l'app native iOS/Android (pas de simulateur dans cet environnement) ;
  - getirly.com (bloqué par le proxy réseau) ;
  - les écrans qui demandent le serveur.
- Le bandeau « Démo · rien n'est enregistré » a été masqué sur les captures. Aucun autre élément d'interface n'a été modifié.
- Les photos de la démo, hébergées sur GitHub Pages (bloqué ici), ont été servies depuis les mêmes fichiers du dépôt (`public-photos/`, `site/`).

## 2. Écrans et fonctionnalités utilisés

| Espace | Écrans capturés (réels) |
| --- | --- |
| Mixte | Histoire « C'est quoi IRLY » (5 scènes), Accueil (+ défilement), Découvrir (Événements, Lieux), Activités, Padel, détail d'une activité (J'y vais / Je n'y vais pas / Peut-être, AED 60), Toutes les catégories, IRL (live), IRLY Network, profil professionnel (« Pourquoi vous rencontrer ») |
| Girl | Accueil Girl, Communautés IRLY Girl (Girl Trip, Girl Expat, Girl Activité, Girl Sport), Activités, Découvrir, IRL |
| Girl Network | IRLY Network en violet, profil professionnel (Yara, « Pourquoi vous rencontrer ») |
| Anciennes captures réelles du dépôt (`site/shots/app/fr`) | Liste des communautés de l'inscription (IRLY Gym, Sport, Trip, Network, Newcomers), discussion de groupe « Padel entre amis · Al Quoz », message privé |

Non montré, faute de pouvoir le vérifier :
- **la carte** : les tuiles OpenFreeMap sont bloquées ici, y compris sur les anciennes captures ;
- **la page d'une communauté Mixte** : elle exige la connexion au serveur.

Dans la vidéo complète, le chapitre « Carte » est remplacé par « En live », une fonction réelle.

## 3. Publication X

`https://x.com/kingao476942/status/2112729924943634602` : **inaccessible** (x.com ne résout pas depuis cet environnement). Le contenu du tweet n'a pas été lu. Les quatre dépôts cités dans la mission ont été évalués directement.

## 4. Dépôts GitHub consultés

Tous les quatre ont été clonés et lus (README, SKILL.md, scripts, dépendances, licences). Rien n'a été exécuté depuis ces dépôts.

| Dépôt | Nature | Verdict |
| --- | --- | --- |
| whaleyxbt/claude-motion | Remotion 4 + skills Claude (motion-design, review-loop, sound-design) et un pipeline HTML `render(t)` capturé par Playwright | Règles reprises (courbes d'accélération, durées de lecture, boucle de relecture par planches). Pas installé : Remotion demande une licence payante pour les entreprises au-delà d'une certaine taille. |
| howseen-ai/claude-motion-design | Un SKILL.md et des scripts Python (HTML `seek(t)`, Playwright Python) | Règles reprises (honnêteté, vraies captures uniquement, hygiène de capture, contrôle des « pops »). Scripts liés à la machine de l'auteur et à des téléchargements réseau. |
| heygen-com/hyperframes | Moteur HTML + GSAP vers MP4, CLI, skills, préréglage 9:16 | Meilleur outil évalué. Règles 9:16 reprises (zones sûres, texte ≥ 28 px, durées de maintien). Non installé : télémétrie active par défaut, téléchargement de navigateur et GSAP par CDN. Le même principe a été appliqué avec les outils déjà présents. |
| h3nryprod01/design-taste | Skill de goût visuel (anti-« slop »), sans rendu | Règles reprises pour les affiches (une couleur d'accent, pas de dégradés dans le texte, pas de fausses captures). |

## 5. Skills installés et réellement utilisés

- **Installés : aucun** des quatre dépôts. Ce choix est délibéré (sécurité, télémétrie, licence, dépendances réseau). Leurs règles ont été appliquées à la main.
- **Utilisé** : le type d'artefact « Design » de claude.ai, pour le design system IRLY (https://claude.ai/artifact/2g5e1xyiYRdh6kCFkZvq3b).
- **Consultés** : le rapport d'évaluation des quatre dépôts ci-dessus.

## 6. Outils de rendu

- **Playwright 1.63 + Chromium** :
  - captures d'écran de la démo (@3x) ;
  - enregistrements pas à pas des défilements (@2x, 30 i/s, sans saccade) ;
  - rendu image par image des compositions.
- **Moteur maison** (`_source/videos/engine.js`) :
  - chaque image est calculée à partir du temps seul, donc le rendu est reproductible ;
  - durées et ressorts tirés de `src/motion/tokens.ts` ;
  - logo animé point par point d'après `src/brand/dots.ts`.
- **ffmpeg 6.1.1** : H.264 (CRF 16, BT.709, `faststart`), AAC 192 kbit/s, sonie normalisée à −14 LUFS, contrôles de noirs et d'images figées.
- **Python (numpy, Pillow)** :
  - musique et sound design **synthétisés de zéro** (aucun échantillon ni droit tiers) ;
  - planches de contrôle, contrôle des images.

## 7. Les 20 images (1080 × 1920, PNG)

| Série | Fichiers |
| --- | --- |
| A — Mixte | `01_IRLY_MIXTE_IMAGES/mixte_01_discover.png`, `mixte_02_activities.png`, `mixte_03_communities.png`, `mixte_04_irl.png`, `mixte_05_network.png` |
| B — Girl | `02_IRLY_GIRL_IMAGES/girl_01_discover.png`, `girl_02_activities.png`, `girl_03_trip.png`, `girl_04_expat.png`, `girl_05_network.png` |
| C — Network | `03_IRLY_NETWORK_IMAGES/network_01_discover.png`, `network_02_grow.png`, `network_03_founders.png`, `network_04_communities.png`, `network_05_girl_network.png` |
| D — TikTok | `04_TIKTOK_SLIDESHOW/slide_01.png` … `slide_05.png` |

Aperçus : `07_PREVIEWS_AND_REPORT/preview_*.jpg`. Contrôle : `qa_images.md`.

## 8. Vidéos

VIDEOS_TABLE

## 9. Fichiers sources

- `_source/images/*.html` : une composition par image ; `common.css` et `common.js` contiennent les tokens IRLY, le cadre de téléphone, le recadrage des vraies captures et le logo en points.
- `_source/videos/*.html` : une composition par vidéo ; `engine.js` et `video.css` contiennent le moteur.
- `_source/videos/audio/*.json` : partitions de la bande-son (énergie, effets) ; `_source/tools/music.py` les synthétise.
- `_source/videos/seq/*.json` : scénarios d'enregistrement des clips de l'app.
- `_source/assets/` :
  - `shots/` : captures réelles ;
  - `photos/` : photos du projet (propres à IRLY et Pixabay) ;
  - `fonts/` : Manrope et Instrument Serif, licence OFL.
- `_source/tools/` :
  - `capture.mjs` : captures d'écran ;
  - `capture-seq.mjs` : enregistrement des clips ;
  - `render-png.mjs` : rendu des images ;
  - `render-video.mjs` : rendu des vidéos ;
  - `stills.mjs` : images clés de contrôle ;
  - `mux.sh` : assemblage image et son ;
  - `qa-video.sh`, `qa-images.py` : contrôles qualité ;
  - `build-video.sh` : chaîne complète d'une vidéo ;
  - `prepare-sources.sh` : régénération des sources lourdes.
- Les dossiers d'images des clips et des films (environ 370 Mo) ne sont pas versionnés. `prepare-sources.sh` les régénère.

Refaire une image : `node _source/tools/render-png.mjs _source images/<nom>.html=<sortie>.png` (depuis `IRLY_MARKETING/`).
Refaire une vidéo : `_source/tools/build-video.sh <nom> <secondes> <dossier>`.

## 10. Contrôles qualité effectués

- **Images** :
  - dimensions vérifiées (20/20 en 1080 × 1920) ;
  - quasi-doublons recherchés par hachage perceptif : aucun ;
  - chaque photo n'est utilisée qu'une fois ;
  - textes extraits et relus ;
  - au moins une passe de critique visuelle et de correction par série, soit 8 corrections au total :
    - A3 : téléphone en basse définition retiré, pilules recalées ;
    - A4 : recadrage refait sur les boutons de réponse ;
    - B3 : doublon de texte retiré ;
    - C4 : compteur issu de la démo retiré, pour ne pas être lu comme une statistique ;
    - slide 1 : texte déplacé hors du visage ;
    - slide 3 : photo avec un enfant remplacée ;
    - mot « démo » retiré d'un texte ;
    - recadrage d'A4 affiné.
- **Vidéos** :
  - images clés relues avant chaque rendu complet ;
  - corrections après relecture :
    - découpage des mots qui cassait les balises ;
    - « ? » orphelin ;
    - carte d'activité qui doublait l'écran ;
    - fondus d'entrée et de sortie en conflit ;
    - image figée de 2 s, d'où une dérive de caméra lente ajoutée partout ;
  - sur chaque fichier final : durée, résolution, cadence, présence du son, sonie, noirs, images figées, planche d'une image par seconde (`*_contact_sheet.jpg`).
- **Son** : vérifié par mesures (sonie, crête, spectre). **Il n'a pas été écouté** : aucune sortie audio dans cet environnement.

## 11. Coûts et dépendances externes

- **Coût** : aucun. Aucun service payant ni clé d'API n'a été utilisé.
- **Licences** :
  - les plans vidéo de Dubaï viennent de Pixabay, sous licence Pixabay (`.github/scripts/media-variants-picks.json`) ;
  - les photos d'activités sont propres à IRLY (`site/img/own`) ;
  - les portraits de la démo viennent de Pixabay ou de banques CC0, ou ont été fournis par IRLY ;
  - les polices sont sous licence OFL ;
  - la musique est originale, synthétisée pour ce projet.
- **À vérifier avant publication** : les droits et le consentement des personnes visibles sur les photos propres à IRLY, comme le rappelle déjà `marketing/tiktok/07_SEUL_A_DUBAI/LEGENDE.md`.

## 12. Reste à faire

- Valider le slogan « Make Friends IRL » : il vient du brief et n'existe pas dans le code. « Find your people » est le slogan du code et a été utilisé pour Girl.
- Écouter les quatre bandes-son et ajuster les volumes si besoin (vérifiées par mesures uniquement).
- Capturer sur un vrai iPhone ou Android pour une version « native ». Les captures actuelles viennent de la build web de la même version.
- Montrer la carte et une page de communauté Mixte : il faut un environnement où les tuiles et le serveur de test sont accessibles.
- Si le lancement a lieu : remplacer « Bientôt disponible » par les liens des stores.
- Versions anglaises : la démo existe en anglais (`LOCALE=en-US` dans les scripts de capture).

## Statut

| Élément | Statut |
| --- | --- |
| Design system IRLY (canvas) | Terminé et vérifié |
| 20 images | Terminées et vérifiées (dimensions, textes, doublons, relecture visuelle) |
| 4 vidéos | STATUS_VIDEOS |
| Analyse du tweet | Non réalisée (inaccessible) |
| Installation des skills tiers | Non réalisée, par choix (voir § 4-5) |
