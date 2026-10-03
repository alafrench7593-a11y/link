"""Les gestes de football de Google Research Football, convertis en clips de la base de mouvements.

Source : github.com/google-research/football, dossier third_party/gfootball_engine (« Gameplay
Football » de Bastiaan Konings Schuiling, très modifié par Google), placé dans le domaine public
par son fichier LICENSE (The Unlicense). Ce qui est repris : les fichiers d'animation (.anim) et la
description du corps (objects/players/player.object), lus comme des données ; aucun code.

Un fichier .anim (lu dans utils/animation.cpp du même dossier, pour la forme) : une ligne par
segment du corps, des clés (image, quaternion x y z w) à 100 images par seconde ; la ligne
« player » porte le déplacement (image, x y z) ; puis des lignes « extension,football,image,x,y,z »
(l'instant et le point où le corps touche le ballon) et des balises (le genre du geste, l'état
d'arrivée : couché sur le dos ou sur le ventre...). Le quaternion d'une clé remplace la rotation
propre du segment ; la position du segment par rapport à son parent est celle de player.object.
Repère du fichier : z vers le haut, l'avant du joueur vers -y, sa gauche vers +x.

La conversion donne, comme pour une capture CMU (mouvements.py) : pour chacune des 25
articulations, la rotation qui mène de la pose en T des captures à la pose de l'image (dans
l'espace du personnage, le cap lissé du bassin retiré), la position des hanches, la vitesse, les
appuis, et les grandeurs du Motion Matching. Le corps de GRF n'a ni clavicules, ni mains, ni
orteils, ni cou en deux os : chacune de ces articulations suit le segment qui la porte.
"""
import os
import re

import numpy as np
from scipy.spatial.transform import Rotation

GRF_FPS = 100.0
# du repère du fichier (z en haut, avant -y, gauche +x) au repère du labo (y en haut, avant +z, gauche +x)
C = np.array([[1.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, -1.0, 0.0]])

# les points au bout des segments, dans le repère de leur segment (mesurés sur les maillages du
# joueur de GRF : foot.ase, lowerarm.ase, head.ase)
BOUTS = {
    "orteils_g": ("left_ankle", (0.0, -0.10, -0.105)), "pointe_g": ("left_ankle", (0.0, -0.161, -0.10)),
    "orteils_d": ("right_ankle", (0.0, -0.10, -0.105)), "pointe_d": ("right_ankle", (0.0, -0.161, -0.10)),
    "main_g": ("left_elbow", (0.0, 0.0, -0.24)), "main_d": ("right_elbow", (0.0, 0.0, -0.24)),
    "sommet": ("neck", (0.0, 0.0, 0.287)),
}

# chaque articulation de la base (mouvements.ARTICULATIONS) et le segment de GRF qui la porte
SEGMENT = {
    "Hips": "body", "LHipJoint": "body", "LeftUpLeg": "left_thigh", "LeftLeg": "left_knee",
    "LeftFoot": "left_ankle", "LeftToeBase": "left_ankle",
    "RHipJoint": "body", "RightUpLeg": "right_thigh", "RightLeg": "right_knee",
    "RightFoot": "right_ankle", "RightToeBase": "right_ankle",
    "LowerBack": "body", "Spine": "middle", "Spine1": "middle", "Neck": "neck", "Neck1": "neck", "Head": "neck",
    "LeftShoulder": "middle", "LeftArm": "left_shoulder", "LeftForeArm": "left_elbow", "LeftHand": "left_elbow",
    "RightShoulder": "middle", "RightArm": "right_shoulder", "RightForeArm": "right_elbow", "RightHand": "right_elbow",
}


def lire_objet(chemin):
    """Le corps de player.object : pour chaque segment, son parent et sa position (repère GRF)."""
    texte = open(chemin, encoding="utf-8", errors="ignore").read()
    noeuds, pile = {}, []
    for m in re.finditer(r"<(/?)node>|<name>([^<]+)</name>|<position>([^<]+)</position>", texte):
        if m.group(1) == "" and m.group(0) == "<node>":
            pile.append(None)
        elif m.group(1) == "/":
            pile.pop()
        elif m.group(2) is not None and pile and pile[-1] is None:
            nom = m.group(2).strip()
            parent = next((n for n in reversed(pile[:-1]) if n), None)
            pile[-1] = nom
            noeuds[nom] = {"parent": parent}
        elif m.group(3) is not None and pile and pile[-1] and "position" not in noeuds[pile[-1]]:
            noeuds[pile[-1]]["position"] = np.array([float(x) for x in m.group(3).split(",")])
    return noeuds


def lire_anim(chemin):
    """Les clés de chaque segment, l'extension football (contacts) et les balises."""
    cles, contacts, balises = {}, [], {}
    lignes = open(chemin, encoding="utf-8", errors="ignore").read().splitlines()
    i = 0
    while i < len(lignes):
        l = lignes[i].strip()
        if not l:
            i += 1
            continue
        if l.startswith("<") and not l.startswith("</"):
            nom = l.strip("<>")
            valeur = []
            i += 1
            while i < len(lignes) and lignes[i].strip() != f"</{nom}>":
                valeur.append(lignes[i].strip())
                i += 1
            balises[nom] = " ".join(valeur).strip()
            i += 1
            continue
        champs = l.split(",")
        if champs[0] == "extension":
            if champs[1] == "football":
                contacts.append((int(champs[2]), np.array([float(x) for x in champs[3:6]])))
        elif champs[0] == "player":
            v = [float(x) for x in champs[1:]]
            cles["player"] = [(int(round(v[k])), np.array(v[k + 1:k + 4])) for k in range(0, len(v), 4)]
        else:
            v = [float(x) for x in champs[1:]]
            cles[champs[0]] = [(int(round(v[k])), np.array(v[k + 1:k + 5])) for k in range(0, len(v), 5)]
        i += 1
    return cles, contacts, balises


def _valeur(cles, image, quaternion):
    """La valeur à une image (fractionnaire) : interpolation entre les clés voisines (sphérique
    pour les rotations, comme le moteur de GRF), maintien avant la première et après la dernière."""
    images = [c[0] for c in cles]
    if image <= images[0]:
        return cles[0][1]
    if image >= images[-1]:
        return cles[-1][1]
    k = int(np.searchsorted(images, image, side="right")) - 1
    (f0, a), (f1, b) = cles[k], cles[k + 1]
    u = (image - f0) / max(1e-9, (f1 - f0))
    if not quaternion:
        return a * (1 - u) + b * u
    qa, qb = a / np.linalg.norm(a), b / np.linalg.norm(b)
    if np.dot(qa, qb) < 0:
        qb = -qb
    d = float(np.clip(np.dot(qa, qb), -1.0, 1.0))
    if d > 0.9995:
        q = qa * (1 - u) + qb * u
        return q / np.linalg.norm(q)
    th = np.arccos(d)
    return (np.sin((1 - u) * th) * qa + np.sin(u * th) * qb) / np.sin(th)


def poser(objet, cles, image):
    """Les rotations et positions de chaque segment (repère GRF) à une image."""
    W, P = {}, {}
    racine = _valeur(cles["player"], image, False) if "player" in cles else np.zeros(3)
    ordre, restants = [], dict(objet)
    while restants:
        for nom, n in list(restants.items()):
            if n["parent"] is None or n["parent"] in P:
                q = _valeur(cles[nom], image, True) if nom in cles else np.array([0.0, 0.0, 0.0, 1.0])
                R = Rotation.from_quat(q).as_matrix()
                if n["parent"] is None:
                    W[nom] = R
                    P[nom] = racine + n["position"]
                else:
                    W[nom] = W[n["parent"]] @ R
                    P[nom] = P[n["parent"]] + W[n["parent"]] @ n["position"]
                ordre.append(nom)
                del restants[nom]
    for b, (seg, local) in BOUTS.items():
        P[b] = P[seg] + W[seg] @ np.array(local)
    return W, P


def directions_reference(objet):
    """La direction de chaque segment quand toutes ses rotations propres sont nulles (repère du
    labo) : bras et jambes tendus vers le bas, pied vers l'avant."""
    W, P = poser(objet, {}, 0)
    d = {}
    for seg, enfant in (("left_shoulder", "left_elbow"), ("right_shoulder", "right_elbow"), ("left_elbow", "main_g"),
                        ("right_elbow", "main_d"), ("left_thigh", "left_knee"), ("right_thigh", "right_knee"),
                        ("left_knee", "left_ankle"), ("right_knee", "right_ankle"), ("left_ankle", "orteils_g"),
                        ("right_ankle", "orteils_d")):
        v = C @ (P[enfant] - P[seg])
        d[seg] = v / np.linalg.norm(v)
    return d


def _de_vers(a, b):
    """La rotation la plus courte qui mène la direction a sur la direction b."""
    a, b = a / np.linalg.norm(a), b / np.linalg.norm(b)
    v, c = np.cross(a, b), float(np.dot(a, b))
    if c < -0.999999:
        axe = np.cross(a, [1.0, 0.0, 0.0])
        if np.linalg.norm(axe) < 1e-6:
            axe = np.cross(a, [0.0, 1.0, 0.0])
        return Rotation.from_rotvec(axe / np.linalg.norm(axe) * np.pi).as_matrix()
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx / (1 + c)


# les articulations dont la direction en pose en T est corrigée vers celle du segment de GRF
CORRIGEES = {"LeftArm": "left_shoulder", "LeftForeArm": "left_elbow", "LeftHand": "left_elbow",
             "RightArm": "right_shoulder", "RightForeArm": "right_elbow", "RightHand": "right_elbow",
             "LeftUpLeg": "left_thigh", "LeftLeg": "left_knee", "RightUpLeg": "right_thigh", "RightLeg": "right_knee",
             "LeftFoot": "left_ankle", "LeftToeBase": "left_ankle", "RightFoot": "right_ankle", "RightToeBase": "right_ankle"}


def echantillonner(objet, chemin, fps, articulations, directions_tpose, hanches_ref):
    """Le clip à fps images par seconde : rotations par articulation (écart à la pose en T, dans
    le repère du labo, cap compris), positions des points utiles, et les balises du fichier."""
    cles, contacts, balises = lire_anim(chemin)
    derniere = max(c[0] for v in cles.values() for c in v)
    n = int(np.floor(derniere / GRF_FPS * fps)) + 1
    ref = directions_reference(objet)
    hanches0 = objet["body"]["position"][2]
    echelle = hanches_ref / hanches0
    A = {}
    for art in articulations:
        seg = CORRIGEES.get(art)
        cle_t = art if art in directions_tpose else {"LeftHand": "LeftForeArm", "RightHand": "RightForeArm",
                                                       "LeftToeBase": "LeftFoot", "RightToeBase": "RightFoot"}.get(art)
        if seg and cle_t in directions_tpose:
            A[art] = _de_vers(np.array(directions_tpose[cle_t]), ref[seg])
        else:
            A[art] = np.eye(3)
    G = np.zeros((n, len(articulations), 3, 3))
    noms_points = ["body", "left_thigh", "right_thigh", "left_ankle", "right_ankle", "orteils_g", "orteils_d",
                   "pointe_g", "pointe_d", "main_g", "main_d", "neck", "sommet", "left_shoulder", "right_shoulder", "left_knee", "right_knee"]
    Pts = {k: np.zeros((n, 3)) for k in noms_points}
    for f in range(n):
        W, P = poser(objet, cles, f / fps * GRF_FPS)
        for j, art in enumerate(articulations):
            G[f, j] = C @ W[SEGMENT[art]] @ C.T @ A[art]
        for k in noms_points:
            Pts[k][f] = (C @ P[k]) * echelle
    contacts_lab = [(int(round(fr / GRF_FPS * fps)), (C @ p) * echelle) for fr, p in contacts]
    return dict(n=n, G=G, P=Pts, contacts=contacts_lab, balises=balises, duree=derniere / GRF_FPS, echelle=echelle)
