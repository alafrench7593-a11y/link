"""Lecture des fichiers BVH (captures de mouvement) et cinématique directe, en numpy.

Un BVH décrit une hiérarchie d'articulations (décalages au repos) et, image par image, la position
de la racine et la rotation de chaque articulation (angles d'Euler dans l'ordre des canaux). On en
tire, pour chaque image, la rotation et la position de chaque articulation dans le monde.
"""
import numpy as np


class Articulation:
    def __init__(self, nom, parent, decalage):
        self.nom = nom
        self.parent = parent          # index, -1 pour la racine
        self.decalage = np.asarray(decalage, dtype=np.float64)
        self.canaux = []
        self.fin = None               # décalage du « End Site », s'il y en a un


class BVH:
    def __init__(self, articulations, images, pas):
        self.articulations = articulations
        self.images = images          # (n, canaux) en degrés et unités du fichier
        self.pas = pas                # secondes entre deux images
        self.index = {a.nom: i for i, a in enumerate(articulations)}

    @property
    def n(self):
        return self.images.shape[0]


def lire(chemin):
    jetons = open(chemin, encoding="utf-8", errors="replace").read().split()
    i = 0
    arts, pile = [], []
    courant = None
    while jetons[i] != "MOTION":
        t = jetons[i]
        if t in ("ROOT", "JOINT"):
            nom = jetons[i + 1]
            parent = pile[-1] if pile else -1
            arts.append(Articulation(nom, parent, (0, 0, 0)))
            courant = len(arts) - 1
            i += 2
        elif t == "End":
            # End Site { OFFSET x y z }
            j = i
            while jetons[j] != "OFFSET":
                j += 1
            arts[pile[-1]].fin = np.array([float(x) for x in jetons[j + 1:j + 4]])
            j += 4
            while jetons[j] != "}":
                j += 1
            i = j + 1
            continue
        elif t == "{":
            pile.append(courant)
            i += 1
        elif t == "}":
            pile.pop()
            courant = pile[-1] if pile else None
            i += 1
        elif t == "OFFSET":
            arts[courant].decalage = np.array([float(x) for x in jetons[i + 1:i + 4]])
            i += 4
        elif t == "CHANNELS":
            n = int(jetons[i + 1])
            arts[courant].canaux = jetons[i + 2:i + 2 + n]
            i += 2 + n
        else:
            i += 1
    n = int(jetons[i + 2])
    pas = float(jetons[i + 5])
    valeurs = np.array([float(x) for x in jetons[i + 6:]], dtype=np.float64)
    largeur = sum(len(a.canaux) for a in arts)
    return BVH(arts, valeurs.reshape(n, largeur), pas)


def _rotation_axe(axe, angles):
    """Matrices de rotation (n, 3, 3) autour d'un axe, angles en radians."""
    c, s = np.cos(angles), np.sin(angles)
    m = np.zeros((len(angles), 3, 3))
    if axe == "X":
        m[:, 0, 0] = 1; m[:, 1, 1] = c; m[:, 1, 2] = -s; m[:, 2, 1] = s; m[:, 2, 2] = c
    elif axe == "Y":
        m[:, 1, 1] = 1; m[:, 0, 0] = c; m[:, 0, 2] = s; m[:, 2, 0] = -s; m[:, 2, 2] = c
    else:
        m[:, 2, 2] = 1; m[:, 0, 0] = c; m[:, 0, 1] = -s; m[:, 1, 0] = s; m[:, 1, 1] = c
    return m


def cinematique(b):
    """Rotations (n, J, 3, 3) et positions (n, J, 3) de chaque articulation dans le monde."""
    n, J = b.n, len(b.articulations)
    R = np.zeros((n, J, 3, 3))
    P = np.zeros((n, J, 3))
    col = 0
    for j, a in enumerate(b.articulations):
        local = np.tile(np.eye(3), (n, 1, 1))
        pos = np.tile(a.decalage, (n, 1))
        for c in a.canaux:
            v = b.images[:, col]
            col += 1
            if c.endswith("position"):
                pos[:, "XYZ".index(c[0])] = v
            else:
                local = local @ _rotation_axe(c[0], np.radians(v))
        if a.parent < 0:
            R[:, j] = local
            P[:, j] = pos
        else:
            R[:, j] = R[:, a.parent] @ local
            P[:, j] = P[:, a.parent] + np.einsum("nij,j->ni", R[:, a.parent], a.decalage)
    return R, P
