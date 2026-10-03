#!/usr/bin/env python3
"""Le script d'import des personnages (Content/Python/personnage_linkfoot.py), essayé HORS
d'Unreal contre un faux module « unreal ».

    python3 unreal/tests-python/test_personnage.py

Le faux module ne connaît que l'API que le script déclare dans API_UTILISEE (relevée dans la
documentation Python d'Epic pour Unreal 5.8) : un appel à autre chose lève une erreur.

Ce que ça prouve : la logique du script (l'ordre des étapes, les chaînes posées à la main quand
la reconnaissance automatique échoue, rien de supposé quand un asset manque, le branchement du
maillage aux footballeurs). Ce que ça ne prouve pas : qu'Unreal importe le FBX ou reconnaît le
squelette comme le faux module. Seul un essai dans l'éditeur le dit.
"""
import importlib.util
import pathlib
import sys
import types

ICI = pathlib.Path(__file__).resolve().parent
SCRIPT = ICI.parent / "LinkFoot" / "Content" / "Python" / "personnage_linkfoot.py"
ECHECS = []


def verifier(nom, condition, detail=""):
    print(("  ok    " if condition else "  ÉCHEC ") + nom + (f"  ({detail})" if detail else ""))
    if not condition:
        ECHECS.append(nom)


def faux_unreal(auto_reconnu=True):
    u = types.ModuleType("unreal")
    assets = {}
    dossiers = set()
    appels = []
    u.appels = appels
    u.assets = assets

    class Objet:
        def __init__(self, chemin):
            self._chemin = chemin

        def get_path_name(self):
            return self._chemin

    class SkeletalMesh(Objet):
        pass

    class IKRigDefinition(Objet):
        def __init__(self, chemin):
            super().__init__(chemin)
            self.chaines, self.buts, self.racine, self.mesh, self.fbik, self.racine_mvt = [], {}, None, None, False, None

    class IKRetargeter(Objet):
        def __init__(self, chemin):
            super().__init__(chemin)
            self.source = self.cible = None
            self.ops = 0
            self.carte = None
            self.aligne = None

    class Definitions(Objet):
        def __init__(self, chemin):
            super().__init__(chemin)
            self.maillage_par_defaut = None

        def set_editor_property(self, nom, valeur):
            if nom != "maillage_par_defaut":
                raise AttributeError(f"LFDefinitionsPersonnages.{nom} n'existe pas")
            self.maillage_par_defaut = valeur

    class BoneChain:
        def __init__(self, nom):
            self._nom = nom

        def get_editor_property(self, nom):
            if nom != "chain_name":
                raise AttributeError(nom)
            return self._nom

    class AssetImportTask:
        _champs = ("filename", "destination_path", "automated", "replace_existing", "save", "imported_object_paths")

        def __init__(self):
            object.__setattr__(self, "_objets", [])
            for c in self._champs:
                object.__setattr__(self, c, [] if c == "imported_object_paths" else None)

        def __setattr__(self, nom, valeur):
            if nom not in self._champs:
                raise AttributeError(f"AssetImportTask.{nom} n'existe pas")
            object.__setattr__(self, nom, valeur)

        def get_objects(self):
            return list(self._objets)

    class AssetTools:
        def import_asset_tasks(self, taches):
            appels.append("import_asset_tasks")
            for t in taches:
                nom = pathlib.PurePath(t.filename).stem
                chemin = f"{t.destination_path}/{nom}.{nom}"
                sk = SkeletalMesh(chemin)
                assets[chemin] = sk
                t._objets.append(sk)
                t.imported_object_paths.append(chemin)

        def create_asset(self, nom, dossier, classe, fabrique, calling_context="None", overwrite_existing=False):
            appels.append("create_asset")
            if classe is not IKRetargeter or not isinstance(fabrique, IKRetargetFactory):
                raise TypeError("create_asset : classe ou fabrique inattendue")
            chemin = f"{dossier}/{nom}.{nom}"
            assets[chemin] = IKRetargeter(chemin)
            return assets[chemin]

    class AssetToolsHelpers:
        @staticmethod
        def get_asset_tools():
            return AssetTools()

    class EditorAssetLibrary:
        @staticmethod
        def does_asset_exist(chemin):
            return chemin in assets

        @staticmethod
        def load_asset(chemin):
            return assets[chemin]

        @staticmethod
        def save_loaded_asset(asset, only_if_is_dirty=True):
            appels.append("save:" + asset.get_path_name())
            return True

        @staticmethod
        def make_directory(chemin):
            dossiers.add(chemin)
            return True

        @staticmethod
        def does_directory_exist(chemin):
            return chemin in dossiers

    class IKRigDefinitionFactory:
        @staticmethod
        def create_new_ik_rig_asset(dossier, nom):
            chemin = f"{dossier}/{nom}.{nom}"
            assets[chemin] = IKRigDefinition(chemin)
            return assets[chemin]

    class IKRigController:
        def __init__(self, rig):
            self.rig = rig

        @staticmethod
        def get_controller(rig):
            return IKRigController(rig)

        def set_skeletal_mesh(self, sk):
            if not isinstance(sk, SkeletalMesh):
                raise TypeError("set_skeletal_mesh attend un SkeletalMesh")
            self.rig.mesh = sk
            return True

        def apply_auto_generated_retarget_definition(self):
            if auto_reconnu:
                self.rig.chaines = ["Spine", "Head", "LeftArm", "RightArm", "LeftLeg", "RightLeg"]
                self.rig.racine = "pelvis"
            return auto_reconnu

        def get_retarget_chains(self):
            return [BoneChain(n) for n in self.rig.chaines]

        def set_retarget_root(self, os_):
            self.rig.racine = os_
            return True

        def add_new_goal(self, nom, os_):
            self.rig.buts[nom] = os_
            return nom

        def add_retarget_chain(self, nom, debut, fin, but):
            self.rig.chaines.append(nom)
            return nom

        def apply_auto_fbik(self):
            self.rig.fbik = True
            return True

        def set_root_motion_bone(self, os_):
            self.rig.racine_mvt = os_
            return True

    class IKRetargetFactory:
        pass

    class IKRetargeterController:
        def __init__(self, rtg):
            self.rtg = rtg

        @staticmethod
        def get_controller(rtg):
            return IKRetargeterController(rtg)

        def set_ik_rig(self, cote, rig):
            if cote == "SOURCE":
                self.rtg.source = rig
            else:
                self.rtg.cible = rig

        def add_default_ops(self):
            self.rtg.ops += 1

        def auto_map_chains(self, genre, forcer, op_name="None"):
            self.rtg.carte = genre

        def auto_align_all_bones(self, cote, methode):
            self.rtg.aligne = (cote, methode)

    u.SkeletalMesh, u.IKRigDefinition, u.IKRetargeter, u.BoneChain = SkeletalMesh, IKRigDefinition, IKRetargeter, BoneChain
    u.AssetTools = AssetTools
    u.AssetImportTask, u.AssetToolsHelpers, u.EditorAssetLibrary = AssetImportTask, AssetToolsHelpers, EditorAssetLibrary
    u.IKRigDefinitionFactory, u.IKRigController = IKRigDefinitionFactory, IKRigController
    u.IKRetargetFactory, u.IKRetargeterController = IKRetargetFactory, IKRetargeterController
    u.RetargetSourceOrTarget = types.SimpleNamespace(SOURCE="SOURCE", TARGET="TARGET")
    u.AutoMapChainType = types.SimpleNamespace(EXACT="EXACT", FUZZY="FUZZY", CLEAR="CLEAR")
    u.RetargetAutoAlignMethod = types.SimpleNamespace(CHAIN_TO_CHAIN="CHAIN_TO_CHAIN", MESH_TO_MESH="MESH_TO_MESH")
    u.Definitions = Definitions
    return u


def charger(u):
    spec = importlib.util.spec_from_file_location("personnage_linkfoot", SCRIPT)
    m = importlib.util.module_from_spec(spec)
    sys.modules["unreal"] = u
    spec.loader.exec_module(m)
    m.unreal = u
    return m


def main():
    fbx = "C:/link/unreal/LinkFoot/SourceArt/Characters/Players/Quaternius/SK_LinkFoot_Quaternius.fbx"

    print("1. tout l'enchaînement, squelette reconnu automatiquement")
    u = faux_unreal(auto_reconnu=True)
    m = charger(u)
    # chaque fonction d'Unreal utilisée est déclarée (et seulement celles-là existent dans le faux module)
    declarees = {x.split(".")[0] for x in m.API_UTILISEE}
    verifier("API déclarée connue du faux module", all(hasattr(u, d) for d in declarees), sorted(d for d in declarees if not hasattr(u, d)))
    u.assets["/Game/Characters/Mannequins/Rigs/IK_Mannequin"] = u.IKRigDefinition("/Game/Characters/Mannequins/Rigs/IK_Mannequin")
    u.assets["/Game/LinkFoot/Data/DA_Personnages"] = u.Definitions("/Game/LinkFoot/Data/DA_Personnages")
    r = m.tout(fbx, source_ik_rig="/Game/Characters/Mannequins/Rigs/IK_Mannequin", definitions="/Game/LinkFoot/Data/DA_Personnages")
    verifier("maillage importé dans le dossier LinkFoot", r["maillage"] == "/Game/LinkFoot/Characters/Players/Quaternius/SK_LinkFoot_Quaternius.SK_LinkFoot_Quaternius", r["maillage"])
    verifier("IK Rig créé et sauvé", r["ik_rig"].endswith("IK_LinkFoot_Quaternius") and any(a.startswith("save:") and "IK_LinkFoot" in a for a in u.appels), r["ik_rig"])
    verifier("reconnaissance automatique utilisée", r["auto"] and r["chaines"][:2] == ["Spine", "Head"], r["chaines"])
    rig = u.assets[r["ik_rig"]]
    verifier("IK du corps entier automatique", rig.fbik)
    verifier("os du mouvement racine : root", rig.racine_mvt == "root")
    rtg = u.assets[r["retargeter"]]
    verifier("retargeter : source et cible", rtg.source is u.assets["/Game/Characters/Mannequins/Rigs/IK_Mannequin"] and rtg.cible is rig)
    verifier("retargeter : opérations, chaînes, alignement", rtg.ops == 1 and rtg.carte == "FUZZY" and rtg.aligne == ("TARGET", "CHAIN_TO_CHAIN"))
    verifier("footballeurs branchés sur le maillage", u.assets["/Game/LinkFoot/Data/DA_Personnages"].maillage_par_defaut is u.assets[r["maillage"]])

    print("2. squelette non reconnu : les chaînes du mannequin posées à la main")
    u = faux_unreal(auto_reconnu=False)
    m = charger(u)
    r = m.tout(fbx)
    rig = u.assets[r["ik_rig"]]
    verifier("11 chaînes posées", r["chaines"] == [c[0] for c in m.CHAINES], r["chaines"])
    verifier("racine du reciblage : pelvis", rig.racine == "pelvis")
    verifier("buts des mains et des pieds", rig.buts == {"LeftArmGoal": "hand_l", "RightArmGoal": "hand_r", "LeftLegGoal": "foot_l", "RightLegGoal": "foot_r"}, rig.buts)
    verifier("ni retargeter ni branchement sans leurs assets", "retargeter" not in r and "branche" not in r)

    print("3. rien n'est supposé : un asset absent arrête tout, en le nommant")
    u = faux_unreal()
    m = charger(u)
    try:
        m.retargeter("/Game/N/Existe/Pas", "/Game/X")
        verifier("IK Rig source absent refusé", False)
    except ValueError as e:
        verifier("IK Rig source absent refusé", "introuvable" in str(e), str(e))
    try:
        m.brancher("/Game/LinkFoot/Data/DA_Absent", "/Game/X")
        verifier("asset de définitions absent refusé", False)
    except ValueError as e:
        verifier("asset de définitions absent refusé", "introuvable" in str(e), str(e))

    print("ÉCHECS : " + ", ".join(ECHECS) if ECHECS else "tout passe")
    return 1 if ECHECS else 0


if __name__ == "__main__":
    sys.exit(main())
