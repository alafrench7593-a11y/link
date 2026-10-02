# LinkFoot dans Unreal Engine 5.8

Le match que le moteur LinkFoot a joué, incarné par des footballeurs Unreal. Le moteur décide
tout ; Unreal le montre (pourquoi : `docs/ue5/audit.md`). Le projet et ses modules :
`docs/ue5/projet-unreal.md`. L'animation : `docs/ue5/animation.md`.

## Où on en est

| Partie | État |
| --- | --- |
| Cœur C++ (`LinkFootCore`) | écrit, **compilé et testé ici** : 88 vérifications sur trois vrais matchs et les seize scènes (`tests-coeur`) |
| Couche Unreal (4 modules, 15 fichiers .cpp) | écrite, **jamais compilée par Unreal** : ce dépôt n'a pas d'Unreal. Vérifiée en syntaxe contre les déclarations relevées dans la référence 5.8 (`verif-syntaxe`), y compris la compilation « unity » |
| Scènes de test (§76) | 16 scènes tirées de vrais matchs, dans `LinkFoot/Content/LinkFoot/Scenes` |
| Assets (Animation Blueprint, bases Pose Search, IK Rig, Blueprints, niveau) | **aucun** : ils se créent dans l'éditeur (ci-dessous) |
| Animations de football | **aucune** : à capturer ou acheter (audit, section 8) |

## Vérifier sans Unreal

```bash
# le cœur (CMake 3.20+, un compilateur C++20, Node 22 pour fabriquer les matchs de test)
cmake -S unreal/tests-coeur -B build/coeur -G Ninja && cmake --build build/coeur && ctest --test-dir build/coeur --output-on-failure
# la couche Unreal, en syntaxe seulement
python3 unreal/verif-syntaxe/verifier.py
```

L'intégration continue lance les deux à chaque envoi (`.github/workflows/verifications.yml`).

## Le premier footballeur (§78) : ce qui est fait, ce qu'il reste à faire dans Unreal

Les libellés suivis de **NV** n'ont pas pu être vérifiés dans la documentation d'Epic pour la 5.8 ;
les autres en viennent.

### 1. Installer (une fois)

| Ce qu'il faut | Où | Réglage |
| --- | --- | --- |
| Unreal Engine 5.8.3 | Epic Games Launcher, onglet Unreal Engine, Bibliothèque **NV** | |
| Visual Studio 2026 (recommandé par Epic) ou 2022 17.14 et plus | Visual Studio Installer | la charge de travail C++ pour les jeux ; MSVC 14.38 au moins, 14.50 recommandé. La liste exacte des composants : la page d'Epic « Setting up Visual Studio for C++ projects » |
| Le dépôt, branche `ue5` | `git clone`, puis `git checkout ue5` | le projet est `unreal/LinkFoot/LinkFoot.uproject` |

### 2. Compiler le projet

1. Ouvrir `unreal/LinkFoot/LinkFoot.uproject`. Unreal signale que les modules LinkFoot manquent et
   propose de les compiler : accepter (texte de la fenêtre **NV**).
2. Si la compilation échoue, générer la solution Visual Studio (clic droit sur le `.uproject`,
   « Generate Visual Studio project files » **NV**), ouvrir `LinkFoot.sln`, configuration
   `Development Editor`, plateforme `Win64`, et compiler `LinkFootEditor`.
3. **Me renvoyer les premières erreurs** (fenêtre Sortie de Visual Studio). C'est la première vraie
   compilation : des retouches sont probables, je les fais.

### 3. Lancer les tests d'Unreal

| Action | Menu exact | Réglage |
| --- | --- | --- |
| Activer le greffon de test | Edit > Plugins, chercher « Functional Testing Editor » | coché, puis redémarrer l'éditeur |
| Lancer les tests | Tools > Test Automation | cocher le groupe `LinkFoot`, puis Start Tests |
| Ou en ligne de commande | `UnrealEditor-Cmd.exe "<chemin>\LinkFoot.uproject" -ExecCmds="Automation RunTest LinkFoot;Quit" -ReportExportPath="<dossier>"` | |

Attendu : 4 tests verts (`LinkFoot.Coeur.Scenes`, `LinkFoot.Match.Repere`,
`LinkFoot.Joueur.Trajectoire`, `LinkFoot.Match.Etat`).

### 4. Les animations de locomotion : le Game Animation Sample

| Action | Où | Détail |
| --- | --- | --- |
| Obtenir le projet | Fab, « Game Animation Sample » (gratuit, Epic, mis à jour pour la 5.8 le 12 août 2026) | créer un projet à partir de lui, en 5.8 |
| Le migrer dans LinkFoot | dans ce projet : Content Browser, clic droit sur le dossier des bases Motion Matching (`MotionMatchingData`) et sur le mannequin (`Characters/UEFN_Mannequin`), « Migrate » **NV** | destination : `unreal/LinkFoot/Content`. La migration emporte les animations et le squelette dont ces bases dépendent |
| Greffons manquants | Edit > Plugins | si un asset migré en réclame un (le Game Animation Sample en utilise d'autres que les nôtres), l'activer |

Licence : utilisable dans un jeu Unreal, y compris commercial ; pas hors d'Unreal (d'après la licence de contenu d'Epic ; la fiche Fab elle-même n'a pas pu être lue).

### 5. Les assets à créer dans LinkFoot

| Asset | Menu exact | Réglages |
| --- | --- | --- |
| `BP_LF_Ballon` | Content Browser, Add (+) > Blueprint Class, All Classes : `LFBallon` | composant `Maillage` : une sphère de 22 cm de diamètre (la sphère de base d'Unreal fait 1 m **NV** : échelle 0,22) |
| `ABP_LF_Footballeur` | Add (+) > Animation > Animation Blueprint **NV** | squelette : celui du mannequin migré ; classe parente : `LFAnimInstanceFootballeur` |
| son graphe | dans l'Animation Blueprint | voir `docs/ue5/animation.md`, section 4. Motion Matching (catégorie Pose Search) avec les bases de locomotion migrées ; tirer depuis sa sortie pour ajouter **Pose History** ; dans les détails de Pose History, décocher **Generate Trajectory** et brancher la variable héritée `Trajectoire` sur la broche **Trajectory** ; puis Orientation Warping (Locomotion Angle ← `AngleLocomotion`), Stride Warping (Locomotion Speed ← `VitesseLocomotion`), Leg IK, Output Pose |
| le signal de l'animation choisie | une fonction liée au nœud Motion Matching (libellé de la liaison **NV**) | `Get Motion Matching Search Result`, puis le nom de `SelectedDatabase`, vers `SignalerAnimationChoisie` : sans lui, le HUD dit « animation non signalée » |
| `BP_LF_Footballeur` | Add (+) > Blueprint Class, All Classes : `LFFootballeur` | composant Mesh : le maillage du mannequin ; Anim Class : `ABP_LF_Footballeur`. Garder la position du maillage (pieds au bas de la capsule, lacet −90°) |
| `L_LF_Banc` | File > New Level **NV** | un sol et une lumière ; glisser un `LFDirecteurMatch` (panneau Place Actors, recherche) à l'origine |
| réglages du directeur | panneau Details du `LFDirecteurMatch` | Scene : 1 ; Seulement Le Focus : coché ; Classe Footballeur : `BP_LF_Footballeur` ; Classe Ballon : `BP_LF_Ballon` ; Vitesse Lecture : 1 (0,25 pour un ralenti) |

### 6. Jouer et juger

Lancer le niveau (Play). Le HUD affiche, pour le joueur : écart au moteur, familles attendue et vue,
contact, alertes. Passer ensuite aux scènes 2, 3 et 4 (champ Scene).

Le palier 1 est atteint quand, sur les scènes 1 à 4 : aucun **DESYNC**, aucune **FOOT SLIDE
WARNING**, aucune **ANIMATION DESYNC** sur la locomotion. **CONTACT MANQUÉ** à la scène 4
(réception en course) est attendu tant qu'il n'y a pas de gestes de football ; l'IK du pied vers
`PointContact` (Two Bone IK, Alpha = `PoidsIKContact`) doit le réduire pour les ballons au sol.

Pour voir pourquoi une pose a été choisie : Tools > Debug > Rewind Debugger (greffons Animation
Insights et Pose Search), piste Pose Search, onglets Active Pose, Pose Candidates, Channel
Breakdown.

**Me renvoyer** : une capture du HUD pour chaque scène et les lignes `LinkFoot :` du journal (Output
Log). Je corrige le code d'après elles.
