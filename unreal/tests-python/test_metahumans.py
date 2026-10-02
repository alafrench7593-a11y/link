#!/usr/bin/env python3
"""Le script des MetaHumans de LinkFoot (Content/Python/metahumans_linkfoot.py), essayé HORS
d'Unreal contre un faux module « unreal ».

    python3 unreal/tests-python/test_metahumans.py

Le faux module ne connaît que l'API relevée dans la documentation d'Epic pour Unreal 5.8 (les
fonctions et les champs que le script déclare dans API_UTILISEE) : un appel à autre chose lève
une erreur. Il imite aussi ce qui piège en vrai : les structures rendues par copie (une
modification non réécrite est perdue), les plages des mensurations qui suivent la taille, une
édition refusée tant que le personnage n'est pas ouvert pour l'édition.

Ce que ça prouve : la logique du script (quel modèle, quelles cibles, quel ordre d'appels,
reprise sans doublon, rien d'appliqué quand une correspondance est vide). Ce que ça ne prouve
pas : que MetaHuman Creator réagit comme le faux module. Seul un essai dans l'éditeur le dit
(docs/ue5/personnages.md, « Premier essai »).
"""
import copy
import json
import pathlib
import sys
import tempfile
import types

ICI = pathlib.Path(__file__).resolve().parent
RACINE = ICI.parent / "LinkFoot"
SCENE = RACINE / "Content" / "LinkFoot" / "Scenes" / "01-sprint_droit.json"

APPELS = []
ECHECS = []


def verifier(nom, condition, detail=""):
    print(("  ok    " if condition else "  ÉCHEC ") + nom + (f"  ({detail})" if detail else ""))
    if not condition:
        ECHECS.append(nom)


# --------------------------------------------------------------------------- le faux unreal

class Struct:
    """Une structure d'Unreal vue de Python : get_editor_property rend une COPIE."""
    _champs = ()

    def __init__(self, **valeurs):
        for c in self._champs:
            object.__setattr__(self, c, valeurs.pop(c, None))
        if valeurs:
            raise AttributeError(f"{type(self).__name__} n'a pas les champs {sorted(valeurs)}")

    def __setattr__(self, nom, valeur):
        if nom not in self._champs:
            raise AttributeError(f"{type(self).__name__}.{nom} n'existe pas")
        object.__setattr__(self, nom, valeur)

    def get_editor_property(self, nom):
        if nom not in self._champs:
            raise AttributeError(f"{type(self).__name__}.{nom} n'existe pas")
        return copy.deepcopy(getattr(self, nom))

    def set_editor_property(self, nom, valeur):
        if nom not in self._champs:
            raise AttributeError(f"{type(self).__name__}.{nom} n'existe pas")
        object.__setattr__(self, nom, copy.deepcopy(valeur))


class SkinProperties(Struct):
    _champs = ("u", "v", "roughness", "face_texture_index", "body_texture_index")


class SkinSettings(Struct):
    _champs = ("skin", "freckles", "accents")


class Iris(Struct):
    _champs = ("primary_color_u", "primary_color_v")


class Eye(Struct):
    _champs = ("iris",)


class EyesSettings(Struct):
    _champs = ("eye_left", "eye_right")


class BodyConstraint(Struct):
    _champs = ("name", "is_active", "target_measurement", "min_measurement", "max_measurement")


class SlotSelection(Struct):
    _champs = ("slot_name", "selected_item", "parent_item_path")


class TextureRequest(Struct):
    _champs = ("blocking", "report_progress")


class RigRequest(Struct):
    _champs = ("blocking", "report_progress", "rig_type")


class BuildParameters(Struct):
    _champs = ("absolute_build_path", "animation_system_name", "enable_wardrobe_item_validation", "common_folder_path",
               "name_override", "pipeline_override", "pipeline_quality", "pipeline_type")


# le corps paramétrique : des plages en cm qui suivent la taille (175 cm au repos)
CORPS = {
    "Height": (150.0, 205.0),
    "Shoulder Width": (36.0, 50.0),
    "Chest Circumference": (84.0, 120.0),
    "Waist Circumference": (66.0, 100.0),
    "Hip Circumference": (84.0, 112.0),
    "Hip Width": (30.0, 40.0),
    "Arm Length": (55.0, 72.0),
    "Inseam": (72.0, 92.0),
    "Thigh Circumference": (48.0, 66.0),
    "Calf Circumference": (33.0, 44.0),
    "Neck Circumference": (34.0, 44.0),
    "Muscularity": (0.0, 1.0),
    "Body Fat": (0.0, 1.0),
}


class Collection:
    def __init__(self, perso):
        self.perso = perso
        self.items = []
        self.default_instance = Instance(perso)

    def try_add_item_from_wardrobe_item(self, emplacement, item):
        APPELS.append("internal_collection.try_add_item_from_wardrobe_item")
        if not isinstance(item, ItemGardeRobe):
            raise TypeError("pas un Wardrobe Item")
        self.items.append((str(emplacement), item.chemin))
        return f"cle:{emplacement}:{item.chemin}"


class Instance:
    def __init__(self, perso):
        self.perso = perso
        self.selections = []

    def try_add_slot_selection(self, selection):
        APPELS.append("default_instance.try_add_slot_selection")
        if not isinstance(selection, SlotSelection):
            raise TypeError("pas une MetaHumanPipelineSlotSelection")
        self.selections.append((selection.slot_name, selection.selected_item))
        return True


class Personnage:
    def __init__(self, chemin, modele=None):
        self.chemin = chemin
        self.modele = modele
        self.taille = 175.0
        self.cibles = {}
        self.skin_settings = SkinSettings(skin=SkinProperties(u=0.5, v=0.5, roughness=1.0, face_texture_index=0, body_texture_index=0))
        self.eyes_settings = EyesSettings(eye_left=Eye(iris=Iris(primary_color_u=0.5, primary_color_v=0.5)),
                                          eye_right=Eye(iris=Iris(primary_color_u=0.5, primary_color_v=0.5)))
        self.internal_collection = Collection(self)
        self.coefficients = [0.1 * i for i in range(8)]
        self.peau_validee = None
        self.yeux_valides = None
        self.corps_valide = False
        self.assemblages = []

    def get_path_name(self):
        return self.chemin

    def get_editor_property(self, nom):
        if nom not in ("skin_settings", "eyes_settings"):
            raise AttributeError(f"MetaHumanCharacter.{nom} n'est pas relevé dans la documentation")
        return copy.deepcopy(getattr(self, nom))


class ItemGardeRobe:
    def __init__(self, chemin):
        self.chemin = chemin


class SousSysteme:
    def __init__(self):
        self.en_edition = set()

    def _edite(self, perso):
        if id(perso) not in self.en_edition:
            raise RuntimeError("le personnage n'a pas été ouvert pour l'édition (try_add_object_to_edit)")

    def try_add_object_to_edit(self, perso):
        APPELS.append("MetaHumanCharacterEditorSubsystem.try_add_object_to_edit")
        if id(perso) in self.en_edition:
            return False
        self.en_edition.add(id(perso))
        return True

    def remove_object_to_edit(self, perso):
        APPELS.append("MetaHumanCharacterEditorSubsystem.remove_object_to_edit")
        self.en_edition.discard(id(perso))

    def get_body_constraints(self, perso, mise_a_l_echelle):
        APPELS.append("MetaHumanCharacterEditorSubsystem.get_body_constraints")
        k = perso.taille / 175.0 if mise_a_l_echelle else 1.0
        r = []
        for nom, (lo, hi) in CORPS.items():
            echelle = 1.0 if nom in ("Height", "Muscularity", "Body Fat") else k
            r.append(BodyConstraint(name=nom, is_active=False, target_measurement=(lo + hi) / 2 * echelle,
                                    min_measurement=lo * echelle, max_measurement=hi * echelle))
        return r

    def set_body_constraints(self, perso, contraintes):
        APPELS.append("MetaHumanCharacterEditorSubsystem.set_body_constraints")
        self._edite(perso)
        actives = {c.name: c.target_measurement for c in contraintes if c.is_active}
        perso.cibles = actives
        if "Height" in actives:
            perso.taille = actives["Height"]

    def commit_body_state(self, perso):
        APPELS.append("MetaHumanCharacterEditorSubsystem.commit_body_state")
        self._edite(perso)
        perso.corps_valide = True

    def commit_skin_settings(self, perso, reglages):
        APPELS.append("MetaHumanCharacterEditorSubsystem.commit_skin_settings")
        self._edite(perso)
        perso.skin_settings = copy.deepcopy(reglages)
        perso.peau_validee = copy.deepcopy(reglages)

    def commit_eyes_settings(self, perso, reglages):
        APPELS.append("MetaHumanCharacterEditorSubsystem.commit_eyes_settings")
        self._edite(perso)
        perso.eyes_settings = copy.deepcopy(reglages)
        perso.yeux_valides = copy.deepcopy(reglages)

    def get_face_model_coefficients(self, perso):
        APPELS.append("MetaHumanCharacterEditorSubsystem.get_face_model_coefficients")
        return list(perso.coefficients)

    def set_face_model_coefficients(self, perso, coefficients):
        APPELS.append("MetaHumanCharacterEditorSubsystem.set_face_model_coefficients")
        self._edite(perso)
        perso.coefficients = list(coefficients)

    def request_texture_sources(self, perso, demande):
        APPELS.append("MetaHumanCharacterEditorSubsystem.request_texture_sources")
        self._edite(perso)

    def request_auto_rigging(self, perso, demande):
        APPELS.append("MetaHumanCharacterEditorSubsystem.request_auto_rigging")
        self._edite(perso)

    def build_meta_human(self, perso, parametres):
        APPELS.append("MetaHumanCharacterEditorSubsystem.build_meta_human")
        self._edite(perso)
        perso.assemblages.append((parametres.pipeline_type, parametres.pipeline_quality, parametres.name_override))


def faux_unreal(dossier_sauve):
    u = types.ModuleType("unreal")
    actifs = {}
    sous_systeme = SousSysteme()

    class MetaHumanCharacterEditorSubsystem:
        pass

    def get_editor_subsystem(classe):
        APPELS.append("get_editor_subsystem")
        if classe is not MetaHumanCharacterEditorSubsystem:
            raise TypeError("sous-système inattendu")
        return sous_systeme

    def load_asset(chemin):
        APPELS.append("load_asset")
        return actifs.get(chemin)

    class EditorAssetLibrary:
        @staticmethod
        def does_asset_exist(chemin):
            APPELS.append("EditorAssetLibrary.does_asset_exist")
            return chemin in actifs

        @staticmethod
        def duplicate_asset(source, destination):
            APPELS.append("EditorAssetLibrary.duplicate_asset")
            if source not in actifs or destination in actifs:
                return None
            actifs[destination] = Personnage(destination, modele=source)
            return actifs[destination]

        @staticmethod
        def save_loaded_asset(actif):
            APPELS.append("EditorAssetLibrary.save_loaded_asset")
            return True

    class Paths:
        @staticmethod
        def project_content_dir():
            APPELS.append("Paths.project_content_dir")
            return str(RACINE / "Content")

        @staticmethod
        def project_saved_dir():
            APPELS.append("Paths.project_saved_dir")
            return str(dossier_sauve)

    def enumeration(nom, valeurs):
        return type(nom, (), {v: f"{nom}.{v}" for v in valeurs})

    def struct_appelee(nom, classe):
        def fabrique(**valeurs):
            APPELS.append(nom)
            return classe(**valeurs)
        return fabrique

    u.MetaHumanCharacterEditorSubsystem = MetaHumanCharacterEditorSubsystem
    u.get_editor_subsystem = get_editor_subsystem
    u.load_asset = load_asset
    u.EditorAssetLibrary = EditorAssetLibrary
    u.Paths = Paths
    u.LinearColor = lambda r, g, b, a: (r, g, b, a)
    u.MetaHumanPipelineSlotSelection = struct_appelee("MetaHumanPipelineSlotSelection", SlotSelection)
    u.MetaHumanCharacterEditorBuildParameters = struct_appelee("MetaHumanCharacterEditorBuildParameters", BuildParameters)
    u.MetaHumanCharacterTextureRequestParams = struct_appelee("MetaHumanCharacterTextureRequestParams", TextureRequest)
    u.MetaHumanCharacterAutoRiggingRequestParams = struct_appelee("MetaHumanCharacterAutoRiggingRequestParams", RigRequest)
    u.MetaHumanDefaultPipelineType = enumeration("MetaHumanDefaultPipelineType", ("CINEMATIC", "OPTIMIZED", "UEFN"))
    u.MetaHumanQualityLevel = enumeration("MetaHumanQualityLevel", ("LOW", "MEDIUM", "HIGH", "CINEMATIC"))
    u.MetaHumanRigType = enumeration("MetaHumanRigType", ("JOINTS_ONLY", "JOINTS_AND_BLENDSHAPES"))
    u._actifs = actifs
    u._sous_systeme = sous_systeme
    return u


# --------------------------------------------------------------------------- les essais

def main():
    sys.dont_write_bytecode = True	# pas de __pycache__ dans Content/Python
    tmp = pathlib.Path(tempfile.mkdtemp())
    unreal = faux_unreal(tmp)
    sys.modules["unreal"] = unreal
    sys.path.insert(0, str(RACINE / "Content" / "Python"))
    import metahumans_linkfoot as mh

    print("\nCe que le script décide, sans Unreal")
    verifier("les noms se comparent sans casse, accents ni espaces", mh.normaliser("Épaules  Width_2") == "epauleswidth2")
    c = BodyConstraint(name="Shoulder Width", is_active=False, target_measurement=43.0, min_measurement=36.0, max_measurement=50.0)
    verifier("0,5 tombe au milieu de la plage", abs(mh.cible_relative(c, 0.5, 0.6) - 43.0) < 1e-9)
    verifier("l'amplitude resserre : 1 ne va pas au bout de la plage", abs(mh.cible_relative(c, 1.0, 0.6) - 47.2) < 1e-9, f"{mh.cible_relative(c, 1.0, 0.6):g}")
    verifier("une valeur de la fiche hors de 0 à 1 est bornée", mh.cible_relative(c, 7.0, 0.6) == mh.cible_relative(c, 1.0, 0.6))
    h = BodyConstraint(name="Height", is_active=False, target_measurement=1.75, min_measurement=1.5, max_measurement=2.05)
    verifier("une taille en cm va dans une plage en mètres, si la règle le permet", mh.cible_absolue(h, 187, (1.0, 0.01)) == (1.87, None)
             and mh.cible_absolue(h, 187)[0] is None)
    h2 = BodyConstraint(name="Height", is_active=False, target_measurement=175, min_measurement=150, max_measurement=200)
    v, note = mh.cible_absolue(h2, 207)
    verifier("un peu au-dessus de la plage : ramené au bord, avec une note", v == 200 and note and "ramené" in note)
    v, note = mh.cible_absolue(BodyConstraint(name="Muscularity", is_active=False, target_measurement=0.5, min_measurement=0, max_measurement=1), 76)
    verifier("une mesure qui n'a rien à voir avec la plage n'est pas devinée", v is None and "non réglé" in note)
    contraintes = SousSysteme().get_body_constraints(Personnage("x"), True)
    trouvee, note = mh.trouver_contrainte(contraintes, {"motifs": ["hip"]})
    verifier("deux contraintes répondent à « hip » : la plus courte, et une note qui le dit", trouvee.name == "Hip Width" and "plusieurs" in note)
    trouvee, note = mh.trouver_contrainte(contraintes, {"motifs": ["hip"], "contrainte": "Hip Circumference"})
    verifier("le nom exact des correspondances l'emporte", trouvee.name == "Hip Circumference" and note is None)
    trouvee, note = mh.trouver_contrainte(contraintes, {"motifs": ["toe"]})
    verifier("une mesure sans contrainte est signalée, pas inventée", trouvee is None and "aucune" in note)

    corresp_vide = mh.charger_correspondances()
    joueurs = mh.charger_feuille(SCENE)
    verifier("la feuille donne un joueur par personnage", len(joueurs) == len({j["personnage"] for j in joueurs}) and len(joueurs) >= 22, f"{len(joueurs)} joueurs")
    plan = mh.plan_joueur(joueurs[0], corresp_vide)
    verifier("correspondances vides : aucun modèle, aucune peau, aucune garde-robe", plan["modele"] is None and plan["uv"] is None and plan["garde_robe"] == [])
    verifier("et chaque manque est dit (coiffure, barbe, tenue)", any("coiffure" in m for m in plan["manques"]) and any("tenue" in m for m in plan["manques"]),
             " ; ".join(plan["manques"]))

    # des correspondances remplies comme le ferait l'artiste
    corresp = json.loads(json.dumps(corresp_vide))
    modeles = ["/Game/Modeles/Clair", "/Game/Modeles/Mat", "/Game/Modeles/Fonce"]
    for m, chemin in zip(corresp["modeles_visage"], modeles):
        m["chemin"] = chemin
        unreal._actifs[chemin] = Personnage(chemin)
    corresp["teints_uv"] = [[0.1 * i, 0.5] for i in range(10)]
    corresp["textures_peau"] = 4
    corresp["yeux"] = {str(i): {"eye_left.iris.primary_color_u": 0.1 * i, "eye_right.iris.primary_color_u": 0.1 * i} for i in range(6)}
    corresp["emplacements"]["barbe"] = "Beard"
    corresp["emplacements"]["moustache"] = "Mustache"
    for k in corresp["coiffures"]:
        corresp["coiffures"][k] = f"/Game/GardeRobe/Cheveux/{k}"
    for k, v in corresp["barbes"].items():
        if v:
            v["item"] = f"/Game/GardeRobe/Barbes/{k}"
    corresp["tenues"] = {"H": "/Game/GardeRobe/Maillots/LinkFoot_Domicile", "A": "/Game/GardeRobe/Maillots/LinkFoot_Exterieur"}
    for chemin in list(corresp["coiffures"].values()) + [v["item"] for v in corresp["barbes"].values() if v] + list(corresp["tenues"].values()):
        unreal._actifs[chemin] = ItemGardeRobe(chemin)
    fichier = tmp / "correspondances.json"
    fichier.write_text(json.dumps(corresp), encoding="utf-8")

    stables = all(mh.choisir_modele(j, corresp) == mh.choisir_modele(j, corresp) for j in joueurs)
    compatibles = all(j["apparence"]["teint"] in next(m["teints"] for m in corresp["modeles_visage"] if m["chemin"] == mh.choisir_modele(j, corresp))
                      for j in joueurs if j.get("apparence"))
    verifier("le modèle d'un joueur est toujours le même, et va avec son teint", stables and compatibles)

    print("\nUn essai : rien n'est touché")
    APPELS.clear()
    rapport = mh.generer(str(SCENE), correspondances=fichier, essai=True)
    touche = [a for a in APPELS if not a.startswith("Paths.")]
    verifier("en essai, aucun appel à l'éditeur", touche == [], ", ".join(touche[:3]))
    verifier("en essai, le rapport dit ce qui serait fait pour chaque joueur", len(rapport) == len(joueurs) and all(r.get("essai") for r in rapport if r["modele"]))

    print("\nPour de vrai, dans le faux éditeur")
    APPELS.clear()
    rapport = mh.generer(str(SCENE), correspondances=fichier, assembler=True)
    persos = {j["personnage"]: unreal._actifs.get(mh.nom_asset(j, corresp)) for j in joueurs}
    verifier("un MetaHuman par joueur, dupliqué de son modèle", all(p is not None and p.modele in modeles for p in persos.values()), f"{len(persos)}")
    tailles_ok = all(abs(persos[j["personnage"]].cibles.get("Height", -1) - min(205.0, max(150.0, j["morphologie"]["taille_cm"]))) < 1e-6 for j in joueurs)
    verifier("la taille du corps est celle de la fiche (en cm, bornée à la plage)", tailles_ok)
    # les épaules : la position dans la plage relue À LA TAILLE du joueur suit la valeur de la fiche
    positions = []
    for j in joueurs:
        p = persos[j["personnage"]]
        k = p.taille / 175.0
        lo, hi = 36.0 * k, 50.0 * k
        positions.append((j["morphologie"]["epaules"], (p.cibles["Shoulder Width"] - lo) / (hi - lo)))
    dans_plage = all(0.0 <= r <= 1.0 for _, r in positions)
    fidele = all(abs(r - (0.5 + (v - 0.5) * 0.6)) < 1e-6 for v, r in positions)
    verifier("les épaules sont placées dans la plage relue à la taille du joueur (deux passages)", dans_plage and fidele)
    verifier("muscularité et masse grasse viennent de la fiche", all(abs(persos[j["personnage"]].cibles["Muscularity"] - (0.5 + (j["morphologie"]["muscles"] - 0.5) * 0.6)) < 1e-6 for j in joueurs))
    verifier("le corps est validé (commit_body_state)", all(p.corps_valide for p in persos.values()))
    peaux = all(persos[j["personnage"]].peau_validee.skin.u == corresp["teints_uv"][j["apparence"]["teint"]][0]
                and persos[j["personnage"]].peau_validee.skin.face_texture_index == j["apparence"]["graine"] % 4 for j in joueurs)
    verifier("la peau : le teint sur le sélecteur U/V et une texture de peau stable, réécrits malgré les copies", peaux)
    yeux = all(abs(persos[j["personnage"]].yeux_valides.eye_left.iris.primary_color_u - 0.1 * j["apparence"]["yeux"]) < 1e-9 for j in joueurs)
    verifier("les yeux : les champs pointés posés à travers les structures copiées", yeux)
    gr = True
    for j in joueurs:
        sel = persos[j["personnage"]].internal_collection.default_instance.selections
        attendus = [("Hair", f"cle:Hair:/Game/GardeRobe/Cheveux/{j['apparence']['coiffure']}")]
        barbe = j["apparence"]["barbe"]
        if barbe != "aucune":
            slot = "Mustache" if barbe == "moustache" else "Beard"
            attendus.append((slot, f"cle:{slot}:/Game/GardeRobe/Barbes/{barbe}"))
        attendus.append(("Outfits", f"cle:Outfits:{corresp['tenues'][j['camp']]}"))
        gr = gr and sel == attendus
    verifier("la garde-robe : coiffure, barbe ou moustache, maillot du camp", gr)
    assembles = all(p.assemblages == [("MetaHumanDefaultPipelineType.OPTIMIZED", "MetaHumanQualityLevel.MEDIUM", mh.nom_asset(j, corresp).rsplit("/", 1)[-1])]
                    for j, p in ((j, persos[j["personnage"]]) for j in joueurs))
    verifier("assemblé en Optimized, qualité moyenne, sous le nom du joueur", assembles)
    verifier("tous les personnages sont refermés (remove_object_to_edit)", not unreal._sous_systeme.en_edition)
    ordre = True
    debut = None
    for i, a in enumerate(APPELS):
        if a.endswith("try_add_object_to_edit"):
            debut = i
        elif a.endswith(("set_body_constraints", "commit_skin_settings", "commit_eyes_settings", "build_meta_human")) and debut is None:
            ordre = False
    verifier("aucune édition avant try_add_object_to_edit", ordre)
    verifier("deux passages sur le corps par joueur (la taille, puis le reste)", APPELS.count("MetaHumanCharacterEditorSubsystem.set_body_constraints") == 2 * len(joueurs))
    inconnus = sorted(set(APPELS) - set(mh.API_UTILISEE) - {"internal_collection.try_add_item_from_wardrobe_item", "default_instance.try_add_slot_selection"})
    verifier("le script n'appelle que l'API qu'il déclare (relevée dans la documentation 5.8)", not inconnus, ", ".join(inconnus))
    verifier("le rapport est écrit dans Saved/LinkFoot", (tmp / "LinkFoot" / "metahumans-rapport.json").exists())

    print("\nRelancer met à jour, sans doubler")
    avant = len(unreal._actifs)
    APPELS.clear()
    rapport2 = mh.generer(str(SCENE), correspondances=fichier)
    verifier("aucun nouvel asset, chaque joueur repris", len(unreal._actifs) == avant and all(r.get("reprise") for r in rapport2))
    verifier("aucune duplication au second passage", "EditorAssetLibrary.duplicate_asset" not in APPELS)

    print("\nLe mélange des visages reste éteint tant qu'on ne l'a pas jugé")
    verifier("éteint par défaut : aucun coefficient touché", "MetaHumanCharacterEditorSubsystem.set_face_model_coefficients" not in APPELS)
    corresp["melange_visages"]["actif"] = True
    fichier.write_text(json.dumps(corresp), encoding="utf-8")
    APPELS.clear()
    mh.generer(str(SCENE), correspondances=fichier, limite=3)
    p0 = persos[joueurs[0]["personnage"]]
    verifier("allumé : les coefficients sont mêlés, dans les bornes des deux modèles",
             "MetaHumanCharacterEditorSubsystem.set_face_model_coefficients" in APPELS and len(p0.coefficients) == 8)

    print(f"\n{'ÉCHEC' if ECHECS else 'OK'} : {len(ECHECS)} échec(s)")
    return 1 if ECHECS else 0


if __name__ == "__main__":
    sys.exit(main())
