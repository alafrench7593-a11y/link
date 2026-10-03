# SK_LinkFoot_Quaternius : la base technique temporaire (option A)

Un footballeur provisoire pour construire et valider toute la chaîne (rig, Motion Matching, IK,
ballon, IA, 11 contre 11, caméra) avant l'arrivée d'un personnage réaliste. Le squelette porte
les noms du mannequin d'Unreal : le futur personnage n'aura qu'à suivre la même convention pour
prendre sa place sans rien changer à l'architecture.

## Origine et licence

- Personnage : « Animated Men » de Quaternius (quaternius.com/packs/animatedmen.html), un des 4
  modèles du pack, licence **CC0 1.0** (`LICENSE-quaternius.txt`, copie du fichier de licence
  livré avec le modèle).
- Fichier source : `assets/player.glb` du dépôt github.com/kendrekaran/striker-3d (commit
  57847f8), dont le README le décrit comme « Animated Men », converti de FBX en GLB. C'est le
  même fichier que `../Candidates/Candidate_01/Candidate_01.glb`.
- Les 3 autres modèles du pack ne sont pas ici : la page du pack ne les nomme pas et son
  téléchargement n'était pas accessible depuis l'environnement de travail.

## Ce qui a été changé (rendu/construire/quaternius_ue.py, Blender 4.5)

| Avant (Quaternius) | Après (LinkFoot) |
|---|---|
| 4,84 unités de haut | 1,80 m, échelle et rotations appliquées, pieds au sol |
| `Bone`, `Body`, `Hips`, `Abdomen`, `Torso`, `Neck`, `Head` | `root`, `pelvis`, `spine_01`, `spine_02`, `spine_03`, `neck_01`, `head` |
| `Shoulder`, `UpperArm`, `LowerArm`, `Palm`, `MiddleHand`, `Fingers`, `Thumb1`, `Thumb2` | `clavicle`, `upperarm`, `lowerarm`, `hand`, `middle_01`, `middle_02`, `thumb_01`, `thumb_02` |
| `UpperLeg`, `LowerLeg`, `Foot` (le pied, cible d'IK enfant de la racine, part du talon) | `thigh`, `calf`, `foot` (enfant du mollet, pivot à la cheville) + `ball` (orteils, nouveau) |
| `PoleTarget.L/R` | retirés (sans poids) |
| 11 animations génériques (marche, course, applaudir...) | retirées : les pieds suivaient l'ancienne hiérarchie ; LinkFoot anime avec ses propres captures |

Les poids de peau sont ceux de Quaternius ; l'avant de chaque chaussure passe en douceur de
`foot` à `ball`. Le rapport complet (os, hiérarchie, mesures des pieds) est dans
`SK_LinkFoot_Quaternius.rapport.json`.

## Fichiers

- `SK_LinkFoot_Quaternius.fbx` : pour Unreal (objet d'armature nommé « Armature » : Unreal n'en
  fait pas un os de plus ; sans os feuilles).
- `SK_LinkFoot_Quaternius.glb` : pour le labo three.js (`rendu/labo/index.html?perso=/unreal/LinkFoot/SourceArt/Characters/Players/Quaternius/SK_LinkFoot_Quaternius.glb`).
- `SK_LinkFoot_Quaternius.blend` : la scène Blender de travail.

## Refaire

```sh
python rendu/construire/quaternius_ue.py <le .glb ou .fbx Quaternius> <dossier de sortie>
python rendu/construire/vitrine_blend.py <dossier>/SK_LinkFoot_Quaternius.blend vitrine.png --squelette --vues face,profil
python rendu/construire/vitrine_blend.py <dossier>/SK_LinkFoot_Quaternius.blend pose.png --pose essai
```

(avec le Python de Blender : `pip install bpy==4.5.4` dans un environnement Python 3.11.)

## Ce qui n'est pas vérifié

Rien de ce dossier n'a encore été importé dans Unreal : l'environnement de travail n'a pas
d'Unreal. Le squelette a été vérifié dans Blender (rendus, pose d'essai) et dans le labo
three.js (os écrits à 0,0000015 m de la pose voulue, 0 glissement de pied sur les 16 scènes).
