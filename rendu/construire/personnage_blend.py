"""Un personnage riggé venu d'ailleurs (.blend, .glb, .gltf ou .fbx) : on le vérifie, puis on
l'exporte pour LinkFoot (GLB pour le labo three.js, FBX pour Unreal).

A lancer avec le Python de Blender (le module bpy de PyPI, ou blender --background --python) :

    python personnage_blend.py <fichier> <dossier de sortie> [--nom SoccerPlayerBlue] [--lod 15000]

Vérifie : les maillages (sommets, faces, triangles après modificateurs), le squelette (os,
os de déformation, convention de noms, pose de repos en T ou en A), les matériaux et leurs
textures (taille, emballées ou manquantes), les animations (actions, images, cadence), les
unités de la scène, l'échelle (taille du personnage), l'orientation (le côté vers lequel
pointent les pieds), et ce que coûtera l'affichage (triangles, appels de dessin, mémoire
des textures). Le rapport sort en JSON (<nom>.rapport.json) et en clair.

Exporte : <nom>.glb (+Y en haut, modificateurs appliqués sauf l'armature, peau, animations),
<nom>.fbx (pour Unreal : sans os feuilles, os de déformation seulement, textures intégrées) et,
avec --lod, <nom>_lod1.glb, décimé jusqu'au nombre de triangles demandé (pour le web).

Le fichier d'entrée n'est jamais modifié.
"""
import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector


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


def convention(noms):
    n = " ".join(noms)
    if "mixamorig" in n:
        return "Mixamo"
    if any(x.startswith("DEF-") for x in noms):
        return "Rigify (os DEF-)"
    if "pelvis" in noms and "thigh_l" in noms:
        return "Unreal (mannequin)"
    if any(x in noms for x in ("Hips", "LeftUpLeg", "RightUpLeg")):
        return "type Mixamo / BVH"
    if any("UpperLeg" in x for x in noms):
        return "type Quaternius"
    if any(x.startswith("Bip") for x in noms):
        return "3ds Max Biped"
    return "autre"


def os_par_role(arm):
    """Le haut de la cuisse, le pied et le haut du bras de chaque côté, d'après les noms."""
    def cherche(mots, cote):
        for b in arm.data.bones:
            n = b.name.lower().replace("mixamorig:", "")
            if not any(m in n for m in mots):
                continue
            c = None
            if "left" in n or n.endswith((".l", "_l", "-l", " l")) or n.startswith(("l_", "l.")) or b.name.endswith("L") and n[-2:-1].isalpha():
                c = "L"
            elif "right" in n or n.endswith((".r", "_r", "-r", " r")) or n.startswith(("r_", "r.")) or b.name.endswith("R") and n[-2:-1].isalpha():
                c = "R"
            if c == cote and not any(x in n for x in ("ik", "pole", "target", "twist", "mch", "org-")):
                return b
        return None
    r = {}
    for c in ("L", "R"):
        r["cuisse" + c] = cherche(("upleg", "thigh", "upperleg", "upper_leg"), c)
        r["pied" + c] = cherche(("foot", "ankle"), c)
        r["bras" + c] = cherche(("upperarm", "upper_arm", "arm"), c) if cherche(("upperarm", "upper_arm"), c) is None else cherche(("upperarm", "upper_arm"), c)
        r["orteil" + c] = cherche(("toe", "ball"), c)
    return r


def triangles(obj, depsgraph):
    ev = obj.evaluated_get(depsgraph)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    ev.to_mesh_clear()
    return n


def inspecter(nom):
    scene = bpy.context.scene
    depsgraph = bpy.context.evaluated_depsgraph_get()
    rap = {"nom": nom, "blender": bpy.app.version_string}
    us = scene.unit_settings
    rap["unites"] = {"systeme": us.system, "echelle": us.scale_length, "longueur": us.length_unit}
    rap["cadence"] = scene.render.fps / scene.render.fps_base

    maillages = [o for o in scene.objects if o.type == "MESH"]
    armatures = [o for o in scene.objects if o.type == "ARMATURE"]
    peau = []
    for o in maillages:
        arm = next((m.object for m in o.modifiers if m.type == "ARMATURE" and m.object), None)
        if arm is None and o.parent and o.parent.type == "ARMATURE":
            arm = o.parent
        tris = triangles(o, depsgraph)
        peau.append({
            "nom": o.name, "armature": arm.name if arm else None, "visible": not o.hide_render,
            "sommets": len(o.data.vertices), "faces": len(o.data.polygons), "triangles": tris,
            "materiaux": [s.material.name if s.material else None for s in o.material_slots],
            "uv": len(o.data.uv_layers), "groupes": len(o.vertex_groups),
            "formes": len(o.data.shape_keys.key_blocks) if o.data.shape_keys else 0,
            "modificateurs": [m.type for m in o.modifiers],
        })
    rap["maillages"] = peau
    rap["triangles"] = sum(m["triangles"] for m in peau if m["visible"])
    rap["appels_dessin"] = sum(max(1, len(m["materiaux"])) for m in peau if m["visible"])

    # l'échelle et l'orientation : la boîte des maillages visibles, dans le monde
    pts = []
    for o in maillages:
        if o.hide_render:
            continue
        for c in o.bound_box:
            pts.append(o.matrix_world @ Vector(c))
    if pts:
        mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        rap["boite_m"] = {"min": [round(v, 4) for v in mn], "max": [round(v, 4) for v in mx],
                          "taille": round((mx.z - mn.z) * us.scale_length, 4)}

    squelettes = []
    for a in armatures:
        os_ = list(a.data.bones)
        deform = [b for b in os_ if b.use_deform]
        racines = [b.name for b in os_ if b.parent is None]
        roles = os_par_role(a)
        s = {"nom": a.name, "os": len(os_), "os_deformation": len(deform), "racines": racines,
             "convention": convention([b.name for b in os_]), "contraintes": sum(len(p.constraints) for p in a.pose.bones),
             "noms": [b.name for b in os_][:400]}
        mw = a.matrix_world
        # la pose de repos : l'angle du haut du bras avec l'horizontale (0 : en T, ~45 : en A)
        angles = []
        for c in ("L", "R"):
            b = roles.get("bras" + c)
            if b:
                d = (mw @ b.tail_local) - (mw @ b.head_local)
                angles.append(round(math.degrees(math.atan2(-d.z, math.hypot(d.x, d.y))), 1))
        s["bras_sous_horizontale_deg"] = angles
        s["pose_repos"] = "T" if angles and max(abs(x) for x in angles) < 15 else "A" if angles and max(angles) < 60 else "autre"
        # l'orientation : vers où pointent les pieds (de la cheville vers la pointe), dans le monde
        avant = Vector((0, 0, 0))
        for c in ("L", "R"):
            p, o = roles.get("pied" + c), roles.get("orteil" + c)
            if p:
                fin = (mw @ o.head_local) if o else (mw @ p.tail_local)
                d = fin - (mw @ p.head_local)
                d.z = 0
                avant += d
        if avant.length > 1e-6:
            avant.normalize()
            axe = max((("+X", avant.x), ("-X", -avant.x), ("+Y", avant.y), ("-Y", -avant.y)), key=lambda t: t[1])[0]
            s["face_vers"] = axe
        s["roles"] = {k: (v.name if v else None) for k, v in roles.items()}
        squelettes.append(s)
    rap["squelettes"] = squelettes

    images = []
    for img in bpy.data.images:
        if img.type != "IMAGE":
            continue
        manquante = not img.packed_file and not (img.filepath and os.path.exists(bpy.path.abspath(img.filepath)))
        w, h = img.size[:]
        images.append({"nom": img.name, "taille": [w, h], "emballee": bool(img.packed_file), "manquante": manquante,
                       "espace": img.colorspace_settings.name, "fichier": img.filepath})
    rap["textures"] = images
    rap["memoire_textures_mo"] = round(sum(i["taille"][0] * i["taille"][1] * 4 * 4 / 3 for i in images) / 2 ** 20, 1)
    mats = []
    for m in bpy.data.materials:
        if not m.users:
            continue
        noeuds = [n.type for n in m.node_tree.nodes] if m.use_nodes and m.node_tree else []
        imgs = [n.image.name for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image] if m.use_nodes and m.node_tree else []
        mats.append({"nom": m.name, "principled": "BSDF_PRINCIPLED" in noeuds, "images": imgs, "noeuds": len(noeuds)})
    rap["materiaux"] = mats
    anims = []
    for act in bpy.data.actions:
        fr = act.frame_range
        cibles = sorted({fc.data_path.split('"')[1] for fc in act.fcurves if fc.data_path.startswith("pose.bones")})
        anims.append({"nom": act.name, "images": [round(fr[0], 2), round(fr[1], 2)], "courbes": len(act.fcurves), "os_animes": len(cibles)})
    rap["animations"] = anims
    return rap


def en_clair(r):
    l = [f"{r['nom']} (Blender {r['blender']})"]
    u = r["unites"]
    l.append(f"unités : {u['systeme']}, échelle {u['echelle']}, longueur {u['longueur']} ; cadence {r['cadence']:g} i/s")
    if "boite_m" in r:
        b = r["boite_m"]
        l.append(f"taille : {b['taille']} m ; boîte {b['min']} → {b['max']}")
    l.append(f"triangles (visibles, après modificateurs) : {r['triangles']} ; appels de dessin : {r['appels_dessin']}")
    for m in r["maillages"]:
        l.append(f"  maillage {m['nom']} : {m['triangles']} tri, {m['sommets']} sommets, matériaux {m['materiaux']}, "
                 f"armature {m['armature']}, {m['formes']} formes, modificateurs {m['modificateurs']}{'' if m['visible'] else ' (caché au rendu)'}")
    for s in r["squelettes"]:
        l.append(f"squelette {s['nom']} : {s['os']} os ({s['os_deformation']} de déformation), convention {s['convention']}, "
                 f"repos en {s['pose_repos']} (bras {s['bras_sous_horizontale_deg']} ° sous l'horizontale), pieds vers {s.get('face_vers', '?')}, "
                 f"{s['contraintes']} contraintes ; racines {s['racines']}")
        l.append(f"  rôles : {s['roles']}")
    for t in r["textures"]:
        l.append(f"  texture {t['nom']} {t['taille'][0]}x{t['taille'][1]} {t['espace']}{' emballée' if t['emballee'] else ''}{' MANQUANTE' if t['manquante'] else ''}")
    l.append(f"mémoire des textures (avec mipmaps) : {r['memoire_textures_mo']} Mo")
    for m in r["materiaux"]:
        l.append(f"  matériau {m['nom']} : {'Principled' if m['principled'] else 'autre'}, images {m['images']}")
    for a in r["animations"]:
        l.append(f"  animation {a['nom']} : images {a['images'][0]} à {a['images'][1]}, {a['os_animes']} os animés")
    return "\n".join(l)


def exporter(sortie, nom, lod):
    os.makedirs(sortie, exist_ok=True)
    glb = os.path.join(sortie, nom + ".glb")
    bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=False, export_apply=True,
                              export_yup=True, export_skins=True, export_animations=True, export_morph=True)
    fbx = os.path.join(sortie, nom + ".fbx")
    bpy.ops.export_scene.fbx(filepath=fbx, use_selection=False, add_leaf_bones=False, use_armature_deform_only=True,
                             bake_anim=True, path_mode="COPY", embed_textures=True, mesh_smooth_type="FACE",
                             apply_scale_options="FBX_SCALE_UNITS")
    faits = [glb, fbx]
    if lod:
        depsgraph = bpy.context.evaluated_depsgraph_get()
        visibles = [o for o in bpy.context.scene.objects if o.type == "MESH" and not o.hide_render]
        total = sum(triangles(o, depsgraph) for o in visibles)
        if total > lod:
            rapport = lod / total
            for o in visibles:
                m = o.modifiers.new("LinkFoot_LOD1", "DECIMATE")
                m.ratio = rapport
                # le décimateur doit passer avant l'armature (il garde les groupes de sommets)
                while o.modifiers.find(m.name) > 0:
                    bpy.context.view_layer.objects.active = o
                    bpy.ops.object.modifier_move_up(modifier=m.name)
            lod1 = os.path.join(sortie, nom + "_lod1.glb")
            bpy.ops.export_scene.gltf(filepath=lod1, export_format="GLB", use_selection=False, export_apply=True,
                                      export_yup=True, export_skins=True, export_animations=True, export_morph=False)
            faits.append(lod1)
    return faits


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("fichier")
    ap.add_argument("sortie")
    ap.add_argument("--nom")
    ap.add_argument("--lod", type=int, default=0)
    ap.add_argument("--sans-export", action="store_true")
    a = ap.parse_args(argv)
    nom = a.nom or os.path.splitext(os.path.basename(a.fichier))[0]
    ouvrir(os.path.abspath(a.fichier))
    rap = inspecter(nom)
    os.makedirs(a.sortie, exist_ok=True)
    with open(os.path.join(a.sortie, nom + ".rapport.json"), "w", encoding="utf-8") as f:
        json.dump(rap, f, ensure_ascii=False, indent=1)
    print(en_clair(rap))
    if not a.sans_export:
        for f in exporter(a.sortie, nom, a.lod):
            print("exporté :", f, f"{os.path.getsize(f) / 2 ** 20:.2f} Mo")


if __name__ == "__main__":
    main()
