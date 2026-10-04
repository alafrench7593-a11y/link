# Rendu réel du match (laboratoire web)

Ce dossier joue un document `linkfoot-match` (le match que le moteur LinkFoot a calculé) avec de vrais corps humains qui bougent avec de vraies captures de mouvement, dans un stade éclairé, vu par une caméra de télévision.

Le moteur (`src/engine.js`) reste la seule autorité : le rendu lit ses positions, ses orientations, ses actions et son ballon, et n'en change aucun résultat. Ce qu'il ajoute est visuel et borné (voir « Ce que le rendu invente »).

## Ce qui est fait

| Élément | Comment |
|---|---|
| Corps | Maillage de base MakeHuman (CC0), déformé par les cibles « macro » selon la morphologie de chaque joueur (taille, poids, carrure, muscles), équipement (maillot, short, chaussettes, chaussures) gonflé sur la peau, 10 teints, coiffures |
| Mouvement | Motion Matching sur 159 captures CMU (course, virages, départs, arrêts, pas chassés, recul, marche, attente) : toutes les 0,1 s, la requête décrit la trajectoire que le moteur fera jouer au joueur dans 0,2, 0,4 et 0,6 s, et la pose actuelle ; transitions par inertialisation (demi-vie 0,08 s) |
| Allure de course | Quand le joueur court vite, la recherche pénalise les prises d'allure molle (bras serrés, genou qui ne remonte pas : mesurés sur chaque prise) ; plus vite que la prise, le balancier des bras s'élargit ; le buste se penche en accélérant et aux grandes vitesses |
| Gestes de football (GRF) | 45 gestes de Google Research Football (domaine public), convertis dans la même base (`construire/grf.py`) : tacles glissés, chutes, déséquilibres, relevés, têtes (dont plongeante), contrôles de la poitrine et du genou, retourné, touches, célébrations, parades ; chacun garde l'instant et le point où il touche le ballon. Ils ne sont jamais cherchés par le Motion Matching (la locomotion est identique, os par os) ; la vitrine `labo/gestes.html` les montre sur n'importe quel corps. Branchés sur le moteur : tacle glissé (action `tacle` de genre `glisse`, puis relevé), chute puis relevé (état `au_sol` d'une faute subie, le relevé finit quand le moteur relève le joueur), tête (`duel_aerien` quand le ballon est en l'air, le geste choisi selon sa hauteur), touche (`touche`, ballon dans les mains), contrôle de la poitrine (`controle` haut : un ballon long que personne ne dispute ; le geste d'amorti est ancré à l'instant où la descente du ballon passe à la hauteur du contrôle, puis le ballon tombe aux pieds) |
| Personnages | Le corps MakeHuman par défaut, ou n'importe quel personnage riggé (glTF, GLB, FBX : noms Quaternius, Mixamo, mannequin d'Unreal, Rigify) avec `perso=` : ses os sont reconnus, il est mis à la taille de la fiche et habillé aux couleurs du club, puis animé par le même Motion Matching (`labo/personnage.js`). Deux sont prêts : le Quaternius « Animated Men » (CC0) et le footballeur de Gameplay Football (domaine public : 747 triangles, visage sans traits, six coiffures dont une seule visible, choisie d'après la fiche ; `construire/gpf_joueur.py`) |
| Pieds | Verrouillage pendant les appuis (talon puis pointe), décollage quand la jambe ne peut plus tenir l'appui (ou ne l'a déjà pas tenu à l'image d'avant), pointe au-dessus de l'herbe en l'air, bassin abaissé si la foulée l'exige ; posé sur le talon, le pied garde le cap de sa pointe (il ne pivote que sur la pointe), et c'est la pointe qui tient dès qu'elle est à 3 cm du sol ; détecteur de glissade identique à celui du cœur C++ (pointe à moins de 3 cm du sol et plus de 15 cm/s pendant 0,1 s) |
| Pied et ballon | Le pied ne traverse jamais le ballon (segment cheville-bout de la chaussure, 4 cm d'épaisseur, contre la sphère de 11 cm) : celui qui touche s'arrête derrière lui, les autres passent à côté, chacun du côté de sa hanche ; le pied qui se pose s'en écarte, le pied d'appui d'une frappe se pose à côté du chemin du ballon (celui qui arrive et celui qui part) ; un appui sur le chemin d'un ballon qui roule se lève pour le laisser passer ; en dernier, sur la pose qu'on voit (après le plongeon du gardien, qui fait pivoter tout le corps), un pied libre encore dans le ballon en est écarté. Seul le pied bouge : le ballon reste celui du moteur |
| Frappes | Passes, tirs, dégagements et tacles jouent une vraie capture de frappe (CMU 10 et 11), calée pour que le pied touche le ballon à l'instant de l'action du moteur ; le corps se tourne vers la cible ; le pied d'appui garde la course quand le joueur va vite |
| Contrôles et conduite | Le pied le plus proche touche le ballon à la réception ; balle au pied, le pied va au ballon à chaque touche du moteur (action `conduite`, toutes les 0,3 à 0,65 s selon la vitesse et la pression), dans le sens où elle l'envoie, en visant derrière le ballon tel qu'il roule encore (pas le point de la touche, qu'il atteindrait en le traversant) ; si le ballon est plus loin que la foulée ne porte, le joueur s'allonge vers lui |
| Regard | La tête et le cou suivent le ballon (au plus 70° de côté) ; le porteur lève les yeux de temps en temps |
| Fatigue | Sous 50 d'énergie (celle du moteur), le buste se penche en courant ; épuisé et arrêté depuis plus d'une seconde, le joueur pose les mains sur les genoux |
| Célébrations | Les sept genres du moteur (corner, foule, genou, équipe, silence, calme, ballon) : bras écartés en courant, poing qui frappe l'air, à genoux bras au ciel, doigt sur la bouche ; les coéquipiers qui rejoignent le buteur lèvent les bras |
| Maillots | Couleurs du club, trame de tissu, numéro du joueur dans le dos (décalque courbé sur le dos, porté par l'os de la colonne) et sur la poitrine (peint dans la texture, triangle par triangle) |
| Gardien | Garde (genoux fléchis, mains ouvertes) quand le ballon approche ; plongeon latéral (le corps bascule autour de ses pieds, la poussée l'emmène, les mains vont au ballon), arrêt bas ou en face, saut ; ballon tenu contre la poitrine après un arrêt capté, lâché avant le dégagement |
| Ballon | Vol rejoué par la formule du moteur (les images à 10 par seconde la suivent à 2 cm près) ; porté : celui du moteur, poussé par les touches et qui roule entre deux (vitesse en e^(−k t), comme dans le moteur), sans rien y ajouter ; un document d'avant le 4 octobre 2026 garde l'ancienne règle (devant le porteur, avec la respiration de conduite) ; il roule sans glisser |
| Stade | Pelouse tondue en bandes, lignes réglementaires, buts et filets, panneaux, tribunes en gradins avec un public aux couleurs des deux clubs, pylônes, ciel ; tout est généré dans `labo/stade.js` |
| Temps | Celui du document (`match.meteo`) : soleil ; pluie (ciel couvert, pelouse mouillée, gouttes) ; neige ; nuit (projecteurs, tribunes dans la pénombre) |
| Caméra | Télé (tribune principale, 18 m derrière la touche, 15 m de haut, panoramique sur le ballon, 31 m de terrain dans le cadre, 24 m près du but) avec le bandeau du score et l'horloge du moteur ; suivi, serré, face, dos |

## Mesure

`node rendu/outils/verifier-pieds.mjs` joue les 16 scènes de test en entier, 22 joueurs chacune, avec le détecteur du cœur C++ sur les deux pieds de chaque joueur, et compte chaque pas de 1/60 s où un pied est enfoncé de plus de 2 cm dans le ballon ; avec `LINKFOOT_SCENES=rendu/labo/scenes`, les cinq fenêtres de vrais matchs (faute et chute, tacle glissé, duel aérien, touche, contrôle de la poitrine). Résultat du 4 octobre, sur les scènes réextraites du moteur au ballon poussé par touches :

| Corps | 16 scènes de test | 5 fenêtres de matchs |
|---|---|---|
| MakeHuman (par défaut) | 0 glissement, 0 pied dans le ballon, VALIDE | 0 glissement, 0 pied dans le ballon, VALIDE |
| Quaternius « Animated Men » | 0 glissement, 0 pied dans le ballon, VALIDE | 0 glissement, 0 pied dans le ballon, VALIDE |
| Footballeur de Gameplay Football | 0 glissement, 0 pied dans le ballon, VALIDE | 0 glissement, 0 pied dans le ballon, VALIDE |

Le pied dans le ballon se mesure sur la pose qu'on voit, après le plongeon du gardien : mesuré avant, on jugeait les jambes du gardien resté debout. La scène « Un contre un » réextraite le 4 octobre au soir (marquage par anticipation) a montré un ballon repoussé qui passait 8 cm dans le pied du gardien couché ; la sortie de la porte donne maintenant l'instant du pire enfoncement.

Avant le 4 octobre, la porte ne regardait pas le ballon : sur une conduite de balle de dix secondes (285 images), un pied entrait de plus de 2 cm dans le ballon 50 fois, à presque chaque touche, et passait jusqu'à 8 mm de son centre (le pied qui touche visait le point de la touche, que le ballon n'avait pas encore atteint) ; sur les 16 scènes, 58 pas de 1/60 s. Les scènes réextraites ont aussi montré trois glissements avec le pied de Gameplay Football (le moteur accélère plus franchement) : un appui que la jambe n'atteint plus est maintenant lâché dès qu'il est traîné de 2 cm, et la pointe tient dès qu'elle est à 3 cm du sol (le seuil du détecteur), au lieu de 2.

Les images de gestes au sol (tacle glissé, chute, relevé) ne sont pas jugées et sont comptées à part (214 dans la scène 08, 220 et 218 dans les fenêtres). Le pied de Gameplay Football, dont l'avant est 8 cm sous la cheville, a révélé un défaut que les deux autres corps cachaient : posé sur le talon, le pied gardait le cap d'un axe du squelette et non celui de sa pointe, qui tournait quand le pied roulait ou basculait (deux glissements, à 19 et 27 cm/s). Corrigé dans `labo/mouvement.js`. Entre une et cinq minutes par corps sur deux cœurs.

Coût de l'animation (22 joueurs, sans le dessin) : 0,15 s de calcul par seconde de match sur la machine de test (deux cœurs, sans GPU). La recherche du Motion Matching saute les paquets de 16 images dont la borne basse du coût dépasse déjà le meilleur trouvé : 6,5 fois plus rapide que la recherche exhaustive, avec les mêmes choix (1 632 recherches comparées, 0 différence).

## Ce que le rendu invente (et ses bornes)

- Les gestes de tout le corps (tacle glissé, chute, relevé, tête, touche) : le corps suit le déplacement du geste, ancré pour que le pied ou la tête arrive au ballon à l'instant et au point du moteur, au plus 1,5 m de la position du moteur, qu'il rejoint en 0,3 s ; le tacleur reste couché puis se relève (le moteur ne le met pas au sol) ; le saut de tête monte au plus de 0,25 m de plus que le geste pour atteindre le ballon. Pendant un geste au sol (tacle glissé, chute, relevé), le détecteur de glissement ne juge pas les pieds (glisser y est voulu) ; ces images sont comptées et affichées par la porte des pieds.
- La touche : le lanceur tient le ballon dans ses mains 1,2 s avant le lancer, et le ballon part de ses mains (2,1 m) au lieu du sol ; il arrive où le moteur le dit.

- La conduite de balle, seulement pour un document d'avant le 4 octobre 2026 (ballon collé au porteur) : au plus 0,35 m autour de la position du moteur, éteinte 0,15 s avant une frappe. Depuis, le moteur pousse le ballon par touches et le rendu n'ajoute rien.
- Le transfert du ballon à un nouveau porteur (0,35 s) : le moteur le pose d'un coup jusqu'à 2,3 m plus loin.
- Le plongeon du gardien : le moteur ne le déplace pas (il dit le côté, la durée et le point du tir) ; le corps rendu s'écarte de sa position le temps du plongeon, puis la rejoint.
- Le corps d'un joueur qui frappe s'approche du ballon (au plus 0,7 m) pendant le geste.
- Le corps d'un joueur qui touche le ballon (frappe, contrôle, touche de conduite) s'allonge vers lui quand la jambe ne l'atteint pas, au plus de 0,5 m, le temps du geste (`labo/mouvement.js`, « le corps va chercher le ballon »).
- Les gestes des célébrations et de la fatigue : le moteur dit le genre, la destination, la durée et l'énergie ; la forme du geste est celle du rendu.

## Reconstruire les données

Les sources ne sont pas dans le dépôt (seules les données générées le sont). Clones partiels :

```sh
git clone --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman.git mh-src/makehuman
git clone --filter=blob:none --sparse https://github.com/Shriinivas/cmubvh.git mocap/cmubvh
git clone --filter=blob:none --no-checkout --depth 1 https://github.com/google-research/football.git gfootball
(cd gfootball && git sparse-checkout init --no-cone && printf '/third_party/gfootball_engine/data/media/objects/players/\n/third_party/gfootball_engine/data/media/animations/\n/third_party/gfootball_engine/LICENSE\n' > .git/info/sparse-checkout && git checkout HEAD)
```

Puis (les BVH des clips listés dans `construire/mouvements.py` copiés dans `mocap/bvh`) :

```sh
cd rendu/construire
python3 mouvements.py <dossier des BVH> ../donnees <gfootball/third_party/gfootball_engine/data/media>   # mouvements.json / .bin
python3 corps.py <mh-src/makehuman> <BVH de référence, 16_35.bvh> ../donnees   # corps.json / .bin (le clone, qui contient makehuman/data)
```

## Voir et filmer

```sh
node rendu/outils/photo.mjs "rendu/labo/index.html?doc=/unreal/LinkFoot/Content/LinkFoot/Scenes/13-contre_attaque.json&joueurs=tous&camera=tv&t=2535.1" photo.png 1280 720
node rendu/outils/filmer.mjs tele.mp4 "doc=/unreal/LinkFoot/Content/LinkFoot/Scenes/13-contre_attaque.json&joueurs=tous&camera=tv" 0 0 1280 720 30
# un moment précis (instants du match), un film et une planche de six images, avec les glissements comptés
node rendu/outils/moment.mjs controle "doc=/rendu/labo/scenes/controle_haut.json&joueurs=tous&focus=10&camera=face" 70.36 70.96 560 400
```

Paramètres de la page : `doc` (le document), `joueurs` (`focus`, `tous` ou des codes), `focus` (le joueur suivi), `camera` (`tv`, `suivi`, `serre`, `face`, `dos`, `cote` : de profil, `portrait` : le visage), `t` (instant de départ), `lecture=1` (temps réel), `hud=0` (sans bandeau), `perso` (un personnage riggé à la place du corps MakeHuman). `photo.mjs` part de l'instant demandé ; `cliche.mjs` joue la scène depuis son début (les gestes, la fatigue et les célébrations ont besoin de leur histoire). Les outils lancent Chromium sans écran (`/opt/pw-browsers/chromium`, SwiftShader).

## Personnages riggés, comparaison, allures

```sh
# la scène de comparaison : même scène, même instant, même caméra, même lumière, une image par corps
node rendu/outils/comparer.mjs comparaison.png "doc=/unreal/LinkFoot/Content/LinkFoot/Scenes/01-sprint_droit.json&joueurs=focus&camera=cote" 64.1 640 480 \
  "LinkFoot actuel=" "Quaternius=/unreal/LinkFoot/SourceArt/Characters/Players/Quaternius/SK_LinkFoot_Quaternius.glb"
# les allures : le meilleur exemple de chaque allure dans les scènes de test, filmé de profil
node rendu/outils/allures.mjs sortie perso=/unreal/LinkFoot/SourceArt/Characters/Players/Quaternius/SK_LinkFoot_Quaternius.glb
# la vitrine des gestes : chaque clip demandé (nom ou catégorie), une planche et un film
node rendu/outils/gestes.mjs sortie "glisse,chute,releve,tete" perso=/unreal/LinkFoot/SourceArt/Characters/Players/Quaternius/SK_LinkFoot_Quaternius.glb
# des fenêtres de vrais matchs autour d'actions que les scènes de test n'ont pas (faute et chute, tacle glissé, duel aérien, touche, contrôle de la poitrine)
node rendu/outils/extraire.mjs 1 4          # écrit rendu/labo/scenes/*.json ; LINKFOOT_SCENES=rendu/labo/scenes pour la porte des pieds
# la porte des pieds avec un personnage riggé
LINKFOOT_PERSO=/unreal/LinkFoot/SourceArt/Characters/Players/Quaternius/SK_LinkFoot_Quaternius.glb node rendu/outils/verifier-pieds.mjs
```

Dans Blender (le Python de Blender : `pip install bpy==4.5.4` dans un environnement Python 3.11) :

- `construire/personnage_blend.py` : vérifie un personnage (maillages, triangles, squelette, pose en T ou en A, orientation, matériaux, textures, animations, unités, taille) et l'exporte en GLB (labo) et FBX (Unreal), avec un niveau de détail réduit si demandé ;
- `construire/rigger.py` : le rig automatique d'un personnage qui n'en a pas (squelette aux noms du mannequin d'Unreal, articulations mesurées sur le maillage, pondération par la chaleur des os calculée sur une enveloppe étanche puis reportée sur le vrai maillage) ;
- `construire/quaternius_ue.py` : le personnage Quaternius « Animated Men » (CC0) préparé pour Unreal (voir `unreal/LinkFoot/SourceArt/Characters/Players/Quaternius/README.md`) ;
- `construire/gpf_joueur.py` : le footballeur de Gameplay Football (domaine public) lu dans ses fichiers d'origine (ASE de 3ds Max), poids de peau du jeu, remis debout, squelette aux noms du mannequin d'Unreal, une matière par pièce pour l'habillage, six coiffures (voir `unreal/LinkFoot/SourceArt/Characters/Players/GameplayFootball/README.md`) ;
- `construire/grf.py` : la conversion des animations de Google Research Football dans la base (voir « Reconstruire les données ») ;
- `construire/vitrine_blend.py` : des rendus Cycles d'un personnage (face, trois quarts, profil, dos), avec ses os dessinés à travers le corps ou dans une pose d'essai ; `--cacher` retire des objets du rendu (une seule coiffure sur six, par exemple).

Le moteur oriente maintenant le corps comme Gameplay Football (règle reprise et réécrite, voir `src/engine.js`, « Orientation du corps ») : sans le ballon, un joueur peut regarder le ballon sans courir vers lui, en pas chassés ou en reculant (en défense, sous 3,5 m/s), le corps à 45° au plus de la course au-delà, 22° en sprint. C'est l'angle des images de la passerelle ; le jeu ne le lit pas (12 matchs identiques au geste près, angles mis à part) et `test/corps.js` vérifie la règle sur des matchs entiers. Le Motion Matching trouve donc enfin ses captures de pas chassés et de recul (`outils/allures.mjs` en filme un exemple de chaque).

## Dans l'app : le match en direct avec les vrais corps

Le même code joue le match que l'app regarde en direct (`labo/reel.js`) : la vue 3D de l'app (`src/stade3d.js`) garde le terrain, le public, la caméra et les signes ; les 22 joueurs sont le footballeur de Gameplay Football animé par le Motion Matching et les gestes GRF, comme dans le labo. Le moteur garde un peu plus d'une seconde d'avance sur l'image montrée (`src/direct.js`) ; les images qui arrivent allongent le document lu par `labo/match.js` (`etendre`), et les gestes des joueurs concernés sont repris sans casser un geste en cours (`actualiserGestes`). Le relevé après une chute commence au plus tôt à l'image montrée (en direct, on ne sait pas d'avance quand le moteur relèvera le joueur). Le personnage est lu par `labo/glb.js` (sans GLTFLoader : même résultat, image pour image, vérifié sur trois vues des deux personnages), ce que l'app peut faire sur téléphone.

```sh
# la page d'essai : un club, un match en direct regardé, la vue 3D de l'app et les vrais corps
#   rendu/labo/essai-reel.html?seed=5   (reel=0 : la vue telle qu'elle était, footballeurs en géométrie)
# le premier but d'un match en direct, filmé comme l'app le montre (de 5 s avant à 3 s après)
node rendu/outils/direct.mjs but 5 -5 3 390 320
```

Mesuré dans Chromium sans GPU (SwiftShader, deux cœurs) : 3 à 5 ms de calcul des corps par pas de 1/60 s pour les 22 joueurs. `app/verifier.mjs` vérifie que la vue 3D de l'app charge et anime les vrais corps. Pas encore vérifié : un téléphone réel (les vrais corps n'y sont pas branchés : `app/src/reel.js`), l'écran Mon Club (il ne charge que three.js).

## Licences

- **MakeHuman** : les actifs (maillage de base, cibles, squelette, poids) sont sous CC0 1.0 (LICENSE.md de MakeHuman, sections C et D). Aucun code de MakeHuman (AGPL) n'est repris : `construire/makehuman.py` lit les fichiers de données et applique les facteurs des curseurs macro, réécrits.
- **CMU Graphics Lab Motion Capture Database** (conversion BVH de B. Hahne, cgspeed) : « free for use in research projects. You may include this data in commercially-sold products, but you may not resell this data directly, even in converted form. » Mention demandée : « The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217. » `donnees/mouvements.bin` est une forme convertie de ces données : il peut être inclus dans LinkFoot, pas vendu ni distribué comme base de mouvements à part.
- **Google Research Football** (`third_party/gfootball_engine`, d'après Gameplay Football de Bastiaan Konings Schuiling) : le fichier LICENSE de ce dossier le place dans le domaine public (The Unlicense) ; ses animations (.anim), la description du corps (player.object) et le footballeur (maillage, poids, textures, coiffures : `construire/gpf_joueur.py`) sont lus comme des données ; aucun code n'est copié (la règle d'orientation du corps est réécrite dans le moteur). Jamais `data/databases` : logos et maillots de vrais clubs, noms de vrais joueurs. Les gestes convertis portent le préfixe « grf: » dans la base.
- **Quaternius** « Animated Men » : CC0 1.0 (`unreal/LinkFoot/SourceArt/Characters/Players/`, avec la licence d'origine).
- Aucun modèle, visage, animation, texture, son ni code d'EA Sports FC, de FIFA, d'eFootball ou d'un autre studio. Le motif du ballon, les panneaux et le public sont générés ici.

## Vers Unreal

Les mêmes captures et la même base peuvent alimenter Pose Search dans Unreal : export des clips retenus en FBX, reciblage vers le squelette des MetaHumans avec l'IK Retargeter, base Pose Search avec les mêmes canaux (trajectoire à 0,2, 0,4 et 0,6 s, pieds, hanches). Ce n'est pas encore fait : aucun asset Unreal n'a été créé à partir de ce dossier.
