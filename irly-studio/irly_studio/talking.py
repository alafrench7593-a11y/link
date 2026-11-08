"""Moteurs « visage qui parle » et voix locale, installés à côté du dépôt
par tools/install_talking_heads.sh. Chacun tourne dans son propre environnement Python ;
on les appelle en ligne de commande, sans modifier leur code.

Licences : les moteurs marqués commercial=False servent aux tests uniquement.
"""

from __future__ import annotations

import glob
import os
import shutil
import subprocess
import tempfile
import time

TOOLS = os.environ.get("IRLY_TOOLS_DIR") or os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", ".."))

ENGINES = {
    "sadtalker": {"label": "SadTalker", "repo": "OpenTalker/SadTalker", "commercial": True,
                  "note": "Une image + une voix. Apache 2.0."},
    "musetalk": {"label": "MuseTalk", "repo": "TMElyralab/MuseTalk", "commercial": None,
                 "note": "Lèvres de bonne qualité. Code MIT ; vérifier la licence des poids (OpenRAIL-M)."},
    "wav2lip": {"label": "Wav2Lip", "repo": "Rudrabha/Wav2Lip", "commercial": False,
                "note": "Usage commercial interdit (entraîné sur LRS2)."},
    "liveportrait": {"label": "LivePortrait + lèvres", "repo": "KwaiVGI/LivePortrait", "commercial": False,
                     "note": "Mouvements de tête copiés d'une vidéo ; modèles InsightFace non commerciaux."},
}
VOICES = {"chatterbox": {"label": "Chatterbox (local, gratuit)", "repo": "resemble-ai/chatterbox",
                         "commercial": True, "note": "MIT. Filigrane audio invisible (Perth)."}}


def tool_dir(name: str) -> str:
    return os.path.join(TOOLS, {"sadtalker": "SadTalker", "musetalk": "MuseTalk", "wav2lip": "Wav2Lip",
                                "liveportrait": "LivePortrait", "chatterbox": "chatterbox"}[name])


def py(name: str) -> str:
    sub = ("Scripts", "python.exe") if os.name == "nt" else ("bin", "python")
    return os.path.join(tool_dir(name), ".venv", *sub)


def installed(name: str) -> bool:
    return os.path.exists(py(name))


def _wav(src: str, dst: str, rate: int = 16000):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-ac", "1", "-ar", str(rate), dst], check=True)
    return dst


def _run(cmd: list[str], cwd: str, log: str | None):
    t0 = time.time()
    with open(log or os.devnull, "a") as f:
        f.write("$ " + " ".join(cmd) + "\n")
        f.flush()
        env = dict(os.environ, HF_HUB_DISABLE_XET="1")  # téléchargement HTTP classique depuis Hugging Face
        proc = subprocess.run(cmd, cwd=cwd, stdout=f, stderr=subprocess.STDOUT, env=env)
    if proc.returncode != 0:
        raise RuntimeError(f"{os.path.basename(cwd)} a échoué (code {proc.returncode}), journal : {log}")
    return time.time() - t0


def _mux(video: str, audio: str, out: str):
    """Remet la voix d'origine en pleine qualité sur la vidéo générée."""
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", video, "-i", audio, "-map", "0:v", "-map", "1:a",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-c:a", "aac", "-shortest", out],
                   check=True)
    return out


# ---------------------------------------------------------------- moteurs

def sadtalker(face: str, audio: str, out: str, *, log=None, enhance=False, still=True) -> str:
    d = tool_dir("sadtalker")
    work = tempfile.mkdtemp(prefix="sadtalker_")
    wav = _wav(audio, os.path.join(work, "voice.wav"))
    cmd = [py("sadtalker"), "inference.py", "--driven_audio", wav, "--source_image", os.path.abspath(face),
           "--result_dir", work, "--preprocess", "full", "--size", "256", "--cpu", "--batch_size", "4"]
    if still:
        cmd.append("--still")
    if enhance:
        cmd += ["--enhancer", "gfpgan"]
    _run(cmd, d, log)
    vids = sorted(glob.glob(os.path.join(work, "**", "*.mp4"), recursive=True), key=os.path.getmtime)
    if not vids:
        raise RuntimeError(f"SadTalker n'a produit aucune vidéo, journal : {log}")
    return _mux(vids[-1], audio, out)


def wav2lip(face: str, audio: str, out: str, *, log=None) -> str:
    d = tool_dir("wav2lip")
    sfd = os.path.join(d, "face_detection", "detection", "sfd", "s3fd.pth")
    if not os.path.exists(sfd):
        src = (glob.glob(os.path.join(d, "hf_s3fd", "*.pth")) or [None])[0]
        if src:
            shutil.copy(src, sfd)
    ckpt = (glob.glob(os.path.join(d, "hf_weights", "*gan*.pth")) or glob.glob(os.path.join(d, "hf_weights", "*.pth")))[0]
    work = tempfile.mkdtemp(prefix="wav2lip_")
    wav = _wav(audio, os.path.join(work, "voice.wav"))
    res = os.path.join(work, "out.mp4")
    os.makedirs(os.path.join(d, "temp"), exist_ok=True)
    _run([py("wav2lip"), "inference.py", "--checkpoint_path", ckpt, "--face", os.path.abspath(face),
          "--audio", wav, "--outfile", res, "--face_det_batch_size", "4", "--wav2lip_batch_size", "32"], d, log)
    return _mux(res, audio, out)


def musetalk(face: str, audio: str, out: str, *, log=None) -> str:
    d = tool_dir("musetalk")
    work = tempfile.mkdtemp(prefix="musetalk_")
    wav = _wav(audio, os.path.join(work, "voice.wav"))
    cfg = os.path.join(work, "task.yaml")
    with open(cfg, "w") as f:
        f.write(f'task_0:\n video_path: "{os.path.abspath(face)}"\n audio_path: "{wav}"\n')
    ffdir = os.path.dirname(shutil.which("ffmpeg"))
    _run([py("musetalk"), "-m", "scripts.inference", "--inference_config", cfg, "--result_dir", work,
          "--unet_model_path", "models/musetalkV15/unet.pth", "--unet_config", "models/musetalkV15/musetalk.json",
          "--version", "v15", "--ffmpeg_path", ffdir, "--batch_size", "4", "--output_vid_name", "out.mp4"], d, log)
    vids = sorted(glob.glob(os.path.join(work, "**", "out.mp4"), recursive=True))
    if not vids:
        raise RuntimeError(f"MuseTalk n'a produit aucune vidéo, journal : {log}")
    return _mux(vids[-1], audio, out)


def liveportrait(face: str, audio: str, out: str, *, log=None, driving: str | None = None,
                 lips: str = "musetalk") -> str:
    """Tête et regard animés par une vidéo de référence, puis lèvres calées sur la voix."""
    d = tool_dir("liveportrait")
    work = tempfile.mkdtemp(prefix="liveportrait_")
    drv = driving or os.path.join(d, "assets", "examples", "driving", "d0.mp4")
    _run([py("liveportrait"), "inference.py", "-s", os.path.abspath(face), "-d", drv, "-o", work,
          "--flag-force-cpu", "--no-flag-use-half-precision"], d, log)
    anim = [v for v in glob.glob(os.path.join(work, "*.mp4")) if "concat" not in v]
    if not anim:
        raise RuntimeError(f"LivePortrait n'a produit aucune vidéo, journal : {log}")
    # boucle la vidéo animée sur la durée de la voix
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                audio], capture_output=True, text=True).stdout)
    looped = os.path.join(work, "looped.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-stream_loop", "-1", "-i", anim[0], "-t", f"{dur:.2f}",
                    "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", looped], check=True)
    return (musetalk if lips == "musetalk" else wav2lip)(looped, audio, out, log=log)


RUNNERS = {"sadtalker": sadtalker, "wav2lip": wav2lip, "musetalk": musetalk, "liveportrait": liveportrait}


def talk(engine: str, face: str, audio: str, out: str, *, log: str | None = None, **kw) -> dict:
    if not installed(engine if engine != "liveportrait" else "liveportrait"):
        raise RuntimeError(f"{ENGINES[engine]['label']} n'est pas installé : tools/install_talking_heads.sh {engine}")
    t0 = time.time()
    RUNNERS[engine](os.path.abspath(face), os.path.abspath(audio), os.path.abspath(out), log=log, **kw)
    return {"engine": engine, "file": out, "seconds": round(time.time() - t0)}


# ---------------------------------------------------------------- voix locale

CHATTERBOX_SCRIPT = r"""
import sys, torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
text, out, lang, ref, exag = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], float(sys.argv[5])
m = ChatterboxMultilingualTTS.from_pretrained(device="cpu", t3_model="v3")
kw = {"exaggeration": exag}
if ref != "-":
    kw["audio_prompt_path"] = ref
wav = m.generate(text, language_id=lang, **kw)
ta.save(out, wav, m.sr)
"""


def chatterbox(text: str, out: str, *, language="fr", reference: str | None = None,
               exaggeration: float = 0.5, log: str | None = None) -> str:
    """Voix locale gratuite. `reference` : extrait de voix à imiter, avec l'accord de la personne."""
    if not installed("chatterbox"):
        raise RuntimeError("Chatterbox n'est pas installé : tools/install_talking_heads.sh chatterbox")
    out = os.path.abspath(out)  # Chatterbox tourne dans son propre dossier
    script = os.path.join(tempfile.mkdtemp(prefix="cbx_"), "run.py")
    open(script, "w").write(CHATTERBOX_SCRIPT)
    wav = out if out.endswith(".wav") else out + ".wav"
    _run([py("chatterbox"), script, text, wav, language, reference or "-", str(exaggeration)],
         tool_dir("chatterbox"), log)
    if wav != out:
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", wav, "-b:a", "192k", out], check=True)
    return out
