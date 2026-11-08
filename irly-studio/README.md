# IRLY Studio

Studio de production vidéo marketing réservé à IRLY – Make Friends IRL.
Il s'appuie sur MoneyPrinterTurbo pour le montage des médias. Le motion design, les
sous-titres TikTok, la voix et le mixage sont faits par un module IRLY indépendant.

Ce dossier ne touche ni au code de l'application IRLY, ni à Supabase, ni aux comptes
utilisateurs, ni à l'App Store. MoneyPrinterTurbo est installé à part, sans modification.

## Démarrer

```bash
./setup.sh   # clone MoneyPrinterTurbo à côté du dépôt et installe ses dépendances
./start.sh   # ouvre le studio sur http://localhost:8502
```

Pour ElevenLabs, définir `ELEVENLABS_API_KEY` dans l'environnement avant `./start.sh`.
Pour la génération de scripts par IA, renseigner `llm_provider` et sa clé dans
`MoneyPrinterTurbo/config.toml`. Aucune clé n'est écrite dans ce dépôt.

## Déroulé dans l'interface

1. Choisir la campagne, la version, la durée, la langue, le format et les images par seconde.
2. Générer le script, puis le relire et le modifier partie par partie.
3. Valider le script.
4. Choisir les médias : photos et vidéos, captures réelles de l'app, logo, musique.
5. Générer la voix et l'écouter avant d'aller plus loin.
6. Assembler : MoneyPrinterTurbo fait le montage, le module IRLY ajoute les animations.
7. Relire les sous-titres et les corriger (format SRT).
8. Prévisualiser une image par scène.
9. Exporter le MP4 et le télécharger. La publication reste manuelle.

Les autres pages : **Campagnes IRLY**, **Bibliothèque de médias**, **Historique**.

## Contenu

| Fichier | Rôle |
|---|---|
| `irly_studio/catalog.py` | Les 5 univers IRLY, les 6 campagnes, les accroches et les textes, écrits à la main en français et en anglais |
| `irly_studio/scripts.py` | Scripts en 6 parties (accroche, problème, situation, IRLY, fonctionnalité, appel à l'action), ajustés à 15, 30, 45 ou 60 s. 3 variantes. Option LLM |
| `irly_studio/voice.py` | Voix ElevenLabs (clé), Microsoft Edge (gratuit) ou fichier importé. Féminine ou masculine, 5 tons |
| `irly_studio/subtitles.py` | Calage sur les pauses de la voix (ffmpeg, sans modèle de reconnaissance vocale), blocs de 2 à 5 mots, mots-clés en couleur, SRT modifiable |
| `irly_studio/motion.py` | Motion design : titres animés mot par mot, révélation du logo, iPhone 3D en perspective, cartes d'activités, carte de fin, transitions, zone sûre TikTok |
| `irly_studio/render.py` | Composition image par image, H.264 yuv420p plafonné à 12 Mb/s, musique générée en code, voix et musique mixées à -14 LUFS |
| `irly_studio/mpt_bridge.py` | Appel à la CLI officielle de MoneyPrinterTurbo (médias locaux, voix fournie) et à son module LLM |
| `irly_studio/pipeline.py` | Projet, étapes, historique dans `output/<id>/project.json` |
| `app.py` | Interface Streamlit |
| `demo.py` | Vidéo de démonstration Solitude 30 s |
| `examples/` | La vidéo de démonstration rendue et son affiche |

## Rapport

**Version installée.** MoneyPrinterTurbo 1.3.10, commit `c235354`. Python 3.13, ffmpeg système,
Streamlit 1.66. Toutes les dépendances viennent de `requirements.txt` de MoneyPrinterTurbo, plus
pytest pour les tests.

**Services utilisés et coûts.**

| Service | Usage | Coût |
|---|---|---|
| MoneyPrinterTurbo | Montage | Gratuit (open source) |
| Musique | Générée en code | Gratuit, sans droits |
| Microsoft Edge TTS | Voix | Gratuit, sans clé |
| ElevenLabs | Voix de la démo, via ton connecteur | Environ 890 crédits pour 2 prises, soit à peu près 0,16 $ |
| LLM (facultatif) | Scripts | Selon le fournisseur choisi dans `config.toml` |

**Tests réalisés.**

| # | Test | Résultat |
|---|---|---|
| 1 | Installation | OK : clonage, environnement Python, dépendances |
| 2 | Démarrage | OK : interface servie (HTTP 200, `/_stcore/health` = ok) |
| 3 | Génération de script | OK : 6 campagnes × 4 durées × 3 variantes × 2 langues, chaque script tient dans sa durée |
| 4 | Voix | Fichier importé : OK. Edge TTS : erreur claire, réseau bloqué dans cet environnement de test. ElevenLabs : erreur claire sans clé |
| 5 | Import de médias | OK : bibliothèque et montage avec médias locaux |
| 6 | Montage MoneyPrinterTurbo | OK : 3 photos et la voix, environ 2 min 30 |
| 7 | Motion design | OK : toutes les scènes en 9:16 et en 16:9, capture réelle affichée dans le téléphone |
| 8 | Sous-titres | OK : calage sur les pauses, aller-retour SRT, texte dans la zone sûre |
| 9 | Export | OK : MP4 1080×1920, 30 i/s, yuv420p, AAC, -14,1 LUFS, crête -1,4 dBTP. Test 1920×1080 en 60 i/s : OK |
| 10 | Variantes | OK : 3 scripts différents par campagne, accroches au choix |
| 11 | Gestion des erreurs | OK : campagne inconnue, langue sans texte, clé absente, aucun média, voix indisponible |
| 12 | Historique | OK : projets relus et rouverts |
| — | Parcours dans l'interface | OK : script généré et validé, les 4 pages s'ouvrent sans erreur (Streamlit AppTest) |

Au total, 160 tests unitaires passent : `<venv MPT>/bin/python -m pytest tests -q`.

**Limitations.**

- **Edge TTS** n'a pas pu être testé ici, car le réseau de l'environnement de test bloque le service.
  Il marche normalement sur un ordinateur classique, sans clé.
- **Langues :** l'espagnol, l'allemand et l'italien ont besoin du LLM. Les textes écrits à la main
  couvrent le français et l'anglais.
- **Images d'illustration :** aucune banque d'images (Pexels, Pixabay) n'est branchée. Les vidéos
  utilisent les médias que tu importes. Une clé Pexels dans `config.toml` permettrait de l'ajouter.
- **Écran du téléphone :** sans captures réelles, il montre le logo IRLY. La campagne 6
  « Comment utiliser IRLY » a besoin des vraies captures.
- **Logo :** sans logo importé, le studio affiche le logotype texte « IRLY ».
- **Calage des sous-titres :** il est précis à la phrase près, et réparti au prorata à l'intérieur
  d'une phrase. Corrige le SRT si un mot doit tomber pile.
- **Export 4K :** non proposé. Le moteur est prévu pour le 1080p.
- **Durée de rendu :** environ 2 min de montage MoneyPrinterTurbo, puis 2 min de motion design pour 30 s.
