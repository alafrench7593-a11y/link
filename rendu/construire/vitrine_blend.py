"""La vitrine d'un personnage : des rendus Cycles (processeur, sans écran) de face, de trois
quarts, de profil et de dos, sous la même lumière, pour juger un modèle importé, son squelette
(os dessinés en orange par-dessus le corps) et ses déformations (une pose d'essai).

A lancer avec le Python de Blender :

    python vitrine_blend.py <fichier .blend|.glb|.gltf|.fbx> <sortie.png> [--squelette] [--pose essai]
                            [--vues face,trois_quarts,profil,dos] [--taille 512] [--echantillons 24]

Les vues sont assemblées côte à côte dans une seule image (une colonne par vue).
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Vector, Euler, Matrix


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
    for o in list(bpy.context.scene.objects):
        # les formes d'os que crée l'import glTF ne sont pas le personnage
        if o.type == "MESH" and (o.name.startswith("Icosphere") or any(c.name == "glTF_not_exported" for c in o.users_collection)):
            o.hide_render = True


def poser_essai(arm):
    """Une pose qui sollicite les articulations : bras le long du corps et en avant, genou plié,
    hanche fléchie, buste tourné, tête tournée (pour voir les déformations du rig)."""
    pb = arm.pose.bones
    def tourne(nom, axe, deg):
        b = pb.get(nom)
        if not b:
            return
        b.rotation_mode = "XYZ"
        # rotation autour d'un axe du monde, convertie dans le repère de l'os
        mw = arm.matrix_world @ b.bone.matrix_local
        axe_local = (mw.to_3x3().inverted() @ Vector(axe)).normalized()
        q = b.rotation_euler.to_quaternion()
        from mathutils import Quaternion
        q = Quaternion(axe_local, math.radians(deg)) @ q
        b.rotation_euler = q.to_euler("XYZ")
    tourne("upperarm_l", (0, 1, 0), 70)
    tourne("upperarm_r", (0, 1, 0), -45)
    tourne("upperarm_r", (1, 0, 0), -50)
    tourne("lowerarm_r", (0, 0, 1), 60)
    tourne("thigh_l", (1, 0, 0), -35)
    tourne("calf_l", (1, 0, 0), 70)
    tourne("thigh_r", (1, 0, 0), 15)
    tourne("spine_02", (0, 0, 1), 15)
    tourne("head", (0, 0, 1), 25)
    bpy.context.view_layer.update()


def dessiner_os(arm):
    """Chaque os de déformation devient un fuseau orange qui se voit à travers le corps."""
    mat = bpy.data.materials.new("LinkFoot_Os")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (1.0, 0.45, 0.05, 1)
    em.inputs["Strength"].default_value = 3.0
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs[0])
    bpy.context.view_layer.update()
    for pb in arm.pose.bones:
        if not pb.bone.use_deform:
            continue
        t = arm.matrix_world @ pb.head
        q = arm.matrix_world @ pb.tail
        d = q - t
        L = d.length
        if L < 1e-5:
            continue
        bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.018, radius2=0.004, depth=L, location=(t + q) / 2)
        c = bpy.context.active_object
        c.rotation_mode = "QUATERNION"
        c.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
        c.data.materials.append(mat)
        c.visible_shadow = False
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=0.022, location=t)
        s = bpy.context.active_object
        s.data.materials.append(mat)
        s.visible_shadow = False


def boite():
    pts = []
    dg = bpy.context.evaluated_depsgraph_get()
    for o in bpy.context.scene.objects:
        if o.type != "MESH" or o.hide_render or o.name.startswith("LinkFoot_Sol"):
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        pts.extend(o.matrix_world @ v.co for v in me.vertices)
        ev.to_mesh_clear()
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx


def regard(arm):
    """-1 si le personnage regarde vers -Y (la convention de Blender), +1 vers +Y."""
    if arm is not None and "linkfoot_rig_auto" in arm.keys():
        return -1 if arm["linkfoot_rig_auto"].get("regard", "-Y") == "-Y" else 1
    return -1


def scene_rendu(taille, echantillons):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = echantillons
    sc.cycles.use_denoising = True
    sc.render.resolution_x = taille
    sc.render.resolution_y = taille
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
    if sc.world is None:
        sc.world = bpy.data.worlds.new("Monde")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.62, 0.68, 0.74, 1)
    bg.inputs["Strength"].default_value = 0.9


def eclairer(mn, mx):
    c = (mn + mx) / 2
    H = mx.z - mn.z
    bpy.ops.object.light_add(type="SUN", location=(c.x - 3, c.y - 3, mx.z + 4))
    soleil = bpy.context.active_object
    soleil.data.energy = 3.2
    soleil.data.angle = math.radians(4)
    soleil.rotation_euler = Euler((math.radians(50), 0, math.radians(-35)))
    bpy.ops.object.light_add(type="AREA", location=(c.x + 2.5, c.y - 2.0, mn.z + 1.6 * H))
    remplir = bpy.context.active_object
    remplir.data.energy = 250 * H * H
    remplir.data.size = 2.0
    remplir.rotation_euler = (Vector((c.x, c.y, mn.z + 0.6 * H)) - remplir.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.mesh.primitive_plane_add(size=40, location=(c.x, c.y, mn.z))
    sol = bpy.context.active_object
    sol.name = "LinkFoot_Sol"
    m = bpy.data.materials.new("LinkFoot_Pelouse")
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (0.09, 0.26, 0.08, 1)
    p.inputs["Roughness"].default_value = 0.9
    sol.data.materials.append(m)


def rendre_vues(vues, sortie, mn, mx, avant):
    sc = bpy.context.scene
    c = (mn + mx) / 2
    H = mx.z - mn.z
    cam_d = bpy.data.cameras.new("Vitrine")
    cam_d.lens = 70
    cam = bpy.data.objects.new("Vitrine", cam_d)
    sc.collection.objects.link(cam)
    sc.camera = cam
    angles = {"face": 0, "trois_quarts": 35, "profil": 90, "dos": 180}
    fichiers = []
    for v in vues:
        a = math.radians(angles[v])
        # devant le personnage : du côté où il regarde
        dist = 2.5 * H
        direction = Vector((math.sin(a), avant * math.cos(a), 0))
        cam.location = Vector((c.x, c.y, mn.z + 0.55 * H)) + direction * dist
        cible = Vector((c.x, c.y, mn.z + 0.5 * H))
        cam.rotation_euler = (cible - cam.location).to_track_quat("-Z", "Y").to_euler()
        f = sortie.replace(".png", f"_{v}.png")
        sc.render.filepath = f
        bpy.ops.render.render(write_still=True)
        fichiers.append(f)
    return fichiers


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("fichier")
    ap.add_argument("sortie")
    ap.add_argument("--squelette", action="store_true")
    ap.add_argument("--pose", default="")
    ap.add_argument("--vues", default="face,trois_quarts,profil,dos")
    ap.add_argument("--taille", type=int, default=512)
    ap.add_argument("--echantillons", type=int, default=24)
    ap.add_argument("--cacher", default="", help="expression : les objets dont le nom correspond ne sont pas rendus "
                    "(une seule coiffure sur plusieurs, par exemple)")
    a = ap.parse_args(argv)
    ouvrir(os.path.abspath(a.fichier))
    if a.cacher:
        import re
        for o in bpy.context.scene.objects:
            if re.search(a.cacher, o.name):
                o.hide_render = True
                o.hide_set(True)
    arm = next((o for o in bpy.context.scene.objects if o.type == "ARMATURE"), None)
    if arm is not None:
        if arm.animation_data:
            arm.animation_data.action = None
        for pb in arm.pose.bones:
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
            pb.scale = (1, 1, 1)
        bpy.context.view_layer.update()
        if a.pose == "essai":
            poser_essai(arm)
    mn, mx = boite()
    if a.squelette and arm is not None:
        dessiner_os(arm)
        # le corps devient translucide pour laisser voir les os
        for o in bpy.context.scene.objects:
            if o.type == "MESH" and not o.name.startswith(("Cone", "Sphere")) and not o.hide_render:
                for s in o.material_slots:
                    if s.material and s.material.use_nodes:
                        p = s.material.node_tree.nodes.get("Principled BSDF")
                        if p and "Alpha" in p.inputs:
                            p.inputs["Alpha"].default_value = 0.35
    scene_rendu(a.taille, a.echantillons)
    eclairer(mn, mx)
    fichiers = rendre_vues(a.vues.split(","), os.path.abspath(a.sortie), mn, mx, regard(arm))
    print("\n".join(fichiers))


if __name__ == "__main__":
    main()
