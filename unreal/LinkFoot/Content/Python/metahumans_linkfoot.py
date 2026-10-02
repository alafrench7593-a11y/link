"""LinkFoot : un MetaHuman par footballeur, depuis les fiches que le moteur envoie.

A lancer DANS l'éditeur d'Unreal 5.8, plugins MetaHuman Creator et Python Editor Script
activés. Ce dossier (Content/Python) est sur le chemin de Python de l'éditeur ; dans
l'Output Log, mode « Python » :

    import metahumans_linkfoot as mh
    mh.lister("/Game/LinkFoot/MetaHumans/Modeles/MHC_Modele01")      # les contraintes du corps
    mh.generer("LinkFoot/Scenes/01-sprint_droit.json", essai=True)   # ce qui serait fait
    mh.generer("LinkFoot/Scenes/01-sprint_droit.json")               # le faire

Pour chaque joueur de la feuille du document (scène de test ou match entier), il :
  1. duplique un modèle de visage fait à la main dans MetaHuman Creator (choisi de façon stable
     d'après la graine du joueur, parmi les modèles compatibles avec son teint) ; s'il existe
     déjà, il le reprend : relancer le script met à jour au lieu de doubler ;
  2. règle le corps paramétrique : la taille d'abord, puis, les plages relues à cette taille,
     les mensurations (épaules, poitrine, taille, hanches, bras, cuisses, mollets, cou...) tirées
     de la morphologie de la fiche (cahier « qualité visuelle » §8 à §12) ;
  3. pose la peau (le teint 0 à 9 de la fiche, sur le sélecteur U/V de MetaHuman), la texture
     de peau (pores, imperfections), les yeux ;
  4. ajoute la coiffure, la barbe et la tenue depuis la garde-robe (des Wardrobe Items) ;
  5. sur demande, demande les textures et le rig du visage aux services d'Epic, puis assemble
     le personnage (pipeline Optimized par défaut : vingt-deux joueurs à l'écran).

Ce qu'il ne fait pas : il ne crée aucun visage à partir de rien, ne copie aucun visage réel,
n'utilise aucun fichier d'un autre jeu. Les visages viennent des modèles que l'artiste fait
dans MetaHuman Creator ; le script les décline, joueur par joueur.

Seules des fonctions relevées dans la documentation d'Epic pour Unreal 5.8 sont appelées
(API_UTILISEE, vérifié par unreal/tests-python). Ce que la documentation ne dit pas (les noms
des contraintes régionales et leurs unités, les champs des yeux, le nom de l'emplacement de la
barbe, les U/V de chaque teint) vient du fichier de correspondances, que l'artiste complète en
regardant ses propres modèles (mh.lister) : une entrée vide n'est pas appliquée, elle est
signalée dans le rapport.
"""
import json
import os
import pathlib
import unicodedata

try:
    import unreal  # présent seulement dans l'éditeur d'Unreal
except ImportError:  # les tests (unreal/tests-python) fournissent un faux module
    unreal = None

ICI = pathlib.Path(__file__).resolve().parent
CORRESPONDANCES = ICI / "metahumans_linkfoot.json"

# Ce que le script appelle de l'API d'Unreal 5.8, et où c'est documenté :
#   metahuman-creator-python-scripting-in-unreal-engine (MetaHuman 5.8) : get_editor_subsystem,
#     MetaHumanCharacterEditorSubsystem (try_add_object_to_edit, remove_object_to_edit,
#     get_body_constraints, set_body_constraints, commit_body_state, commit_skin_settings,
#     commit_eyes_settings, get_face_model_coefficients, set_face_model_coefficients,
#     request_texture_sources, request_auto_rigging, build_meta_human), internal_collection
#     (try_add_item_from_wardrobe_item, default_instance.try_add_slot_selection) ;
#   la référence C++ 5.8 : FMetaHumanCharacterBodyConstraint (Name, bIsActive, TargetMeasurement,
#     MinMeasurement, MaxMeasurement), FMetaHumanCharacterSkinSettings (Skin),
#     FMetaHumanCharacterSkinProperties (U, V, Roughness, FaceTextureIndex, BodyTextureIndex),
#     FMetaHumanPipelineSlotSelection (SlotName, SelectedItem), FMetaHumanCharacterEditorBuildParameters
#     (PipelineType, PipelineQuality, NameOverride), GetBodyConstraints(Character,
#     bScaleMeasurementRangesWithHeight) ;
#   Editor Scripting Utilities : EditorAssetLibrary (does_asset_exist, duplicate_asset,
#     save_loaded_asset), load_asset, Paths.
API_UTILISEE = (
    "get_editor_subsystem", "load_asset", "Paths.project_content_dir", "Paths.project_saved_dir",
    "EditorAssetLibrary.does_asset_exist", "EditorAssetLibrary.duplicate_asset", "EditorAssetLibrary.save_loaded_asset",
    "MetaHumanCharacterEditorSubsystem.try_add_object_to_edit", "MetaHumanCharacterEditorSubsystem.remove_object_to_edit",
    "MetaHumanCharacterEditorSubsystem.get_body_constraints", "MetaHumanCharacterEditorSubsystem.set_body_constraints",
    "MetaHumanCharacterEditorSubsystem.commit_body_state", "MetaHumanCharacterEditorSubsystem.commit_skin_settings",
    "MetaHumanCharacterEditorSubsystem.commit_eyes_settings", "MetaHumanCharacterEditorSubsystem.get_face_model_coefficients",
    "MetaHumanCharacterEditorSubsystem.set_face_model_coefficients", "MetaHumanCharacterEditorSubsystem.request_texture_sources",
    "MetaHumanCharacterEditorSubsystem.request_auto_rigging", "MetaHumanCharacterEditorSubsystem.build_meta_human",
    "MetaHumanCharacterTextureRequestParams", "MetaHumanCharacterAutoRiggingRequestParams", "MetaHumanRigType",
    "MetaHumanPipelineSlotSelection", "MetaHumanCharacterEditorBuildParameters", "MetaHumanDefaultPipelineType",
    "MetaHumanQualityLevel",
)


# --------------------------------------------------------------------------- sans Unreal
# Tout ce qui décide (quel modèle, quelle mensuration, quel teint) est ici, testable hors
# d'Unreal ; la partie Unreal ne fait qu'appliquer.

def normaliser(texte):
    """« Shoulder Width » -> « shoulderwidth » ; « épaules » -> « epaules »."""
    t = unicodedata.normalize("NFKD", str(texte)).encode("ascii", "ignore").decode("ascii")
    return "".join(c for c in t.lower() if c.isalnum())


def charger_correspondances(chemin=None):
    with open(chemin or CORRESPONDANCES, encoding="utf-8") as f:
        return json.load(f)


def charger_feuille(chemin):
    """Les joueurs d'un document du moteur (« linkfoot-match », passerelle) : une entrée par
    personnage, dans l'ordre des codes."""
    with open(chemin, encoding="utf-8") as f:
        doc = json.load(f)
    if doc.get("format") != "linkfoot-match":
        raise ValueError(f"{chemin} n'est pas un document « linkfoot-match »")
    vus, joueurs = set(), []
    for j in doc.get("joueurs", []):
        if j.get("personnage") and j["personnage"] not in vus and j.get("morphologie"):
            vus.add(j["personnage"])
            joueurs.append(j)
    return joueurs


def nom_asset(joueur, corresp):
    brut = "".join(c if c.isalnum() else "_" for c in str(joueur["personnage"]))
    return corresp["dossier_sortie"].rstrip("/") + "/" + corresp.get("prefixe", "MHC_") + brut


def choisir_modele(joueur, corresp):
    """Le modèle de visage du joueur : parmi ceux dont la plage de teints contient le sien (tous
    si aucun), le même à chaque fois pour le même joueur (sa graine)."""
    modeles = [m for m in corresp.get("modeles_visage", []) if m.get("chemin")]
    if not modeles:
        return None
    teint = int(joueur.get("apparence", {}).get("teint", 0))
    compatibles = [m for m in modeles if teint in m.get("teints", range(10))] or modeles
    graine = int(joueur.get("apparence", {}).get("graine", 0))
    return compatibles[graine % len(compatibles)]["chemin"]


def trouver_contrainte(contraintes, regle):
    """La contrainte du corps qui répond à une règle : son nom exact s'il est donné, sinon la
    plus courte dont le nom contient un des motifs. Rend (contrainte, note)."""
    noms = {normaliser(c.name): c for c in contraintes}
    if regle.get("contrainte"):
        c = noms.get(normaliser(regle["contrainte"]))
        return (c, None) if c else (None, f"contrainte « {regle['contrainte']} » absente du modèle")
    candidates = sorted({n for n in noms for m in regle.get("motifs", []) if normaliser(m) in n}, key=lambda n: (len(n), n))
    if not candidates:
        return None, "aucune contrainte ne répond aux motifs " + ", ".join(regle.get("motifs", []))
    note = None
    if len(candidates) > 1:
        note = f"plusieurs contraintes possibles ({', '.join(candidates)}), prise : {candidates[0]} ; le préciser dans « contrainte »"
    return noms[candidates[0]], note


def plage(c):
    lo, hi = getattr(c, "min_measurement", None), getattr(c, "max_measurement", None)
    if lo is None or hi is None or not hi > lo:
        return None
    return float(lo), float(hi)


def cible_relative(c, valeur01, amplitude):
    """Une valeur de 0 à 1 de la fiche dans la plage de la contrainte, resserrée autour du milieu
    (amplitude 0,6 : on reste dans des corps d'athlètes plausibles)."""
    p = plage(c)
    if p is None:
        return None
    lo, hi = p
    v = min(1.0, max(0.0, float(valeur01)))
    return lo + (hi - lo) * (0.5 + (v - 0.5) * amplitude)


def cible_absolue(c, valeur, echelles=(1.0,)):
    """Une mesure (la taille en cm, le poids en kg) : telle quelle si elle tombe dans la plage,
    sinon à une des échelles permises par la règle (cm -> m : 0,01) qui l'y fait tomber. Une valeur un peu hors de la plage (moins de
    20 %) y est ramenée, avec une note ; au-delà, rien : on ne devine pas une unité."""
    p = plage(c)
    if p is None:
        return float(valeur), None
    lo, hi = p
    meilleur = None
    for e in echelles:
        v = float(valeur) * e
        if lo <= v <= hi:
            return v, None
        ecart = (lo - v) / lo if v < lo else (v - hi) / hi
        if meilleur is None or ecart < meilleur[0]:
            meilleur = (ecart, min(hi, max(lo, v)))
    if meilleur is not None and meilleur[0] < 0.2:
        return meilleur[1], f"{valeur} hors de la plage [{lo:g}, {hi:g}] de « {c.name} », ramené à {meilleur[1]:g}"
    return None, f"{valeur} hors de la plage [{lo:g}, {hi:g}] de « {c.name} », à toutes les échelles : non réglé"


def plan_corps(joueur, contraintes, corresp, seulement=None):
    """Les cibles du corps : [(nom de la contrainte, cible)] et les notes. seulement : les clés de
    la fiche à traiter (la taille seule au premier passage)."""
    morpho = joueur.get("morphologie", {})
    cibles, notes = [], []
    for cle, regle in corresp.get("corps", {}).items():
        if seulement is not None and cle not in seulement:
            continue
        if cle not in morpho:
            continue
        c, note = trouver_contrainte(contraintes, regle)
        if note:
            notes.append(f"{cle} : {note}")
        if c is None:
            continue
        if regle.get("mode") == "absolu":
            cible, note2 = cible_absolue(c, morpho[cle], tuple(float(e) for e in regle.get("echelles", [1.0])))
        else:
            cible = cible_relative(c, morpho[cle], float(regle.get("amplitude", corresp.get("amplitude", 0.6))))
            note2 = None if cible is not None else f"« {c.name} » n'a pas de plage : non réglée"
        if note2:
            notes.append(f"{cle} : {note2}")
        if cible is not None:
            cibles.append((str(c.name), cible))
    return cibles, notes


def plan_joueur(joueur, corresp):
    """Ce qui sera fait pour ce joueur, sans Unreal : asset, modèle, peau, yeux, garde-robe."""
    app = joueur.get("apparence", {})
    teint = int(app.get("teint", 0))
    teints_uv = list(corresp.get("teints_uv") or []) + [None] * 10
    uv = teints_uv[teint] if 0 <= teint < 10 else None
    graine = int(app.get("graine", 0))
    n_textures = corresp.get("textures_peau")
    garde_robe, manques = [], []
    emplacements = corresp.get("emplacements", {})
    coiffure = corresp.get("coiffures", {}).get(app.get("coiffure", ""))
    if coiffure:
        garde_robe.append(("cheveux", emplacements.get("cheveux"), coiffure))
    elif app.get("coiffure"):
        manques.append(f"coiffure « {app['coiffure']} » : aucun Wardrobe Item dans « coiffures »")
    barbe = corresp.get("barbes", {}).get(app.get("barbe", ""))
    if barbe and barbe.get("item"):
        quoi = barbe.get("emplacement", "barbe")
        garde_robe.append((quoi, emplacements.get(quoi), barbe["item"]))
    elif app.get("barbe") and app.get("barbe") != "aucune":
        manques.append(f"barbe « {app['barbe']} » : aucun Wardrobe Item dans « barbes »")
    tenue = corresp.get("tenues", {}).get(joueur.get("camp", ""))
    if tenue:
        garde_robe.append(("tenue", emplacements.get("tenue"), tenue))
    else:
        manques.append(f"tenue du camp « {joueur.get('camp', '?')} » : aucun maillot dans « tenues »")
    return {
        "personnage": joueur["personnage"],
        "nom": joueur.get("nom", ""),
        "asset": nom_asset(joueur, corresp),
        "modele": choisir_modele(joueur, corresp),
        "teint": teint,
        "uv": uv,
        "texture_peau": (graine % int(n_textures)) if n_textures else None,
        "yeux": (corresp.get("yeux") or {}).get(str(app.get("yeux", 0))) or None,
        "garde_robe": garde_robe,
        "manques": manques,
    }


# --------------------------------------------------------------------------- dans Unreal

def _sous_systeme():
    return unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)


def _chemin_contenu(chemin):
    p = pathlib.Path(chemin)
    if p.is_absolute() or unreal is None:
        return p
    return pathlib.Path(unreal.Paths.project_content_dir()) / p


def _poser(racine, chemin, valeur):
    """racine.a.b.c = valeur sur des structures (chaque niveau est une copie : on réécrit en
    remontant)."""
    parties = chemin.split(".")
    pile = [racine]
    for p in parties[:-1]:
        pile.append(pile[-1].get_editor_property(p))
    if isinstance(valeur, list) and len(valeur) == 4:
        valeur = unreal.LinearColor(*valeur)
    pile[-1].set_editor_property(parties[-1], valeur)
    for i in range(len(parties) - 2, -1, -1):
        pile[i].set_editor_property(parties[i], pile[i + 1])


def _editer(personnage):
    sub = _sous_systeme()
    if not sub.try_add_object_to_edit(personnage):
        raise RuntimeError("impossible d'éditer " + personnage.get_path_name() + " : déjà ouvert dans MetaHuman Creator ?")
    return sub


def lister(chemin_modele):
    """Les contraintes du corps d'un modèle, avec leurs plages : de quoi remplir « corps » dans
    le fichier de correspondances."""
    perso = unreal.load_asset(chemin_modele)
    sub = _editer(perso)
    try:
        lignes = []
        for c in sub.get_body_constraints(perso, True):
            p = plage(c)
            lignes.append(f"{c.name} : {c.target_measurement:g}" + (f"  [{p[0]:g}, {p[1]:g}]" if p else ""))
        print("\n".join(lignes))
        return lignes
    finally:
        sub.remove_object_to_edit(perso)


def _corps(sub, perso, joueur, corresp, journal):
    # 1) la taille seule, puisque les plages des autres mensurations en dépendent
    taille = [k for k, r in corresp.get("corps", {}).items() if r.get("mode") == "absolu" and k.startswith("taille")]
    contraintes = list(sub.get_body_constraints(perso, True))
    cibles, notes = plan_corps(joueur, contraintes, corresp, seulement=taille)
    journal["notes"] += notes
    if cibles:
        _appliquer_cibles(sub, perso, contraintes, cibles)
    # 2) le reste, les plages relues à cette taille
    contraintes = list(sub.get_body_constraints(perso, True))
    cibles2, notes2 = plan_corps(joueur, contraintes, corresp, seulement=[k for k in corresp.get("corps", {}) if k not in taille])
    journal["notes"] += notes2
    _appliquer_cibles(sub, perso, contraintes, cibles + cibles2)
    sub.commit_body_state(perso)
    journal["corps"] = {n: round(v, 3) for n, v in cibles + cibles2}


def _appliquer_cibles(sub, perso, contraintes, cibles):
    voulues = {normaliser(n): v for n, v in cibles}
    for c in contraintes:
        v = voulues.get(normaliser(c.name))
        c.is_active = v is not None
        if v is not None:
            c.target_measurement = v
    sub.set_body_constraints(perso, contraintes)


def _peau(sub, perso, plan, journal):
    if plan["uv"] is None and plan["texture_peau"] is None:
        journal["notes"].append("peau : teints_uv et textures_peau vides dans les correspondances, la peau du modèle est gardée")
        return
    reglages = perso.get_editor_property("skin_settings")
    peau = reglages.get_editor_property("skin")
    if plan["uv"] is not None:
        peau.set_editor_property("u", float(plan["uv"][0]))
        peau.set_editor_property("v", float(plan["uv"][1]))
    else:
        journal["notes"].append(f"peau : pas d'U/V pour le teint {plan['teint']} dans teints_uv")
    if plan["texture_peau"] is not None:
        peau.set_editor_property("face_texture_index", plan["texture_peau"])
        peau.set_editor_property("body_texture_index", plan["texture_peau"])
    reglages.set_editor_property("skin", peau)
    sub.commit_skin_settings(perso, reglages)
    journal["peau"] = {"uv": plan["uv"], "texture": plan["texture_peau"]}


def _yeux(sub, perso, plan, journal):
    if not plan["yeux"]:
        journal["notes"].append("yeux : rien dans « yeux » pour cette couleur, les yeux du modèle sont gardés")
        return
    reglages = perso.get_editor_property("eyes_settings")
    for chemin, valeur in plan["yeux"].items():
        _poser(reglages, chemin, valeur)
    sub.commit_eyes_settings(perso, reglages)
    journal["yeux"] = plan["yeux"]


def _garde_robe(perso, plan, journal):
    collection = perso.internal_collection
    for quoi, emplacement, chemin in plan["garde_robe"]:
        if not emplacement or not chemin:
            journal["notes"].append(f"{quoi} : emplacement ou item vide dans les correspondances")
            continue
        item = unreal.load_asset(chemin)
        if item is None:
            journal["notes"].append(f"{quoi} : {chemin} introuvable")
            continue
        r = collection.try_add_item_from_wardrobe_item(emplacement, item)
        # une fonction C++ « bool f(..., Out&) » : Python rend la clé (None en cas d'échec), ou
        # (bool, clé) ; on accepte les deux formes
        if isinstance(r, tuple):
            cle = r[-1] if not (isinstance(r[0], bool) and not r[0]) else None
        else:
            cle = r
        if cle is None or isinstance(cle, bool):
            journal["notes"].append(f"{quoi} : {chemin} refusé dans l'emplacement {emplacement}")
            continue
        selection = unreal.MetaHumanPipelineSlotSelection(slot_name=emplacement, selected_item=cle)
        if not collection.default_instance.try_add_slot_selection(selection):
            journal["notes"].append(f"{quoi} : {chemin} ajouté mais pas sélectionné dans {emplacement} (déjà occupé ?)")
            continue
        journal["garde_robe"].append(f"{emplacement} : {chemin}")


def _melange_visage(sub, perso, joueur, corresp, journal):
    """Expérimental, désactivé par défaut : mêler les coefficients du visage avec un second
    modèle. Rien dans la documentation ne dit que ce mélange donne un visage plausible : à
    juger à l'oeil sur quelques joueurs avant de l'activer (« melange_visages »)."""
    reglage = corresp.get("melange_visages") or {}
    if not reglage.get("actif"):
        return
    autres = [m["chemin"] for m in corresp.get("modeles_visage", []) if m.get("chemin")]
    if len(autres) < 2:
        return
    visage = joueur.get("apparence", {}).get("visage", [0.5, 0.5])
    second = unreal.load_asset(autres[int(visage[0] * len(autres)) % len(autres)])
    a = list(sub.get_face_model_coefficients(perso))
    b = list(sub.get_face_model_coefficients(second))
    if len(a) != len(b) or not a:
        journal["notes"].append("visage : coefficients incompatibles, pas de mélange")
        return
    w = float(reglage.get("poids_max", 0.35)) * float(visage[1])
    sub.set_face_model_coefficients(perso, [x + (y - x) * w for x, y in zip(a, b)])
    journal["visage"] = {"melange_avec": second.get_path_name(), "poids": round(w, 3)}


def _assembler(sub, perso, plan, corresp, journal, textures, rig):
    if textures:
        demande = unreal.MetaHumanCharacterTextureRequestParams()
        demande.blocking = True
        demande.report_progress = False
        sub.request_texture_sources(perso, demande)
    if rig:
        demande = unreal.MetaHumanCharacterAutoRiggingRequestParams()
        demande.blocking = True
        demande.report_progress = False
        demande.rig_type = getattr(unreal.MetaHumanRigType, corresp.get("assemblage", {}).get("rig", "JOINTS_AND_BLENDSHAPES"))
        sub.request_auto_rigging(perso, demande)
    a = corresp.get("assemblage", {})
    parametres = unreal.MetaHumanCharacterEditorBuildParameters()
    parametres.set_editor_property("pipeline_type", getattr(unreal.MetaHumanDefaultPipelineType, a.get("type", "OPTIMIZED")))
    parametres.set_editor_property("pipeline_quality", getattr(unreal.MetaHumanQualityLevel, a.get("qualite", "MEDIUM")))
    parametres.set_editor_property("name_override", plan["asset"].rsplit("/", 1)[-1])
    sub.build_meta_human(perso, parametres)
    journal["assemble"] = f"{a.get('type', 'OPTIMIZED')} {a.get('qualite', 'MEDIUM')}"


def generer(document, correspondances=None, essai=False, assembler=False, textures=False, rig=False, limite=None):
    """Un MetaHuman par joueur du document. essai : ne touche à rien, rend ce qui serait fait.
    assembler : lance aussi l'assemblage (long : plusieurs minutes par joueur). textures, rig :
    demandent les textures sources et le rig du visage aux services d'Epic (compte Epic, réseau)."""
    corresp = charger_correspondances(correspondances)
    joueurs = charger_feuille(_chemin_contenu(document))
    if limite:
        joueurs = joueurs[: int(limite)]
    rapport = []
    for joueur in joueurs:
        plan = plan_joueur(joueur, corresp)
        journal = {"personnage": plan["personnage"], "nom": plan["nom"], "asset": plan["asset"], "modele": plan["modele"],
                   "notes": [], "garde_robe": []}
        rapport.append(journal)
        journal["notes"] += plan["manques"]
        if plan["modele"] is None:
            journal["notes"].append("aucun modèle de visage dans « modeles_visage » : rien à décliner")
            continue
        if essai:
            journal["essai"] = True
            journal["plan"] = {k: plan[k] for k in ("uv", "texture_peau", "yeux", "garde_robe")}
            continue
        if unreal.EditorAssetLibrary.does_asset_exist(plan["asset"]):
            perso = unreal.load_asset(plan["asset"])
            journal["reprise"] = True
        else:
            perso = unreal.EditorAssetLibrary.duplicate_asset(plan["modele"], plan["asset"])
        if perso is None:
            journal["notes"].append("duplication du modèle impossible")
            continue
        sub = _editer(perso)
        try:
            _corps(sub, perso, joueur, corresp, journal)
            _peau(sub, perso, plan, journal)
            _yeux(sub, perso, plan, journal)
            _melange_visage(sub, perso, joueur, corresp, journal)
            _garde_robe(perso, plan, journal)
            if assembler:
                _assembler(sub, perso, plan, corresp, journal, textures, rig)
        finally:
            sub.remove_object_to_edit(perso)
        unreal.EditorAssetLibrary.save_loaded_asset(perso)
    _ecrire_rapport(rapport)
    return rapport


def _ecrire_rapport(rapport):
    dossier = pathlib.Path(unreal.Paths.project_saved_dir()) / "LinkFoot" if unreal is not None else pathlib.Path(os.environ.get("TMPDIR", "/tmp"))
    dossier.mkdir(parents=True, exist_ok=True)
    chemin = dossier / "metahumans-rapport.json"
    chemin.write_text(json.dumps(rapport, ensure_ascii=False, indent=1), encoding="utf-8")
    # les notes, regroupées : ce que l'artiste a à compléter dans les correspondances
    comptes = {}
    for j in rapport:
        for n in j["notes"]:
            comptes[n] = comptes.get(n, 0) + 1
    print(f"LinkFoot : {len(rapport)} joueur(s), {len(comptes)} note(s) distincte(s) ; rapport : {chemin}")
    for n, k in sorted(comptes.items(), key=lambda x: (-x[1], x[0]))[:40]:
        print(f"  {k:3d} x {n}")
    return chemin
