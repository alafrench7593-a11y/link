"""Le corps des footballeurs de LinkFoot, tiré des actifs CC0 de MakeHuman.

Sortie (rendu/donnees/corps.json + corps.bin) : le maillage du corps, des yeux et du « casque » de
cheveux ; les sommets des articulations (pour recalculer le squelette de chaque joueur) ; les poids
de peau ramenés à 50 os ; la zone de chaque sommet (peau, maillot, short, chaussettes, chaussures,
cheveux, yeux) ; et les cibles de forme que la fiche de chaque joueur règle (genre, âge, muscle,
poids, taille, proportions, origines, mensurations, visage). Le navigateur fabrique chaque joueur
en additionnant ces cibles : un seul fichier pour les 22.

Actifs : MakeHuman, « released under CC0 1.0 Universal » (maillage de base, cibles, squelette,
poids). Aucun code de MakeHuman n'est repris.
"""
import json
import os

import numpy as np

import bvh
import makehuman as mh

# les os gardés (les autres sont fondus dans leur plus proche ancêtre gardé)
OS = ["root", "spine05", "spine04", "spine03", "spine02", "spine01", "neck01", "neck02", "neck03", "head",
      "eye.L", "eye.R",
      "clavicle.L", "shoulder01.L", "upperarm01.L", "upperarm02.L", "lowerarm01.L", "lowerarm02.L", "wrist.L",
      "clavicle.R", "shoulder01.R", "upperarm01.R", "upperarm02.R", "lowerarm01.R", "lowerarm02.R", "wrist.R",
      "pelvis.L", "upperleg01.L", "upperleg02.L", "lowerleg01.L", "lowerleg02.L", "foot.L", "toe1-1.L",
      "pelvis.R", "upperleg01.R", "upperleg02.R", "lowerleg01.R", "lowerleg02.R", "foot.R", "toe1-1.R"]

# os de MakeHuman → articulation de la capture (base CMU) dont ils suivent la rotation ; les os d'une
# même chaîne reçoivent la même correction de pose (leur courbure au repos est gardée)
CHAINES = [
    (["root"], "Hips", None),
    (["spine05", "spine04"], "LowerBack", "Spine"),
    (["spine03", "spine02"], "Spine", "Spine1"),
    (["spine01"], "Spine1", "Neck1"),
    (["neck01", "neck02"], "Neck", "Neck1"),
    (["neck03"], "Neck1", "Head"),
    (["head", "eye.L", "eye.R"], "Head", None),
]
for c, C in (("L", "Left"), ("R", "Right")):
    H = "LHipJoint" if c == "L" else "RHipJoint"
    CHAINES += [
        ([f"clavicle.{c}", f"shoulder01.{c}"], f"{C}Shoulder", f"{C}Arm"),
        ([f"upperarm01.{c}", f"upperarm02.{c}"], f"{C}Arm", f"{C}ForeArm"),
        ([f"lowerarm01.{c}", f"lowerarm02.{c}"], f"{C}ForeArm", f"{C}Hand"),
        ([f"wrist.{c}"], f"{C}Hand", None),
        ([f"pelvis.{c}"], H, f"{C}UpLeg"),
        ([f"upperleg01.{c}", f"upperleg02.{c}"], f"{C}UpLeg", f"{C}Leg"),
        ([f"lowerleg01.{c}", f"lowerleg02.{c}"], f"{C}Leg", f"{C}Foot"),
        ([f"foot.{c}"], f"{C}Foot", f"{C}ToeBase"),
        ([f"toe1-1.{c}"], f"{C}ToeBase", None),
    ]

ZONES = ["peau", "maillot", "short", "chaussettes", "chaussures", "cheveux", "yeux", "meches"]


def os_garde(nom, bones):
    while nom not in OS:
        nom = bones[nom]["parent"]
    return nom


def cibles_a_exporter(dossier):
    """Les cibles que la fiche règle : (nom court, chemin relatif)."""
    L = []
    md = "macrodetails"
    for r in ("african", "asian", "caucasian"):
        L.append(f"{md}/{r}-male-young.target")
    for m in ("minmuscle", "averagemuscle", "maxmuscle"):
        for w in ("minweight", "averageweight", "maxweight"):
            L.append(f"{md}/universal-male-young-{m}-{w}.target")
            for h in ("minheight", "maxheight"):
                L.append(f"{md}/height/male-young-{m}-{w}-{h}.target")
            for p in ("idealproportions", "uncommonproportions"):
                L.append(f"{md}/proportions/male-young-{m}-{w}-{p}.target")
    paires = ["measure/measure-shoulder-dist", "measure/measure-bust-circ", "measure/measure-waist-circ",
              "measure/measure-hips-circ", "measure/measure-upperarm-length", "measure/measure-lowerarm-length",
              "measure/measure-upperleg-height", "measure/measure-lowerleg-height", "measure/measure-thigh-circ",
              "measure/measure-calf-circ", "measure/measure-neck-circ", "measure/measure-upperarm-circ",
              "torso/torso-vshape", "torso/torso-muscle-pectoral", "torso/torso-muscle-dorsi",
              "stomach/stomach-tone", "head/head-fat", "head/head-scale-horiz", "head/head-scale-vert",
              "nose/nose-hump", "nose/nose-scale-horiz", "nose/nose-scale-vert", "mouth/mouth-scale-horiz",
              "chin/chin-prominent", "chin/chin-width", "buttocks/buttocks-volume"]
    for c in ("l", "r"):
        paires += [f"armslegs/{c}-upperarm-muscle", f"armslegs/{c}-lowerarm-muscle", f"armslegs/{c}-upperleg-muscle",
                   f"armslegs/{c}-lowerleg-muscle", f"armslegs/{c}-hand-scale", f"armslegs/{c}-foot-scale",
                   f"cheek/{c}-cheek-bones", f"ears/{c}-ear-scale"]
    for p in paires:
        for s in ("decr", "incr"):
            L.append(f"{p}-{s}.target")
    L += ["head/head-oval.target", "head/head-square.target", "head/head-round.target", "head/head-rectangular.target"]
    return [x for x in L if os.path.exists(os.path.join(dossier, x))]


def directions_tpose(chemin_bvh):
    b = bvh.lire(chemin_bvh)
    _, P = bvh.cinematique(b)
    I = b.index
    d = {}
    for os_, cmu, enfant in CHAINES:
        if enfant:
            v = P[0, I[enfant]] - P[0, I[cmu]]
            d[cmu] = (v / np.linalg.norm(v)).round(5).tolist()
    return d


def construire(dossier_mh, bvh_ref, sortie):
    data = os.path.join(dossier_mh, "makehuman", "data")
    base = mh.lire_base(os.path.join(data, "3dobjs", "base.obj"))
    sq = mh.lire_squelette(os.path.join(data, "rigs", "default.mhskel"))
    bones = sq["bones"]
    poids = mh.lire_poids(os.path.join(data, "rigs", "default_weights.mhw"))

    # les parties rendues
    parties = {"body": "corps", "helper-hair": "meches", "helper-l-eye": "yeux", "helper-r-eye": "yeux"}
    gid = {i: parties[n] for i, n in enumerate(base.noms_groupes) if n in parties}
    faces = [(f, fu, gid[g]) for f, fu, g in zip(base.faces, base.faces_uv, base.groupes_faces) if g in gid]
    rendus = sorted({v for f, _, _ in faces for v in f})
    # les sommets des articulations des os gardés (cubes d'articulation, invisibles)
    art = set()
    for o in OS:
        for cle in ("head", "tail"):
            art.update(sq["joints"][bones[o][cle]])
    tous = sorted(set(rendus) | art)
    nouveau = {v: i for i, v in enumerate(tous)}
    N = len(tous)
    pos = base.sommets[tous] * 0.1                      # décimètres → mètres

    # poids de peau ramenés aux os gardés, 4 au plus par sommet
    acc = [dict() for _ in range(N)]
    for o, liste in poids.items():
        g = OS.index(os_garde(o, bones))
        for v, w in liste:
            if v in nouveau:
                d = acc[nouveau[v]]
                d[g] = d.get(g, 0.0) + w
    sidx = np.zeros((N, 4), dtype=np.uint8)
    swt = np.zeros((N, 4), dtype=np.float32)
    for i, d in enumerate(acc):
        if not d:
            d = {OS.index("head"): 1.0}
        top = sorted(d.items(), key=lambda x: -x[1])[:4]
        s = sum(w for _, w in top) or 1.0
        for k, (g, w) in enumerate(top):
            sidx[i, k], swt[i, k] = g, w / s
    sw8 = np.round(swt * 255).astype(np.int32)
    sw8[:, 0] += 255 - sw8.sum(axis=1)                  # somme exacte à 255
    sw8 = sw8.astype(np.uint8)

    # zones, en pose de repos
    def tete(o):
        return base.sommets[sq["joints"][bones[o]["head"]]].mean(axis=0) * 0.1

    def queue(o):
        return base.sommets[sq["joints"][bones[o]["tail"]]].mean(axis=0) * 0.1

    def le_long(p, o_debut, o_fin_queue):
        a, b = tete(o_debut), queue(o_fin_queue)
        return np.clip(np.dot(p - a, b - a) / np.dot(b - a, b - a), -1, 2)

    taille_y = (tete("spine05")[1] + tete("spine04")[1]) / 2 + 0.02
    zone = np.zeros(N, dtype=np.uint8)
    partie_de = {}
    for f, _, p in faces:
        for v in f:
            partie_de[v] = p
    for v, i in nouveau.items():
        p = partie_de.get(v)
        if p == "meches":
            zone[i] = ZONES.index("meches"); continue
        if p == "yeux":
            zone[i] = ZONES.index("yeux"); continue
        if p is None:
            continue
        x = pos[i]
        o = OS[sidx[i, 0]]
        z = "peau"
        if o.startswith(("spine", "clavicle", "shoulder", "breast")):
            z = "maillot" if x[1] > taille_y else "short"
        elif o.startswith("upperarm"):
            c = o[-1]
            z = "maillot" if le_long(x, f"upperarm01.{c}", f"upperarm02.{c}") < 0.42 else "peau"
        elif o.startswith(("root", "pelvis")):
            z = "short" if x[1] < taille_y else "maillot"
        elif o.startswith("upperleg"):
            c = o[-1]
            z = "short" if le_long(x, f"upperleg01.{c}", f"upperleg02.{c}") < 0.46 else "peau"
        elif o.startswith("lowerleg"):
            c = o[-1]
            z = "chaussettes" if le_long(x, f"lowerleg01.{c}", f"lowerleg02.{c}") > 0.1 else "peau"
            if le_long(x, f"lowerleg01.{c}", f"lowerleg02.{c}") > 0.93:
                z = "chaussures"
        elif o.startswith(("foot", "toe")):
            z = "chaussures"
        zone[i] = ZONES.index(z)

    # la calotte de cheveux : le cuir chevelu (sommets de la tête au-dessus de la ligne
    # d'implantation, oreilles exclues), copié pour être décollé de la peau selon la coiffure
    tete_w = np.zeros(N)
    for o, liste in poids.items():
        if os_garde(o, bones) in ("head", "eye.L", "eye.R"):
            for v, w in liste:
                if v in nouveau:
                    tete_w[nouveau[v]] += w

    def implantation(z):
        return float(np.interp(z, [-0.01, 0.03, 0.07], [0.665, 0.73, 0.775]))

    scalp = set()
    for v in rendus:
        i = nouveau[v]
        if partie_de.get(v) != "corps" or tete_w[i] < 0.6:
            continue
        x, y, z = pos[i]
        oreille = abs(x) > 0.072 and y < 0.75 and -0.015 < z < 0.065
        if y > implantation(z) and not oreille:
            scalp.add(i)
    copie = {}
    for i in sorted(scalp):
        copie[i] = N + len(copie)
    N2 = N + len(copie)
    origine = np.array(sorted(copie, key=copie.get), dtype=np.uint16)
    pos = np.concatenate([pos, pos[origine]])
    sidx = np.concatenate([sidx, sidx[origine]])
    sw8 = np.concatenate([sw8, sw8[origine]])
    zone = np.concatenate([zone, np.full(len(origine), ZONES.index("cheveux"), dtype=np.uint8)])

    # triangles, groupés par zone (la zone d'un triangle : celle de la majorité de ses sommets).
    # Un sommet ne porte qu'une coordonnée de texture ; aux coutures de la découpe UV, le même
    # sommet en a deux : on le double (même position, mêmes poids, recopié après les cibles),
    # sinon les triangles de la couture étirent la texture d'un îlot à l'autre.
    tri_par_zone = {z: [] for z in range(len(ZONES))}
    uv_de, doubles = {}, {}
    voisins = {}
    zc = ZONES.index("chaussures")

    def coin(i, t_):
        if t_ < 0:
            return i
        if i not in uv_de:
            uv_de[i] = t_
            return i
        if uv_de[i] == t_ or np.allclose(base.uv[uv_de[i]], base.uv[t_], atol=1e-6):
            return i
        cle = (i, t_)
        if cle not in doubles:
            doubles[cle] = N2 + len(doubles)
        return doubles[cle]

    for f, fu, _ in faces:
        idx = [nouveau[v] for v in f]
        coins = [coin(i, t_) for i, t_ in zip(idx, fu)]
        zs = [zone[i] for i in idx]
        zt = max(set(zs), key=zs.count)
        for k in range(1, len(coins) - 1):
            tri_par_zone[zt].append((coins[0], coins[k], coins[k + 1]))
        if all(i in copie for i in idx):
            c = [copie[i] for i in idx]
            for k in range(1, len(c) - 1):
                tri_par_zone[ZONES.index("cheveux")].append((c[0], c[k], c[k + 1]))
        for k, i in enumerate(idx):
            if zone[i] == zc:
                s_ = voisins.setdefault(i, set())
                s_.add(idx[k - 1]); s_.add(idx[(k + 1) % len(idx)])
    N3 = N2 + len(doubles)
    sources = np.array([i for (i, _), j in sorted(doubles.items(), key=lambda x: x[1])], dtype=np.uint16)
    uv = np.zeros((N3, 2), dtype=np.float32)
    for i, t_ in uv_de.items():
        uv[i] = base.uv[t_]
    for i, j in copie.items():
        uv[j] = uv[i]
    for (i, t_), j in doubles.items():
        uv[j] = base.uv[t_]
    pos = np.concatenate([pos, pos[sources]])
    sidx = np.concatenate([sidx, sidx[sources]])
    sw8 = np.concatenate([sw8, sw8[sources]])
    zone = np.concatenate([zone, zone[sources]])
    origine = np.concatenate([origine, sources]).astype(np.uint16)
    # pour lisser les crampons (les orteils de MakeHuman se fondent dans une chaussure)
    lisse = np.array(sorted(voisins), dtype=np.uint16)
    off, vois = [0], []
    for i in lisse:
        vois += sorted(voisins[int(i)])
        off.append(len(vois))
    groupes, indices = [], []
    for z in range(len(ZONES)):
        t = tri_par_zone[z]
        groupes.append(dict(zone=ZONES[z], debut=len(indices) * 3, n=len(t) * 3))
        indices += t
    indices = np.array(indices, dtype=np.uint16)

    # le squelette : sommets des têtes et queues
    os_json = []
    for o in OS:
        p = bones[o]["parent"]
        while p and p not in OS:
            p = bones[p]["parent"]
        os_json.append(dict(nom=o, parent=OS.index(p) if p else -1,
                            tete=[nouveau[v] for v in sq["joints"][bones[o]["head"]]],
                            queue=[nouveau[v] for v in sq["joints"][bones[o]["tail"]]]))

    # les cibles
    dossier_cibles = os.path.join(data, "targets")
    cibles = []
    morceaux = []
    for chemin in cibles_a_exporter(dossier_cibles):
        idx, d = mh.lire_cible(os.path.join(dossier_cibles, chemin))
        garde = np.array([v in nouveau for v in idx])
        if not garde.any():
            continue
        idx, d = idx[garde], d[garde] * 0.1
        echelle = float(np.abs(d).max()) / 32767 if np.abs(d).max() > 0 else 1.0
        q = np.round(d / echelle).astype(np.int16)
        cibles.append(dict(nom=chemin[:-7], n=int(len(idx)), echelle=echelle))
        morceaux.append((np.array([nouveau[v] for v in idx], dtype=np.uint16), q))

    os.makedirs(sortie, exist_ok=True)
    tableaux = {}
    with open(os.path.join(sortie, "corps.bin"), "wb") as f:
        def ecrire(nom, arr):
            while f.tell() % 4:
                f.write(b"\0")
            tableaux[nom] = [f.tell(), arr.dtype.name, list(arr.shape)]
            f.write(np.ascontiguousarray(arr).tobytes())
        ecrire("positions", pos.astype(np.float32))
        ecrire("copieDe", origine)
        ecrire("lisseIdx", lisse)
        ecrire("lisseOff", np.array(off, dtype=np.uint32))
        ecrire("lisseVois", np.array(vois, dtype=np.uint16))
        ecrire("uv", uv)
        ecrire("indices", indices.reshape(-1))
        ecrire("osIndex", sidx)
        ecrire("osPoids", sw8)
        ecrire("zones", zone)
        for k, (c, (i, q)) in enumerate(zip(cibles, morceaux)):
            ecrire(f"cible_{k}_i", i)
            ecrire(f"cible_{k}_d", q.reshape(-1))
            c["i"] = tableaux[f"cible_{k}_i"]
            c["d"] = tableaux[f"cible_{k}_d"]
    manifeste = dict(
        source="MakeHuman (makehumancommunity.org), actifs « released under CC0 1.0 Universal » : maillage de base "
               "hm08, cibles, squelette par défaut et ses poids. Aucun code de MakeHuman.",
        sommets=N3, sommets_base=N, doubles_uv=N2, os=os_json, zones=ZONES, groupes=groupes, cibles=cibles,
        chaines=[dict(os=o, cmu=c, enfant=e) for o, c, e in CHAINES],
        directions_tpose=directions_tpose(bvh_ref),
        tableaux={k: v for k, v in tableaux.items() if not k.startswith("cible_")})
    json.dump(manifeste, open(os.path.join(sortie, "corps.json"), "w", encoding="utf-8"), ensure_ascii=False)
    return manifeste


if __name__ == "__main__":
    import sys
    m = construire(sys.argv[1], sys.argv[2], sys.argv[3])
    print(m["sommets"], "sommets,", sum(g["n"] for g in m["groupes"]) // 3, "triangles,", len(m["cibles"]), "cibles")
    print([(g["zone"], g["n"] // 3) for g in m["groupes"]])
