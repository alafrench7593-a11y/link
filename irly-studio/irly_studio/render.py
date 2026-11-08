"""Rendu final : fond MoneyPrinterTurbo + motion design + sous-titres + mixage audio.

Les images du montage de base sont lues en continu par ffmpeg, composées image par image
par motion.render_frame, puis réencodées en H.264 yuv420p. L'audio (voix off + musique
synthétisée, sans droits) est mixé avec atténuation de la musique sous la voix, puis
normalisé à -14 LUFS / -1 dBTP, la cible des réseaux sociaux.
"""

from __future__ import annotations

import os
import subprocess
import wave

import numpy as np
from PIL import Image

from . import motion

SR = 44100


def synth_music(path: str, duration: float, bpm: int = 96, seed: int = 7, mood: str = "warm"):
    """Nappe douce + pulsation légère, générée en code (aucun droit musical)."""
    rng = np.random.default_rng(seed)
    n = int(duration * SR)
    t = np.arange(n) / SR
    chords = {
        "warm": [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]],
        "bright": [[62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 69]],
    }[mood if mood in ("warm", "bright") else "warm"]
    bar = 4 * 60 / bpm
    out = np.zeros(n)
    for i in range(int(duration / bar) + 1):
        a, b = int(i * bar * SR), min(n, int((i + 1) * bar * SR + 0.4 * SR))
        if a >= n:
            break
        seg_t = np.arange(b - a) / SR
        env = np.minimum(1, seg_t / 0.6) * np.exp(-seg_t / (bar * 1.6))
        for note in chords[i % 4]:
            f = 440 * 2 ** ((note - 69) / 12)
            for det in (-0.12, 0.0, 0.12):
                out[a:b] += 0.05 * env * np.sin(2 * np.pi * f * (1 + det / 100) * seg_t
                                                  + rng.uniform(0, 6.28))
    beat = 60 / bpm
    for k in range(int(duration / beat)):
        a = int(k * beat * SR)
        seg = np.arange(min(int(0.25 * SR), n - a)) / SR
        kick = 0.35 * np.sin(2 * np.pi * (52 + 70 * np.exp(-seg * 30)) * seg) * np.exp(-seg * 14)
        out[a:a + len(seg)] += kick * (0.6 if k % 2 else 1.0)
    fade = np.minimum(1, t / 1.0) * np.minimum(1, (duration - t) / 1.5)
    out = np.tanh(out * fade * 1.4) * 0.6
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((out * 32767).astype(np.int16).tobytes())


def measure_lufs(path: str) -> tuple[float, float]:
    """Loudness intégrée (LUFS) et crête vraie (dBTP) d'un fichier audio."""
    import re
    r = subprocess.run(["ffmpeg", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    i = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)[-1])
    peak = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r.stderr)[-1])
    return i, peak


def mix_audio(voice: str, music: str | None, out: str, duration: float, music_db: float = -16,
              target: float = -14.0):
    raw = out + ".raw.wav"
    _mix(voice, music, raw, duration, music_db)
    # 2e passe : gain exact vers la cible, puis limiteur à -1,5 dBTP
    i, _ = measure_lufs(raw)
    gain = target - i
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-af",
                    f"volume={gain:.2f}dB,alimiter=limit=0.84:level=false", "-ar", "48000",
                    "-c:a", "aac", "-b:a", "192k", out], check=True)
    os.remove(raw)


def _mix(voice: str, music: str | None, out: str, duration: float, music_db: float = -16):
    """Voix + musique : la musique s'efface sous la voix (sidechain), puis loudnorm."""
    if music:
        filt = (f"[1:a]volume={music_db}dB,aformat=channel_layouts=stereo[m];"
                "[0:a]aformat=channel_layouts=stereo,asplit=2[v][sc];"
                "[m][sc]sidechaincompress=threshold=0.04:ratio=6:attack=20:release=350[md];"
                "[v][md]amix=inputs=2:duration=longest:normalize=0,"
                f"apad,atrim=0:{duration:.3f}[a]")
        cmd = ["ffmpeg", "-y", "-v", "error", "-i", voice, "-i", music, "-filter_complex", filt,
               "-map", "[a]", "-ar", "48000", out]
    else:
        cmd = ["ffmpeg", "-y", "-v", "error", "-i", voice, "-af",
               f"apad,atrim=0:{duration:.3f}", "-ar", "48000", out]
    subprocess.run(cmd, check=True)


class BaseReader:
    """Lit le montage de base image par image, au bon débit et à la bonne taille."""

    def __init__(self, path: str | None, w: int, h: int, fps: int):
        self.w, self.h = w, h
        self.last = None
        self.proc = None
        if path:
            self.proc = subprocess.Popen(
                ["ffmpeg", "-v", "error", "-i", path, "-vf",
                 f"fps={fps},scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}",
                 "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)

    def next(self) -> Image.Image | None:
        if not self.proc:
            return None
        buf = self.proc.stdout.read(self.w * self.h * 3)
        if len(buf) == self.w * self.h * 3:
            self.last = Image.frombytes("RGB", (self.w, self.h), buf)
        return self.last  # au-delà de la fin, on garde la dernière image

    def close(self):
        if self.proc:
            self.proc.stdout.close()
            self.proc.wait()


def render(plan: motion.Plan, *, size: tuple[int, int], base_video: str | None, audio: str,
           out_path: str, fps: int = 30, start: float = 0.0, end: float | None = None,
           crf: int = 19, progress=None) -> str:
    w, h = size
    L = motion.Layout(w, h)
    end = plan.duration if end is None else end
    reader = BaseReader(base_video, w, h, fps)
    for _ in range(int(start * fps)):
        reader.next()
    tmp_video = out_path + ".video.mp4"
    enc = subprocess.Popen(
        ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
         "-r", str(fps), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", str(crf),
         "-maxrate", "12M", "-bufsize", "24M", "-profile:v", "high",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", tmp_video], stdin=subprocess.PIPE)
    frames = int(round((end - start) * fps))
    try:
        for i in range(frames):
            t = start + i / fps
            img = motion.render_frame(plan, L, t, reader.next(), fps)
            enc.stdin.write(img.tobytes())
            if progress and i % fps == 0:
                progress(i / frames)
    finally:
        enc.stdin.close()
        enc.wait()
        reader.close()
    audio_args = ["-ss", f"{start:.3f}", "-t", f"{end - start:.3f}", "-i", audio]
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", tmp_video, *audio_args, "-map", "0:v",
                    "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
                    "-movflags", "+faststart", out_path], check=True)
    os.remove(tmp_video)
    if progress:
        progress(1.0)
    return out_path


def still(plan: motion.Plan, size, base_video, t: float, out_png: str, fps: int = 30):
    """Une image fixe à l'instant t, pour la prévisualisation et les planches contact."""
    w, h = size
    base = None
    if base_video:
        r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", base_video, "-frames:v", "1",
                            "-vf", f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}",
                            "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True)
        if len(r.stdout) == w * h * 3:
            base = Image.frombytes("RGB", (w, h), r.stdout)
    img = motion.render_frame(plan, motion.Layout(w, h), t, base, fps)
    img.save(out_png)
    return out_png
