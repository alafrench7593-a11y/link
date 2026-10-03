# LinkFoot dans Unreal 5.8 : des footballeurs qui ont l'air vrais

Le cahier « qualité visuelle » demande des joueurs au niveau visuel des meilleurs jeux de football,
**originaux** : aucun modèle, visage, animation, texture, code ou fichier venant d'EA Sports FC, de
FIFA ou d'un autre jeu. La référence est un niveau de qualité, pas un contenu. Ce document dit, pour
chacune des 32 sections, ce qui existe, ce qui le vérifie, et ce qui reste à faire dans l'éditeur.

Les libellés suivis de **NV** n'ont pas pu être vérifiés dans la documentation d'Epic pour la 5.8 ;
les autres en viennent, ou du code de ce dépôt.

## 1. Où on en est, sans détour

**Aucun personnage final n'existe encore** : aucun visage, aucun MetaHuman, aucune coiffure, aucun
maillot. Une **base technique temporaire** existe (section 1 bis) : un personnage Quaternius (CC0)
préparé pour Unreal, pour construire et valider la chaîne entière avant le personnage réaliste. Ce
dépôt n'a pas d'Unreal : ce personnage n'a été vu que dans Blender et dans le labo three.js.

Ce qui existe, et que les personnages consommeront :

| Quoi | Où | Vérifié par |
| --- | --- | --- |
| Le corps de chaque joueur : 16 proportions et 3 mesures, différentes à poste égal | `src/passerelle.js` (`morphologie`), feuille de match | `test/passerelle.js` |
| Son visage : graine, 8 coefficients, teint 0 à 9, texture et style de cheveux, barbe, yeux ; figé d'une version à l'autre | `apparencePont` | `test/passerelle.js` (3 empreintes figées) |
| Son caractère : 5 traits, 6 tempéraments | `personnalitePont` | `test/passerelle.js` |
| La tête et les yeux séparés du corps, dans leurs limites | `LFRegard` (`orienterRegard`) | `tests-coeur` : 121 806 regards |
| 8 expressions et 8 gestes, nés des actions du match | `LFVisage` | `tests-coeur` : 17 buts sur 17, 21 tirs manqués sur 21, 48 fautes sur 48 |
| Le souffle, la sueur, la pluie, la posture de fatigue | `LFPhysiologie` | `tests-coeur` : 18 puis 38 respirations par minute après un sprint |
| 15 types de course, la foulée de chaque corps, le buste | `LFLocomotion`, `LFCorps` | `tests-coeur` |
| La porte de qualité : un pied qui glisse et la scène ne passe pas | `LFDetecteurs` (`porteQualite`), le directeur, le HUD | `tests-coeur` |
| Tout cela offert au graphe d'animation, au HUD, aux matériaux | `ULFAnimInstanceFootballeur`, `ALFHUDDebug`, `ULFComposantPeau` | `verif-syntaxe` (syntaxe seulement) |
| La fabrique des MetaHumans, un par joueur | `Content/Python/metahumans_linkfoot.py` | `unreal/tests-python` (contre un faux éditeur) |

Le rendu final dépend de quatre chantiers qui ne se font que dans l'éditeur ou en studio : les
modèles de visage dans MetaHuman Creator, la garde-robe (coiffures, barbes, maillots, crampons), les
matériaux (sueur, pluie), et les **captures de mouvement** de football. Le dernier est le plus long.

## 1 bis. La base technique temporaire : le Quaternius (option A)

| Quoi | Où | Vérifié par |
| --- | --- | --- |
| Le personnage, squelette aux noms du mannequin d'Unreal (root, pelvis, spine_01 à 03, neck_01, head, clavicle, upperarm, lowerarm, hand, thigh, calf, foot, ball), poids d'origine, 1,80 m | `unreal/LinkFoot/SourceArt/Characters/Players/Quaternius/SK_LinkFoot_Quaternius.fbx` (README à côté : origine, licence CC0, ce qui a changé) | rendus Blender ; labo three.js : 0 glissement de pied sur les 16 scènes |
| Le script d'import : maillage, IK Rig (chaînes reconnues, sinon posées d'après les noms du mannequin ; IK du corps entier), IK Retargeter depuis l'IK Rig du mannequin, branchement aux footballeurs | `Content/Python/personnage_linkfoot.py` | `unreal/tests-python/test_personnage.py` (contre un faux éditeur ; chaque fonction relevée dans la doc Python 5.8) |
| Les gestes de football (tacle glissé, chute, relevé, tête, touche...) | la base du labo (`rendu/`, clips « grf: », Google Research Football, domaine public) | labo three.js, branchés sur les actions du moteur |

Ce personnage n'est pas le personnage final : il sert à faire marcher le joueur, ses animations, son
IK, le ballon et le match. Le personnage réaliste prendra sa place en suivant les mêmes noms d'os.

### Premier essai du Quaternius dans l'éditeur

1. Unreal 5.8 ouvert sur `unreal/LinkFoot/LinkFoot.uproject`, plugins IK Rig et Python Editor Script actifs.
2. Output Log, mode Python : `import personnage_linkfoot as pl` puis
   `pl.tout("<chemin du dépôt>/unreal/LinkFoot/SourceArt/Characters/Players/Quaternius/SK_LinkFoot_Quaternius.fbx")`.
3. Ouvrir `/Game/LinkFoot/Characters/Players/Quaternius/IK_LinkFoot_Quaternius` : les chaînes (bras, jambes, colonne, tête) et le solveur du corps entier doivent apparaître. Si l'import a nommé le maillage autrement (Interchange ignore `destination_name`), le rapport rendu par `pl.tout` donne le vrai chemin.
4. Avec un IK Rig de mannequin dans le projet (celui du Game Animation Sample, par exemple) : `pl.retargeter("<son chemin>", "<chemin de IK_LinkFoot_Quaternius>")`, puis l'ouvrir et jouer une animation du mannequin sur le Quaternius.
5. Avec l'asset de définitions des personnages : `pl.brancher("<son chemin>", "<chemin du maillage>")`, puis la carte LinkFoot.Scenes.
6. **Me renvoyer** le rapport et les messages de l'Output Log, et une capture du viewport : je corrige.

## 2. L'originalité (§1)

- Les visages sont des **modèles faits à la main** dans MetaHuman Creator (des mélanges de presets,
  aucun visage réel), déclinés joueur par joueur : le script choisit le modèle d'après la graine du
  joueur et règle son corps, sa peau, ses yeux, sa garde-robe. Il ne crée aucun visage de rien.
- Les coiffures, barbes, maillots et crampons sont des Wardrobe Items faits ou choisis par l'artiste.
  Les maillots sont des maillots LinkFoot.
- Les animations sont capturées pour LinkFoot ou achetées avec une licence qui le permet ; le Game
  Animation Sample d'Epic sert de départ pour la locomotion (`unreal/README.md`).
- Les références de la grille du §30 sont des **vidéos de vrais joueurs** que l'équipe a filmées ou
  qui sont libres de droits ; jamais des captures d'un jeu du commerce.
- La licence de MetaHuman (Epic) est à relire avant la sortie.

## 3. Les 32 sections

| § | Le cahier | Ce qui existe | Ce qui reste (éditeur, artiste, capture) |
| --- | --- | --- | --- |
| 1 | qualité AAA, personnages originaux | les règles du §2 ci-dessus | relire la licence MetaHuman |
| 2 | le visage | graine et 8 coefficients ; choix stable du modèle de visage ; mélange de deux modèles (expérimental, éteint) | faire au moins trois modèles de visage, puis juger le mélange à l'oeil avant de l'allumer |
| 3 | la peau : diffusion sous la surface, micro-relief, pores, imperfections, brillance, sueur, variations | teint 0 à 9 ; une texture de peau par joueur (index stable) ; sueur, pluie et effort envoyés aux matériaux (`ULFComposantPeau`) | relever les 10 points U/V des teints ; lire les données de primitive dans le matériau de peau (section 5) |
| 4 | les yeux, et le regard : corps vers l'avant, tête en partie vers le ballon, yeux sur le ballon | `orienterRegard` : les yeux seuls jusqu'à 15° ; au-delà, la tête prend 75 % de ce qui dépasse (70° au plus) et les yeux le reste (35° au plus) ; `LacetTete`, `LacetYeux`... | brancher la tête et les yeux (section 5) ; couleurs d'yeux dans `yeux` |
| 5 | les coiffures | 10 styles, liés à la texture des cheveux | un Wardrobe Item par style |
| 6 | les barbes | 7 états, de rasé au bouc | les items, le nom de l'emplacement de la barbe **NV** |
| 7 | 16 mesures du corps | `morphologie` : les 16, plus masse grasse, envergure, pointure | relever les noms des contraintes du corps (`mh.lister`) |
| 8 | une silhouette par poste | défenseurs plus larges, gardiens à l'envergure et aux mains | |
| 9 | deux joueurs du même poste différents | un bruit propre au personnage (écart minimal 0,15) | |
| 10 | la musculature suit le profil | rapide : cuisses, mollets, moins de masse grasse ; fort : torse, cou, épaules | |
| 11 | les mains | `mains` (un gardien plus grandes) | une contrainte de main existe-t-elle dans le corps MetaHuman ? **NV** ; sinon l'échelle de l'os de la main |
| 12 | les pieds | `pieds`, `pointure` | |
| 13 | les crampons | la pointure | des crampons LinkFoot (Wardrobe Item) |
| 14 | le maillot | une tenue par camp dans les correspondances | des maillots LinkFoot ; numéro et nom |
| 15 | le tissu | | Chaos Cloth sur le maillot et le short ; le coût à mesurer |
| 16 | Motion Matching, Pose Search, IK, Control Rig | la classe d'animation (`docs/ue5/animation.md`) | le graphe, les bases |
| 17 | la bibliothèque de locomotion | `TypeCourse` : immobile, marche, trot, course, sprint, départ, accélération, décélération, arrêt, courbe, diagonale, latéral, recul, repli, pressing | une base Pose Search par type, un Chooser sur `TypeCourse` ; les captures |
| 18 | les virages de 10° à 180° | `VirageDeg`, `RayonVirage`, `Virage` | des pivots par angle (captures) |
| 19 | l'accélération selon les attributs | `Explosivite` ; un explosif fait des pas plus courts et se penche plus (30° contre 24,6° au même effort) | Stride Warping et buste dans le graphe |
| 20 | la pose des pieds, porte dure | `DetecteurPied` ; `porteQualite` : NE PAS LIVRER au premier glissement ; verdict du directeur à chaque boucle, ligne du HUD | la faire tourner sur les seize scènes |
| 21 | le corps change la course | foulée par longueur de jambe (0,78 à 0,92 m), cadence ; `Echelle` | `LongueurPas` et `Cadence` dans le Stride Warping |
| 22 | les gestes de football | familles d'animation, prochain contact (`LFContact`) | les captures (audit, section 8) |
| 23 | les réponses aux contacts | `bDesequilibre`, `bAuSol`, familles chute et déséquilibre | animation physique partielle, captures |
| 24 | la fatigue se voit | essoufflement, fréquence et amplitude du souffle, posture de fatigue, énergie | une couche de respiration additive, une posture fatiguée |
| 25 | les expressions | 8 poids de 0 à 1 et la dominante | les poses d'expression du visage (section 5) |
| 26 | la vie dans le match | regard et coups d'oeil par-dessus l'épaule (`LFRegard`), appel, protestation, mains sur la tête, applaudir, célébration, consigne, poing serré (`Geste`) ; le replacement est celui du moteur | les gestes du haut du corps, en couche (captures) |
| 27 | la personnalité | 6 tempéraments ; ils règlent l'amplitude des expressions et des gestes | l'amplitude des couches dans le graphe |
| 28 | le test caméra de retransmission | | section 6 |
| 29 | le laboratoire des personnages | | section 6 |
| 30 | la grille humain réel contre LinkFoot | la grille (section 7) | la remplir |
| 31 | le test absolu | `bModeReel` (le HUD n'affiche plus rien) ; la porte de qualité | le faire (section 8) |
| 32 | de vrais footballeurs dans un vrai match | | |

## 4. La fabrique des MetaHumans

`unreal/LinkFoot/Content/Python/metahumans_linkfoot.py` et ses correspondances
`metahumans_linkfoot.json`. Pour chaque joueur d'une feuille de match : dupliquer un modèle de visage
(choisi parmi ceux qui vont avec son teint, toujours le même pour lui), régler la taille, relire les
plages des mensurations à cette taille, régler les mensurations, poser la peau et les yeux, ajouter
coiffure, barbe et maillot, et sur demande demander textures et rig du visage puis assembler.
Relancer met à jour au lieu de doubler.

Il n'appelle que des fonctions relevées dans la documentation d'Epic pour la 5.8 :
[MetaHuman Creator Python Scripting](https://dev.epicgames.com/documentation/metahuman/metahuman-creator-python-scripting-in-unreal-engine),
et la référence C++ des structures (`FMetaHumanCharacterBodyConstraint` : `Name`, `bIsActive`,
`TargetMeasurement`, `MinMeasurement`, `MaxMeasurement` ; `FMetaHumanCharacterSkinProperties` : `U`,
`V`, `Roughness`, `FaceTextureIndex`, `BodyTextureIndex` ; `FMetaHumanPipelineSlotSelection` ;
`FMetaHumanCharacterEditorBuildParameters`). La liste est dans le script (`API_UTILISEE`) ; le test
hors d'Unreal échoue si le script appelle autre chose.

Ce que la documentation ne dit pas vient des correspondances, que l'artiste remplit en regardant ses
propres modèles. Une entrée vide n'est pas appliquée : le rapport la signale.

| Ce qui n'est pas documenté | Comment on le trouve |
| --- | --- |
| les noms des contraintes du corps autres que la taille, et leurs unités | `mh.lister(modèle)` les affiche avec leurs plages |
| le point U/V de chaque teint | à l'oeil, dans le panneau de la peau |
| les champs des yeux | les exemples Python livrés avec MetaHuman (`test_set_character_properties.py`, cité par la documentation) |
| le nom de l'emplacement de la barbe et de la moustache | le panneau de la garde-robe (la documentation cite « Hair » et « Outfits ») |
| ce que rend `try_add_item_from_wardrobe_item` en Python | le script accepte la clé seule ou (booléen, clé) |
| la mise à jour des plages après la taille | supposée par le script (deux passages) ; à vérifier au premier essai |

### Premier essai

1. Edit > Plugins : activer les greffons MetaHuman (chercher « MetaHuman ») **NV** pour leurs noms
   exacts ; Python Editor Script Plugin et Editor Scripting Utilities sont déjà dans le `.uproject`.
2. Faire trois modèles de visage dans MetaHuman Creator (création d'un MetaHuman Character depuis le
   Content Browser **NV**), sans coiffure, barbe ni tenue, dans `/Game/LinkFoot/MetaHumans/Modeles`.
3. Dans `metahumans_linkfoot.json`, mettre leurs chemins dans `modeles_visage`.
4. Output Log, mode Python : `import metahumans_linkfoot as mh`, puis
   `mh.lister("/Game/LinkFoot/MetaHumans/Modeles/<un modèle>")`. Reporter les noms exacts dans
   `corps` (champ `contrainte`) quand le rapport signale une ambiguïté.
5. `mh.generer("LinkFoot/Scenes/01-sprint_droit.json", essai=True)` : rien n'est touché, le rapport
   (`Saved/LinkFoot/metahumans-rapport.json`) dit ce qui serait fait.
6. `mh.generer("LinkFoot/Scenes/01-sprint_droit.json", limite=3)` : trois joueurs. Les regarder.
7. Le reste ; puis `assembler=True` (plusieurs minutes par joueur), `textures=True` et `rig=True`
   (services d'Epic, compte Epic).
8. **Me renvoyer** le rapport et les messages de l'Output Log : je corrige le script.

## 5. Brancher un MetaHuman sur le footballeur LinkFoot

`ALFFootballeur` porte l'Animation Blueprint LinkFoot sur son maillage (le squelette du mannequin).
Un MetaHuman assemblé est un ensemble de maillages (corps, visage, cheveux, tenue) **NV** pour sa
forme exacte en 5.8. La voie proposée :

| Pièce | Réglage |
| --- | --- |
| `BP_LF_Footballeur_MH` | enfant de `BP_LF_Footballeur` ; y ajouter les composants du MetaHuman assemblé |
| le maillage du mannequin (`Mesh`) | invisible mais animé : Visibility Based Anim Tick Option = Always Tick Pose and Refresh Bones |
| le corps MetaHuman | suit le mannequin (Leader Pose Component = `Mesh`) ; les os du corps des MetaHumans et du mannequin d'Unreal 5 portent les mêmes noms **NV** ; sinon, un IK Retargeter à l'exécution |
| la tête | `LacetTete` et `TangageTete` sur le cou et la tête (Control Rig, ou un nœud de rotation d'os) |
| les yeux | `LacetYeux` et `TangageYeux` sur les contrôles de regard du visage MetaHuman (noms **NV**) |
| les expressions | une Pose Asset du visage par expression, mêlées par les 8 poids (`PoidsJoie`...) ; le visage MetaHuman se pilote par des courbes `CTRL_expressions_*` **NV** |
| le souffle | une couche additive du buste, vitesse = `FrequenceRespiration` / 60, poids = `AmplitudeRespiration` |
| la fatigue | une couche de posture, poids = `PostureFatigue` |
| les gestes | des montages du haut du corps par `Geste`, amplitude réglée par `Expressivite` et `Agressivite` |
| la sueur, la pluie | dans le matériau de la peau et celui du maillot, le nœud Custom Primitive Data : index 0 = transpiration, 1 = humidité, 2 = effort (`ULFComposantPeau`, index réglables si le matériau MetaHuman en utilise déjà) ; la sueur baisse la rugosité et monte le spéculaire, l'humidité assombrit le maillot |

## 6. Le laboratoire (§29) et le test caméra (§28)

Un niveau `L_LF_Labo`, avec un `LFDirecteurMatch` dont on change la scène :

| Plan du cahier | Scène LinkFoot |
| --- | --- |
| course, sprint | 1. Sprint droit ; 3. Sprint puis arrêt |
| contrôle du ballon | 4. Réception en course |
| duel | 7. Duel d'épaule |
| pluie | 15. Sous la pluie (humidité 1 pour tous) |
| projecteurs | 16. Match de nuit |
| fatigue | 14. Joueur épuisé |

Lumières (une par sous-niveau, ou un Blueprint qui les bascule) : studio (trois Rect Lights sur un
fond neutre), jour (Directional Light haute, Sky Atmosphere, Sky Light), heure dorée (soleil à
quelques degrés de l'horizon), projecteurs (quatre mâts de Spot Lights), pluie (la scène 15, des
surfaces mouillées). Caméras : CLOSE (le visage), MEDIUM (le joueur en pied), BROADCAST (la tribune
principale, en hauteur), FAR (le plan large). Leurs distances et focales sont à choisir sur place et
à garder ensuite, pour comparer d'une version à l'autre.

Ce qu'on regarde à chaque distance : de près, la peau, les yeux, la sueur, l'expression ; en pied,
les proportions, les mains, le maillot ; en retransmission, la course, les appuis, la silhouette ;
de loin, que la foule de joueurs ne se ressemble pas et que personne ne glisse.

## 7. La grille humain réel contre LinkFoot (§30)

Pour chaque plan du laboratoire, une vidéo de référence (de vrais joueurs, filmés par l'équipe ou
libres de droits) et la même chose dans LinkFoot. Note : 0 on voit un jeu, 1 presque, 2 on ne voit
pas la différence.

| Critère | Réel | LinkFoot | Note | Ce qui manque |
| --- | --- | --- | --- | --- |
| peau : pores, brillance, sueur | | | | |
| yeux : humidité, reflets, regard qui suit le ballon | | | | |
| cheveux : silhouette, mouvement | | | | |
| silhouette : proportions, variété dans l'équipe | | | | |
| course : cadence, buste, appuis | | | | |
| pose des pieds | | | | |
| contact avec le ballon | | | | |
| fatigue : souffle, posture | | | | |
| expression après un but, une faute, un tir manqué | | | | |
| maillot : plis, tissu, pluie | | | | |
| de nuit, sous les projecteurs | | | | |

## 8. Le test absolu (§31)

1. Le HUD en mode réel : `bModeReel` coché sur `LFHUDDebug` (ou la commande de console `ShowHUD`,
   qui masque tout le HUD **NV** pour la 5.8). Plus de nom, de note, de statistique, de débogage.
2. Les seize scènes, en BROADCAST et en MEDIUM, dix secondes chacune.
3. Des personnes qui ne connaissent pas le projet : « Ce sont de vrais footballeurs ? »
4. Si non : **NE PAS LIVRER**. Et, quel que soit l'avis, la porte automatique : un seul glissement de
   pied ou une désynchronisation pendant une boucle, et le journal dit `porte de qualité : NE PAS
   LIVRER` (le directeur, à chaque boucle).

## 9. Le coût d'affichage

Vingt-deux joueurs, un ballon, une foule. Pipeline d'assemblage Optimized (le script le prend par
défaut, qualité moyenne). Les cheveux sont le poste le plus cher : mèches de près seulement, cartes
puis maillages simples en s'éloignant (le découpage exact des niveaux MetaHuman est **NV**). Le tissu
simulé seulement pour les joueurs proches de la caméra. Les données de primitive gardent les
matériaux partagés entre joueurs. Aucun chiffre de budget ici : il se mesure (Unreal Insights) sur la
machine visée, au premier assemblage de vingt-deux joueurs.
