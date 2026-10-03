"""Le corps humain de MakeHuman (actifs CC0 1.0 : maillage de base, cibles, squelette, poids),
lu en numpy, sans rien du code de MakeHuman (AGPL) : seulement ses données et les formules de
ses curseurs « macro » (genre, âge, muscle, poids, taille, proportions), produits de facteurs.

Unités du maillage de base : le décimètre, Y vers le haut, le personnage regarde +Z.
"""
import json
import os
import re

import numpy as np


class Base:
    def __init__(self, sommets, uv, faces, faces_uv, groupes_faces, noms_groupes):
        self.sommets = sommets            # (N, 3) float64
        self.uv = uv                      # (M, 2)
        self.faces = faces                # liste de tuples d'indices de sommets (quads ou triangles)
        self.faces_uv = faces_uv
        self.groupes_faces = groupes_faces  # index du groupe de chaque face
        self.noms_groupes = noms_groupes

    def sommets_du_groupe(self, prefixe):
        g = {i for i, n in enumerate(self.noms_groupes) if n.startswith(prefixe)}
        s = set()
        for f, gi in zip(self.faces, self.groupes_faces):
            if gi in g:
                s.update(f)
        return np.array(sorted(s), dtype=np.int64)


def lire_base(chemin):
    sommets, uv, faces, faces_uv, groupes, noms = [], [], [], [], [], []
    courant = -1
    index_nom = {}
    for ligne in open(chemin, encoding="utf-8"):
        if ligne.startswith("v "):
            sommets.append([float(x) for x in ligne.split()[1:4]])
        elif ligne.startswith("vt "):
            uv.append([float(x) for x in ligne.split()[1:3]])
        elif ligne.startswith("g "):
            nom = ligne.split()[1]
            if nom not in index_nom:
                index_nom[nom] = len(noms)
                noms.append(nom)
            courant = index_nom[nom]
        elif ligne.startswith("f "):
            ps = ligne.split()[1:]
            faces.append(tuple(int(p.split("/")[0]) - 1 for p in ps))
            faces_uv.append(tuple(int(p.split("/")[1]) - 1 if "/" in p and p.split("/")[1] else -1 for p in ps))
            groupes.append(courant)
    return Base(np.array(sommets), np.array(uv), faces, faces_uv, groupes, noms)


def lire_cible(chemin):
    idx, d = [], []
    for ligne in open(chemin, encoding="utf-8"):
        if not ligne.strip() or ligne.startswith("#"):
            continue
        p = ligne.split()
        idx.append(int(p[0]))
        d.append([float(p[1]), float(p[2]), float(p[3])])
    return np.array(idx, dtype=np.int64), np.array(d, dtype=np.float64).reshape(-1, 3)


# ---------------------------------------------------------------- les curseurs macro
def valeurs_macro(genre=1.0, age=0.5, muscle=0.5, poids=0.5, taille=0.5, proportions=0.5, ethnies=None):
    """Les facteurs de MakeHuman pour chaque catégorie (ses formules, sur [0, 1])."""
    v = {"male": genre, "female": 1.0 - genre}
    if age < 0.5:
        v["old"] = 0.0
        v["baby"] = max(0.0, 1 - age * 5.333)
        v["young"] = max(0.0, (age - 0.1875) * 3.2)
        v["child"] = max(0.0, min(1.0, 5.333 * age) - v["young"])
    else:
        v["child"] = v["baby"] = 0.0
        v["old"] = max(0.0, age * 2 - 1)
        v["young"] = 1 - v["old"]
    for nom, x in (("muscle", muscle), ("weight", poids)):
        v["max" + nom] = max(0.0, x * 2 - 1)
        v["min" + nom] = max(0.0, 1 - x * 2)
        v["average" + nom] = 1 - (v["max" + nom] + v["min" + nom])
    v["maxheight"] = max(0.0, taille * 2 - 1)
    v["minheight"] = max(0.0, 1 - taille * 2)
    v["idealproportions"] = max(0.0, proportions * 2 - 1)
    v["uncommonproportions"] = max(0.0, 1 - proportions * 2)
    e = ethnies or {"african": 1 / 3, "asian": 1 / 3, "caucasian": 1 / 3}
    s = sum(e.values()) or 1.0
    for k in ("african", "asian", "caucasian"):
        v[k] = e.get(k, 0.0) / s
    return v


def poids_cibles_macro(dossier_cibles, valeurs):
    """{chemin relatif de cible : poids} pour les cibles macro, poids = produit des facteurs des
    catégories nommées dans le nom du fichier (comme le fait MakeHuman)."""
    poids = {}
    md = os.path.join(dossier_cibles, "macrodetails")
    for racine, _, fichiers in os.walk(md):
        for f in fichiers:
            if not f.endswith(".target"):
                continue
            atomes = f[:-7].split("-")
            if atomes[0] == "universal":
                atomes = atomes[1:]
            w = 1.0
            for a in atomes:
                if a not in valeurs:
                    w = None
                    break
                w *= valeurs[a]
            if w and w > 1e-6:
                poids[os.path.relpath(os.path.join(racine, f), dossier_cibles)] = w
    return poids


# ---------------------------------------------------------------- squelette et poids
def lire_squelette(chemin):
    s = json.load(open(chemin, encoding="utf-8"))
    return s


def articulations(squelette, sommets):
    """Position de chaque articulation : la moyenne des sommets qui la définissent."""
    return {nom: sommets[np.array(liste)].mean(axis=0) for nom, liste in squelette["joints"].items()}


def os_du_squelette(squelette, sommets):
    """[(nom, parent, tête, queue)] dans l'ordre parent avant enfant."""
    pos = articulations(squelette, sommets)
    bones = squelette["bones"]
    ordre, vus = [], set()

    def ajouter(n):
        if n in vus:
            return
        p = bones[n]["parent"]
        if p:
            ajouter(p)
        vus.add(n)
        ordre.append(n)

    for n in bones:
        ajouter(n)
    return [(n, bones[n]["parent"], pos[bones[n]["head"]], pos[bones[n]["tail"]]) for n in ordre]


def lire_poids(chemin):
    return json.load(open(chemin, encoding="utf-8"))["weights"]
