"""LinkFoot : un personnage riggé importé dans Unreal 5.8 et branché aux footballeurs.

Deux personnages sont prêts, préparés pour Unreal avec le même squelette : la base technique
temporaire (option A), le Quaternius « Animated Men » (CC0),
`SourceArt/Characters/Players/Quaternius/SK_LinkFoot_Quaternius.fbx` ; et le footballeur de
Gameplay Football (domaine public), `SourceArt/Characters/Players/GameplayFootball/SK_LinkFoot_GPF.fbx`.
Son squelette porte les noms du mannequin d'Unreal (root, pelvis, spine_01 à spine_03, neck_01,
head, clavicle, upperarm, lowerarm, hand, thigh, calf, foot, ball) : le personnage réaliste qui
le remplacera n'aura qu'à suivre la même convention, ces fonctions resteront les mêmes.

A lancer DANS l'éditeur d'Unreal 5.8 (plugins IK Rig et Python Editor Script activés). Ce dossier
(Content/Python) est sur le chemin de Python de l'éditeur ; dans l'Output Log, mode « Python » :

    import personnage_linkfoot as pl
    r = pl.tout("C:/.../link/unreal/LinkFoot/SourceArt/Characters/Players/Quaternius/SK_LinkFoot_Quaternius.fbx",
                source_ik_rig="/Game/Characters/Mannequins/Rigs/IK_Mannequin",
                definitions="/Game/LinkFoot/Data/DA_Personnages")
    print(r)

Ou pas à pas : pl.importer(...), pl.ik_rig(...), pl.retargeter(...), pl.brancher(...).

Ce que ça fait :
  1. importer : le FBX en Skeletal Mesh (avec son squelette), dans le dossier demandé ;
  2. ik_rig : l'IK Rig du personnage ; les chaînes de reciblage reconnues automatiquement
     (apply_auto_generated_retarget_definition), sinon posées à la main d'après les noms du
     mannequin ; la racine du reciblage sur le bassin ; l'IK du corps entier automatique
     (apply_auto_fbik) ;
  3. retargeter : un IK Retargeter depuis un IK Rig source qui existe déjà dans le projet (celui
     du mannequin d'Unreal ou du Game Animation Sample : le chemin est à donner, rien n'est
     supposé), opérations par défaut, chaînes associées par leurs noms, os alignés ;
  4. brancher : le maillage devient le maillage par défaut des footballeurs dans l'asset de
     définitions (classe LFDefinitionsPersonnages).

Ce qu'il ne fait pas : il ne crée ni l'Animation Blueprint, ni la base Pose Search (ce sont des
graphes et des réglages faits dans l'éditeur, docs/ue5) ; il ne télécharge rien.

Seules des fonctions relevées dans la documentation Python d'Epic pour Unreal 5.8 sont appelées
(API_UTILISEE, vérifié par unreal/tests-python/test_personnage.py contre un faux module).
Rien n'a été exécuté dans un vrai Unreal par l'auteur de ce script : l'environnement de travail
n'en avait pas. Le premier essai dans l'éditeur dira ce que le faux module ne peut pas dire.
"""
try:
    import unreal  # présent seulement dans l'éditeur d'Unreal
except ImportError:  # les tests (unreal/tests-python) fournissent un faux module
    unreal = None

# Ce que le script appelle de l'API d'Unreal 5.8 (documentation Python d'Epic, application_version=5.8) :
#   AssetImportTask (filename, destination_path, automated, replace_existing, save ; get_objects) ;
#   AssetToolsHelpers.get_asset_tools, AssetTools.import_asset_tasks, AssetTools.create_asset ;
#   EditorAssetLibrary.load_asset, does_asset_exist, save_loaded_asset, make_directory, does_directory_exist ;
#   IKRigDefinitionFactory.create_new_ik_rig_asset ; IKRigController.get_controller, set_skeletal_mesh,
#     apply_auto_generated_retarget_definition, get_retarget_chains, set_retarget_root, add_new_goal,
#     add_retarget_chain, apply_auto_fbik, set_root_motion_bone ;
#   IKRetargetFactory ; IKRetargeterController.get_controller, set_ik_rig, add_default_ops, auto_map_chains,
#     auto_align_all_bones ; RetargetSourceOrTarget (SOURCE, TARGET) ; AutoMapChainType (FUZZY) ;
#   RetargetAutoAlignMethod (CHAIN_TO_CHAIN) ; BoneChain (chain_name) ; SkeletalMesh, IKRigDefinition, IKRetargeter.
API_UTILISEE = (
    "AssetImportTask", "AssetToolsHelpers.get_asset_tools", "AssetTools.import_asset_tasks", "AssetTools.create_asset",
    "EditorAssetLibrary.load_asset", "EditorAssetLibrary.does_asset_exist", "EditorAssetLibrary.save_loaded_asset",
    "EditorAssetLibrary.make_directory", "EditorAssetLibrary.does_directory_exist",
    "IKRigDefinitionFactory.create_new_ik_rig_asset", "IKRigController.get_controller",
    "IKRigController.set_skeletal_mesh", "IKRigController.apply_auto_generated_retarget_definition",
    "IKRigController.get_retarget_chains", "IKRigController.set_retarget_root", "IKRigController.add_new_goal",
    "IKRigController.add_retarget_chain", "IKRigController.apply_auto_fbik", "IKRigController.set_root_motion_bone",
    "IKRetargetFactory", "IKRetargeterController.get_controller", "IKRetargeterController.set_ik_rig",
    "IKRetargeterController.add_default_ops", "IKRetargeterController.auto_map_chains",
    "IKRetargeterController.auto_align_all_bones", "RetargetSourceOrTarget", "AutoMapChainType",
    "RetargetAutoAlignMethod", "BoneChain.chain_name", "SkeletalMesh", "IKRigDefinition", "IKRetargeter",
)

DOSSIER = "/Game/LinkFoot/Characters/Players/Quaternius"

# les chaînes de reciblage d'un squelette aux noms du mannequin, si la reconnaissance automatique
# n'en trouve pas : (nom de la chaîne, premier os, dernier os, os du but ou None)
CHAINES = (
    ("Spine", "spine_01", "spine_03", None),
    ("Neck", "neck_01", "neck_01", None),
    ("Head", "head", "head", None),
    ("LeftClavicle", "clavicle_l", "clavicle_l", None),
    ("LeftArm", "upperarm_l", "hand_l", "hand_l"),
    ("RightClavicle", "clavicle_r", "clavicle_r", None),
    ("RightArm", "upperarm_r", "hand_r", "hand_r"),
    ("LeftLeg", "thigh_l", "foot_l", "foot_l"),
    ("LeftToe", "ball_l", "ball_l", None),
    ("RightLeg", "thigh_r", "foot_r", "foot_r"),
    ("RightToe", "ball_r", "ball_r", None),
)


def _exiger(chemin, quoi):
    if not unreal.EditorAssetLibrary.does_asset_exist(chemin):
        raise ValueError(f"{quoi} introuvable dans le projet : {chemin}")
    return unreal.EditorAssetLibrary.load_asset(chemin)


def importer(fichier_fbx, dossier=DOSSIER):
    """Le FBX en Skeletal Mesh. Rend le chemin du maillage importé."""
    if not unreal.EditorAssetLibrary.does_directory_exist(dossier):
        unreal.EditorAssetLibrary.make_directory(dossier)
    tache = unreal.AssetImportTask()
    tache.filename = fichier_fbx
    tache.destination_path = dossier
    tache.automated = True
    tache.replace_existing = True
    tache.save = True
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([tache])
    maillages = [o for o in tache.get_objects() if isinstance(o, unreal.SkeletalMesh)]
    if not maillages:
        raise RuntimeError(f"aucun Skeletal Mesh importé depuis {fichier_fbx} (objets : {tache.imported_object_paths})")
    return maillages[0].get_path_name()


def ik_rig(maillage, nom="IK_LinkFoot_Quaternius", dossier=DOSSIER):
    """L'IK Rig du personnage. Rend (chemin de l'IK Rig, chaînes, reconnaissance automatique ou non)."""
    sk = _exiger(maillage, "le maillage")
    rig = unreal.IKRigDefinitionFactory.create_new_ik_rig_asset(dossier, nom)
    c = unreal.IKRigController.get_controller(rig)
    c.set_skeletal_mesh(sk)
    auto = bool(c.apply_auto_generated_retarget_definition())
    if not auto or not c.get_retarget_chains():
        # à la main, d'après les noms du mannequin
        c.set_retarget_root("pelvis")
        for chaine, debut, fin, os_but in CHAINES:
            but = c.add_new_goal(chaine + "Goal", os_but) if os_but else "None"
            c.add_retarget_chain(chaine, debut, fin, but)
    c.set_root_motion_bone("root")
    fbik = bool(c.apply_auto_fbik())
    unreal.EditorAssetLibrary.save_loaded_asset(rig)
    chaines = [str(ch.get_editor_property("chain_name")) for ch in c.get_retarget_chains()]
    return {"ik_rig": rig.get_path_name(), "chaines": chaines, "auto": auto, "fbik_auto": fbik}


def retargeter(source_ik_rig, cible_ik_rig, nom="RTG_Mannequin_vers_LinkFoot", dossier=DOSSIER):
    """Un IK Retargeter de l'IK Rig source (déjà dans le projet) vers celui du personnage."""
    src = _exiger(source_ik_rig, "l'IK Rig source")
    cib = _exiger(cible_ik_rig, "l'IK Rig cible")
    outils = unreal.AssetToolsHelpers.get_asset_tools()
    rtg = outils.create_asset(nom, dossier, unreal.IKRetargeter, unreal.IKRetargetFactory())
    c = unreal.IKRetargeterController.get_controller(rtg)
    c.set_ik_rig(unreal.RetargetSourceOrTarget.SOURCE, src)
    c.set_ik_rig(unreal.RetargetSourceOrTarget.TARGET, cib)
    c.add_default_ops()
    c.auto_map_chains(unreal.AutoMapChainType.FUZZY, True)
    # le personnage est en T, le mannequin en A : on aligne les os de la cible sur la source
    c.auto_align_all_bones(unreal.RetargetSourceOrTarget.TARGET, unreal.RetargetAutoAlignMethod.CHAIN_TO_CHAIN)
    unreal.EditorAssetLibrary.save_loaded_asset(rtg)
    return rtg.get_path_name()


def brancher(definitions, maillage):
    """Le maillage devient celui des footballeurs (asset de classe LFDefinitionsPersonnages)."""
    da = _exiger(definitions, "l'asset de définitions des personnages")
    sk = _exiger(maillage, "le maillage")
    da.set_editor_property("maillage_par_defaut", sk)
    unreal.EditorAssetLibrary.save_loaded_asset(da)
    return True


def noms(fichier_fbx):
    """Le dossier et les noms des assets d'un personnage, tirés de son fichier : le dossier de
    SourceArt qui le contient (Quaternius, GameplayFootball) et son nom sans « SK_ »."""
    parties = fichier_fbx.replace("\\", "/").split("/")
    nom = parties[-1].rsplit(".", 1)[0]
    court = nom[3:] if nom.startswith("SK_") else nom
    dossier = "/Game/LinkFoot/Characters/Players/" + (parties[-2] if len(parties) > 1 else court)
    return {"dossier": dossier, "ik_rig": "IK_" + court, "retargeter": "RTG_Mannequin_vers_" + court}


def tout(fichier_fbx, source_ik_rig=None, definitions=None, dossier=None):
    """Les quatre étapes ; le reciblage et le branchement seulement si leurs assets sont donnés.
    Les assets vont dans /Game/LinkFoot/Characters/Players/<dossier du FBX> (sauf dossier donné)."""
    n = noms(fichier_fbx)
    dossier = dossier or n["dossier"]
    rapport = {"maillage": importer(fichier_fbx, dossier)}
    rapport.update(ik_rig(rapport["maillage"], nom=n["ik_rig"], dossier=dossier))
    if source_ik_rig:
        rapport["retargeter"] = retargeter(source_ik_rig, rapport["ik_rig"], nom=n["retargeter"], dossier=dossier)
    if definitions:
        rapport["branche"] = brancher(definitions, rapport["maillage"])
    return rapport
