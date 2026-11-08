"""Pont vers MoneyPrinterTurbo, installé à part et non modifié.

On appelle sa CLI officielle pour le montage des médias (zoom lent, transitions, format),
et son module LLM pour les scripts quand un fournisseur est configuré dans config.toml.
"""

from __future__ import annotations

import json
import os
import subprocess
import uuid

MPT_DIR = os.environ.get("IRLY_MPT_DIR") or os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "MoneyPrinterTurbo"))


def mpt_python() -> str:
    sub = ("Scripts", "python.exe") if os.name == "nt" else ("bin", "python")  # Windows ou Mac/Linux
    venv = os.path.join(MPT_DIR, ".venv", *sub)
    return venv if os.path.exists(venv) else "python3"


def available() -> bool:
    return os.path.exists(os.path.join(MPT_DIR, "cli.py"))


def version() -> str:
    try:
        for line in open(os.path.join(MPT_DIR, "pyproject.toml"), encoding="utf-8"):
            if line.startswith("version"):
                return line.split("=")[1].strip().strip('"')
    except OSError:
        pass
    return "inconnue"


def base_montage(materials: list[str], audio: str, *, aspect: str = "9:16",
                 clip_seconds: int = 5, transition: str = "fade-in", log_path: str | None = None) -> str:
    """Monte les photos/vidéos fournies sur la durée de la voix off. Renvoie le montage
    sans sous-titres ni musique (le motion design et le mixage sont faits ensuite)."""
    if not available():
        raise RuntimeError(f"MoneyPrinterTurbo introuvable dans {MPT_DIR}")
    if not materials:
        raise ValueError("Aucun média : importe au moins une photo ou une vidéo.")
    task_id = str(uuid.uuid4())
    cmd = [mpt_python(), "cli.py", "--video-script", "IRLY", "--video-source", "local",
           "--video-materials", ",".join(os.path.abspath(m) for m in materials),
           "--custom-audio-file", os.path.abspath(audio), "--bgm-type", "none",
           "--no-subtitle-enabled", "--video-aspect", aspect, "--video-concat-mode", "sequential",
           "--image-motion", "zoom", "--video-transition-mode", transition,
           "--video-clip-duration", str(clip_seconds), "--stop-at", "video", "--task-id", task_id]
    with open(log_path or os.devnull, "w") as log:
        proc = subprocess.run(cmd, cwd=MPT_DIR, stdout=subprocess.PIPE, stderr=log, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"Le montage MoneyPrinterTurbo a échoué (code {proc.returncode}). "
                           f"Journal : {log_path}")
    result = json.loads(proc.stdout.strip().splitlines()[-1])
    combined = result["result"].get("combined_videos") or result["result"]["videos"]
    return combined[0]


def llm_complete(prompt: str) -> str:
    """Appelle le LLM configuré dans MoneyPrinterTurbo (llm_provider dans config.toml)."""
    code = ("import sys,json\nfrom app.services import llm\n"
            "print(json.dumps(llm._generate_response(sys.stdin.read())))")
    proc = subprocess.run([mpt_python(), "-c", code], cwd=MPT_DIR, input=prompt,
                          capture_output=True, text=True, timeout=180)
    if proc.returncode != 0:
        raise RuntimeError("Aucun LLM utilisable : configure llm_provider et sa clé dans "
                           "MoneyPrinterTurbo/config.toml, ou garde le moteur « textes IRLY ».")
    text = json.loads(proc.stdout.strip().splitlines()[-1])
    if not text or str(text).lower().startswith("error"):
        raise RuntimeError(f"Le LLM a renvoyé une erreur : {str(text)[:200]}")
    return text
