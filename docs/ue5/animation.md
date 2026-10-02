# LinkFoot dans Unreal 5.8 : l'architecture d'animation

Étapes 5 à 8 du cahier : l'architecture d'animation, un premier footballeur humain, les onze
systèmes de l'étape 7 (squelette, IK Rig, Control Rig, Motion Matching, Pose Search, locomotion,
appuis, accélération, freinage, virages, ballon), puis le test.

Ce qui existe : le code C++ (cœur portable testé ici, couche Unreal vérifiée en syntaxe). Ce qui
n'existe pas encore : **aucun asset Unreal** (pas de .uasset dans le dépôt : Animation Blueprint,
bases Pose Search, IK Rig, niveau). Ils se créent dans l'éditeur ; `unreal/README.md` donne les
menus. Les libellés de l'éditeur relevés dans la documentation d'Epic pour la 5.8 sont donnés tels
quels ; ceux qui n'ont pas pu l'être sont marqués **NV** (non vérifié).

## 1. Le principe : le moteur place, l'animation incarne

- Le moteur LinkFoot a déjà joué le match. Unreal ne déplace personne : chaque footballeur est posé,
  à chaque image, là où le moteur l'a mis, orienté comme son corps dans le moteur.
- L'animation choisit **comment** le corps arrive là, jamais **où** il va. Si elle l'emmenait
  ailleurs, le détecteur de désynchronisation le dirait (DESYNC au-delà de 30 cm pendant 0,2 s).
- Motion Matching reçoit le **vrai** passé et le **vrai** futur du joueur : en relecture, le moteur
  les a déjà joués. Rien n'est prédit. En direct (phase 5), le moteur tourne avec 1,2 s d'avance
  sur l'écran pour que ce futur existe encore.

## 2. La chaîne, image par image

| Ordre | Qui | Ce qu'il fait |
| --- | --- | --- |
| 1 | `ALFDirecteurMatch` (avant tout le monde) | avance l'horloge du match (`ULFMatchSubsystem::Avancer`) |
| 2 | `ALFFootballeur` | pose la capsule à la position du moteur (lissée, 25 cm d'écart au plus, voir l'audit), le lacet du corps ; cache le joueur hors du terrain ; `bCoupe` quand le moteur l'a replacé |
| 3 | le maillage, **après** l'acteur (`AddTickPrerequisiteActor`) | `ULFAnimInstanceFootballeur` remplit ses propriétés (section 3), puis le graphe de l'Animation Blueprint choisit la pose |
| 4 | `ULFComposantControle` (groupe de tick `TG_PostUpdateWork`) | compare les os de cette image au moteur : DESYNC, ANIMATION DESYNC, FOOT SLIDE WARNING, IMPOSSIBLE MOVEMENT, CONTACT MANQUÉ |
| 5 | `ALFHUDDebug` | affiche tout cela par joueur (§71) |

## 3. Ce que la classe d'animation donne au graphe

`ULFAnimInstanceFootballeur` est la classe parente des Animation Blueprint des footballeurs. Elle
ne joue aucune animation : elle traduit ce que le moteur a joué en entrées des nœuds d'Unreal.

| Propriété | Unité | D'où | Nœud qui la lit |
| --- | --- | --- | --- |
| `Trajectoire` | `FTransformTrajectory`, monde, cm | 10 échantillons de passé toutes les 0,04 s, le présent, 8 de futur toutes les 0,2 s (les valeurs par défaut d'Epic) ; l'échantillon de temps 0 est l'image précédente, la convention de Pose History | broche **Trajectory** du nœud **Pose History**, avec **Generate Trajectory** décoché |
| `AngleLocomotion` | degrés, + à droite | direction du mouvement par rapport au corps | **Orientation Warping**, Locomotion Angle |
| `VitesseLocomotion`, `Vitesse` | cm/s | vitesse du moteur | **Stride Warping**, Locomotion Speed |
| `Bande`, `Phase`, `Allure`, `Virage` | énumérations | arrêt, marche, trot, course, rapide, sprint (0,3 ; 2 ; 4 ; 6 ; 8 m/s) ; stable, démarrage, accélération, freinage, arrêt ; avant, latéral, recul ; virage par classes de 30 à 180° | le choix des bases (section 5) |
| `AccelerationLongitudinale`, `VirageDeg`, `RayonVirage` | cm/s², degrés, cm | le long du mouvement ; changement de cap sur 0,6 s ; v²/a | le choix des bases, le débogage |
| `CibleRegard`, `bRegardValide` | point du monde | le ballon, la passe qui arrive, le partenaire à servir, le but visé, devant soi en conduite, un coup d'œil par-dessus l'épaule (`LFRegard`) | **Look At** (ou un Control Rig) |
| `bContact`, `TempsAvantContact`, `GenreContact`, `Surface`, `bPiedFaible`, `QualiteControle` | | le prochain contact avec le ballon, annoncé jusqu'à 1,2 s avant, gardé 0,25 s après | le choix des gestes ; l'IK du contact |
| `PointContact`, `PointContactLocal` | cm | le **centre** du ballon au contact, dans le monde et dans le repère du corps (X devant, Y à droite, Z hauteur) | **Two Bone IK** du pied ou de la tête (Effector Location) |
| `PoidsIKContact` | 0 à 1 | monte pendant 0,25 s jusqu'au contact, retombe en 0,12 s | Alpha de cet IK |
| `Energie`, `bFatigue` | 0 à 100 | l'énergie du moteur (fatigué sous 60) | une couche de posture |
| `TypeCorps`, `Explosivite`, `Agilite`, `Equilibre`, `Foulee` | | la carte du joueur (`LFCorps`) | le choix des bases, le maillage |
| `FamilleAttendue` | énumération | ce que le moteur fait faire au joueur (29 familles) | le contrôle (section 6) |

## 4. Le graphe de l'Animation Blueprint

```
Bases à chercher (palier 1 : les bases de locomotion du Game Animation Sample)
        │
Motion Matching (catégorie Pose Search) ◄── Pose History : Trajectory = Trajectoire,
        │                                     Generate Trajectory décoché
Local To Component
        │
Orientation Warping     Locomotion Angle = AngleLocomotion
        │               IK Foot Root Bone, IK Foot Bones, Spine Bones
Stride Warping          Locomotion Speed = VitesseLocomotion
        │               Pelvis Bone, Foot Definitions
Leg IK                  les appuis (Foot Placement existe aussi : expérimental)
        │
Two Bone IK             le pied (ou la tête) vers PointContact, Alpha = PoidsIKContact
        │
Look At                 CibleRegard
        │
Component To Local ──► Output Pose
```

Les nœuds viennent de la documentation 5.8 : Motion Matching et Pose History (greffon Pose Search),
Orientation et Stride Warping (greffon Animation Warping, qui exige des animations avec root motion
et un IK Rig), Leg IK, Two Bone IK et Look At (module AnimGraphRuntime, sans greffon). Foot
Placement, Offset Root Bone et Slope Warping sont marqués expérimentaux par Epic ; le palier 1 s'en
passe.

Le **root motion** des animations ne doit jamais déplacer l'acteur : le moteur le place. Le
mouvement de personnage d'Unreal est désactivé dans `ALFFootballeur` ; dans l'Animation Blueprint,
ne pas choisir « No Root Motion Extraction » (le corps quitterait la capsule, et DESYNC le dirait).
Le réglage exact qui convient le mieux (celui du Game Animation Sample ou « Ignore Root Motion ») :
**NV**, à trancher au premier essai avec le détecteur.

## 5. Les bases de mouvements et leur nom

Motion Matching cherche dans des bases Pose Search (`UPoseSearchDatabase`), décrites par un schéma
(`UPoseSearchSchema`). L'exemple d'Epic pondère la pose à 1,0 et la trajectoire à 3,0 ; c'est le
point de départ.

- **Palier 1** (un joueur, locomotion) : les bases de locomotion du Game Animation Sample, telles
  quelles. Avec une trajectoire juste, la recherche choisit seule les démarrages, arrêts et pivots :
  c'est le rôle de Motion Matching.
- **Palier 2** (le ballon) : des bases par geste, choisies selon `GenreContact` et
  `TempsAvantContact` (un Chooser, ou `Set Databases To Search` dans la fonction de mise à jour du
  nœud). Elles demandent des captures de football (audit, section 8).

**La convention de nom**, pour que le contrôle sache quelle famille Unreal montre : le nom de la base
(ou de l'animation) contient **un** mot-clé de cette liste. Le premier trouvé dans cet ordre gagne,
majuscules indifférentes (`LFFamilles.cpp`).

| Famille | Mots-clés |
| --- | --- |
| célébration | `celebr` |
| chute | `getup`, `get_up`, `ragdoll`, `fall`, `chute` |
| déséquilibre | `stumble`, `stagger`, `desequilibre` |
| plongeon, prise, sortie, arrêt | `dive`, `plongeon` ; `claim`, `catch`, `prise` ; `sortiepieds`, `sortie_pieds` ; `parade`, `save` |
| tacle glissé, tacle, interception | `slide`, `glisse` ; `tackle`, `tacle` ; `intercept` |
| tête, tir, centre, touche, dégagement, passe | `header`, `tete` ; `volley`, `shoot`, `shot`, `tir` ; `cross`, `centre` ; `throw`, `touche` ; `clear`, `degagement` ; `pass` |
| réception, protection, dribble | `receive`, `reception`, `control`, `first_touch` ; `shield`, `protect` ; `dribble`, `crochet`, `feint` |
| pivot, démarrage, freinage | `pivot`, `turn`, `virage` ; `start`, `demarrage` ; `stop`, `brake`, `freinage` |
| recul, latéral | `backpedal`, `recul` ; `strafe`, `shuffle`, `lateral` |
| sprint, course, trot, marche, immobile | `sprint` ; `run`, `course` ; `jog`, `trot` ; `walk`, `marche` ; `idle`, `stand`, `immobile` |

Exemples : `PSD_LF_Sprint`, `PSD_LF_Freinage`, `PSD_LF_Reception_Course` (réception). Un mot qui
en contient un autre trompe le contrôle : `Return` contient `turn`, `Crossover` contient `cross`.
Les noms des bases du Game Animation Sample (Starts, Stops, Pivots, Idles, Walk, Jog, Run) sont
reconnus tels quels ; leur liste exacte est **NV** (à relever dans le projet).

Pour que le contrôle sache ce qui a été choisi, l'Animation Blueprint appelle
`SignalerAnimationChoisie` avec le nom de la base retenue, depuis une fonction liée au nœud Motion
Matching qui lit `Get Motion Matching Search Result` (son champ `SelectedDatabase`). Les fonctions
existent dans l'API 5.8 ; le libellé exact de la liaison dans le panneau Détails est **NV**.

## 6. Les onze systèmes de l'étape 7

| Système | Fait en C++ et testé | À créer dans l'éditeur | Ce qui le vérifie |
| --- | --- | --- | --- |
| Squelette | le morphotype et l'échelle de chaque joueur (`LFCorps` : dix morphotypes, échelle = taille / 180) | le maillage et le squelette du mannequin du Game Animation Sample ; les MetaHumans au palier 4 (reciblage UEFN vers MetaHuman fourni par Epic) | tests du cœur §43 §44 ; DESYNC sur l'os racine |
| IK Rig | | un IK Rig du mannequin (Add (+) > Animation > IK Rig ; bouton **Auto Create IK**) : il sert au warping et au reciblage | FOOT SLIDE WARNING |
| Control Rig | les cibles : `PointContactLocal`, `CibleRegard` | facultatif au palier 1 ; au palier 2, un Control Rig de contact (Full Body IK, greffon expérimental) si Two Bone IK ne suffit pas | CONTACT MANQUÉ |
| Motion Matching | `Trajectoire`, construite du moteur (test Unreal `LinkFoot.Joueur.Trajectoire` : 19 échantillons, chacun à 1 cm du moteur) | le nœud Motion Matching et Pose History | ANIMATION DESYNC |
| Pose Search | la convention de nom (section 5) | un schéma et des bases (Add (+) > Animation > Motion Matching > Pose Search Schema / Pose Search Database), ou ceux du Game Animation Sample | ANIMATION DESYNC ; Rewind Debugger |
| Locomotion | `Vitesse`, `Bande`, `Allure`, `Effort` | les bases de locomotion | DESYNC, ANIMATION DESYNC |
| Appuis | | Leg IK (ou Foot Placement, expérimental) | FOOT SLIDE WARNING : un pied posé (os sous 3 cm) qui va à plus de 15 cm/s pendant 0,1 s ; PIED SOUS LE SOL (2 cm) ; PIED QUI FLOTTE (4 cm) |
| Accélération | `AccelerationLongitudinale`, `Phase` = démarrage ou accélération, `Explosivite` | les bases de démarrage | famille démarrage ; IMPOSSIBLE MOVEMENT au-delà de 14 m/s² |
| Freinage | `Phase` = freinage ou arrêt | les bases d'arrêt | famille freinage ; IMPOSSIBLE MOVEMENT |
| Virages | `AngleLocomotion`, `VirageDeg`, `RayonVirage`, `Virage` | Orientation Warping ; les bases de pivots | famille pivot ; rotation impossible (720°/s au-delà de 4 m/s) |
| Ballon | le contact : genre, surface, pied (règle du moteur), qualité du contrôle, point, temps restant, poids d'IK | Two Bone IK vers `PointContact` ; puis les bases de gestes (captures de football) | **CONTACT MANQUÉ** : la partie du corps qui joue à plus de 15 cm de la surface du ballon pendant les 0,05 s autour de l'instant du moteur |

Le détecteur de contact a été vérifié sur 6 199 contacts de trois vrais matchs : à 60 images par
seconde, le ballon rendu passe exactement (0 cm) par chaque point de contact du moteur à son instant.
Un pied qui va au point du moteur touche donc le ballon qu'on voit.

## 7. Le test (étape 8)

Hors d'Unreal, à chaque modification (et en intégration continue) :

- `unreal/tests-coeur` : 88 vérifications du cœur sur trois vrais matchs et les seize scènes ;
- `python3 unreal/verif-syntaxe/verifier.py` : la couche Unreal contre les déclarations relevées
  dans la référence 5.8 (syntaxe seulement).

Dans Unreal (après la première compilation) :

- les tests d'automatisation du groupe `LinkFoot` (4 tests : scènes, repère, trajectoire, état du
  match), depuis **Tools > Test Automation** (greffon Functional Testing Editor) ou en ligne de
  commande avec `-ExecCmds="Automation RunTest LinkFoot;Quit"` ;
- la scène 1 (sprint droit), puis 2 (virage à 90°), 3 (sprint et arrêt), 4 (réception en course),
  avec `bSeulementLeFocus` : le HUD affiche, pour le joueur, l'écart au moteur, les familles
  attendue et vue, le contact, et les alertes ;
- le **Rewind Debugger** (Tools > Debug > Rewind Debugger ; greffons Animation Insights et Pose
  Search) : piste Pose Search, onglets Active Pose, Pose Candidates, Channel Breakdown, pour voir
  pourquoi une pose a été choisie.

Le palier 1 (§78) est atteint quand, sur les scènes 1 à 4 : aucun DESYNC, aucune FOOT SLIDE
WARNING, aucune ANIMATION DESYNC sur la locomotion. CONTACT MANQUÉ à la scène 4 est attendu tant que
les gestes de ballon ne sont pas capturés ; l'IK de contact doit le réduire pour les ballons au sol.

## 8. Ce qui reste à vérifier dans l'éditeur

- le libellé de la liaison de fonction du nœud Motion Matching (section 5) ;
- les noms des bases du Game Animation Sample et de leur schéma ;
- le réglage de root motion de l'Animation Blueprint (section 4) ;
- l'orientation du maillage : `ALFFootballeur` le tourne de −90° (mannequins d'Epic) ; si la
  trajectoire affichée est tournée d'un quart de tour par rapport au corps,
  `DecalageLacetTrajectoire` la corrige ;
- si `FTransformTrajectory::GetSampleAtTime` interpole entre deux échantillons : la trajectoire
  fournie a déjà ses échantillons aux instants demandés, ce qui rend la question secondaire.
