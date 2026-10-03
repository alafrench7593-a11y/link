# LinkFoot pour Unreal Engine 5.8 : l'audit

Réponse aux étapes 1 et 2 du cahier « LINKFOOT, AAA FOOTBALL SIMULATION » (2 octobre 2026) :
ce qui existe, ce qui se garde, ce qui change, ce qui passe dans Unreal, ce qui reste web, ce qui
manque, de quoi on dépend, ce qui peut casser. Les mesures citées viennent du code et des tests du
dépôt (`unreal/tests-coeur`, `test/passerelle.js`), pas d'estimations.

Version visée : **Unreal Engine 5.8** (sortie le 17 juin 2026, correctif 5.8.3 du 22 septembre
2026). Epic la donnait pour la dernière version majeure prévue d'Unreal 5 ; une 5.9 a depuis été
annoncée selon la presse (août 2026), sans date ni préversion. Les API utilisées ont été relevées dans
la référence d'Epic pour la 5.8 ; ce qui n'a pas pu l'être est marqué « non vérifié ».

## Deux décisions avant tout le reste

**1. Il n'y aura pas de seconde simulation dans Unreal.** Le cahier place `MatchSimulation`,
`PlayerAI`, `TeamAI`, `DecisionEngine`, `BallPhysics` côté Unreal (§5, §86) et exige en même temps
une seule source de vérité (§6) et une seule simulation pour la 2D et la 3D (§7). Les deux ne
tiennent pas ensemble : le moteur LinkFoot joue déjà ces rôles (section 1), il fait autorité en
ligne (le serveur rejoue chaque match par sa graine), et les résultats, l'XP, l'argent et les
divisions en dépendent. Réécrire l'IA en C++ ferait jouer deux matchs différents. Unreal **lit** le
match du moteur et l'**incarne** : `FLinkFootMatchState` existe dans Unreal (§6), mais il se lit dans
le document du moteur, il ne se calcule pas à côté. Si un jour Unreal doit tourner sans Node, la
voie est un seul cœur de simulation compilé deux fois (C++ natif et WebAssembly pour le web), pas
deux moteurs.

**2. Le premier palier (§78) dépend d'animations que le code ne fabrique pas.** Motion Matching
choisit des poses dans des captures de mouvement. Le Game Animation Sample d'Epic (gratuit, mis à
jour pour la 5.8 le 12 août 2026) couvre la locomotion : plus de 500 animations, démarrages,
arrêts, pivots ; sa mise à jour 5.8 ajoute des interactions à deux (bousculades, plaquages, mises
au sol), utiles aux duels. Aucun geste de ballon. « Recevoir, contrôler, passer, tirer » demande
des captures de football (achetées ou tournées). Sans elles, le joueur court juste, mais ses gestes
de ballon seront ceux d'une base générique.

## 1. CURRENT ARCHITECTURE : ce qui existe

```
app/ (Expo, React Native)        canvas/Club.dc.html (Mon Club)        server/ (en ligne)
        \                                  |                                /
         `-------------- src/ : le moteur et les règles du manager -------'
                          engine.js   simulation 2,5D, 22 joueurs, 10 pas par seconde
                          club.js et ses modules : cartes, packs, compétences, entraînement,
                          division, quêtes, économie, transferts, direct (direct.js)
                          stade3d.js  rendu three.js du match et du pack (app et canvas)
                          passerelle.js  le match exporté pour un autre rendu
                                  |
                                  | document linkfoot-match v1 (docs/passerelle-ue5.md)
                                  v
unreal/LinkFoot   LinkFootCore (C++20 sans Unreal) → LinkFootMatch → LinkFootPlayer → LinkFootDebug → LinkFoot
```

| Partie | Où | Ce qu'elle fait | État |
| --- | --- | --- | --- |
| Moteur de match | `src/engine.js` (1 736 lignes) | IA du porteur, IA collective, gardien, tactique, compétences, fatigue, ballon, coups de pied arrêtés | en service, testé (`test/leviers.js`, `test/styles.js`, `test/traits.js`, `test/match.js`) |
| Club et manager | `src/club.js` et 25 modules | cartes, raretés, packs, compétences, entraînement, transferts, divisions, quêtes | en service |
| Rendus | `src/stade3d.js`, `app/src/terrain.js`, canvas | 2D, 3D three.js (téléphone et web), direct | en service ; ils ne décident rien |
| Serveur | `server/`, `api/` | rejoue chaque match en ligne par sa graine, fait autorité | en service |
| Passerelle | `src/passerelle.js` | le document du match : feuille, 10 images par seconde, actions datées, événements, résultat, empreintes, délibérations en mode débogage | 52 vérifications (`test/passerelle.js`) |
| Cœur C++ | `unreal/LinkFoot/Source/LinkFootCore` | lecture, repère, cinématique, trajectoire de Motion Matching, regard, contacts, état du match, statistiques, morphotypes, détecteurs, délibérations, scènes | compilé ici (g++ et clang, avertissements en erreurs) ; 96 vérifications |
| Couche Unreal | `unreal/LinkFoot/Source/LinkFoot*` | sous-système du match, ballon, footballeur, instance d'animation, contrôle, HUD de débogage, directeur, tests d'automatisation | écrite ; **pas compilée par Unreal** (section 8) |
| Scènes de test | `unreal/LinkFoot/Content/LinkFoot/Scenes` | les 16 scènes du §76, tirées de vrais matchs | extraites par `tools/scenes-ue5.mjs`, vérifiées par le cœur |

## 2. WHAT CAN BE REUSED : ce qui se garde

- **Tout le moteur.** Ce que le cahier demande à `UPlayerFootballAI`, `UTeamFootballAI`,
  `UGoalkeeperAI` et au moteur tactique existe et se mesure (tableau de correspondance :
  `docs/passerelle-ue5.md`, section 2.1). La chaîne du §1 (données, attributs, IA, décision,
  mouvement) y est prouvée par les tests de leviers et de traits ; Unreal reprend à partir du
  mouvement.
- **Tout le club** (§62 à §70, `src/club.js` et les autres modules de `src/`) : cartes, valeur,
  entraînement, blessures hors match, pack unique
  aux six raretés, club de départ avec un joueur rare, économie, compétitions. Rien de cela n'a
  à passer dans Unreal.
- **La passerelle et le cœur C++.** Le cœur se compile dans le module `LinkFootCore` tel quel (pas
  d'exception, pas de RTTI, pas d'en-tête d'Unreal). Il est la seule façon de lire le match dans
  Unreal, et il est testé hors d'Unreal sur de vrais matchs du moteur.
- **Les tests**, qui deviennent les critères d'acceptation du rendu : un rendu qui suit le moteur à
  60 images par seconde ne déclenche aucun détecteur ; il reste à le prouver dans Unreal.

## 3. WHAT MUST CHANGE : ce qui doit changer

Ce que la lecture du moteur par le cœur C++ a trouvé. Chaque point est mesuré par un test (le nom
du test entre parenthèses) ; les sept premiers ne se cachent pas au rendu, ils se corrigent dans
le moteur, puisque c'est lui qui fait autorité.

| # | Constat | Mesure | Pourquoi ça se voit | Où |
| --- | --- | --- | --- | --- |
| 1 | Les contacts se règlent en poussant les joueurs | 20 346 à-coups au-delà de 14 m/s² sur 1 463 minutes-joueur rendues à 60 images/s, 3 886 après lissage | pieds qui glissent, corps qui sautent | `move()`, collisions |
| 2 | Le ballon suit son porteur à 0,5 à 1,4 m, sans touches | aucune touche dans le document | §25 « jamais collé au pied » | `ballStep()` |
| 3 | Un contrôle raté ne coûte presque rien | le receveur reprend le ballon au pas suivant 350 fois sur 390 (protégé 0,35 s, ramassage permis sous 0,3 s) | §23 le résultat du contrôle doit changer la suite | `receive()`, `pickup()` |
| 4 | Le pied faible dépend du côté du terrain, pas du corps | 44 % des frappes du pied faible | trop de droitiers frappent du gauche | `weakFoot()` |
| 5 | Un vol aérien n'obéit pas à la pesanteur | 78 vols sur 168 au-delà de 1,5 g, jusqu'à 9,4 g (déviations de la tête) | ballon qui monte et retombe trop vite | `kick()` (sommet et durée indépendants) |
| 6 | Une passe en une touche part jusqu'à 1,7 m du joueur | 6 frappes au sol sur 2 961 au-delà de 1,2 m | le pied n'atteint pas le ballon | `arrive()` accepte la réception à 1,7 m |
| 7 | Le placement du gardien ignore son attribut PLA | hors de l'angle 13 à 22 % du temps (passerelle, §9) | §28 un mauvais gardien doit être mal placé | `gkTarget()` |
| 8 | Pas de blessure pendant le match ; la taille ne pèse pas dans les duels aériens | | §64, §44 | moteur, phase 6 |
| 9 | Le pressing change le comportement, presque pas le résultat | 0,58 joueur au pressing (bas) contre 2,67 (très intense), 0,10 contre 0,74 dans la moitié adverse ; ballons récupérés dans la moitié adverse : 279 contre 297 sur 24 matchs | un réglage que le manager ne voit pas payer | le pressing de `targets()`, les duels |
| 10 | Le Tueur en permanence agit à peine | 4 ou 5 décisions basculées vers la frappe en 12 matchs. Renforcé seul (poids × 1,33), il en fait basculer 32 à 44 mais l'xG de l'équipe a baissé sur 36 matchs (36,6 → 32,3) : il faut aussi qu'il finisse mieux | une carte presque cosmétique (§13) | `decide()`, la frappe |

Ajouté, sans effet sur le match : les délibérations du moteur (mode débogage), pour le panneau
« décision » du §71 : l'option choisie, son rang, les options écartées et leur espérance.

Corrigé pendant ce travail, et protégé par un test : le coup d'envoi à vingt-deux dans le rond, les
tireurs téléportés ou qui bondissent au ballon, la touche jouée balle au pied, la tête qui repartait
du sol, l'instant des réceptions (daté un pas trop tôt : le ballon était encore à 1,5 m), la fiche
d'un titulaire remplacé (elle portait les attributs de son remplaçant), la hauteur du point de
frappe dans le lecteur C++.

Les corrections qui changent le jeu (points 1 à 7, 9, 10) doivent passer par les tests
d'équilibre. Ceux qui jugeaient sur des résultats trop bruités pour six ou douze matchs (le
pressing, le Tueur, le Perforateur) vérifient maintenant ce que font les joueurs : combien
pressent et où, et les décisions qu'une compétence a fait basculer (le moteur compare, au même
instant, le choix fait à celui du même joueur sans elle). Les résultats restent affichés en
constats. Ces compteurs ne changent pas le match (vérifié sur 27 matchs, avec et sans
compétences).

Les correctifs du moteur déjà faits sur la branche `ue5` (coup d'envoi, tireurs qui courent au
ballon, touche lancée, tireur qui frappe de sa place, tête qui part de sa hauteur) changent les
matchs, et la suite longue le montre (2 octobre 2026, 12 matchs par série) :

| Suite | `main` | `ue5` |
| --- | --- | --- |
| leviers | 27 sur 27 | 24 sur 27 : à cinq derrière on ne concède pas moins de tirs ; le pressing fort ne fait pas tacler davantage ; une équipe fraîche ne garde pas plus le ballon |
| styles | 27 sur 27 | 23 sur 27 : presse fort sans plus de fautes, piège du hors-jeu, espace dans le dos, longs ballons |
| cohérence | 22 sur 22 | 21 sur 22 : à note égale, un effectif athlétique prend 36 points sur 36, un technique 19 (sur `main` : 29 contre 27) |

**Remesuré le 3 octobre 2026 : ces écarts étaient du bruit.** Les deux moteurs ont rejoué, avec les
mêmes tests (ceux de `main`) et les mêmes graines, les séries des promesses que `ue5` avait perdues,
à 48 matchs par série au lieu de 12, et l'écart athlètes contre techniciens à 96 :

| Promesse | `main`, 48 matchs | `ue5`, 48 matchs |
| --- | --- | --- |
| à cinq derrière, on concède moins de tirs | 448 → 403 | 406 → 398 |
| pressing fort : on tacle davantage | 1 976 → 2 148 | 1 945 → 2 006 |
| pressing fort : plus de fautes | 410 → 517 | 396 → 486 |
| équipe fraîche : elle frappe davantage, elle tacle moins | tenues | tenues |
| gegenpressing : plus de fautes | 485 → 562 | 467 → 513 |
| bloc haut : l'adversaire plus souvent hors-jeu | 29 → 59 | 23 → 38 |
| bloc bas : moins de danger concédé | 45,9 → 29,0 | 46,5 → 30,4 |
| direct : plus de longs ballons (pour mille décisions) | 5,9 → 6,4 | 5,7 → 6,1 |
| athlètes contre techniciens, même note 72 (96 matchs) | 273 contre 180 points (32 %) | 269 contre 178 (32 %) |

Toutes tiennent sur les deux moteurs. À douze matchs, une série de 36 points bascule sur une
victoire : `main` avait tiré 29 contre 27, `ue5` 36 contre 19, pour le même écart réel. Ce que les
correctifs changent vraiment, d'un style à l'autre : 4 à 8 % de tacles et 3 à 10 % de fautes en
moins (le coup d'envoi n'est plus une mêlée de vingt-deux joueurs dans le rond), et moins de
hors-jeu (−20 à −35 %, sur de petits nombres). Les effets des styles en sortent un peu plus
faibles, jamais inversés. Rien dans ces mesures n'interdit de porter les correctifs sur `main`.

Deux leçons. La suite longue à douze matchs ne sait pas juger un changement du moteur : il faut 48
matchs par série pour ces promesses-là. Et l'écart athlètes contre techniciens est réel, sur les
deux moteurs (32 % des points, deux fois plus de danger) : c'est la note des cartes qui sous-pèse
la vitesse, pas un correctif.

**Correction du 3 octobre 2026 au soir.** « Toutes tiennent » voulait dire : dans le bon sens. Les
suites longues de `ue5`, rejouées en entier à 48 matchs par série (40 par style), avec leur propre
seuil (un écart d'au moins 4 % pour un levier), donnent : cohérence 22 sur 22, styles 27 sur 27
(une alerte venait d'un seuil écrit pour dix matchs, ramené à dix matchs), leviers 24 sur 27. Les
trois leviers qui restent sous le seuil sont dans le bon sens mais trop faibles : à cinq derrière,
406 → 391 tirs concédés (−3,7 %, contre −10 % sur `main`) ; pressing fort, 1 945 → 2 006 tacles
(+3,1 %, contre +8,7 %) ; équipe fraîche, 2 066 → 2 017 tacles (−2,4 %). `test/leviers.js` les
affiche en constats (ils ne cassent la vérification que s'ils s'inversent), les suites longues
jouent 48 matchs par série, et l'intégration continue les lance en trois travaux parallèles. Les
renforcer dans le moteur reste à faire.

## 4. WHAT MOVES TO UNREAL : ce qui passe dans Unreal

La présentation, et seulement elle : les personnages (MetaHuman, morphotypes du §44), l'animation
(Motion Matching, warping, IK, Control Rig, regard), le ballon à l'écran, le stade, le public, la
caméra de retransmission, le son, le ralenti, le débogueur et les détecteurs. Unreal ne décide ni
une passe, ni une issue, ni une statistique : il les lit.

## 5. WHAT STAYS WEB : ce qui reste web

Le compte, le club, l'inventaire, les cartes, les packs, l'économie, les compétitions, l'écran
tactique, le serveur qui fait autorité, et le moteur lui-même (JavaScript, dans l'app et sur le
serveur). La 3D du téléphone reste three.js : vingt-deux MetaHumans et Lumen ne tiennent pas sur un
téléphone. Le client Unreal est un client PC (ou un rendu côté serveur).

## 6. MISSING SYSTEMS : ce qui manque

| Système | Côté | Phase |
| --- | --- | --- |
| Les assets : squelette, IK Rig, Control Rig, bases Pose Search, Chooser, Animation Blueprint, Blueprints des acteurs | Unreal (éditeur) | 1 (`unreal/README.md`) |
| Les gestes de football capturés (§24 : passes, frappes, centres, têtes, contrôles, gardien) | contenu | 2 |
| La lecture en direct (flux WebSocket depuis le moteur, 1,2 s d'avance) | Node et Unreal | 3 |
| Caméra de retransmission (§56, §57), ralenti (§58) | Unreal | 3 |
| Stade, pelouse, éclairage, météo visible (§48, §49, §53 à §55) | Unreal | 4 |
| Public (§50, §51), son (§52) | Unreal | 4 |
| Visages et corps par personnage (§45), maillots (§46), chaussures (§47) | Unreal (MetaHuman) | 4 |
| Niveaux de qualité (§85) | Unreal | 5 |
| Les points 1 à 9 de la section 3 | moteur | en parallèle |

## 7. DEPENDENCIES : de quoi on dépend

- **Unreal Engine 5.8.3** et Visual Studio 2022 17.14 ou plus, ou Visual Studio 2026 (MSVC 14.38
  au moins, 14.50 recommandé) avec la charge de travail C++ pour les jeux.
- **Greffons** (déclarés dans `LinkFoot.uproject`) : Pose Search (Motion Matching, production
  depuis la 5.4), Animation Warping, Motion Warping (bêta), Chooser, Animation Locomotion Library
  (bêta), IK Rig, Control Rig, Full Body IK (expérimental), Python Script, Editor Scripting
  Utilities. À activer en plus dans l'éditeur pour lancer les tests depuis Outils : Functional
  Testing Editor (son nom interne n'a pas été vérifié, il n'est donc pas inscrit dans le projet).
- **Contenu** : le Game Animation Sample (Fab, gratuit, licence de contenu d'Epic : utilisable dans
  un projet Unreal, pas hors d'Unreal ; la fiche Fab elle-même n'a pas pu être lue), MetaHuman (inclus dans la licence d'Unreal), des captures de
  football à acquérir. Aucun asset d'EA Sports FC, de FIFA, d'eFootball ni d'un autre studio.
- **Côté LinkFoot** : Node 22 pour le moteur et l'extraction des scènes ; CMake 3.20 et un
  compilateur C++20 pour les tests du cœur.

## 8. RISKS : ce qui peut casser

1. **Le volume de captures de football** est le vrai chemin critique, en temps et en argent.
2. **La couche Unreal n'a pas été compilée par Unreal.** Ce dépôt n'a pas d'Unreal : ses 15 fichiers
   C++ sont vérifiés contre des déclarations simulées, recopiées de la référence 5.8
   (`unreal/verif-syntaxe`), y compris la compilation « unity ». La première compilation par
   l'Unreal Build Tool peut demander des retouches ; elle est la première tâche de `unreal/README.md`.
3. **Des briques expérimentales** : Full Body IK, le nœud Foot Placement, Offset Root Bone. Motion
   Matching et Chooser sont, eux, en production.
4. **L'écart entre un moteur à 10 images par seconde et un corps humain** : les poussées du moteur
   (section 3, point 1) font glisser les pieds si on les suit à la lettre. Le lissage du cœur les
   réduit de 81 % sans jamais s'écarter de plus de 25 cm du moteur (tolérance du contrat : 30 cm).
5. **La performance** de vingt-deux MetaHumans et d'un public : niveaux de détail stricts, cheveux en
   cartes au-delà de quelques mètres ; le greffon MetaHuman Crowd de la 5.8 est expérimental.
6. **Deux langages** (JavaScript pour le moteur, C++ pour le rendu) : le contrat est versionné, signé
   (empreinte des images) et testé des deux côtés.
7. **Les tests d'équilibre** (section 3, point 10) : tant qu'ils restent trop courts, aucune
   correction du moteur ne peut être jugée.

## Comment migrer, palier par palier

| Palier du cahier | Ce qu'on regarde | Avec quoi | Fini quand |
| --- | --- | --- | --- |
| §78 un joueur | scènes 1 à 4, `bSeulementLeFocus` | le directeur, un footballeur, le ballon, Motion Matching sur la locomotion du Game Animation Sample | aucun DESYNC, aucun FOOT SLIDE WARNING au-delà de 2 cm par appui, les familles d'animation accordées au moteur |
| §79 deux joueurs | scènes 5, 6, 7, 8 | les gestes de contact, l'IK du pied au ballon | le pied au ballon à 15 cm et 0,05 s du moteur |
| §80 cinq joueurs | scènes 9, 10, 11 | têtes, gardien, pressing | idem, plus le gardien |
| §81 onze contre onze | scènes 12 à 16, puis un match entier | les vingt-deux, le stade, la caméra | 60 images par seconde sur la machine cible |
