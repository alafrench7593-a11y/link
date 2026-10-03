# SK_LinkFoot_GPF : le footballeur de Gameplay Football

Le joueur du jeu Gameplay Football, dans son dessin d'origine : 747 triangles, visage sans
traits, six coiffures, maillot, short, chaussettes et crampons. Préparé pour le labo et pour
Unreal avec le même squelette que le Quaternius (noms du mannequin d'Unreal) : on passe de l'un
à l'autre sans rien changer d'autre.

## Origine et licence

- Auteur : Bastiaan Schuiling. Les crédits du jeu (`src/menu/credits.cpp` de
  github.com/BazkieBumpercar/GameplayFootball) le nomment seul pour « graphics, modelling » et
  « player animations ».
- Fichiers d'origine : `third_party/gfootball_engine/data/media/` de
  github.com/google-research/football (commit 3d9e754720a9 ; dépôt archivé le 19 août 2026).
  Ce dossier est placé dans le domaine public par l'Unlicense (`LICENSE-gameplayfootball.txt`,
  copie du fichier LICENSE du dossier).
- Lus : `objects/players/models/fullbody.ase`, `objects/players/player.object`,
  `animations/base.anim.util`, les textures `kit_UVWnormal`, `shoe`, `arm_normal`, `knee_normal`
  et `referee_kit` (seulement pour séparer le maillot du short), et six coiffures. La liste
  exacte est dans `SK_LinkFoot_GPF.rapport.json` (« fichiers_lus »).
- Jamais lu ni copié : `data/databases`, qui contient des logos et des maillots de vrais clubs et
  des noms de vrais joueurs à peine déformés. L'auteur ne pouvait pas mettre dans le domaine
  public des marques et des noms qui ne sont pas à lui.
- Les couleurs des maillots sont celles de LinkFoot : le labo habille chaque joueur aux couleurs
  de son club (matières reconnues par leur nom, `rendu/labo/personnage.js`).

## Ce qui a été fait (`rendu/construire/gpf_joueur.py`, Blender 4.5)

| Dans le jeu | Ici |
|---|---|
| Maillage modelé dans la pose de base du jeu (genoux et coudes fléchis, buste penché) ; 1,90 m debout | Remis debout comme le jeu le fait à chaque image (peau linéaire, mêmes poids), bras écartés de 25° ; 1,80 m |
| Poids de peau codés dans les couleurs des sommets (10 x articulation + 9 x poids, trois articulations au plus) | Les mêmes poids, en groupes de sommets |
| 13 articulations : `body`, `middle`, `neck`, épaules, coudes, hanches, genoux, chevilles | Noms du mannequin d'Unreal ; colonne en trois (`spine_01` à `spine_03`), `neck_01` et `head`, mains, orteils (`ball`) et clavicules ajoutés : ils se partagent les poids d'origine selon la géométrie (main au-delà du poignet, avant de la chaussure) |
| Normales écrites dans le repère de chaque objet (plusieurs objets en miroir) | Ramenées dans le monde ; 747 faces sur 747 dans le bon sens |
| Une texture de maillot pour tout le corps | Une matière par pièce : `maillot`, `short`, `chaussettes`, `chaussures` (texture d'origine), `semelle`, `peau_bras`, `peau_genoux`, `peau_tete` (normales d'origine des bras, des genoux et du maillot) |
| Une coiffure tirée à la création du joueur | Six maillages `cheveux_short01` à `cheveux_long02`, portés par `head` ; le labo n'en montre qu'un, d'après la coiffure de la fiche (rasé : aucun). `bald.ase` n'est qu'un repère vide. |

## Fichiers

- `SK_LinkFoot_GPF.fbx` : pour Unreal, le corps avec une coiffure (`short01`) ; objet d'armature
  nommé « Armature », sans os feuilles.
- `coiffures/SK_LinkFoot_GPF_cheveux_<style>.fbx` : chacune des six coiffures, sur le même squelette
  (à importer avec le squelette du corps et à attacher une à la fois).
- `SK_LinkFoot_GPF.glb` : pour le labo three.js
  (`rendu/labo/index.html?perso=/unreal/LinkFoot/SourceArt/Characters/Players/GameplayFootball/SK_LinkFoot_GPF.glb`).
- `SK_LinkFoot_GPF.blend` : la scène Blender de travail ; `textures/` : les textures converties.
- `SK_LinkFoot_GPF.rapport.json` : os, hiérarchie, pièces, coiffures, échelle, fichiers lus.

## Refaire

```sh
python rendu/construire/gpf_joueur.py <football>/third_party/gfootball_engine/data/media <dossier> \
    --origine "github.com/google-research/football, commit 3d9e754720a9, third_party/gfootball_engine/data/media"
python rendu/construire/vitrine_blend.py <dossier>/SK_LinkFoot_GPF.glb vitrine.png --cacher 'cheveux_(short02|medium|long)'
python rendu/construire/vitrine_blend.py <dossier>/SK_LinkFoot_GPF.glb pose.png --pose essai --cacher 'cheveux_(short02|medium|long)'
```

(avec le Python de Blender : `pip install bpy==4.5.4 scipy pillow` dans un environnement Python 3.11 ;
le dépôt de Google se clone en ne prenant que `third_party/gfootball_engine/data/media/objects/players`
et `.../animations`.)

## Dans Unreal

```python
import personnage_linkfoot as pl
pl.tout("C:/.../link/unreal/LinkFoot/SourceArt/Characters/Players/GameplayFootball/SK_LinkFoot_GPF.fbx",
        source_ik_rig="/Game/Characters/Mannequins/Rigs/IK_Mannequin",
        definitions="/Game/LinkFoot/Data/DA_Personnages")
```

Les assets vont dans `/Game/LinkFoot/Characters/Players/GameplayFootball` (`IK_LinkFoot_GPF`,
`RTG_Mannequin_vers_LinkFoot_GPF`). Les autres coiffures s'importent à la main, en choisissant le
squelette du corps (non scripté).

## Ce qui n'est pas vérifié

Rien de ce dossier n'a encore été importé dans Unreal : l'environnement de travail n'en a pas. Le
personnage a été vérifié dans Blender (rendus de face, de profil, de dos, pose d'essai) et dans le
labo three.js, animé par le moteur (porte des pieds sur les scènes officielles et les fenêtres du
labo).
