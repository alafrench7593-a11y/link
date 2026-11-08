"""Voix off : ElevenLabs (clé API), Edge TTS (gratuit, sans clé) ou fichier importé.

Aucune clé n'est écrite dans le code : ElevenLabs lit ELEVENLABS_API_KEY dans
l'environnement de la machine qui fait tourner le studio.
"""

from __future__ import annotations

import asyncio
import os
import shutil
import subprocess

import requests

from . import subtitles

# Voix naturelles proposées par langue et par genre.
EDGE_VOICES = {
    ("fr", "f"): "fr-FR-DeniseNeural", ("fr", "m"): "fr-FR-HenriNeural",
    ("en", "f"): "en-US-AvaMultilingualNeural", ("en", "m"): "en-US-AndrewMultilingualNeural",
    ("es", "f"): "es-ES-ElviraNeural", ("es", "m"): "es-ES-AlvaroNeural",
    ("de", "f"): "de-DE-KatjaNeural", ("de", "m"): "de-DE-ConradNeural",
    ("it", "f"): "it-IT-ElsaNeural", ("it", "m"): "it-IT-DiegoNeural",
}
# ElevenLabs : voix de la bibliothèque publique, multilingues (le modèle parle la langue du texte).
ELEVEN_VOICES = {
    "f": "mNu8EQcIlFZdOJs7yfhe",  # Julia - Warm French Narrator
    "m": "",  # à choisir dans la bibliothèque ElevenLabs puis renseigner
}

# Réglages par ton : débit et hauteur pour Edge, stabilité/style pour ElevenLabs.
TONE_SETTINGS = {
    "emotionnel": {"rate": "-6%", "pitch": "-2Hz", "stability": 0.35, "style": 0.55},
    "dynamique": {"rate": "+8%", "pitch": "+2Hz", "stability": 0.45, "style": 0.45},
    "naturel": {"rate": "+0%", "pitch": "+0Hz", "stability": 0.5, "style": 0.25},
    "cinematique": {"rate": "-10%", "pitch": "-4Hz", "stability": 0.4, "style": 0.6},
    "publicitaire": {"rate": "+4%", "pitch": "+1Hz", "stability": 0.55, "style": 0.35},
}


def edge_tts(text: str, out_path: str, *, language="fr", gender="f", tone="naturel") -> str:
    import edge_tts as et  # installé avec MoneyPrinterTurbo

    s = TONE_SETTINGS[tone]
    voice = EDGE_VOICES[(language, gender)]

    async def run():
        await et.Communicate(subtitles.clean(text), voice, rate=s["rate"], pitch=s["pitch"]).save(out_path)

    try:
        asyncio.run(run())
    except Exception as exc:  # réseau bloqué, service indisponible
        raise RuntimeError(f"Edge TTS indisponible ({exc.__class__.__name__}). "
                           "Vérifie l'accès à speech.platform.bing.com ou importe un fichier audio.") from exc
    return out_path


def elevenlabs(text: str, out_path: str, *, gender="f", tone="naturel", voice_id: str | None = None,
               model_id: str = "eleven_multilingual_v2") -> str:
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        raise RuntimeError("ELEVENLABS_API_KEY absente de l'environnement.")
    vid = voice_id or ELEVEN_VOICES.get(gender)
    if not vid:
        raise RuntimeError("Aucune voix ElevenLabs configurée pour ce genre (voice.ELEVEN_VOICES).")
    s = TONE_SETTINGS[tone]
    r = requests.post(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}",
                      headers={"xi-api-key": key, "accept": "audio/mpeg"},
                      json={"text": subtitles.clean(text), "model_id": model_id,
                            "voice_settings": {"stability": s["stability"], "similarity_boost": 0.8,
                                               "style": s["style"], "use_speaker_boost": True}},
                      timeout=120)
    if r.status_code != 200:
        raise RuntimeError(f"ElevenLabs a refusé la demande ({r.status_code}) : {r.text[:200]}")
    with open(out_path, "wb") as f:
        f.write(r.content)
    return out_path


def import_audio(src: str, out_path: str) -> str:
    """Convertit n'importe quel fichier audio importé en MP3 propre."""
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg est requis.")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-ac", "1", "-ar", "44100",
                    "-b:a", "192k", out_path], check=True)
    return out_path


def synthesize(provider: str, text: str, out_path: str, **kw) -> str:
    if provider == "elevenlabs":
        return elevenlabs(text, out_path, gender=kw.get("gender", "f"), tone=kw.get("tone", "naturel"),
                          voice_id=kw.get("voice_id"))
    if provider == "edge":
        return edge_tts(text, out_path, language=kw.get("language", "fr"), gender=kw.get("gender", "f"),
                        tone=kw.get("tone", "naturel"))
    if provider == "upload":
        return import_audio(kw["file"], out_path)
    raise ValueError(f"Fournisseur de voix inconnu : {provider}")
