# LinkFoot dans Unreal 5.8 : le projet et ses modules C++

Étapes 3 et 4 du cahier : UNREAL PROJECT STRUCTURE et C++ MODULE ARCHITECTURE. L'audit
(`docs/ue5/audit.md`) dit pourquoi Unreal ne simule rien ; l'architecture d'animation est dans
`docs/ue5/animation.md` ; la procédure dans l'éditeur, dans `unreal/README.md`.

## 1. Où est le projet, et ce qu'il contient

```
unreal/
  LinkFoot/                         le projet Unreal (Unreal Engine 5.8)
    LinkFoot.uproject               cinq modules, dix greffons
    Config/DefaultEngine.ini        mode de jeu par défaut : LFModeDeJeu
    Config/DefaultGame.ini          les scènes partent avec le jeu empaqueté
    Content/LinkFoot/Scenes/        les 16 scènes de test (§76), JSON du moteur (1,6 Mo)
    Source/
      LinkFoot.Target.cs            cible Game
      LinkFootEditor.Target.cs      cible Editor
      LinkFootCore/                 le cœur portable : C++20 pur, sans Unreal
      LinkFootMatch/                le match dans le monde : sous-système, types, ballon
      LinkFootPlayer/               le footballeur et son animation
      LinkFootDebug/                les détecteurs et le HUD de débogage
      LinkFoot/                     le module de jeu : mode de jeu, directeur, tests
  tests-coeur/                      le cœur compilé et testé hors d'Unreal (CMake)
  verif-syntaxe/                    la couche Unreal vérifiée hors d'Unreal (g++ -fsyntax-only)
```

Ce qui n'est pas dans le dépôt : les assets (`.uasset`, `.umap`). Les dossiers prévus dans
`Content/LinkFoot`, avec les préfixes d'usage :

| Dossier | Assets | Créé quand |
| --- | --- | --- |
| `Animation/` | `ABP_LF_Footballeur` (parent `LFAnimInstanceFootballeur`), `PSS_LF_*` (schémas), `PSD_LF_*` (bases), `CHT_LF_*` (Chooser), `IK_LF_*`, `RTG_LF_*` | palier 1 (`unreal/README.md`) |
| `Personnages/` | `BP_LF_Footballeur` (parent `LFFootballeur`), `DA_LF_Personnages` (`LFDefinitionsPersonnages` : un maillage par morphotype) | palier 1, puis 4 |
| `Ballon/` | `BP_LF_Ballon` (parent `LFBallon`) et son maillage | palier 1 |
| `Cartes/` | `L_LF_Banc` : un sol, une lumière, un `LFDirecteurMatch` | palier 1 |
| `Stade/`, `Public/`, `Son/` | stade, foule, ambiance | palier 4 |

Le contenu du Game Animation Sample (mannequin, animations, bases) garde ses propres dossiers une
fois migré : ses Blueprints y renvoient par chemin.

## 2. Les modules et leurs dépendances

```
LinkFootCore  ◄── LinkFootMatch ◄── LinkFootPlayer ◄── LinkFootDebug
     ▲                 ▲                  ▲                  ▲
     └─────────────────┴──────── LinkFoot (module de jeu) ───┘
```

Une seule direction : un module ne connaît que ceux qui sont à sa gauche. Aucun module ne dépend
du débogage, sauf le module de jeu qui assemble tout.

| Module | Dépend de | Rôle |
| --- | --- | --- |
| `LinkFootCore` | Core | lire un document du moteur et en tirer tout ce que le rendu demande. Sans Unreal : compilé dans le module avec `bUseUnity = false`, `bEnableExceptions = false`, sans PCH ; le même code est compilé et testé hors d'Unreal (`unreal/tests-coeur`, g++ et clang, avertissements en erreurs) |
| `LinkFootMatch` | Core, CoreUObject, Engine, LinkFootCore | le match dans un monde Unreal : un `UWorldSubsystem` qui charge le document, tient l'horloge, convertit les repères ; les types réfléchis (énumérations, structures) ; le ballon |
| `LinkFootPlayer` | + LinkFootMatch | le footballeur (capsule posée par le moteur), sa classe d'animation, les maillages par morphotype |
| `LinkFootDebug` | + LinkFootPlayer | les détecteurs (§72 à §75, §82) posés sur chaque footballeur, le HUD (§71) |
| `LinkFoot` | tous | le mode de jeu, le directeur du match, les tests d'automatisation |

## 3. Les classes

### Le cœur (`LinkFootCore`, espace de noms `lf`)

| Fichier | Contenu |
| --- | --- |
| `LFJson` | un lecteur JSON strict (sans dépendance) |
| `LFDocument` | le document `linkfoot-match` v1 : feuille de match, images, actions, événements, résultat, scène, délibérations du moteur (mode débogage) ; refuse un document qui ment (version, ordre du temps, empreinte) |
| `LFRepere` | le repère du moteur vers celui d'Unreal, au bit près de `src/passerelle.js` ; le rayon du ballon |
| `LFCinematique` | la position, la vitesse, l'accélération et l'orientation de chaque joueur à n'importe quel instant (courbe qui passe par chaque image du moteur, lissage borné à 25 cm) ; le ballon, par la formule même de chaque vol |
| `LFTrajectoire` | la trajectoire de Motion Matching : le vrai passé, le vrai futur |
| `LFLocomotion` | le mouvement en mots de locomotion : bande de vitesse, phase, allure, virage, effort ; l'un des 15 types de course du cahier « qualité visuelle » |
| `LFRegard` | où le joueur regarde ; la tête et les yeux séparés du corps, dans leurs limites |
| `LFVisage` | 8 expressions et 8 gestes, nés des actions du match, à l'amplitude du caractère du joueur |
| `LFPhysiologie` | le souffle, la sueur, la pluie, la posture de fatigue, tirés de ce que le joueur a couru |
| `LFContact` | le prochain contact avec le ballon : instant, genre, surface, pied, qualité de contrôle, point dans le repère du corps |
| `LFFamilles` | la famille d'animation attendue (moteur) et vue (nom de la base choisie) |
| `LFDetecteurs` | DESYNC, ANIMATION DESYNC, FOOT SLIDE WARNING, IMPOSSIBLE MOVEMENT, CONTACT MANQUÉ ; la porte de qualité (VALIDE, À REPRENDRE, NE PAS LIVRER) |
| `LFEtatMatch` | l'état du match à tout instant (score, horloge, possession, statistiques d'équipe et de joueur), recalculé des actions selon les règles du moteur |
| `LFCorps` | de la carte au corps : dix morphotypes, échelle, foulée, explosivité, agilité, équilibre, longueur de jambe ; la foulée de ce corps à cette vitesse (pas, cadence, buste) |
| `LFScene` | ce que chaque scène de test doit montrer, vérifié |

### La couche Unreal

| Classe | Module | Rôle |
| --- | --- | --- |
| `ULFMatchSubsystem` | Match | charge une scène ou un fichier ; horloge (`Avancer`, `DefinirTemps`) ; `Etat()` rend `FLinkFootMatchState` (§6) ; repère du terrain (`DefinirRepere`, `PositionMonde`, `LacetMonde`) |
| `FLinkFootMatchState` et les types `ELF*`, `FLF*` | Match | l'état du match pour les Blueprints et l'interface ; chaque énumération est vérifiée égale à celle du cœur à la compilation (`static_assert`) |
| `ALFBallon` | Match | le ballon, posé par le moteur ; il roule sans glisser |
| `ALFFootballeur` | Player | un `ACharacter` dont le mouvement d'Unreal est éteint : la capsule est posée par le moteur ; morphotype, échelle, maillage, classe d'animation ; caché hors du terrain |
| `ULFAnimInstanceFootballeur` | Player | la classe parente des Animation Blueprint (docs/ue5/animation.md) ; pour le cahier « qualité visuelle » : tête et yeux, type de course, foulée, expressions, geste, souffle, sueur, caractère |
| `ULFComposantPeau` | Player | sur chaque footballeur : la sueur, la pluie et l'effort envoyés aux matériaux (données de primitive) |
| `ULFDefinitionsPersonnages` | Player | un Data Asset : un maillage par morphotype, la classe d'animation |
| `ULFComposantControle` | Debug | les détecteurs, sur les os de chaque image ; ce qu'ils ont compté depuis le dernier bilan |
| `ALFHUDDebug` | Debug | étiquettes au-dessus des joueurs et panneau du §71, dernière décision comprise ; la porte de qualité ; `bModeReel` n'affiche rien |
| `ALFModeDeJeu` | LinkFoot | pion spectateur, HUD de débogage |
| `ALFDirecteurMatch` | LinkFoot | posé dans un niveau : charge, fait entrer les joueurs (le seul joueur mis en avant au palier 1), avance l'horloge, ralenti, boucle ; à chaque boucle, le verdict de la porte de qualité |
| tests `LinkFoot.*` | LinkFoot | scènes, repère, trajectoire, état du match, données du cahier « qualité visuelle » |

Le contrat de la passerelle (`docs/passerelle-ue5.md`, section 4) prévoyait d'autres noms
(`ULFBridgeSubsystem`, `ALFFootballer`...) ; les classes ci-dessus les remplacent. Restent à écrire,
aux phases suivantes : la lecture en direct (flux), la caméra de retransmission, le gardien (choix
du plongeon), la foule, le son.

## 4. Les données

- **Entrée** : un document `linkfoot-match` v1 (JSON) produit par `src/passerelle.js`. Les scènes
  de test sont extraites de vrais matchs par `node tools/scenes-ue5.mjs` ; elles portent les cibles
  de l'IA (mode débogage du moteur) pour le panneau du §71.
- **Empaquetage** : les scènes ne sont pas des assets ; `DirectoriesToAlwaysStageAsUFS` les
  embarque (chemin relatif à Content). Le nom exact de la section d'`ini` est NV.
- **Une seule source de vérité** : rien dans Unreal ne recalcule le match. Les statistiques
  affichées sont recalculées des actions selon les règles du moteur, et vérifiées égales au résultat
  du moteur (tests du cœur, trois matchs).

## 5. Les choix de compilation

- C++20 (le défaut et le minimum d'Unreal 5.8) ; `BuildSettingsVersion.Latest`,
  `EngineIncludeOrderVersion.Latest`, comme le recommande la référence des cibles.
- Le cœur : sans exception, sans RTTI, sans en-tête d'Unreal ; ses fonctions et classes publiques
  portent `LFCORE_API` (export du module).
- Les littéraux `TEXT()` restent en ASCII ; le texte accentué passe par `UTF8_TO_TCHAR`.
- Compilation « unity » : `verif-syntaxe` colle les fichiers d'un module comme le fait Unreal, pour
  qu'aucun nom ne s'y heurte.
