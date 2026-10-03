"""Le personnage Quaternius « Animated Men » (CC0) préparé pour Unreal Engine 5 et pour le labo,
sans toucher au fichier d'origine.

A lancer avec le Python de Blender :

    python quaternius_ue.py <fichier Quaternius .glb|.fbx|.blend> <dossier de sortie> [--nom SK_LinkFoot_Quaternius] [--taille 1.80]

Ce que le rig d'origine a de bloquant pour l'IK Rig d'Unreal (inspecté dans le fichier) : les
pieds sont des cibles d'IK rattachées à la racine (pas aux jambes) et partent du talon, au sol ;
il n'y a pas d'orteils ; des cibles de pôle traînent dans le squelette ; les noms ne sont ceux
d'aucun squelette connu d'Unreal. Ce script :
  1. met le personnage à la taille voulue (1,80 m par défaut), debout, échelle et rotations
     appliquées, sans ses animations (leurs pieds suivaient l'ancienne hiérarchie) ;
  2. renomme les os aux noms du mannequin d'Unreal (root, pelvis, spine_01 à spine_03, neck_01,
     head, clavicle, upperarm, lowerarm, hand, doigts, thigh, calf, foot ; _l et _r) ;
  3. rattache chaque pied à son mollet, pivot à la cheville (estimée sur le maillage de la
     chaussure), et lui ajoute un os d'orteils (ball) qui porte l'avant de la chaussure ;
  4. retire les cibles de pôle (leurs poids, s'il y en a, vont à leur parent) ;
  5. garde les poids de peau d'origine (l'artiste les a faits) ; l'avant du pied est partagé
     en douceur entre foot et ball ;
  6. exporte <nom>.fbx (Unreal : sans os feuilles, objet d'armature nommé « Armature » pour
     qu'Unreal n'en fasse pas un os de plus) et <nom>.glb (le labo), plus un rapport JSON.
"""
import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector

NOMS = {
    "Bone": "root", "Body": "pelvis", "Hips": "spine_01", "Abdomen": "spine_02", "Torso": "spine_03",
    "Neck": "neck_01", "Head": "head",
}
for c, u in (("L", "l"), ("R", "r")):
    NOMS.update({
        f"Shoulder.{c}": f"clavicle_{u}", f"UpperArm.{c}": f"upperarm_{u}", f"LowerArm.{c}": f"lowerarm_{u}",
        f"Palm.{c}": f"hand_{u}", f"MiddleHand.{c}": f"middle_01_{u}", f"Fingers.{c}": f"middle_02_{u}",
        f"Thumb1.{c}": f"thumb_01_{u}", f"Thumb2.{c}": f"thumb_02_{u}",
        f"UpperLeg.{c}": f"thigh_{u}", f"LowerLeg.{c}": f"calf_{u}", f"Foot.{c}": f"foot_{u}",
    })
A_RETIRER = ("PoleTarget.L", "PoleTarget.R")


def ouvrir(chemin):
    ext = os.path.splitext(chemin)[1].lower()
    if ext == ".blend":
        bpy.ops.wm.open_mainfile(filepath=chemin, load_ui=False)
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        if ext in (".glb", ".gltf"):
            bpy.ops.import_scene.gltf(filepath=chemin)
        elif ext == ".fbx":
            bpy.ops.import_scene.fbx(filepath=chemin, automatic_bone_orientation=True)
        else:
            raise SystemExit(f"format non pris en charge : {ext}")


def nom_original(n):
    """Le chargeur glTF de Blender garde « Foot.L » ; d'autres chemins l'écrivent « Foot_L »."""
    return n.replace("_L", ".L").replace("_R", ".R") if n.endswith(("_L", "_R")) else n


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("fichier")
    ap.add_argument("sortie")
    ap.add_argument("--nom", default="SK_LinkFoot_Quaternius")
    ap.add_argument("--taille", type=float, default=1.80)
    a = ap.parse_args(argv)
    ouvrir(os.path.abspath(a.fichier))
    rap = {"source": os.path.basename(a.fichier)}

    # les formes d'os de l'import glTF ne font pas partie du personnage
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and (o.name.startswith("Icosphere") or any(c.name == "glTF_not_exported" for c in o.users_collection)):
            bpy.data.objects.remove(o, do_unlink=True)
    arms = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    if len(arms) != 1:
        raise SystemExit(f"il faut exactement une armature, trouvé {len(arms)}")
    arm = arms[0]
    peaux = [o for o in bpy.context.scene.objects if o.type == "MESH" and any(m.type == "ARMATURE" and m.object == arm for m in o.modifiers)]
    rap["os_origine"] = [b.name for b in arm.data.bones]
    rap["maillages"] = [o.name for o in peaux]

    # 1. au repos, sans animation ; puis tout à plat (échelle et rotations appliquées)
    if arm.animation_data:
        arm.animation_data.action = None
    rap["animations_retirees"] = [act.name for act in bpy.data.actions]
    for act in list(bpy.data.actions):
        bpy.data.actions.remove(act)
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    # les parents vides de l'import (RootNode...) : on garde la transformation dans le monde
    for o in [arm] + peaux:
        mw = o.matrix_world.copy()
        if o.parent is not None and o.parent != arm:
            o.parent = None
            o.matrix_world = mw
    for o in list(bpy.context.scene.objects):
        if o.type == "EMPTY":
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in [arm] + peaux:
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    # la taille : du plus bas au plus haut des sommets
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in peaux:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        pts.extend(o.matrix_world @ v.co for v in me.vertices)
        ev.to_mesh_clear()
    z0, z1 = min(p.z for p in pts), max(p.z for p in pts)
    k = a.taille / (z1 - z0)
    rap["taille_origine_unites"] = round(z1 - z0, 4)
    rap["echelle_appliquee"] = round(k, 6)
    arm.scale = (k, k, k)
    arm.location = arm.location * k
    for o in peaux:
        if o.parent != arm:
            o.scale = o.scale * k
            o.location = o.location * k
    bpy.ops.object.select_all(action="DESELECT")
    for o in [arm] + peaux:
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    # les pieds au sol
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in peaux:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        pts.extend(o.matrix_world @ v.co for v in me.vertices)
        ev.to_mesh_clear()
    sol = min(p.z for p in pts)
    for o in [arm] + [p for p in peaux if p.parent != arm]:
        o.location.z -= sol
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    for o in [arm] + peaux:
        o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    bpy.context.view_layer.update()

    # 2. les noms
    renommes = {}
    for b in arm.data.bones:
        n = NOMS.get(nom_original(b.name))
        if n:
            renommes[b.name] = n
    for ancien, nouveau in renommes.items():
        arm.data.bones[ancien].name = nouveau     # Blender renomme aussi les groupes de sommets liés
    for o in peaux:
        for g in o.vertex_groups:
            if g.name in renommes:
                g.name = renommes[g.name]
    rap["renommes"] = renommes
    manquants = [n for n in ("root", "pelvis", "spine_01", "head", "thigh_l", "calf_l", "foot_l", "upperarm_l", "hand_l", "thigh_r", "foot_r") if n not in arm.data.bones]
    if manquants:
        raise SystemExit(f"os attendus absents après renommage : {manquants} (os : {[b.name for b in arm.data.bones]})")

    # 4. les cibles de pôle : leurs poids (s'il y en a) vont au parent, puis on les retire
    retires = []
    for nom in A_RETIRER:
        b = arm.data.bones.get(nom) or arm.data.bones.get(nom.replace(".", "_"))
        if not b:
            continue
        parent = b.parent.name if b.parent else "root"
        for o in peaux:
            g = o.vertex_groups.get(b.name)
            if g is None:
                continue
            gp = o.vertex_groups.get(parent) or o.vertex_groups.new(name=parent)
            for v in o.data.vertices:
                for e in v.groups:
                    if e.group == g.index and e.weight > 0:
                        gp.add([v.index], e.weight, "ADD")
            o.vertex_groups.remove(g)
        retires.append(b.name)
    rap["retires"] = retires

    # 3. les pieds : la cheville et la pointe, mesurées sur les sommets que chaque pied porte
    def sommets_portes(nom_os, seuil=0.5):
        res = []
        for o in peaux:
            g = o.vertex_groups.get(nom_os)
            if g is None:
                continue
            ev_pts = o.data.vertices
            for v in ev_pts:
                for e in v.groups:
                    if e.group == g.index and e.weight >= seuil:
                        res.append((o, v.index, o.matrix_world @ v.co))
        return res
    H = a.taille
    pieds = {}
    for c in ("l", "r"):
        pts = [p for _, _, p in sommets_portes("foot_" + c)]
        if len(pts) < 8:
            raise SystemExit(f"le pied {c} ne porte presque aucun sommet")
        # l'avant : vers -Y (le personnage regarde vers -Y après l'import glTF de Blender)
        avant_y = min(p.y for p in pts)
        arriere_y = max(p.y for p in pts)
        haut = max(p.z for p in pts)
        talon = [p for p in pts if p.y > arriere_y - 0.4 * (arriere_y - avant_y)]
        x = sum(p.x for p in talon) / len(talon)
        cheville = Vector((x, arriere_y - 0.25 * (arriere_y - avant_y), max(0.03 * H, min(0.045 * H, haut))))
        pointe_pts = [p for p in pts if p.y < avant_y + 0.02 * H]
        pointe = Vector((sum(p.x for p in pointe_pts) / len(pointe_pts), avant_y, 0.012 * H))
        base = cheville + (pointe - cheville) * 0.72
        base.z = 0.02 * H
        pieds[c] = (cheville, base, pointe)
    rap["pieds"] = {c: {"cheville": [round(v, 4) for v in ch], "base_orteils": [round(v, 4) for v in b], "pointe": [round(v, 4) for v in p]}
                    for c, (ch, b, p) in pieds.items()}

    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    for nom in retires:
        eb.remove(eb[nom])
    for c in ("l", "r"):
        cheville, base, pointe = pieds[c]
        f = eb["foot_" + c]
        f.use_connect = False
        f.parent = eb["calf_" + c]
        f.head = cheville
        f.tail = base
        # le mollet finit à la cheville
        cl = eb["calf_" + c]
        cl.tail = cheville
        ball = eb.new("ball_" + c)
        ball.head, ball.tail = base, pointe
        ball.parent = f
        ball.use_connect = True
        ball.roll = f.roll
    # la racine : au sol, sous le bassin, vers le haut (la convention d'Unreal)
    r = eb["root"]
    pel = eb["pelvis"]
    for b in eb:
        if b.parent is None and b.name != "root":
            b.parent = r
    r.head = Vector((pel.head.x, pel.head.y, 0.0))
    r.tail = Vector((pel.head.x, pel.head.y, 0.1 * H))
    r.roll = 0.0
    bpy.ops.object.mode_set(mode="OBJECT")
    arm.data.bones["root"].use_deform = False

    # 5. l'avant de chaque chaussure passe en douceur du pied aux orteils
    for c in ("l", "r"):
        cheville, base, pointe = pieds[c]
        axe = (pointe - cheville)
        axe.z = 0
        L = axe.length
        axe.normalize()
        db = (base - cheville).dot(axe)
        for o in peaux:
            gf = o.vertex_groups.get("foot_" + c)
            if gf is None:
                continue
            gb = o.vertex_groups.get("ball_" + c) or o.vertex_groups.new(name="ball_" + c)
            for v in o.data.vertices:
                wf = next((e.weight for e in v.groups if e.group == gf.index), 0.0)
                if wf <= 0:
                    continue
                d = ((o.matrix_world @ v.co) - cheville).dot(axe)
                t = max(0.0, min(1.0, (d - (db - 0.015 * H)) / (0.03 * H)))
                t = t * t * (3 - 2 * t)
                if t > 0:
                    gb.add([v.index], wf * t, "REPLACE")
                    gf.add([v.index], wf * (1 - t), "REPLACE")
    # 6. l'objet d'armature s'appelle « Armature » (Unreal n'en fait pas un os en plus)
    arm.name = "Armature"
    arm.data.name = "Armature"
    rap["os_ue"] = [b.name for b in arm.data.bones]
    rap["hierarchie"] = {b.name: (b.parent.name if b.parent else None) for b in arm.data.bones}
    os.makedirs(a.sortie, exist_ok=True)
    blend = os.path.join(a.sortie, a.nom + ".blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    fbx = os.path.join(a.sortie, a.nom + ".fbx")
    bpy.ops.export_scene.fbx(filepath=fbx, use_selection=False, object_types={"ARMATURE", "MESH"}, add_leaf_bones=False,
                             use_armature_deform_only=False, bake_anim=False, mesh_smooth_type="FACE",
                             apply_scale_options="FBX_SCALE_ALL", path_mode="COPY", embed_textures=True)
    glb = os.path.join(a.sortie, a.nom + ".glb")
    bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=False, export_apply=False,
                              export_yup=True, export_skins=True, export_animations=False)
    rap["fichiers"] = {os.path.basename(f): os.path.getsize(f) for f in (blend, fbx, glb)}
    with open(os.path.join(a.sortie, a.nom + ".rapport.json"), "w", encoding="utf-8") as fh:
        json.dump(rap, fh, ensure_ascii=False, indent=1)
    print(json.dumps({k: rap[k] for k in ("source", "taille_origine_unites", "echelle_appliquee", "retires", "pieds", "fichiers")}, ensure_ascii=False, indent=1))
    print("hiérarchie :", rap["hierarchie"])


if __name__ == "__main__":
    main()
