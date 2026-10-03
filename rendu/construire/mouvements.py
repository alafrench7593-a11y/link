"""La base de mouvements de LinkFoot, tirée de captures de vrais humains (base CMU).

Pour chaque clip : les rotations de 25 articulations, exprimées comme l'écart à la pose en T de
la première image de chaque fichier (la conversion BVH de la base CMU commence toujours par cette
pose), dans l'espace du personnage (le cap lissé du bassin retiré) ; la position des hanches ; la
vitesse du personnage ; les appuis des pieds ; et les 27 grandeurs que cherche le Motion Matching
(trajectoire future, positions et vitesses des pieds, vitesse des hanches), aussi en miroir.

Données : « The data used in this project was obtained from mocap.cs.cmu.edu. The database was
created with funding from NSF EIA-0196217. » Utilisable dans un produit vendu, pas revendable
telle quelle (conditions de la base CMU).
"""
import json
import os

import numpy as np
from scipy.spatial.transform import Rotation

import bvh

FPS = 30
UNITE = 0.05644            # une unité des fichiers CMU, en mètres (1/0.45 pouce)
HANCHES_REF = 0.93         # hauteur des hanches en pose en T du corps de référence (m)
HORIZONS = (6, 12, 18)     # images à 30 i/s : 0,2 s, 0,4 s, 0,6 s

ARTICULATIONS = ["Hips", "LHipJoint", "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase",
                 "RHipJoint", "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase",
                 "LowerBack", "Spine", "Spine1", "Neck", "Neck1", "Head",
                 "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand",
                 "RightShoulder", "RightArm", "RightForeArm", "RightHand"]


def miroir_nom(n):
    for a, b in (("Left", "Right"), ("LHip", "RHip")):
        if n.startswith(a):
            return b + n[len(a):]
        if n.startswith(b):
            return a + n[len(b):]
    return n


MIROIR = [ARTICULATIONS.index(miroir_nom(n)) for n in ARTICULATIONS]

# Le catalogue : clip, catégorie, et la plage utile (images à 120 i/s, fin exclue ; None : tout).
CATALOGUE = {
    "course": ["02_03", "09_01", "09_02", "09_03", "09_04", "09_05", "09_06", "09_07", "09_08", "09_09",
               "09_10", "09_11", "16_35", "16_36", "16_45", "16_46", "16_55", "16_56",
               "35_17", "35_18", "35_19", "35_20", "35_21", "35_22", "35_23", "35_24", "35_25", "35_26",
               "78_06", "78_12", "102_05", "102_10", "104_01", "104_04", "104_37", "104_48", "111_23", "111_24"],
    "virage": ["16_37", "16_38", "16_39", "16_40", "16_41", "16_42", "16_43", "16_44", "16_48", "16_49",
               "16_50", "16_51", "16_52", "16_53", "16_54", "78_01", "78_02", "78_03", "78_07", "78_08",
               "78_09", "78_10", "78_35", "102_01", "102_02", "102_06", "102_07", "102_08", "102_33"],
    "depart": ["104_06", "104_08", "104_53", "104_54", "104_55", "78_32", "102_30"],
    "arret": ["104_09", "104_10", "104_56", "104_57", "16_08", "16_57", "78_25"],
    "lateral": ["78_24", "78_26", "78_27", "78_29", "78_30", "102_22", "102_23", "102_24", "102_25",
                "102_27", "102_28", "83_01", "83_19", "83_33", "83_55", "69_42", "69_48", "69_50"],
    "recul": ["76_09", "76_11", "111_01", "69_34", "69_39", "09_12"],
    "marche": ["16_17", "16_18", "16_19", "16_20", "16_33", "16_34", "69_06", "69_12", "69_13", "69_16",
               "69_18", "69_20", "69_24", "69_28", "69_31", "82_08", "111_26"],
    "immobile": ["77_02", "111_28", "40_10", "40_11"],
    "frappe": ["10_01", "10_02", "10_03", "10_05", "10_06", "11_01"],
    "saut": ["13_11", "13_39", "13_40", "13_41", "13_42", "16_05", "16_06", "16_07", "16_09", "16_10",
             "49_04", "49_05", "75_01", "75_02", "75_03"],
    "chute": ["77_16", "77_17", "77_18", "85_15", "90_16"],
}


def lisser_angle(phi, rayon):
    u = np.unwrap(phi)
    k = np.ones(2 * rayon + 1) / (2 * rayon + 1)
    pad = np.pad(u, rayon, mode="edge")
    return np.convolve(pad, k, mode="valid")


def lisser(x, rayon):
    k = np.ones(2 * rayon + 1) / (2 * rayon + 1)
    pad = np.pad(x, ((rayon, rayon), (0, 0)), mode="edge")
    return np.stack([np.convolve(pad[:, i], k, mode="valid") for i in range(x.shape[1])], axis=1)


def ry(angles):
    c, s = np.cos(angles), np.sin(angles)
    m = np.zeros((len(angles), 3, 3))
    m[:, 0, 0] = c; m[:, 0, 2] = s; m[:, 1, 1] = 1; m[:, 2, 0] = -s; m[:, 2, 2] = c
    return m


def traiter(chemin, categorie):
    b = bvh.lire(chemin)
    G, P = bvh.cinematique(b)
    I = b.index
    # l'échelle : des hanches à HANCHES_REF en pose en T
    hanches_t = (P[0, I["Hips"], 1] - min(P[0, I["LeftToeBase"], 1], P[0, I["RightToeBase"], 1])) * UNITE
    s = UNITE * HANCHES_REF / hanches_t
    pas = int(round(1.0 / (FPS * b.pas)))
    # l'image 0 est la pose en T ; certaines prises ont des images vides (tout à zéro) : on garde
    # la plus longue suite d'images pleines
    pleine = ~np.all(np.abs(b.images) < 1e-9, axis=1)
    pleine[0] = False
    meilleur, debut = (0, 0), None
    for i in range(1, b.n + 1):
        if i < b.n and pleine[i]:
            debut = i if debut is None else debut
        elif debut is not None:
            if i - debut > meilleur[1] - meilleur[0]:
                meilleur = (debut, i)
            debut = None
    images = np.arange(meilleur[0], meilleur[1], pas)
    G0 = G[0]
    Gm, Pm = G[images], P[images] * s
    n = len(images)
    J = [I[a] for a in ARTICULATIONS]
    # le sol : le plus bas des orteils sur tout le clip
    sol = min(Pm[:, I["LeftToeBase"], 1].min(), Pm[:, I["RightToeBase"], 1].min()) - 0.025
    Pm[:, :, 1] -= sol
    # le cap : du bassin (perpendiculaire à la ligne des hanches), lissé sur ±0,2 s
    droite = Pm[:, I["RightUpLeg"]] - Pm[:, I["LeftUpLeg"]]
    avant = np.cross(np.array([0.0, 1.0, 0.0]), droite)
    phi_brut = np.arctan2(avant[:, 0], avant[:, 2])
    phi = lisser_angle(phi_brut, max(1, int(0.2 * FPS)))
    # la racine : les hanches au sol, lissées sur ±0,15 s
    racine = lisser(Pm[:, I["Hips"]][:, [0, 2]], max(1, int(0.15 * FPS)))
    racine3 = np.stack([racine[:, 0], np.zeros(n), racine[:, 1]], axis=1)
    Rinv = ry(-phi)
    # les rotations : écart à la pose en T, cap retiré
    GG = np.einsum("njab,jcb->njac", Gm[:, J], G0[J])          # G(f) · G(pose en T)ᵀ
    D = np.einsum("nab,njbc->njac", Rinv, GG)
    quat = Rotation.from_matrix(D.reshape(-1, 3, 3)).as_quat().reshape(n, len(J), 4)   # x y z w
    # continuité des quaternions dans le temps
    for j in range(len(J)):
        for f in range(1, n):
            if np.dot(quat[f, j], quat[f - 1, j]) < 0:
                quat[f, j] = -quat[f, j]
    hanches = np.einsum("nij,nj->ni", Rinv, Pm[:, I["Hips"]] - racine3)
    # vitesses du personnage (dans son espace) : avant, côté, rotation
    dt = 1.0 / FPS
    dr = np.gradient(racine3, dt, axis=0)
    vit = np.einsum("nij,nj->ni", Rinv, dr)
    omega = np.gradient(np.unwrap(phi), dt)
    # appuis : cheville ou orteil près du sol et lent
    appuis = np.zeros(n, dtype=np.uint8)
    for bit, (ch, ort) in enumerate((("LeftFoot", "LeftToeBase"), ("RightFoot", "RightToeBase"))):
        c, o = Pm[:, I[ch]], Pm[:, I[ort]]
        vc = np.linalg.norm(np.gradient(c[:, [0, 2]], dt, axis=0), axis=1)
        vo = np.linalg.norm(np.gradient(o[:, [0, 2]], dt, axis=0), axis=1)
        bas_c = c[:, 1] < np.percentile(c[:, 1], 5) + 0.035
        bas_o = o[:, 1] < np.percentile(o[:, 1], 5) + 0.03
        pose = (bas_c & (vc < 0.6)) | (bas_o & (vo < 0.6))
        appuis |= (pose.astype(np.uint8) << bit)
    # les grandeurs du Motion Matching (espace du personnage à l'image f)
    def futur(f, k):
        g = f + k
        if g < n:
            return racine3[g], phi[g]
        # au-delà du clip : vitesse et rotation constantes depuis la fin
        e = n - 1
        return racine3[e] + dr[e] * (g - e) * dt, phi[e] + omega[e] * (g - e) * dt
    feats = np.zeros((n, 27), dtype=np.float64)
    pieds = [I["LeftFoot"], I["RightFoot"]]
    vp = np.gradient(Pm[:, pieds], dt, axis=0)
    vh = np.gradient(Pm[:, I["Hips"]], dt, axis=0)
    for f in range(n):
        R = Rinv[f]
        x = []
        for k in HORIZONS:
            p, a = futur(f, k)
            q = R @ (p - racine3[f])
            x += [q[0], q[2]]
        for k in HORIZONS:
            p, a = futur(f, k)
            x += [np.sin(a - phi[f]), np.cos(a - phi[f])]
        for j in range(2):
            x += list(R @ (Pm[f, pieds[j]] - racine3[f]))
        for j in range(2):
            x += list(R @ vp[f, j])
        x += list(R @ vh[f])
        feats[f] = x
    # une frappe : l'image du contact (la pointe du pied au plus vite), le pied qui frappe, la
    # direction de la frappe et la pointe du pied au contact (espace du personnage)
    contact = None
    if categorie == "frappe":
        meilleur_pied = None
        for cote, nom in (("L", "LeftToeBase"), ("R", "RightToeBase")):
            o = Pm[:, I[nom]]
            v = np.gradient(o, dt, axis=0)
            vs = np.linalg.norm(v, axis=1)
            vs[:2] = 0
            vs[-2:] = 0
            f = int(np.argmax(vs))
            if meilleur_pied is None or vs[f] > meilleur_pied[2]:
                meilleur_pied = (cote, f, float(vs[f]), v[f], o[f])
        cote, f, vmax, v, o = meilleur_pied
        R = Rinv[f]
        dv = R @ v
        dv[1] = 0
        dv /= np.linalg.norm(dv) + 1e-9
        op = R @ (o - racine3[f])
        contact = dict(image=f, pied=cote, vitesse=round(vmax, 2), dir=[round(float(dv[0]), 4), round(float(dv[2]), 4)],
                       pointe=[round(float(x), 4) for x in op])
    # cherchable : pas les deux dernières images (il faut pouvoir continuer)
    cherchable = np.ones(n, dtype=np.uint8)
    cherchable[-2:] = 0
    # les mains posées sur les hanches (une attente de passant, pas d'un footballeur en jeu) : à
    # l'arrêt ou en marchant, les deux mains immobiles contre les hanches, à leur hauteur
    if categorie in ("immobile", "marche"):
        hanches_p = Pm[:, I["Hips"]]
        sur_hanches = np.ones(n, dtype=bool)
        for main in ("LeftHand", "RightHand"):
            m = Pm[:, I[main]]
            vm = np.linalg.norm(np.gradient(m - hanches_p, dt, axis=0), axis=1)
            sur_hanches &= (np.linalg.norm(m - hanches_p, axis=1) < 0.27) & (m[:, 1] - hanches_p[:, 1] > -0.1) & (vm < 0.35)
        cherchable[sur_hanches] = 0
    if categorie in ("frappe", "saut", "chute"):
        cherchable[:] = 0      # seulement quand une action du moteur les demande
    return dict(n=n, quat=quat, hanches=hanches, vit=np.stack([vit[:, 0], vit[:, 2], omega], axis=1),
                appuis=appuis, feats=feats, cherchable=cherchable, contact=contact,
                vitesse_moy=float(np.linalg.norm(dr[:, [0, 2]], axis=1).mean()))


def miroir_feats(F):
    M = F.copy()
    # trajectoire : x -> -x
    M[:, [0, 2, 4]] *= -1
    M[:, [6, 8, 10]] *= -1
    # pieds : échange gauche / droite, x -> -x
    g, d = F[:, 12:15].copy(), F[:, 15:18].copy()
    M[:, 12:15], M[:, 15:18] = d, g
    vg, vd = F[:, 18:21].copy(), F[:, 21:24].copy()
    M[:, 18:21], M[:, 21:24] = vd, vg
    M[:, [12, 15, 18, 21, 24]] *= -1
    return M


def construire(dossier_bvh, sortie):
    clips, morceaux = [], []
    total = 0
    for cat, noms in CATALOGUE.items():
        for nom in noms:
            chemin = os.path.join(dossier_bvh, nom + ".bvh")
            if not os.path.exists(chemin):
                print("absent :", nom)
                continue
            r = traiter(chemin, cat)
            clip = dict(nom=nom, categorie=cat, premier=total, n=r["n"], vitesse=round(r["vitesse_moy"], 2))
            if r["contact"]:
                clip["contact"] = r["contact"]
            clips.append(clip)
            morceaux.append(r)
            total += r["n"]
    quat = np.concatenate([m["quat"] for m in morceaux])
    hanches = np.concatenate([m["hanches"] for m in morceaux])
    vit = np.concatenate([m["vit"] for m in morceaux])
    appuis = np.concatenate([m["appuis"] for m in morceaux])
    feats = np.concatenate([m["feats"] for m in morceaux])
    cherchable = np.concatenate([m["cherchable"] for m in morceaux])
    featsM = miroir_feats(feats)
    tout = np.concatenate([feats, featsM])
    moy, ecart = tout.mean(axis=0), tout.std(axis=0) + 1e-6
    # les écarts par groupe (comme le fait Motion Matching) : chaque groupe pèse son nombre de dims
    groupes = [(0, 6), (6, 12), (12, 18), (18, 24), (24, 27)]
    for a, z in groupes:
        ecart[a:z] = ecart[a:z].mean()
    os.makedirs(sortie, exist_ok=True)
    q16 = np.round(quat * 32767).astype(np.int16)
    with open(os.path.join(sortie, "mouvements.bin"), "wb") as f:
        decal = {}
        for nom, arr in (("quat", q16), ("hanches", hanches.astype(np.float32)), ("vit", vit.astype(np.float32)),
                         ("appuis", appuis.astype(np.uint8)), ("cherchable", cherchable.astype(np.uint8)),
                         ("feats", feats.astype(np.float32)), ("featsMiroir", featsM.astype(np.float32))):
            while f.tell() % 4:
                f.write(b"\0")
            decal[nom] = [f.tell(), arr.dtype.name, list(arr.shape)]
            f.write(arr.tobytes())
    manifeste = dict(
        source="mocap.cs.cmu.edu (conversion BVH de B. Hahne, cgspeed) : « The data used in this project was obtained "
               "from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217. »",
        fps=FPS, horizons=list(HORIZONS), articulations=ARTICULATIONS, miroir=MIROIR, images=int(total),
        tableaux=decal, clips=clips, moyennes=moy.round(5).tolist(), ecarts=ecart.round(5).tolist(),
        hanches_ref=HANCHES_REF)
    json.dump(manifeste, open(os.path.join(sortie, "mouvements.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return manifeste


if __name__ == "__main__":
    import sys
    m = construire(sys.argv[1], sys.argv[2])
    print(len(m["clips"]), "clips,", m["images"], "images à", FPS, "i/s")
