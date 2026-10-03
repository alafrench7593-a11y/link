# Rendu réel du match (laboratoire web)

Ce dossier joue un document `linkfoot-match` (le match que le moteur LinkFoot a calculé) avec de vrais corps humains qui bougent avec de vraies captures de mouvement, dans un stade éclairé, vu par une caméra de télévision.

Le moteur (`src/engine.js`) reste la seule autorité : le rendu lit ses positions, ses orientations, ses actions et son ballon, et n'en change aucun résultat. Ce qu'il ajoute est visuel et borné (voir « Ce que le rendu invente »).

## Ce qui est fait

| Élément | Comment |
|---|---|
| Corps | Maillage de base MakeHuman (CC0), déformé par les cibles « macro » selon la morphologie de chaque joueur (taille, poids, carrure, muscles), équipement (maillot, short, chaussettes, chaussures) gonflé sur la peau, 10 teints, coiffures |
| Mouvement | Motion Matching sur 152 captures CMU (course, virages, départs, arrêts, pas chassés, recul, marche, attente) : toutes les 0,1 s, la requête décrit la trajectoire que le moteur fera jouer au joueur dans 0,2, 0,4 et 0,6 s, et la pose actuelle ; transitions par inertialisation (demi-vie 0,08 s) |
| Pieds | Verrouillage pendant les appuis (talon puis pointe), décollage quand la jambe ne peut plus tenir l'appui, pointe au-dessus de l'herbe en l'air, bassin abaissé si la foulée l'exige ; détecteur de glissade identique à celui du cœur C++ (pointe à moins de 3 cm du sol et plus de 15 cm/s pendant 0,1 s) |
| Frappes | Passes, tirs, dégagements et tacles jouent une vraie capture de frappe (CMU 10 et 11), calée pour que le pied touche le ballon à l'instant de l'action du moteur ; le corps se tourne vers la cible ; le pied d'appui garde la course quand le joueur va vite |
| Contrôles et conduite | Le pied le plus proche touche le ballon à la réception ; balle au pied, le ballon est poussé puis rattrapé (une touche toutes les 0,45 à 1 s selon la vitesse) |
| Regard | La tête et le cou suivent le ballon (au plus 70° de côté) ; le porteur lève les yeux de temps en temps |
| Fatigue | Sous 50 d'énergie (celle du moteur), le buste se penche en courant ; épuisé et arrêté depuis plus d'une seconde, le joueur pose les mains sur les genoux |
| Célébrations | Les sept genres du moteur (corner, foule, genou, équipe, silence, calme, ballon) : bras écartés en courant, poing qui frappe l'air, à genoux bras au ciel, doigt sur la bouche ; les coéquipiers qui rejoignent le buteur lèvent les bras |
| Maillots | Couleurs du club, trame de tissu, numéro du joueur dans le dos (décalque courbé sur le dos, porté par l'os de la colonne) et sur la poitrine (peint dans la texture, triangle par triangle) |
| Gardien | Garde (genoux fléchis, mains ouvertes) quand le ballon approche ; plongeon latéral (le corps bascule autour de ses pieds, la poussée l'emmène, les mains vont au ballon), arrêt bas ou en face, saut ; ballon tenu contre la poitrine après un arrêt capté, lâché avant le dégagement |
| Ballon | Vol rejoué par la formule du moteur (les images à 10 par seconde la suivent à 2 cm près) ; porté selon la règle du moteur, depuis la position rendue du porteur ; transfert de 0,35 s quand le moteur le pose d'un coup chez un nouveau porteur ; il roule sans glisser |
| Stade | Pelouse tondue en bandes, lignes réglementaires, buts et filets, panneaux, tribunes en gradins avec un public aux couleurs des deux clubs, pylônes, ciel ; tout est généré dans `labo/stade.js` |
| Temps | Celui du document (`match.meteo`) : soleil ; pluie (ciel couvert, pelouse mouillée, gouttes) ; neige ; nuit (projecteurs, tribunes dans la pénombre) |
| Caméra | Télé (tribune principale, 18 m derrière la touche, 15 m de haut, panoramique sur le ballon, 31 m de terrain dans le cadre, 24 m près du but) avec le bandeau du score et l'horloge du moteur ; suivi, serré, face, dos |

## Mesure

`node rendu/outils/verifier-pieds.mjs` joue les 16 scènes de test en entier, 22 joueurs chacune, avec le détecteur du cœur C++ sur les deux pieds de chaque joueur : **0 glissement** (porte VALIDE). Environ 25 minutes sur deux cœurs.

## Ce que le rendu invente (et ses bornes)

- La conduite de balle : au plus 0,35 m autour de la position du moteur, éteinte 0,15 s avant une frappe (le ballon part toujours d'où le moteur le fait partir).
- Le transfert du ballon à un nouveau porteur (0,35 s) : le moteur le pose d'un coup jusqu'à 2,3 m plus loin.
- Le plongeon du gardien : le moteur ne le déplace pas (il dit le côté, la durée et le point du tir) ; le corps rendu s'écarte de sa position le temps du plongeon, puis la rejoint.
- Le corps d'un joueur qui frappe s'approche du ballon (au plus 0,7 m) pendant le geste.
- Les gestes des célébrations et de la fatigue : le moteur dit le genre, la destination, la durée et l'énergie ; la forme du geste est celle du rendu.

## Reconstruire les données

Les sources ne sont pas dans le dépôt (seules les données générées le sont). Clones partiels :

```sh
git clone --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman.git mh-src/makehuman
git clone --filter=blob:none --sparse https://github.com/Shriinivas/cmubvh.git mocap/cmubvh
```

Puis (les BVH des clips listés dans `construire/mouvements.py` copiés dans `mocap/bvh`) :

```sh
cd rendu/construire
python3 mouvements.py <dossier des BVH> ../donnees          # mouvements.json / .bin
python3 corps.py <mh-src/makehuman> <BVH de référence, 16_35.bvh> ../donnees   # corps.json / .bin (le clone, qui contient makehuman/data)
```

## Voir et filmer

```sh
node rendu/outils/photo.mjs "rendu/labo/index.html?doc=/unreal/LinkFoot/Content/LinkFoot/Scenes/13-contre_attaque.json&joueurs=tous&camera=tv&t=2535.1" photo.png 1280 720
node rendu/outils/filmer.mjs tele.mp4 "doc=/unreal/LinkFoot/Content/LinkFoot/Scenes/13-contre_attaque.json&joueurs=tous&camera=tv" 0 0 1280 720 30
```

Paramètres de la page : `doc` (le document), `joueurs` (`focus`, `tous` ou des codes), `focus` (le joueur suivi), `camera` (`tv`, `suivi`, `serre`, `face`, `dos`), `t` (instant de départ), `lecture=1` (temps réel), `hud=0` (sans bandeau). `photo.mjs` part de l'instant demandé ; `cliche.mjs` joue la scène depuis son début (les gestes, la fatigue et les célébrations ont besoin de leur histoire). Les outils lancent Chromium sans écran (`/opt/pw-browsers/chromium`, SwiftShader).

## Licences

- **MakeHuman** : les actifs (maillage de base, cibles, squelette, poids) sont sous CC0 1.0 (LICENSE.md de MakeHuman, sections C et D). Aucun code de MakeHuman (AGPL) n'est repris : `construire/makehuman.py` lit les fichiers de données et applique les facteurs des curseurs macro, réécrits.
- **CMU Graphics Lab Motion Capture Database** (conversion BVH de B. Hahne, cgspeed) : « free for use in research projects. You may include this data in commercially-sold products, but you may not resell this data directly, even in converted form. » Mention demandée : « The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217. » `donnees/mouvements.bin` est une forme convertie de ces données : il peut être inclus dans LinkFoot, pas vendu ni distribué comme base de mouvements à part.
- Aucun modèle, visage, animation, texture, son ni code d'EA Sports FC, de FIFA, d'eFootball ou d'un autre studio. Le motif du ballon, les panneaux et le public sont générés ici.

## Vers Unreal

Les mêmes captures et la même base peuvent alimenter Pose Search dans Unreal : export des clips retenus en FBX, reciblage vers le squelette des MetaHumans avec l'IK Retargeter, base Pose Search avec les mêmes canaux (trajectoire à 0,2, 0,4 et 0,6 s, pieds, hanches). Ce n'est pas encore fait : aucun asset Unreal n'a été créé à partir de ce dossier.
