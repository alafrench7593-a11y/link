"""Le footballeur de Gameplay Football (Bastiaan Schuiling, domaine public : Unlicense) préparé
pour le labo et pour Unreal Engine 5, à partir des fichiers d'origine (format ASE de 3ds Max).

A lancer avec le Python de Blender (module bpy) :

    python gpf_joueur.py <dossier data/media de GPF> <dossier de sortie> [--nom SK_LinkFoot_GPF] [--taille 1.80]
                         [--origine "github.com/google-research/football, commit ..."]

<dossier data/media> : third_party/gfootball_engine/data/media de Google Research Football (fichier
LICENSE du dossier : Unlicense), ou data/media d'un dépôt de Gameplay Football. Seuls sont lus
objects/players/ (maillage, coiffures, textures) et animations/base.anim.util ; jamais
data/databases (logos et maillots de vrais clubs, noms de vrais joueurs).

Ce que fait le script :
  1. lit le maillage du joueur (models/fullbody.ase : 12 objets, 747 triangles), modelé dans la
     pose de base du jeu (animations/base.anim.util : genoux et coudes fléchis, buste penché) ;
  2. lit les poids de peau que l'auteur a codés dans les couleurs des sommets (gamedefines.cpp,
     GetVertexColors ; humanoidbase.cpp, PrepareFullbodyModel : chaque canal vaut
     10 x articulation + 9 x poids, trois articulations au plus) ;
  3. remet le corps debout comme le jeu le fait (peau linéaire, de la pose de base vers une pose
     de repos : jambes et buste droits, bras écartés de 25° comme le mannequin d'Unreal), pour que
     la hauteur du modèle soit celle d'un joueur debout ;
  4. lui donne le squelette du jeu (13 articulations, player.object) aux noms du mannequin
     d'Unreal : pelvis, spine_01 à 03, neck_01, head, clavicle, upperarm, lowerarm, hand, thigh,
     calf, foot, ball (_l, _r). Les os que le jeu n'a pas (colonne en trois, cou et tête séparés,
     main, orteils, clavicule) se partagent les poids d'origine selon la géométrie ;
  5. range les faces par pièce pour que le labo habille chaque joueur aux couleurs de son club :
     maillot et short (séparés d'après la texture d'arbitre du jeu), chaussettes, chaussures,
     semelle, peau (bras, genoux, tête) ; les normales d'origine sont gardées ;
  6. ajoute les 6 coiffures (cheveux_short01 ... cheveux_long02), portées par la tête ; le chauve
     (bald.ase) n'est qu'un repère vide ;
  7. exporte <nom>.glb (labo), <nom>.fbx (Unreal), <nom>.blend, les textures et un rapport JSON.
"""
import argparse
import json
import math
import os
import re
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector
from PIL import Image
from scipy.spatial.transform import Rotation

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import grf  # noqa: E402

COIFFURES = ("short01", "short02", "medium01", "medium02", "long01", "long02")
# l'ordre des articulations du jeu (Node::GetNodes, parcours en profondeur de player.object)
ARTICULATIONS = ("body", "middle", "neck", "left_shoulder", "left_elbow", "right_shoulder", "right_elbow",
                 "left_thigh", "left_knee", "left_ankle", "right_thigh", "right_knee", "right_ankle")
# la pose de repos : tout droit, bras écartés de 25° (rotation autour de l'axe avant-arrière)
ECART_BRAS = math.radians(25)


# ---- le format ASE ----
def lire_ase(chemin):
    texte = open(chemin, encoding="latin-1").read()
    materiaux = re.findall(r'\*MATERIAL_NAME "([^"]*)"', texte)
    objets = []
    for bloc in re.split(r"\*GEOMOBJECT \{", texte)[1:]:
        def tous(motif, conv=float):
            return [[conv(x) for x in m.groups()] for m in re.finditer(motif, bloc)]
        o = {
            "nom": re.search(r'\*NODE_NAME "([^"]*)"', bloc).group(1),
            "V": np.array(tous(r"\*MESH_VERTEX\s+\d+\s+(\S+)\s+(\S+)\s+(\S+)")),
            "F": np.array(tous(r"\*MESH_FACE\s+\d+:\s+A:\s+(\d+)\s+B:\s+(\d+)\s+C:\s+(\d+)", int)),
            "T": np.array(tous(r"\*MESH_TVERT\s+\d+\s+(\S+)\s+(\S+)\s+(\S+)")),
            "TF": np.array(tous(r"\*MESH_TFACE\s+\d+\s+(\d+)\s+(\d+)\s+(\d+)", int)),
            "CV": np.array(tous(r"\*MESH_VERTCOL\s+\d+\s+(\S+)\s+(\S+)\s+(\S+)")),
            "CF": np.array(tous(r"\*MESH_CFACE\s+\d+\s+(\d+)\s+(\d+)\s+(\d+)", int)),
            "FN": np.array(tous(r"\*MESH_FACENORMAL\s+\d+\s+(\S+)\s+(\S+)\s+(\S+)")),
            "VN": np.array(tous(r"\*MESH_VERTEXNORMAL\s+\d+\s+(\S+)\s+(\S+)\s+(\S+)")).reshape(-1, 3, 3),
        }
        mr = re.search(r"\*MATERIAL_REF (\d+)", bloc)
        o["materiau"] = materiaux[int(mr.group(1))] if mr and materiaux else None
        # les sommets sont dans le monde, les normales dans le repère de l'objet (lignes TM_ROW :
        # ses axes dans le monde ; des objets sont en miroir) : on les ramène dans le monde
        lignes = tous(r"\*TM_ROW[012]\s+(\S+)\s+(\S+)\s+(\S+)")
        if len(lignes) >= 3 and len(o["FN"]):
            T = np.linalg.inv(np.array(lignes[:3])).T
            unit = lambda n: n / (np.linalg.norm(n, axis=-1, keepdims=True) + 1e-12)
            o["FN"] = unit(o["FN"] @ T)
            o["VN"] = unit(o["VN"] @ T)
        if len(o["FN"]):
            V, F = o["V"], o["F"]
            g = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
            o["accord_normales"] = int(((g * o["FN"]).sum(1) > 0).sum())
        objets.append(o)
    return objets


def poids_du_jeu(objets):
    """Les poids de chaque sommet, comme le jeu les lit : la couleur du premier coin de face trouvé à
    cette position (tous objets confondus), chaque canal = 10 x articulation + 9 x poids."""
    couleurs = {}
    for o in objets:
        for f, cf in zip(o["F"], o["CF"]):
            for s, c in zip(f, cf):
                cle = tuple(o["V"][s])
                if cle not in couleurs:
                    couleurs[cle] = np.round(o["CV"][c] * 255)
    res = []
    for o in objets:
        P = []
        for v in o["V"]:
            p = {}
            for ch in couleurs[tuple(v)]:
                j = int(math.floor(ch * 0.1))
                w = (ch - j * 10) / 9.0
                if w > 0.01:
                    p[j] = p.get(j, 0.0) + w
            t = sum(p.values())
            P.append({j: w / t for j, w in p.items()})
        res.append(P)
    return res


# ---- les poses du squelette du jeu ----
def poses(media):
    objet = grf.lire_objet(os.path.join(media, "objects", "players", "player.object"))
    base = grf.lire_anim(os.path.join(media, "animations", "base.anim.util"))[0]
    Wb, Pb = grf.poser(objet, base, 0)
    repos = {}
    for c, s in (("left", -1), ("right", 1)):
        q = Rotation.from_rotvec([0.0, s * ECART_BRAS, 0.0]).as_quat()   # (x, y, z, w)
        repos[c + "_shoulder"] = [(0, q)]
    Wr, Pr = grf.poser(objet, repos, 0)
    return objet, Wb, Pb, Wr, Pr


def reposer(v, n, poids, Wb, Pb, Wr, Pr):
    """Peau linéaire, de la pose de base du jeu vers la pose de repos."""
    vr, nr = np.zeros(3), np.zeros(3)
    for j, w in poids.items():
        a = ARTICULATIONS[j]
        M = Wr[a] @ Wb[a].T
        vr += w * (M @ (v - Pb[a]) + Pr[a])
        nr += w * (M @ n)
    return vr, nr / (np.linalg.norm(nr) or 1.0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("media")
    ap.add_argument("sortie")
    ap.add_argument("--nom", default="SK_LinkFoot_GPF")
    ap.add_argument("--taille", type=float, default=1.80)
    ap.add_argument("--origine", default="", help="d'où vient le dossier data/media (dépôt, commit), écrit dans le rapport")
    a = ap.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])
    a.media, a.sortie = os.path.abspath(a.media), os.path.abspath(a.sortie)   # Blender charge les images par chemin absolu
    joueurs = os.path.join(a.media, "objects", "players")
    os.makedirs(os.path.join(a.sortie, "textures"), exist_ok=True)
    rap = {"source": a.origine or os.path.basename(os.path.abspath(a.media)), "fichiers_lus": []}

    objets = lire_ase(os.path.join(joueurs, "models", "fullbody.ase"))
    rap["fichiers_lus"].append("objects/players/models/fullbody.ase")
    poids = poids_du_jeu(objets)
    objet, Wb, Pb, Wr, Pr = poses(a.media)
    rap["fichiers_lus"] += ["objects/players/player.object", "animations/base.anim.util"]

    # 1. tous les sommets et leurs normales, remis debout
    sommets, normales = [], []   # par objet
    for o, P in zip(objets, poids):
        vs = []
        for i, v in enumerate(o["V"]):
            vr, _ = reposer(v, np.array([0.0, 0.0, 1.0]), P[i], Wb, Pb, Wr, Pr)
            vs.append(vr)
        sommets.append(np.array(vs))
        ns = np.zeros_like(o["VN"])
        for k, f in enumerate(o["F"]):
            for c in range(3):
                _, ns[k, c] = reposer(o["V"][f[c]], o["VN"][k, c], P[f[c]], Wb, Pb, Wr, Pr)
        normales.append(ns)
    tout = np.vstack(sommets)
    sol = tout[:, 2].min()
    hauteur = tout[:, 2].max() - sol
    k = a.taille / hauteur
    rap["hauteur_debout_origine_m"] = round(float(hauteur), 4)
    rap["echelle"] = round(float(k), 5)

    def monde(p):   # repère du jeu = repère de Blender (z en haut, avant -y, gauche +x)
        p = np.asarray(p, dtype=float)
        return Vector(((p[0]) * k, (p[1]) * k, (p[2] - sol) * k))

    # 2. le squelette, aux noms du mannequin d'Unreal
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    ad = bpy.data.armatures.new("Armature")
    arm = bpy.data.objects.new("Armature", ad)
    scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    E = ad.edit_bones
    B = dict(Pr)   # articulations et bouts des segments (grf.BOUTS), pose de repos, repère du jeu
    # la base des orteils et la pointe, mesurées sur la chaussure (les bouts de grf.BOUTS, faits
    # pour les animations, tombent 1,5 cm sous la semelle) : aux trois quarts de la cheville à la
    # pointe, 2,5 cm au-dessus de la semelle ; la pointe, à 2 cm
    for c, g in (("left", "g"), ("right", "d")):
        j = ARTICULATIONS.index(c + "_ankle")
        pts = np.array([v for vs, P in zip(sommets, poids) for v, p in zip(vs, P) if p and max(p, key=p.get) == j])
        ch = Pr[c + "_ankle"]
        avant, semelle = pts[:, 1].min(), pts[:, 2].min()   # l'avant est vers -y
        B["orteils_" + g] = np.array([ch[0], ch[1] + 0.75 * (avant - ch[1]), semelle + 0.025])
        B["pointe_" + g] = np.array([ch[0], avant, semelle + 0.02])
    rap["pieds"] = {g: {"base_orteils": [round(float(x), 3) for x in B["orteils_" + g]], "pointe": [round(float(x), 3) for x in B["pointe_" + g]]} for g in "gd"}
    av ={"l": Wr["left_elbow"] @ np.array([0.0, 0.0, -1.0]), "r": Wr["right_elbow"] @ np.array([0.0, 0.0, -1.0])}

    # longueur réelle de l'avant-bras et de la main, mesurée sur les sommets que le coude porte
    long_main = {}
    for c, j in (("l", ARTICULATIONS.index("left_elbow")), ("r", ARTICULATIONS.index("right_elbow"))):
        coude = B["left_elbow" if c == "l" else "right_elbow"]
        d = [float((v - coude) @ av[c]) for vs, P in zip(sommets, poids) for v, p in zip(vs, P) if p.get(j, 0) > 0.5]
        long_main[c] = max(d)
    rap["avant_bras_et_main_m"] = {c: round(v * k, 3) for c, v in long_main.items()}

    def os_(nom, tete, queue, parent=None, z=None):
        b = E.new(nom)
        b.head, b.tail = monde(tete), monde(queue)
        if parent:
            b.parent = E[parent]
        if z is not None:
            b.align_roll(Vector(z))
        return b

    centre_epaules = B["middle"] + Wr["middle"] @ np.array([0.0, -0.01, 0.48])
    racine = os_("root", [Pr["body"][0], Pr["body"][1], sol], [Pr["body"][0], Pr["body"][1], sol + 0.18])
    os_("pelvis", B["body"], B["middle"], "root", (0, -1, 0))
    s0, s3 = B["middle"], B["neck"]
    os_("spine_01", s0, s0 + (s3 - s0) / 3, "pelvis", (0, -1, 0))
    os_("spine_02", s0 + (s3 - s0) / 3, s0 + 2 * (s3 - s0) / 3, "spine_01", (0, -1, 0))
    os_("spine_03", s0 + 2 * (s3 - s0) / 3, s3, "spine_02", (0, -1, 0))
    cou_tete = B["neck"] + 0.3 * (B["sommet"] - B["neck"])
    os_("neck_01", B["neck"], cou_tete, "spine_03", (0, -1, 0))
    os_("head", cou_tete, B["sommet"], "neck_01", (0, -1, 0))
    poignet = {}
    for c, C, g in (("l", "left", "g"), ("r", "right", "d")):
        ep, co = B[C + "_shoulder"], B[C + "_elbow"]
        poignet[c] = co + av[c] * (long_main[c] * 0.70)
        os_("clavicle_" + c, centre_epaules + 0.15 * (ep - centre_epaules), ep, "spine_03", (0, -1, 0))
        os_("upperarm_" + c, ep, co, "clavicle_" + c, (0, -1, 0))
        os_("lowerarm_" + c, co, poignet[c], "upperarm_" + c, (0, -1, 0))
        os_("hand_" + c, poignet[c], co + av[c] * long_main[c], "lowerarm_" + c, (0, -1, 0))
        os_("thigh_" + c, B[C + "_thigh"], B[C + "_knee"], "pelvis", (0, -1, 0))
        os_("calf_" + c, B[C + "_knee"], B[C + "_ankle"], "thigh_" + c, (0, -1, 0))
        os_("foot_" + c, B[C + "_ankle"], B["orteils_" + g], "calf_" + c, (0, 0, 1))
        os_("ball_" + c, B["orteils_" + g], B["pointe_" + g], "foot_" + c, (0, 0, 1))
    bpy.ops.object.mode_set(mode="OBJECT")
    ad.bones["root"].use_deform = False

    # 3. les matériaux (les noms disent au labo quoi habiller)
    def image(nom_bmp, nom_png, cote=None):
        im = Image.open(os.path.join(joueurs, "textures", nom_bmp)).convert("RGB")
        if cote:
            im = im.resize((cote, cote), Image.LANCZOS)
        chemin = os.path.join(a.sortie, "textures", nom_png)
        im.save(chemin)
        rap["fichiers_lus"].append("objects/players/textures/" + nom_bmp)
        return bpy.data.images.load(chemin)

    def materiau(nom, couleur, base=None, normale=None, rugosite=0.75):
        m = bpy.data.materials.new(nom)
        m.use_nodes = True
        nt = m.node_tree
        bsdf = nt.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (*couleur, 1.0)
        bsdf.inputs["Roughness"].default_value = rugosite
        if base is not None:
            t = nt.nodes.new("ShaderNodeTexImage")
            t.image = base
            nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
        if normale is not None:
            t = nt.nodes.new("ShaderNodeTexImage")
            t.image = normale
            t.image.colorspace_settings.name = "Non-Color"
            nm = nt.nodes.new("ShaderNodeNormalMap")
            nt.links.new(t.outputs["Color"], nm.inputs["Color"])
            nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
        return m

    peau = (0.62, 0.42, 0.30)
    n_kit = image("kit_UVWnormal.bmp", "maillot_normale.png", 512)
    MATS = {
        "maillot": materiau("maillot", (0.95, 0.95, 0.95), normale=n_kit, rugosite=0.8),
        "short": materiau("short", (0.95, 0.95, 0.95), normale=n_kit, rugosite=0.8),
        "chaussettes": materiau("chaussettes", (0.95, 0.95, 0.95), rugosite=0.85),
        "chaussures": materiau("chaussures", (1, 1, 1), base=image("shoe.bmp", "chaussure.png"), rugosite=0.5),
        "semelle": materiau("semelle", (0.03, 0.03, 0.03), rugosite=0.6),
        "peau_bras": materiau("peau_bras", peau, normale=image("arm_normal.bmp", "bras_normale.png"), rugosite=0.6),
        "peau_genoux": materiau("peau_genoux", peau, normale=image("knee_normal.bmp", "genou_normale.png"), rugosite=0.6),
        "peau_tete": materiau("peau_tete", peau, rugosite=0.6),
        "cheveux": materiau("cheveux", (0.18, 0.11, 0.07), rugosite=0.8),
    }
    ordre_mats = list(MATS)

    # maillot ou short : la texture d'arbitre du jeu peint le maillot en vert vif, le short en vert sombre
    arbitre = np.asarray(Image.open(os.path.join(joueurs, "textures", "referee_kit.bmp")).convert("RGB")).astype(float)
    rap["fichiers_lus"].append("objects/players/textures/referee_kit.bmp")

    def piece(o, k):
        nom, m = o["nom"], o["materiau"]
        if m == "kit" and nom.startswith("sock"):
            return "chaussettes"
        if m == "kit":
            u, v = o["T"][o["TF"][k]][:, :2].mean(0)
            h, w = arbitre.shape[:2]
            px = arbitre[int(np.clip((1 - v) * h, 0, h - 1)), int(np.clip(u * w, 0, w - 1))]
            return "maillot" if px[1] > 115 or px.sum() < 30 else "short"
        return {"shoe": "chaussures", "shoe_sole": "semelle", "arm": "peau_bras", "knee": "peau_genoux", "skin": "peau_tete"}[m]

    # 4. le corps : un seul maillage, une matière par pièce, les normales d'origine
    verts, faces, uvs, nlist, mats, vpoids, vobjet = [], [], [], [], [], [], []
    for io, (o, vs, ns, P) in enumerate(zip(objets, sommets, normales, poids)):
        base_i = len(verts)
        for v in vs:
            verts.append(monde(v))
        vpoids += P
        vobjet += [o["nom"]] * len(vs)
        rap.setdefault("normales_d_accord_avec_les_faces", {})[o["nom"]] = f'{o.get("accord_normales", 0)}/{len(o["F"])}'
        for kf, f in enumerate(o["F"]):
            tri = [int(x) + base_i for x in f]   # le sens des faces du fichier est le bon
            uv = [tuple(o["T"][t][:2]) for t in o["TF"][kf]]
            nn = [tuple(x) for x in ns[kf]]
            faces.append(tri)
            uvs.append(uv)
            nlist.append(nn)
            mats.append(ordre_mats.index(piece(o, kf)))
    me = bpy.data.meshes.new("GPF_Corps")
    me.from_pydata([tuple(v) for v in verts], [], faces)
    for m in MATS.values():
        me.materials.append(m)
    me.polygons.foreach_set("material_index", mats)
    couche = me.uv_layers.new(name="UVMap")
    for poly, uv in zip(me.polygons, uvs):
        for li, t in zip(poly.loop_indices, uv):
            couche.data[li].uv = t
    me.update()
    me.normals_split_custom_set([n for nn in nlist for n in nn])
    corps = bpy.data.objects.new("GPF_Corps", me)
    scene.collection.objects.link(corps)
    rap["triangles_corps"] = len(faces)
    rap["pieces"] = {n: mats.count(i) for i, n in enumerate(ordre_mats) if mats.count(i)}

    # 5. les poids, des articulations du jeu vers les os du mannequin
    groupes = {b.name: corps.vertex_groups.new(name=b.name) for b in ad.bones if b.use_deform}
    axe_col = (s3 - s0) / np.linalg.norm(s3 - s0)
    long_col = float(np.linalg.norm(s3 - s0))
    cheville = {c: monde(B[("left" if c == "l" else "right") + "_ankle"]) for c in "lr"}
    base_orteils = {c: monde(B["orteils_" + ("g" if c == "l" else "d")]) for c in "lr"}
    for i, (p, nom_obj) in enumerate(zip(vpoids, vobjet)):
        v = np.array(verts[i]) / k + np.array([0.0, 0.0, sol])   # retour au repère du jeu, debout
        cible = {}

        def ajoute(os_nom, w):
            cible[os_nom] = cible.get(os_nom, 0.0) + w
        for j, w in p.items():
            art = ARTICULATIONS[j]
            if art == "body":
                ajoute("pelvis", w)
            elif art == "middle":
                t = float((v - s0) @ axe_col) / long_col
                tentes = [max(0.0, 1 - abs(t - (n + 0.5) / 3) * 3) for n in range(3)]
                if sum(tentes) == 0:
                    tentes = [1, 0, 0] if t < 0.5 else [0, 0, 1]
                for n, tw in enumerate(tentes):
                    if tw:
                        ajoute(f"spine_0{n + 1}", w * tw / sum(tentes))
            elif art == "neck":
                ajoute("head" if nom_obj == "head" else "neck_01", w)
            elif art.endswith("_shoulder"):
                ajoute("upperarm_" + art[0], w)
            elif art.endswith("_elbow"):
                c = art[0]
                d = float((v - B[art]) @ av[c]) / long_main[c]
                t = min(1.0, max(0.0, (d - 0.64) / 0.12))
                t = t * t * (3 - 2 * t)
                if t < 1:
                    ajoute("lowerarm_" + c, w * (1 - t))
                if t > 0:
                    ajoute("hand_" + c, w * t)
            elif art.endswith("_thigh"):
                ajoute("thigh_" + art[0], w)
            elif art.endswith("_knee"):
                ajoute("calf_" + art[0], w)
            elif art.endswith("_ankle"):
                c = art[0]
                axe = base_orteils[c] - cheville[c]
                axe.z = 0
                L = axe.length
                axe.normalize()
                dd = (Vector(verts[i]) - cheville[c]).dot(axe)
                t = max(0.0, min(1.0, (dd - (L - 0.015 * a.taille)) / (0.03 * a.taille)))
                t = t * t * (3 - 2 * t)
                if t < 1:
                    ajoute("foot_" + c, w * (1 - t))
                if t > 0:
                    ajoute("ball_" + c, w * t)
        for os_nom, w in cible.items():
            groupes[os_nom].add([i], w, "REPLACE")
    corps.parent = arm
    corps.modifiers.new("Armature", "ARMATURE").object = arm

    # 6. les coiffures, portées par la tête
    tete_mat = MATS["cheveux"]
    rap["coiffures"] = {}
    for nom in COIFFURES:
        hobj = lire_ase(os.path.join(joueurs, "hairstyles", nom + ".ase"))
        rap["fichiers_lus"].append(f"objects/players/hairstyles/{nom}.ase")
        hv, hf, huv = [], [], []
        for o in hobj:
            b0 = len(hv)
            for v in o["V"]:
                hv.append(monde(Wr["neck"] @ v + Pr["neck"]))
            for f in o["F"]:
                hf.append([int(x) + b0 for x in f])
        hm = bpy.data.meshes.new("cheveux_" + nom)
        hm.from_pydata([tuple(v) for v in hv], [], hf)
        hm.materials.append(tete_mat)
        for poly in hm.polygons:
            poly.use_smooth = True
        hm.update()
        ho = bpy.data.objects.new("cheveux_" + nom, hm)
        scene.collection.objects.link(ho)
        ho.vertex_groups.new(name="head").add(list(range(len(hv))), 1.0, "REPLACE")
        ho.parent = arm
        ho.modifiers.new("Armature", "ARMATURE").object = arm
        rap["coiffures"][nom] = len(hf)

    # 7. exports
    rap["os_ue"] = [b.name for b in ad.bones]
    rap["hierarchie"] = {b.name: (b.parent.name if b.parent else None) for b in ad.bones}
    rap["hauteur_m"] = a.taille
    blend = os.path.join(a.sortie, a.nom + ".blend")
    bpy.context.preferences.filepaths.save_version = 0   # pas de copie .blend1
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    # Unreal : le corps avec une coiffure (la première), puis chaque coiffure à part sur le même
    # squelette (dans l'éditeur, on en attache une à la fois au footballeur)
    def exporter_fbx(chemin, objets):
        bpy.ops.object.select_all(action="DESELECT")
        for o in objets:
            o.select_set(True)
        bpy.ops.export_scene.fbx(filepath=chemin, use_selection=True, object_types={"ARMATURE", "MESH"}, add_leaf_bones=False,
                                 use_armature_deform_only=False, bake_anim=False, mesh_smooth_type="OFF",
                                 apply_scale_options="FBX_SCALE_ALL", path_mode="COPY", embed_textures=True)
    fbx = os.path.join(a.sortie, a.nom + ".fbx")
    exporter_fbx(fbx, [arm, corps, bpy.data.objects["cheveux_" + COIFFURES[0]]])
    os.makedirs(os.path.join(a.sortie, "coiffures"), exist_ok=True)
    rap["fbx_coiffures"] = []
    for nom in COIFFURES:
        f = os.path.join(a.sortie, "coiffures", f"{a.nom}_cheveux_{nom}.fbx")
        exporter_fbx(f, [arm, bpy.data.objects["cheveux_" + nom]])
        rap["fbx_coiffures"].append(os.path.relpath(f, a.sortie))
    bpy.ops.object.select_all(action="DESELECT")
    glb = os.path.join(a.sortie, a.nom + ".glb")
    bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=False, export_apply=False,
                              export_yup=True, export_skins=True, export_animations=False)
    rap["fichiers"] = {os.path.basename(f): os.path.getsize(f) for f in (blend, fbx, glb)}
    with open(os.path.join(a.sortie, a.nom + ".rapport.json"), "w", encoding="utf-8") as fh:
        json.dump(rap, fh, ensure_ascii=False, indent=1)
    print(json.dumps({k2: rap[k2] for k2 in ("hauteur_debout_origine_m", "echelle", "triangles_corps", "pieces", "coiffures",
                                              "avant_bras_et_main_m", "fichiers")}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
