# LinkFoot et Unreal Engine 5 : l'analyse, puis la passerelle

Version 1 du contrat, 2 octobre 2026. Ce document répond au cahier « LINKFOOT, UNREAL ENGINE 5,
football 3D ultra-réaliste » : avant de toucher à quoi que ce soit côté Unreal, ce que LinkFoot
sait déjà faire, ce qui lui manque, et le contrat exact entre le moteur LinkFoot et Unreal.

Le côté LinkFoot de la passerelle est écrit et testé (`src/passerelle.js`, `test/passerelle.js`).
Le côté Unreal est écrit dans `unreal/` (section 4) : son cœur C++ est compilé et testé hors
d'Unreal ; la couche Unreal n'a encore été compilée par aucun Unreal, et ses assets se créent dans
l'éditeur (`unreal/README.md`). L'audit du cahier « AAA » est dans `docs/ue5/audit.md`.

## 1. Les cinq décisions

1. **Une seule autorité : le moteur LinkFoot.** Il décide tout : qui court où, qui passe, qui
   tire, ce que devient le ballon, le score. Unreal ne décide rien : il transforme ce que le
   moteur a décidé en mouvements humains. Le `PlayerAI`, le `TeamAI` et le `GoalkeeperAI` du
   cahier existent déjà dans le moteur (section 2) ; les réécrire dans Unreal donnerait deux
   cerveaux qui jouent deux matchs différents, et l'écran ne montrerait plus le match qui compte
   (résultat, XP, argent, division, serveur en ligne).
2. **Le moteur reste en JavaScript**, là où il tourne déjà : l'app, l'écran Mon Club et le
   serveur qui fait autorité en ligne en rejouant chaque match par sa graine. Unreal le lit :
   d'abord par fichier, ensuite en direct par un flux, plus tard éventuellement embarqué.
3. **Une tolérance, pas une liberté.** Unreal peut s'écarter localement de la trajectoire du
   moteur pour poser un pied, adoucir un contact ou aligner une frappe : 30 cm et 0,2 s au plus,
   et il revient sur la trajectoire. Il ne change jamais une issue (une passe interceptée reste
   interceptée, un tir arrêté reste arrêté).
4. **Un contrat versionné et vérifiable.** Format `linkfoot-match`, version 1, une empreinte par
   match. Deux rendus qui lisent le même match ont la même empreinte. Le contrat est testé côté
   LinkFoot (`test/passerelle.js`) et devra l'être côté Unreal (section 7).
5. **Unreal photoréaliste sur PC, pas sur téléphone.** Vingt-deux MetaHumans, Lumen et un stade
   ne tiennent pas sur un téléphone : Lumen sur mobile est expérimental, réservé à des Android
   haut de gamme et absent d'iOS. Le client Unreal est donc un client PC (ou un rendu serveur) ;
   l'app téléphone garde sa 3D three.js, qui lit les mêmes données.

## 2. Ce qui existe déjà

### 2.1 Le moteur (`src/engine.js`)

Une simulation 2D et demie : terrain de 68 sur 105 m, vingt-deux joueurs, un ballon qui a une
hauteur, un pas de 0,1 s, environ 36 000 à 42 000 pas par match (le chronomètre saute les arrêts
de jeu). Tirée au sort par une graine : même graine, même configuration, même match.

| Cahier UE5 | Ce que le moteur fait déjà | Où |
| --- | --- | --- |
| §18 PlayerAI | le porteur évalue passes, conduite, dribble, centre, frappe (valeur attendue de chaque option) ; les autres prennent une cible, une urgence, une intention | `decide`, `attackTargets`, `defendTargets` |
| §19 TeamAI | bloc en lignes qui coulisse vers le ballon, hauteur de ligne, pressing (nombre de presseurs, rayon), transitions, largeur, couverture, marquage de zone ou individuel | `defendTargets`, `setTP`, `assignMarks` |
| §17 sans ballon | appels en profondeur, appels dans la surface, dédoublements, décrochages, couverture | `p.run`, intentions `ATTACK_SPACE`, `OVERLAP`, `DROP`, `COVER` |
| §20 et §21 tactique, formation | chaque réglage de l'écran Tactique est lu par le moteur ; la formation donne les places de départ et les zones | `engineCfg`, `formCoords` ; prouvé par `test/leviers.js` |
| §22 à §24 défense, ligne, hors-jeu | ligne qui monte et recule, piège du hors-jeu, temps de réaction du défenseur sur un appel | `defendTargets`, `calcOff`, `offsideCall` |
| §25 à §29 gardien | placement sur l'axe ballon et centre du but, sortie sur passe en profondeur, plongeon, arrêt (réflexe, pied, claquette, détente), prise ou parade, sortie dans les pieds, prise aérienne ; réflexes, prise, plongeon, dégagement et placement lus | `gkTarget`, `shoot`, `shotArrive`, `aerialContest` |
| §9 à §16 locomotion | vitesse de pointe (VIT), accélération (DRI et VIT), agilité dans les virages (DRI, PHY), équilibre dans les contacts (PHY), inertie : l'accélération est bornée, un demi-tour freine | `setAttr`, `move` |
| §30 ballon | vols paramétriques (départ, arrivée, durée, hauteur), ballon libre avec gravité, rebond et frottement selon la météo | `kick`, `flightStep`, `ballStep` |
| §31 ballon et joueur | contrôle en quatre niveaux (raté, long, correct, orienté, élite), passe en une touche, perte sous pression | `receive`, `touchScore` |
| §44 actions | 14 frappes (puissante, placée, enroulée, ras du sol, lob, volée, retournée, talon...), 8 gestes de dribble en 5 paliers, 3 genres de tacle, têtes, dégagements, touches, corners, coups francs, penalties | `pickShot`, `DRIBS`, `duels` |
| §32 et §33 compétences | 12 320 combinaisons ; chaque compétence modifie un comportement (le Sprinter accélère plus fort, le Funambule accède à des gestes, le Mur intervient mieux...) | `src/skills.js`, `TR()`, `test/traits.js` |
| §40 à §42 fatigue, forme, moral | l'énergie baisse avec l'effort et réduit vitesse, accélération et qualité de touche ; forme et moral modifient les attributs au coup d'envoi | `move`, `setAttr` |
| §51 public, §54 météo | clameur sur les occasions, quatre météos qui changent frottement, contrôles, passes et vitesse | `mark({ k: 'roar' })`, `WEATHER` |
| §53 replay | un match se rejoue à l'identique par sa graine et les décisions datées du manager | `reprendreMatch`, `src/direct.js` |

### 2.2 Autour du moteur

- **Les cartes et le club** (`src/club.js` et ses modules) : une carte est un joueur, avec le même
  identifiant ; ses statistiques, son niveau, ses compétences équipées partent au moteur par
  `joueurMoteur`. Une carte améliorée change le joueur que le moteur fait jouer.
- **Trois rendus lisent déjà le moteur** sans rien décider : la 2D vue de dessus, la 3D three.js
  de l'écran Mon Club et de l'app (`src/stade3d.js`), le direct de l'app (`src/direct.js`, qui
  montre chaque action en temps réel et saute le reste).
- **Le serveur** rejoue chaque match en ligne par sa graine : c'est lui qui fait autorité.
- **Les tests** prouvent que chaque décision se joue vraiment (`test/leviers.js`), que les styles
  tiennent leurs promesses (`test/styles.js`), que la carte dit ce que vaut le joueur
  (`test/coherence.js`).

### 2.3 Ce qui manque pour le cahier UE5

| Manque | Pourquoi ça compte dans Unreal | Phase |
| --- | --- | --- |
| Rien de ce que fait chaque joueur n'était transmis en détail (le rendu devinait le geste) | l'animation contextuelle (§44, §45) a besoin du geste, du pied, de l'instant du contact | **fait : canal d'actions** |
| Pas d'orientation du corps, pas d'énergie, pas d'intention dans les images | posture, fatigue visible (§40), débogueur (§54) | **fait : images de passerelle** |
| Pas d'identité stable du personnage ; les adversaires partageaient les mêmes numéros | §36 carte → personnage ; « pas 22 clones » (§5) | **fait : identités** |
| La taille et le poids existent (fiche du joueur) mais pas les proportions | §4 et §8 la morphologie | **fait : morphologie** (visuelle, voir §8 du cahier) |
| Le coup d'envoi des matchs officiels partait avec les 22 joueurs sur le rond central | mêlée visible et duels dès la première seconde | **trouvé par la passerelle, corrigé** |
| Un tireur de corner ou de touche trop loin était téléporté au ballon (jusqu'à 38 m) | téléportation visible | **trouvé par la passerelle, corrigé** |
| Une touche sans partenaire libre : le lanceur partait balle au pied | geste impossible | **trouvé par la passerelle, corrigé** |
| Les contacts se règlent en déplaçant les joueurs (jusqu'à 25 cm en un pas) | à-coups, pieds qui glissent : à lisser côté rendu, puis côté moteur | phase 2 et 6 |
| Le ballon suit son porteur à 0,5 à 1,4 m, sans touches distinctes | §31 « le ballon ne doit jamais être collé au pied » | phase 3 (rendu), phase 6 (moteur) |
| Le placement du gardien ne dépend pas de son attribut PLA (seulement ses arrêts) | §28 un gardien faible doit être mal placé | phase 6 |
| Pas de blessure pendant le match | §43 un blessé ne court plus normalement | phase 6 |
| La taille ne pèse pas dans les duels aériens | §8, « lorsque cela est prévu » | phase 6, mesuré |
| Pas d'audio | §52 | phase 4 (Unreal, piloté par les événements) |

## 3. Le contrat

### 3.1 Repère et unités

- Le moteur : mètres, `x` de 0 à 68 (largeur), `y` de 0 à 105 (longueur), `z` la hauteur du
  ballon. Le domicile (`H`) attaque vers `y = 0` au coup d'envoi.
- Les images : centimètres entiers ; les angles en milliradians, dans le repère du moteur
  (`a = atan2(fy, fx)`).
- Unreal : centimètres, X vers l'avant, Y vers la droite vue de dessus, Z vers le haut.

```
X = (52,5 − y) × 100      Y = (x − 34) × 100      Z = z × 100
lacet (degrés) = atan2(cos a, −sin a)
```

Sans miroir : la vue de dessus du moteur et celle d'Unreal se superposent. Le rond central est
l'origine ; le but vers lequel le domicile attaque est à X = +5 250. `versUnreal()` et
`lacetUnreal()` dans `src/passerelle.js` font la conversion, et `test/passerelle.js` la vérifie.

### 3.2 Le temps

- Une image tous les 0,1 s de jeu. Le temps `t` d'une image est la fin de son pas.
- Une action est datée de l'instant du geste : à `t`, le ballon est encore au point de départ
  (`x0`, `y0`) ; l'image suivante le montre parti.
- Une **coupe** (`coupe = 1`) annonce que le moteur a replacé tout le monde (coup d'envoi, reprise
  après un but, mi-temps). Unreal n'interpole jamais à travers une coupe : il coupe la caméra.
  La célébration d'un but saute un pas sans image : c'est aussi une coupe.
- Un **remplacement** fait changer de personne un code (0 à 21) ; une **expulsion** retire un
  joueur (`x` et `y` à −900). Ce sont des actions : Unreal fait sortir et entrer.
- Le chronomètre affiché (`horloge`, en secondes) saute les arrêts de jeu ; il ne sert qu'à
  l'affichage.

### 3.3 Le vol du ballon

Pour une action `passe`, `tir`, `degagement` ou `touche`, le ballon à l'instant `τ` vaut :

```
u = clamp((τ − t) / dur, 0, 1)
e = u                       pour un ballon aérien ou un tir
e = 1 − (1 − u)^1,35        pour une passe au sol (elle ralentit)
x = x0 + (x1 − x0) × e      y = y0 + (y1 − y0) × e      z = 4 × apex × u × (1 − u)
```

C'est la formule du moteur (`flightStep`). Un vol peut s'arrêter avant `u = 1` : l'action
suivante (contrôle, interception, duel aérien, arrêt) le dit.

### 3.4 Le document

Un objet JSON (gzip pour le transport), produit par `club.matchPont(adversaire, { seed })` :

```
format, version                     "linkfoot-match", 1
moteur { hz, pas, graine }          10, 0,1, la graine du match
repere, codes                       la conversion Unreal ; intentions, états, coups de pied arrêtés
match { competition, meteo, domicile, debut, fin }
equipes { H, A }                    club, maillot, formation, mentalité, tactique, entraîneur, style
joueurs [ ... ]                     la feuille de match (3.5)
images { champs, donnees }          dix images par seconde (3.6)
actions [ ... ]                     ce que chaque joueur fait (3.7)
evenements [ ... ]                  buts, cartons, clameur, gestes, commentaire (3.8)
decisions [ ... ]                   mode débogage seulement : les délibérations du moteur (ci-dessous)
resultat { score, tirs_au_but, possession, stats, notes, journal }
empreinte                           l'empreinte des images et des actions
```

En mode débogage (`{ debug: true }`), `decisions` donne, à chaque décision d'un porteur, ce
qu'il a choisi et ce qu'il a écarté (§71 du cahier) : `{ t, c, choix, rang, autres, bascule }`.
`choix` et chacune des trois meilleures `autres` sont `{ k, genre, vers, ev }` : le geste (`pass`,
`shot`, `carry`, `cross`, `hold`, `clear`), son genre (passe en profondeur, conduite vers le but,
centre au premier poteau...), le receveur d'une passe, et l'espérance que le moteur lui donnait,
sans unité, comparable seulement à la même décision. `rang` : 0 si le joueur a pris l'option qu'il
jugeait la meilleure (il se trompe parfois, selon sa lecture du jeu). `bascule` : sans sa
compétence, il aurait préféré autre chose. Un observateur, sans effet sur le match ; un match
entier en compte environ 3 500 (770 Ko). Chaque passe, frappe, centre ou dégagement choisi
correspond à l'action du même joueur au même instant (`test/passerelle.js`, et le cœur C++).

Ordre de grandeur, un match entier : 36 000 à 42 000 images, environ 2 400 actions, 22 Mo de
JSON, 7 Mo compressé, 4 à 5 secondes de calcul. Un format binaire viendra si la taille gêne ;
le contenu ne changera pas.

### 3.5 La feuille de match : de la carte au personnage

Une entrée par personne : les 22 titulaires (`code` 0 à 21) et les bancs (`code` nul).

| Champ | Contenu |
| --- | --- |
| `code`, `camp` | 0 à 10 domicile, 11 à 21 extérieur ; le numéro de la ligne d'image |
| `id`, `carte`, `personnage` | §36 : la carte n° 127 est le joueur n° 127 et le personnage `LF-00127`. Un adversaire, qui n'a pas de carte, reçoit `ADV-<club>-<n>` : le même visage à chaque rencontre, un autre pour un autre club |
| `nom`, `poste`, `ligne`, `numero`, `note`, `rarete`, `niveau` | ce que la carte affiche |
| `poste_tactique`, `role`, `devoir` | la place dans la formation, le rôle et la consigne individuelle choisis dans l'écran Tactique |
| `stats` | les statistiques de la carte (VIT, ATQ, TIR, PAS, DRI, DÉF, PHY ; gardien : VIT, PLO, RÉF, MAI, DÉG, PLA) |
| `moteur` | ce que le moteur en tire, lu dans le moteur lui-même : `vitesse_max` (m/s), `acceleration`, `agilite`, `equilibre`, `tir`, `passe`, `dribble`, `defense`, `physique`, `decision` ; `gardien { reflexes, prise, plongeon, degagement, placement }` |
| `competences` | effet, condition, puissance, rareté de chaque compétence portée |
| `etat` | forme, moral, énergie, blessure au coup d'envoi |
| `pied`, `pied_faible` | pied fort, pied faible de 1 à 5 |
| `morphologie` | `taille_cm`, `poids_kg` (ceux de la fiche), `carrure`, et des proportions de 0 à 1 : `epaules`, `muscles`, `masse`, `jambes`, `bras`, `bassin`, `posture`. Elles découlent des statistiques : un physique fort a les épaules et les muscles, un rapide les jambes, un gardien les bras. Le corps ne change pas le jeu : les attributs restent le facteur principal (§8 du cahier) |
| `apparence` | une graine, 8 coefficients de visage, teint, coiffure, couleur des cheveux, barbe, sourcils, yeux. Tirés d'une graine propre au personnage : originaux, jamais copiés sur un vrai joueur, et rien n'est déduit de la nationalité |

Statistique → carte → moteur → mouvement, sur un exemple mesuré par `test/passerelle.js` : des
attaquants passés de VIT 40 à VIT 95 sur la carte reçoivent du moteur une vitesse de pointe de
6,1 à 8,6 m/s, le rendu les voit courir plus vite, et ils reçoivent 23 passes en profondeur au
lieu de 3.

### 3.6 Les images

Chaque ligne : douze valeurs d'en-tête, puis six valeurs par joueur, dans l'ordre des codes.

| En-tête | Contenu |
| --- | --- |
| `t` | temps en dixièmes de seconde (fin du pas) |
| `horloge`, `mi_temps` | chronomètre affiché (secondes), 1 ou 2 |
| `coupe` | 1 si le moteur a replacé tout le monde |
| `bx`, `by`, `bz` | le ballon, en centimètres |
| `porteur` | code du porteur, −1 si personne |
| `score_d`, `score_e` | le score |
| `cpa`, `tireur` | coup de pied arrêté en préparation (index dans `codes.cpa` : coup d'envoi, corner, coup franc à centrer, coup franc direct, coup franc, touche, six mètres, penalty) et son tireur |

| Par joueur | Contenu |
| --- | --- |
| `x`, `y` | position en centimètres ; −900 : absent (expulsé) |
| `angle` | orientation du corps, milliradians, repère du moteur |
| `energie` | 0 à 100 |
| `etats` | bits : 1 au sol, 2 déséquilibré, 4 porteur, 8 exclu, 16 sprint voulu, 32 presse, 64 appel en cours, 128 conduit en dribble |
| `intention` | 0 aucune, puis `HOLD`, `SUPPORT`, `BUILD_UP`, `ATTACK_SPACE`, `DROP`, `OVERLAP`, `RECOVER`, `MARK`, `COVER` |

En mode débogage (`{ debug: true }`), 44 valeurs de plus : la cible de chaque joueur (`cx`, `cy`).
La vitesse se déduit de deux images (différence centrée) ; elle n'est pas transmise.

### 3.7 Les actions

Chacune porte `t` (instant du geste), `c` (code du joueur) et `a` (le type).

`t` est l'instant où l'action se voit dans les images. Un pas du moteur se joue en deux temps :
les décisions (passes, tirs, duels, tacles, dribbles, fautes de duel) partent des positions du
début du pas, l'image de `t` ; le ballon (contrôles, interceptions, duels aériens, prises,
arrêts, buts, hors-jeu) se règle après le déplacement des joueurs, sur les positions de la fin
du pas, et ces actions sont datées de la fin du pas. Au moment d'un contrôle, le ballon est donc
au pied du receveur dans l'image de `t` (0,67 m en médiane, mesuré par `test/passerelle.js`).
Une frappe jouée pendant le pas du ballon (dégagement ou déviation de la tête juste après un
duel aérien) porte en plus `t0`, l'origine de la formule de son vol, un dixième de seconde
avant `t` : au contact (`t`) le ballon est au point de frappe, la formule le rejoint à l'image
suivante (révision du 2 octobre 2026, même version 1 du format).

| `a` | Champs | Ce que le rendu en fait |
| --- | --- | --- |
| `passe` | `genre` (pass, long, through, cross, corner, fkc, gkl), `cpa`, `x0 y0 z0 x1 y1`, `dur`, `apex`, `aerien`, `vers`, `t0` si la formule part avant `t` | geste de passe, pied et surface selon l'angle et la hauteur (`z0` au-dessus de 1,2 m : une tête) ; contact à `t` |
| `tir` | les mêmes, plus `variante` (puissant, place, enroule, rasSol, seche, lob, talon, apresDrib, ferme, faible, volee, demi, reprise, retourne), `issue` (goal, save, miss, block), `tete`, `cf`, `penalty`, `poteau`, `xg` | la frappe exacte, le pied faible si `faible` |
| `degagement`, `touche` | comme une passe | dégagement long ou de la tête ; touche aux deux mains |
| `controle` | `niveau` (rate, long, correct, oriente, elite), `une_touche`, `haut`, `presse` | contrôle, contrôle orienté, poitrine ou cuisse si `haut` |
| `dribble` | `geste` (crochet, protect, feinte, double, passement, roulette, pont, sombrero), `palier` 1 à 5, `contre`, `reussi` | le geste exact face au défenseur `contre` |
| `tacle` | `genre` (tacle, glisse, interception), `cible`, `reussi` | tacle debout, glissé, pied tendu |
| `interception` | `de` | coupe une passe |
| `faute` | `victime`, `cause`, `carton` (Y, R, R2), `penalty`, `chute` (s) | la faute, la chute de la victime |
| `duel_aerien` | `autres` (codes) | tous sautent ; `c` touche le ballon |
| `prise_aerienne`, `sortie_pieds` | `cible` | le gardien |
| `plongeon` | `dir`, `dur`, `x`, `y` (où va le ballon), `issue`, `penalty` | plongeon du gardien vers le point d'arrivée |
| `arret` | `geste` (reflexe, pied, claquette, detente, parade, double), `issue` (capte, corner, repousse), `tireur` | l'arrêt exact |
| `contre`, `poteau` | `tireur` | frappe contrée, poteau |
| `but` | `csc`, `tireur` | le but ; `but` contre son camp |
| `celebration` | `genre`, `fin` | §50 la célébration choisie par le moteur, jusqu'à `fin` |
| `remplacement` | `sortant`, `entrant` | le code change de personne |
| `hors_jeu` | | le drapeau |

### 3.8 Les événements

Ceux du moteur, datés : `goal` (buteur), `card` (couleur), `roar` (clameur, de 0 à 1 : le public
se lève), `skill` (un geste de haut palier), `banner` (le bandeau : « CORNER », « ARRÊT ! »),
`com` (le commentaire, phrase par phrase). Le public, le son et la réalisation s'y branchent.

### 3.9 Le direct (phase 5)

Le même contenu, en flux : un serveur Node (`tools/`) ouvre le match en direct (`matchEnDirect`)
et pousse à Unreal, par WebSocket, `{ type: 'feuille' }` puis des paquets `{ type: 'images' }`,
`{ type: 'actions' }`, `{ type: 'evenements' }`, enfin `{ type: 'fin', resultat }`. Le moteur
garde 1,2 s d'avance (comme le direct de l'app) : Unreal connaît donc toujours la trajectoire
future, dont le Motion Matching a besoin. Si Unreal offre les décisions du manager, il les envoie
(`{ type: 'decision', ... }`) et le moteur les valide ou les refuse avec sa raison, comme
l'écran Match aujourd'hui.

## 4. Le côté Unreal (UE 5.8)

Le projet `unreal/LinkFoot`, en cinq modules (`docs/ue5/projet-unreal.md`). Ce qui était prévu ici,
et ce qui existe :

| Prévu | Écrit | État |
| --- | --- | --- |
| `ULFBridgeSubsystem` : lire un document, l'état à tout instant, la trajectoire future | `ULFMatchSubsystem` (module LinkFootMatch) et le cœur `LinkFootCore` (`LFDocument`, `LFCinematique`, `LFTrajectoire`, `LFEtatMatch`) | fichier : écrit ; flux en direct : phase 5 |
| `ULFMatchDirector` : les 22 joueurs et le ballon, coupes, remplacements, expulsions | `ALFDirecteurMatch` ; la fiche portée à l'instant t (`DocumentMatch::ficheA`) | écrit |
| `ALFFootballer` : capsule pilotée par le moteur | `ALFFootballeur` | écrit ; mannequin d'abord, MetaHuman en phase 4 |
| `ULFLocomotionComponent` : Motion Matching sur la trajectoire du moteur, warping, pieds | `ULFAnimInstanceFootballeur` (C++) et un Animation Blueprint (asset) | C++ écrit ; asset à créer (`docs/ue5/animation.md`) |
| `ULFActionComponent` : le geste, Motion Warping vers le point de contact | le contact dans `ULFAnimInstanceFootballeur` (`LFContact` : instant, genre, surface, pied, point) ; IK du pied vers le point plutôt que Motion Warping, qui modifie le root motion qu'un personnage consomme pour se déplacer et ne déplacerait donc pas un acteur posé par le moteur (déduit de la documentation, à vérifier) | C++ écrit ; gestes : captures de football |
| `ALFBall` | `ALFBallon` | écrit |
| `ULFGoalkeeperComponent`, `ALFCameraDirector`, `ALFCrowd`, `ULFAudio` | | phases 3 et 4 |
| `ULFDebugOverlay` (§54) | `ALFHUDDebug` | écrit, délibérations du moteur comprises (mode débogage, 3.4) |
| `ULFSyncChecker` (§55 côté rendu) | `ULFComposantControle` et `LFDetecteurs` : écart au moteur, pieds, mouvements impossibles, famille d'animation, contact pied-ballon | écrit ; collisions de capsules : à écrire |

Ce que chaque donnée pilote :

| Donnée | Pilote |
| --- | --- |
| positions, angle | la capsule ; la requête de Motion Matching (trajectoire à +0,33, +0,67 et +1 s) |
| `vitesse_max`, `acceleration`, `agilite` | le choix des allures (un joueur explosif n'utilise pas les mêmes départs) ; la trajectoire, elle, vient déjà du moteur |
| `energie` | une couche de posture : épaules qui tombent, foulée plus courte, mains sur les genoux à l'arrêt |
| `etats` | au sol (relevé), déséquilibré (récupération), presse (posture de pressing), appel (course d'appel) |
| `intention` | la posture sans ballon : marquage, couverture, soutien |
| `morphologie` | le corps paramétrique MetaHuman (taille, épaules, jambes, bras, bassin, muscles) |
| `apparence` | la génération du visage, des cheveux, de la barbe (MetaHuman Creator, script Python d'UE 5.8, par lot depuis les feuilles) |
| actions | les gestes, le point et l'instant du contact |
| événements | public, son, réalisation, bandeaux |

## 5. Les personnages

- **MetaHuman**, intégré à Unreal depuis la 5.6 : corps paramétrique (hauteur, poitrine, tour de
  taille, longueur des jambes). Un outil LinkFoot lira les feuilles de match et fabriquera un
  MetaHuman par personnage (`LF-00127` une fois pour toutes ; une carte améliorée garde son
  visage) ; par script Python dans l'éditeur (la création par lot est à vérifier sur la 5.8).
- **Licence** : MetaHuman fait partie de la licence d'Unreal. Pour un jeu : 5 % du chiffre
  d'affaires brut au-delà d'un million de dollars par produit (les ventes sur l'Epic Games Store
  en sont exemptées). Les 1 850 dollars par poste et par an concernent les usages hors jeu.
- **Aucun visage réel** : les coefficients viennent d'une graine. Un visage de joueur réel demanderait
  une licence.
- **Coût d'affichage** : vingt-deux MetaHumans proches de la caméra plus un public. Les cheveux sont
  le poste le plus cher ; il faudra des niveaux de détail stricts (cheveux en cartes au-delà de
  quelques mètres) et le public en instances.

## 6. Le vrai chemin critique : les animations

Le code n'est pas le plus long. Ce sont les gestes.

- **Locomotion** : le Game Animation Sample d'Epic (plus de 500 animations à sa sortie, mis à jour
  pour la 5.8 le 12 août 2026) couvre marcher, courir, démarrer, freiner, tourner. Motion Matching
  (Pose Search) est en production depuis la 5.4 ; seule la génération de trajectoire du nœud Pose
  History reste expérimentale, et LinkFoot s'en passe : la trajectoire vient du moteur.
- **Football** : rien de tout fait à ce niveau. À capturer (capture sans marqueurs à partir de
  vidéo, ou combinaison) ou à acheter, pour chaque action du tableau 3.7 : passes des deux pieds à
  trois allures, 14 frappes, contrôles à quatre niveaux et trois surfaces, 8 dribbles, 3 tacles et
  leurs échecs, têtes, touches, gardien (plongeons à trois hauteurs des deux côtés, prises,
  claquettes, sorties), chutes et relevés, 7 célébrations. Plusieurs centaines de clips.
- C'est ce volume qui sépare une démonstration d'une retransmission crédible.

## 7. Synchronisation et tests

Côté LinkFoot, `test/passerelle.js` (dans `npm test`) :

- le pont ne change pas le match : mêmes score, statistiques, possession et fil, avec ou sans ;
- deux exports du même match ont la même empreinte, et une seule image changée la change ;
- le format : champs, ordre du temps, coupes, types d'actions, codes ;
- §36 carte → personnage, adversaires stables, 22 visages différents ;
- §4 et §8 le corps raconte la carte ;
- §57 la chaîne : carte → moteur → mouvement → action (vitesse, profondeur, gestes de dribble,
  énergie) ;
- §55 sur le document : personne hors du terrain, personne l'un dans l'autre, ballon au pied de
  son porteur, gardien dans l'angle, aucun joueur immobile loin de sa place, aucune
  téléportation hors des coupes, un coup d'envoi où chacun est à sa place, une touche toujours
  lancée ; et, mesurés en constats, les à-coups, les vitesses au-dessus de la pointe, la ligne
  étirée.

Côté Unreal, à écrire avec le plugin (critères d'acceptation) :

- écart entre la capsule et la position du moteur : moyenne sous 10 cm, maximum 30 cm ;
- glissement d'un pied posé : sous 2 cm par appui ;
- contact pied-ballon : à 0,05 s et 15 cm du point et de l'instant du moteur ;
- aucune interpolation à travers une coupe ; aucune capsule l'une dans l'autre ;
- l'empreinte lue égale l'empreinte écrite.

## 8. Les phases

| Phase | Contenu | Fini quand |
| --- | --- | --- |
| 0 (faite) | la passerelle côté LinkFoot : format, export, feuille, actions, tests, contrôles | `test/passerelle.js` vert |
| 1 | visionneuse Unreal : le plugin lit un document, 22 mannequins, le ballon, une caméra TV | les positions collent au centimètre, 60 images par seconde |
| 2 | locomotion : Motion Matching sur la trajectoire du moteur, warping, pieds verrouillés | critères d'écart et de glissement de la section 7 |
| 3 | les gestes : passes, frappes, contrôles, dribbles, tacles, duels, gardien | contact pied-ballon dans la tolérance |
| 4 | personnages MetaHuman par lot, maillots, stade, public, lumière, son | 22 personnages distincts, 60 images par seconde sur la machine cible |
| 5 | direct par flux, ralentis, débogueur, contrôles côté rendu | un match en direct suivi de bout en bout |
| 6 | le moteur : contacts lissés, touches de balle, gardien selon PLA, blessures en match, taille dans les duels aériens (le coup d'envoi, les tireurs téléportés et la touche sans partenaire sont déjà corrigés) | chaque changement mesuré par `test/leviers.js`, `test/styles.js`, `test/coherence.js` et `test/passerelle.js` |

Au 2 octobre 2026 : le code des phases 1 et 2 est écrit (`unreal/`) ; le cœur est testé hors
d'Unreal, la couche Unreal n'a pas encore été compilée par Unreal, et aucun asset n'existe.

## 9. Ce que la passerelle a déjà trouvé dans le moteur

Mesuré sur deux matchs (graine 77, contre deux adversaires) par `verifierPont`. Les trois premiers
points sont corrigés, et `test/passerelle.js` vérifie qu'ils ne reviennent pas :

- **Le coup d'envoi des matchs officiels** (calcul rapide : `playMatch`, le direct, le serveur)
  partait avec les vingt-deux joueurs sur le rond central : premiers tacles et une faute dans la
  première demi-seconde, visibles dans la 3D de l'app. Le mode temps forts, lui, replaçait tout le
  monde. Corrigé : chacun est à sa place dès la première image.
- **Les tireurs de corner et de touche** qui n'étaient pas arrivés au ballon 2,5 s après la mise en
  place y étaient téléportés : 5 à 10 fois par match, jusqu'à 38 m d'un coup. Corrigé : le tireur
  court au ballon, et le temps passe ; zéro téléportation mesurée.
- **Une touche sans partenaire à portée** laissait le lanceur partir balle au pied. Corrigé : il la
  donne au plus proche à 25 m, sinon il la lance le long de la ligne.
- **Les contacts** se règlent en déplaçant les joueurs, pas en les freinant : plus de 2 000 à-coups
  au-dessus de 14 m/s² par match, presque tous au contact d'un autre joueur. À lisser côté rendu
  (tolérance de 30 cm), puis à reprendre dans le moteur.
- **Le gardien** est hors de l'angle de tir dans 13 à 22 % des images où un adversaire a le ballon
  à moins de 30 m, surtout quand il revient d'une sortie.
- **La ligne défensive** s'étire sur plus de 12 m dans 17 à 33 % des images où l'équipe défend,
  surtout quand les latéraux sont montés.

Ces deux derniers points ne sont pas des bugs au sens strict (un gardien qui revient d'une sortie,
un latéral pris haut existent au football) ; leur fréquence est suivie en constat, et elle dira si
le placement du gardien selon PLA et le repli des latéraux (phase 6) changent quelque chose.

Ensuite, la lecture du document par le cœur C++ d'Unreal (`unreal/tests-coeur`, trois matchs).
Corrigé, et vérifié par un test :

- **L'instant des réceptions** : les actions de la phase du ballon (réception, interception,
  duel aérien, arrêt, but) étaient datées du début du pas, alors que le ballon n'arrive qu'à sa
  fin : un contrôle se voyait 0,1 s trop tôt, ballon encore à 1,5 m. Elles sont datées de la fin
  du pas, et une frappe de cette phase porte `t0`, l'origine de sa formule (section 3.7). Le
  match ne change pas.
- **La fiche d'un titulaire remplacé** portait les attributs de son remplaçant (la feuille était
  lue en fin de match) : 19 fiches justes sur 22. Elle est prise au coup d'envoi.

Mesuré, à reprendre dans le moteur (`docs/ue5/audit.md`, section 3) : à 60 images par seconde,
20 346 à-coups au-dessus de 14 m/s² sur 1 463 minutes-joueur (3 886 après le lissage du rendu) ;
un ballon qui suit son porteur sans touches ; un contrôle raté repris au pas suivant 350 fois sur
390 ; 44 % des frappes du pied faible, le côté du terrain décidant du pied ; des vols aériens
jusqu'à 9,4 g ; des frappes en une touche jusqu'à 1,7 m du corps. Les délibérations du moteur
manquaient au document : elles y sont en mode débogage (3.4).
