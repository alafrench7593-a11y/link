"""Le rig automatique d'un personnage qui n'en a pas (une « statue » : Football Player Portugal
sur Sketchfab, par exemple), dans Blender.

Le squelette porte les noms et la hiérarchie du mannequin d'Unreal (root, pelvis, spine_01 à
spine_03, neck_01, head, clavicle, upperarm, lowerarm, hand, thigh, calf, foot, ball ; _l et _r) :
l'IK Rig d'Unreal et le labo three.js (personnage.js) le reconnaissent sans réglage. Les noms
seuls sont repris : la position de chaque articulation est mesurée sur le maillage du
personnage.

Comment les articulations sont placées (le personnage debout, en T ou en A) :
  - la taille H va du sol (le plus bas des sommets) au sommet du crâne ;
  - le côté vers lequel il regarde : celui où les pieds dépassent des chevilles ;
  - les jambes : le centre de chaque jambe, mesuré par tranches horizontales du maillage
    (cheville, mollet, genou, cuisse) ; les hauteurs des articulations suivent les proportions
    humaines moyennes (genou à 0,285 H, hanche à 0,50 H, cheville à 0,045 H) ;
  - les bras : l'axe principal des sommets du bras (hors du tronc), le bout des doigts au plus
    loin du corps ; l'épaule, le coude et le poignet sont posés sur cet axe aux longueurs
    moyennes (bras 0,186 H, avant-bras 0,146 H, main 0,108 H), ce qui marche en T comme en A ;
  - la colonne, le cou et la tête : sur l'axe du tronc, mesuré par tranches ;
  - les pieds : la cheville au-dessus du talon, la base des orteils aux trois quarts du pied.
Puis la pondération automatique de Blender (chaleur des os), quatre influences au plus par
sommet, normalisées ; un sommet que la chaleur n'atteint pas prend l'os le plus proche.

Les proportions moyennes viennent de l'anthropométrie classique (Drillis et Contini, 1966),
exprimées en fraction de la taille.
"""
import math

import bpy
from mathutils import Vector


def _geometrie_monde(objets):
    """Les sommets et les triangles (après modificateurs) de tous les maillages, dans le monde."""
    dg = bpy.context.evaluated_depsgraph_get()
    pts, tris = [], []
    for o in objets:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        me.calc_loop_triangles()
        mw = o.matrix_world
        monde = [mw @ v.co for v in me.vertices]
        pts.extend(monde)
        tris.extend((monde[t.vertices[0]], monde[t.vertices[1]], monde[t.vertices[2]]) for t in me.loop_triangles)
        ev.to_mesh_clear()
    return pts, tris


def _coupe(tris, z):
    """La coupe horizontale du maillage à la hauteur z : les points où ses arêtes la traversent
    (indépendant de la densité des sommets, donc juste aussi sur un maillage léger)."""
    res = []
    for a, b, c in tris:
        if min(a.z, b.z, c.z) > z or max(a.z, b.z, c.z) < z:
            continue
        for p, q in ((a, b), (b, c), (c, a)):
            if (p.z - z) * (q.z - z) < 0:
                t = (z - p.z) / (q.z - p.z)
                res.append(p.lerp(q, t))
    return res


def _centre(pts):
    if not pts:
        return None
    c = Vector((0, 0, 0))
    for p in pts:
        c += p
    return c / len(pts)


def _axe_principal(pts):
    """L'axe d'inertie le plus long d'un nuage (itérations de la puissance sur la covariance)."""
    c = _centre(pts)
    cov = [[0.0] * 3 for _ in range(3)]
    for p in pts:
        d = p - c
        for i in range(3):
            for j in range(3):
                cov[i][j] += d[i] * d[j]
    v = Vector((1, 0.1, 0.1)).normalized()
    for _ in range(60):
        w = Vector((sum(cov[0][j] * v[j] for j in range(3)), sum(cov[1][j] * v[j] for j in range(3)), sum(cov[2][j] * v[j] for j in range(3))))
        if w.length < 1e-12:
            break
        v = w.normalized()
    return c, v


def mesurer(objets):
    """Les articulations du personnage, mesurées sur ses maillages (dans le monde)."""
    pts, tris = _geometrie_monde(objets)
    z0 = min(p.z for p in pts)
    H = max(p.z for p in pts) - z0
    xc = (min(p.x for p in pts) + max(p.x for p in pts)) / 2

    # les jambes, par coupes horizontales : à chaque hauteur, la coupe de chaque côté de l'axe
    def jambe(h, cote):
        t = [p for p in _coupe(tris, z0 + h * H) if (p.x - xc) * cote > 0.01 * H]
        # sous le bassin seulement, et pas les mains qui pendent (un bras en A descend vers 0,45 H)
        t = [p for p in t if abs(p.x - xc) < 0.16 * H]
        return _centre(t)

    # le regard : les pieds dépassent des chevilles vers l'avant
    sens = 0.0
    for cote in (1, -1):
        cheville = jambe(0.09, cote)
        pied = [p for p in pts if p.z < z0 + 0.03 * H and (p.x - xc) * cote > 0]
        if cheville and pied:
            ys = sorted(p.y for p in pied)
            # le bout du pied : le plus loin de la cheville, devant ou derrière
            devant, derriere = ys[0], ys[-1]
            sens += (cheville.y - devant) - (derriere - cheville.y)
    avant = -1.0 if sens > 0 else 1.0     # -1 : il regarde vers -Y (la convention de Blender)
    gauche = 1.0 if avant < 0 else -1.0     # regardant vers -Y, sa gauche est du côté +X

    A = {}
    for nom, cote in (("l", gauche), ("r", -gauche)):
        genou = jambe(0.285, cote)
        bas_mollet = jambe(0.10, cote)
        cuisse = jambe(0.42, cote) or genou
        # la hanche : sur la droite genou-cuisse prolongée jusqu'à 0,50 H
        d = cuisse - genou
        k = (0.50 * H + z0 - genou.z) / d.z if abs(d.z) > 1e-6 else 0
        hanche = genou + d * k
        hanche.x = xc + (hanche.x - xc) * 0.92        # la tête du fémur est plus près du centre
        cheville = Vector((bas_mollet.x, bas_mollet.y, z0 + 0.045 * H))
        pied = [p for p in pts if p.z < z0 + 0.05 * H and (p.x - xc) * cote > 0.01 * H and abs(p.x - xc) < 0.2 * H]
        pointe = min(pied, key=lambda p: p.y) if avant < 0 else max(pied, key=lambda p: p.y)
        pointe = Vector((pointe.x, pointe.y, z0 + 0.012 * H))
        base_orteils = cheville + (pointe - cheville) * 0.72
        base_orteils.z = z0 + 0.02 * H
        A["thigh_" + nom], A["calf_" + nom] = hanche, Vector((genou.x, genou.y, z0 + 0.285 * H))
        A["foot_" + nom], A["ball_" + nom], A["pointe_" + nom] = cheville, base_orteils, pointe

    # le tronc, par tranches (sans les bras : près de l'axe du corps)
    def tronc(h):
        t = [p for p in _coupe(tris, z0 + h * H) if abs(p.x - xc) < 0.12 * H]
        return _centre(t)
    for nom, h in (("pelvis", 0.53), ("spine_01", 0.60), ("spine_02", 0.67), ("spine_03", 0.74), ("neck_01", 0.84), ("head", 0.875)):
        c = tronc(h)
        A[nom] = Vector((xc, c.y if c else 0.0, z0 + h * H))
    A["sommet"] = Vector((xc, A["head"].y, z0 + H))

    # les bras : les sommets au-dessus de la taille et hors du tronc
    for nom, cote in (("l", gauche), ("r", -gauche)):
        bras = [p for p in pts if p.z > z0 + 0.45 * H and (p.x - xc) * cote > 0.14 * H]
        c, v = _axe_principal(bras)
        if (v.x * cote) < 0:
            v = -v
        bout = max(bras, key=lambda p: (p - c).dot(v))
        # la longueur du bras jusqu'au bout des doigts : 0,44 H ; l'épaule en part
        epaule = bout - v * (0.44 * H)
        # garde-fou : l'épaule reste près de sa place moyenne (0,818 H, à 0,11 H du centre)
        moyenne = Vector((xc + cote * 0.11 * H, A["spine_03"].y, z0 + 0.818 * H))
        if (epaule - moyenne).length > 0.06 * H:
            epaule = moyenne
            v = (bout - epaule).normalized()
        A["upperarm_" + nom] = epaule
        A["lowerarm_" + nom] = epaule + v * (0.186 * H)
        A["hand_" + nom] = epaule + v * (0.332 * H)
        A["doigts_" + nom] = bout
        A["clavicle_" + nom] = Vector((xc + cote * 0.02 * H, A["spine_03"].y, z0 + 0.80 * H))
    return A, H, z0, avant


# la hiérarchie du mannequin : (os, parent, tête, queue)
def _os(A, H, z0):
    return [
        ("root", None, Vector((A["pelvis"].x, 0, z0)), Vector((A["pelvis"].x, 0, z0 + 0.1 * H))),
        ("pelvis", "root", A["pelvis"], A["spine_01"]),
        ("spine_01", "pelvis", A["spine_01"], A["spine_02"]),
        ("spine_02", "spine_01", A["spine_02"], A["spine_03"]),
        ("spine_03", "spine_02", A["spine_03"], A["neck_01"]),
        ("neck_01", "spine_03", A["neck_01"], A["head"]),
        ("head", "neck_01", A["head"], A["sommet"]),
    ] + [x for c in ("l", "r") for x in (
        ("clavicle_" + c, "spine_03", A["clavicle_" + c], A["upperarm_" + c]),
        ("upperarm_" + c, "clavicle_" + c, A["upperarm_" + c], A["lowerarm_" + c]),
        ("lowerarm_" + c, "upperarm_" + c, A["lowerarm_" + c], A["hand_" + c]),
        ("hand_" + c, "lowerarm_" + c, A["hand_" + c], A["doigts_" + c]),
        ("thigh_" + c, "pelvis", A["thigh_" + c], A["calf_" + c]),
        ("calf_" + c, "thigh_" + c, A["calf_" + c], A["foot_" + c]),
        ("foot_" + c, "calf_" + c, A["foot_" + c], A["ball_" + c]),
        ("ball_" + c, "foot_" + c, A["ball_" + c], A["pointe_" + c]),
    )]


def rigger(objets, nom="LinkFoot_Squelette"):
    """Crée le squelette, le pose dans les maillages et pondère la peau. Rend l'armature."""
    A, H, z0, avant = mesurer(objets)
    bpy.ops.object.select_all(action="DESELECT")
    donnees = bpy.data.armatures.new(nom)
    arm = bpy.data.objects.new(nom, donnees)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = donnees.edit_bones
    for n, parent, tete, queue in _os(A, H, z0):
        b = eb.new(n)
        b.head, b.tail = tete, queue
        if (b.tail - b.head).length < 1e-4:
            b.tail = b.head + Vector((0, 0, 0.02 * H))
        if parent:
            b.parent = eb[parent]
            b.use_connect = False
        b.use_deform = n != "root"
    # les axes des os (le roulis) : le Z local de chaque os vers l'avant du personnage (bien défini
    # pour les os verticaux comme pour les bras en T) ; sans effet sur la pondération, utile aux IK
    bpy.ops.armature.select_all(action="SELECT")
    bpy.ops.armature.calculate_roll(type="GLOBAL_NEG_Y" if avant < 0 else "GLOBAL_POS_Y")
    bpy.ops.object.mode_set(mode="OBJECT")

    # la pondération. La chaleur des os de Blender échoue sur un maillage fait de morceaux
    # (vêtements, chaussures, yeux séparés, bords ouverts) : on la calcule sur une enveloppe
    # étanche du personnage (un remaillage en voxels de tous ses morceaux réunis), puis on reporte
    # les poids sur le vrai maillage, sommet par sommet, depuis la surface la plus proche.
    for o in objets:
        for m in list(o.modifiers):
            if m.type == "ARMATURE":
                o.modifiers.remove(m)
        o.vertex_groups.clear()
    enveloppe = _enveloppe(objets, 0.006 * H)
    bpy.ops.object.select_all(action="DESELECT")
    enveloppe.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    chaleur = sum(1 for v in enveloppe.data.vertices if any(g.weight > 1e-4 for g in v.groups)) / max(1, len(enveloppe.data.vertices))
    for o in objets:
        for g in enveloppe.vertex_groups:
            o.vertex_groups.new(name=g.name)
        m = o.modifiers.new("LinkFoot_Report", "DATA_TRANSFER")
        m.object = enveloppe
        m.use_vert_data = True
        m.data_types_verts = {"VGROUP_WEIGHTS"}
        m.vert_mapping = "POLYINTERP_NEAREST"
        m.layers_vgroup_select_src = "ALL"
        m.layers_vgroup_select_dst = "NAME"
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(enveloppe, do_unlink=True)
    # les sommets restés sans poids : l'os de déformation le plus proche
    deform = [b for b in arm.data.bones if b.use_deform]
    segs = [(b.name, arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local) for b in deform]
    orphelins = 0
    for o in objets:
        noms = {g.index: g.name for g in o.vertex_groups}
        mw = o.matrix_world
        for v in o.data.vertices:
            if any(g.weight > 1e-4 for g in v.groups if g.group in noms):
                continue
            p = mw @ v.co
            meilleur, dmin = None, 1e9
            for n, a, b in segs:
                ab = b - a
                t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-12)))
                d = (a + ab * t - p).length
                if d < dmin:
                    meilleur, dmin = n, d
            g = o.vertex_groups.get(meilleur) or o.vertex_groups.new(name=meilleur)
            g.add([v.index], 1.0, "REPLACE")
            orphelins += 1
        # quatre influences au plus par sommet (ce que lisent three.js et Unreal), normalisées
        groupes = {g.index: g for g in o.vertex_groups}
        for v in o.data.vertices:
            poids = sorted(((g.weight, g.group) for g in v.groups if g.group in groupes), reverse=True)
            for w, gi in poids[4:]:
                groupes[gi].remove([v.index])
            garde = poids[:4]
            total = sum(w for w, _ in garde)
            if total > 0:
                for w, gi in garde:
                    groupes[gi].add([v.index], w / total, "REPLACE")
        # la peau suit le squelette
        mw = o.matrix_world.copy()
        o.parent = arm
        o.matrix_world = mw
        ma = o.modifiers.new("Armature", "ARMATURE")
        ma.object = arm
    arm["linkfoot_rig_auto"] = {"taille": H, "sol": z0, "regard": "-Y" if avant < 0 else "+Y",
                                "enveloppe_chauffee": round(chaleur, 4), "sommets_sans_poids": orphelins}
    return arm, A, H, orphelins, chaleur


def _enveloppe(objets, voxel):
    """Une copie étanche de tous les maillages réunis : remaillage en voxels."""
    copies = []
    for o in objets:
        c = o.copy()
        c.data = o.data.copy()
        c.modifiers.clear()
        c.vertex_groups.clear()
        bpy.context.scene.collection.objects.link(c)
        copies.append(c)
    bpy.ops.object.select_all(action="DESELECT")
    for c in copies:
        c.select_set(True)
    bpy.context.view_layer.objects.active = copies[0]
    if len(copies) > 1:
        bpy.ops.object.join()
    env = bpy.context.view_layer.objects.active
    env.name = "LinkFoot_Enveloppe"
    m = env.modifiers.new("Voxels", "REMESH")
    m.mode = "VOXEL"
    m.voxel_size = voxel
    m.use_smooth_shade = False
    bpy.ops.object.modifier_apply(modifier=m.name)
    return env
