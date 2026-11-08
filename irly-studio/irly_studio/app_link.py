"""Lien entre le studio et l'application IRLY (dépôt alafrench7593-a11y/irly, en lecture seule).

Tout ce que les vidéos montrent de la marque vient de l'app :
- les écrans : captures de la version web DÉMO de l'app (tools/capture_app.mjs),
  rangées dans assets/app_screens/<langue>/ ;
- le logo et les couleurs : brand.py, repris de src/brand/dots.ts et src/theme/tokens.ts ;
- les photos : celles que l'app et son marketing utilisent déjà, avec leurs licences
  (public-photos/DUBAI.md, CREDITS.md, marketing/tiktok/_photos/*/SOURCES.md).

Le studio ne modifie jamais le dépôt de l'app.
"""

from __future__ import annotations

import glob
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DIR = os.environ.get("IRLY_APP_DIR") or next(
    (p for p in [os.path.join(ROOT, "..", "..", "alafrench7593-a11y", "irly"), os.path.join(ROOT, "..", "..", "irly")]
     if os.path.isdir(p)), os.path.join(ROOT, "..", "..", "irly"))
SCREENS = os.path.join(ROOT, "assets", "app_screens")

# Écrans réels montrés dans le téléphone, par campagne, dans l'ordre du récit.
CAMPAIGN_SCREENS = {
    "solitude": ["03_accueil", "04_decouvrir", "05_activites"],
    "girl": ["08_girl_accueil", "09_girl_communautes", "11_creer"],
    "network": ["10_network", "04_decouvrir"],
    "sport": ["05_activites", "04_decouvrir"],
    "activites": ["05_activites", "04_decouvrir", "03_accueil"],
    "tutoriel": ["02_inscription", "09_girl_communautes", "04_decouvrir", "05_activites", "11_creer"],
}

# Photos de l'app par campagne : thèmes de marketing/tiktok/_photos et clés de public-photos.
CAMPAIGN_PHOTOS = {
    "solitude": ["woman-window-night-city", "dubai-skyline-night", "cafe-alone", "phone-bed-night",
                 "friends-laughing-dinner"],
    "girl": ["girlFriends", "girlCoffee", "girlSunset", "girlBookClub", "girlFitness"],
    "network": ["founders", "startup", "meeting", "office", "coffee-two-friends"],
    "sport": ["running-group-sunrise", "padel", "football", "running", "gym"],
    "activites": ["beachClub", "brunch", "dhow", "dunes", "group-friends-beach", "rooftop-friends-sunset"],
    "tutoriel": ["dubaiMarina", "coffee-two-friends"],
}


def available() -> bool:
    return os.path.isdir(APP_DIR)


def screens(campaign: str, language: str = "fr") -> list[str]:
    """Chemins des vraies captures d'écran pour une campagne (dans l'ordre)."""
    folder = os.path.join(SCREENS, language)
    if not os.path.isdir(folder):
        folder = os.path.join(SCREENS, "fr")
    out = []
    for name in CAMPAIGN_SCREENS.get(campaign, []):
        path = os.path.join(folder, name + ".png")
        if os.path.exists(path):
            out.append(path)
    return out


def all_screens(language: str = "fr") -> list[str]:
    return sorted(glob.glob(os.path.join(SCREENS, language, "*.png")))


def capture_info(language: str = "fr") -> dict:
    path = os.path.join(SCREENS, language, "captures.json")
    return json.load(open(path)) if os.path.exists(path) else {}


def photo_paths(key: str) -> list[str]:
    """Une clé = un dossier de marketing/tiktok/_photos ou une photo de public-photos."""
    folder = os.path.join(APP_DIR, "marketing", "tiktok", "_photos", key)
    if os.path.isdir(folder):
        return sorted(f for f in glob.glob(os.path.join(folder, "*.jpg")) if not os.path.basename(f).startswith("_"))
    single = os.path.join(APP_DIR, "public-photos", f"{key}-1200.jpg")
    return [single] if os.path.exists(single) else []


def photos(campaign: str, limit: int = 6) -> list[str]:
    out = []
    for key in CAMPAIGN_PHOTOS.get(campaign, []):
        out += photo_paths(key)[:2]
    return out[:limit]


def photo_library() -> dict[str, list[str]]:
    """Toutes les photos de l'app, par thème, pour la bibliothèque du studio."""
    lib = {}
    base = os.path.join(APP_DIR, "marketing", "tiktok", "_photos")
    for folder in sorted(glob.glob(os.path.join(base, "*"))):
        if os.path.isdir(folder):
            lib[os.path.basename(folder)] = photo_paths(os.path.basename(folder))
    for f in sorted(glob.glob(os.path.join(APP_DIR, "public-photos", "*-1200.jpg"))):
        lib[os.path.basename(f)[:-9]] = [f]
    return lib


def licence_files() -> list[str]:
    files = [os.path.join(APP_DIR, "public-photos", n) for n in ("DUBAI.md", "CREDITS.md")]
    files += glob.glob(os.path.join(APP_DIR, "marketing", "tiktok", "_photos", "*", "SOURCES.md"))
    return [f for f in files if os.path.exists(f)]


def credit_for(path: str) -> str:
    """Ligne de crédit d'une photo, trouvée dans les fichiers de licence de l'app."""
    name = os.path.basename(path)
    key = name[:-9] if name.endswith("-1200.jpg") else name
    for lic in licence_files():
        for line in open(lic, encoding="utf-8"):
            if f"**{key}**" in line or name in line:
                return line.strip("- \n")
    return "crédit introuvable : vérifier avant publication"
