"""Calage de la voix off et sous-titres dynamiques.

Le calage n'a besoin d'aucun modèle de reconnaissance vocale : on mesure les silences
de la voix off avec ffmpeg, puis on place les frontières entre phrases sur les pauses
les plus proches de la position attendue (proportionnelle au nombre de caractères).
Les sous-titres sont des blocs de 2 à 5 mots, éditables en SRT avant l'export.
"""

from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass, asdict

from . import catalog

TAG_RE = re.compile(r"\[[^\]]*\]")  # balises de direction vocale ElevenLabs : [warm], [pause]


@dataclass
class Cue:
    start: float
    end: float
    text: str
    segment: int = 0
    part: str = ""


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", TAG_RE.sub("", text)).strip()


def audio_duration(path: str) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", path], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def detect_silences(path: str, noise_db: float = -35, min_silence: float = 0.18) -> list[tuple[float, float]]:
    """Liste des silences (début, fin) de la voix off, via le filtre silencedetect."""
    proc = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af",
                           f"silencedetect=noise={noise_db}dB:d={min_silence}", "-f", "null", "-"],
                          capture_output=True, text=True)
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", proc.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", proc.stderr)]
    return list(zip(starts, ends))


def speech_bounds(silences: list[tuple[float, float]], duration: float) -> tuple[float, float]:
    """Début et fin réels de la parole (on ignore le silence de tête et de queue)."""
    first = silences[0][1] if silences and silences[0][0] < 0.05 else 0.0
    last = silences[-1][0] if silences and silences[-1][1] >= duration - 0.05 else duration
    return first, last


def align_segments(texts: list[str], audio_path: str) -> list[tuple[float, float]]:
    """Début et fin de chaque phrase dans la voix off."""
    duration = audio_duration(audio_path)
    silences = detect_silences(audio_path)
    t0, t1 = speech_bounds(silences, duration)
    weights = [max(len(clean(t)), 1) for t in texts]
    total = sum(weights)
    pauses = [((a + b) / 2, a, b) for a, b in silences if a > t0 + 0.1 and b < t1 - 0.1]
    bounds = [(t0, t0)]
    used = set()
    acc = 0
    for w in weights[:-1]:
        acc += w
        expected = t0 + (t1 - t0) * acc / total
        # pause libre la plus proche de la frontière attendue, dans une fenêtre raisonnable
        candidates = [(abs(mid - expected), i, a, b) for i, (mid, a, b) in enumerate(pauses)
                      if i not in used and abs(mid - expected) < 1.6 and a > bounds[-1][1] + 0.3]
        if candidates:
            _, i, a, b = min(candidates)
            used.add(i)
            bounds.append((a, b))
        else:
            bounds.append((expected, expected))
    spans = []
    start = t0
    for b in bounds[1:]:
        spans.append((start, b[0]))
        start = b[1]
    spans.append((start, t1))
    return spans


def split_words(text: str, max_words: int = 4, max_chars: int = 26) -> list[str]:
    """Découpe une phrase en blocs courts lisibles sur téléphone, en coupant aux virgules."""
    words = clean(text).split()
    chunks, cur = [], []
    for w in words:
        trial = " ".join(cur + [w])
        if cur and (len(cur) >= max_words or len(trial) > max_chars):
            chunks.append(" ".join(cur))
            cur = []
        cur.append(w)
        if w.endswith((",", ";", ":", "…")) and len(cur) >= 2:
            chunks.append(" ".join(cur))
            cur = []
    if cur:
        # évite un mot orphelin à la fin
        if len(cur) == 1 and chunks and len(chunks[-1]) + len(cur[0]) < max_chars + 6:
            chunks[-1] += " " + cur[0]
        else:
            chunks.append(" ".join(cur))
    return chunks


def build_cues(segments: list[tuple[str, str]], spans: list[tuple[float, float]]) -> list[Cue]:
    """segments : liste (partie, texte). Les blocs se partagent le temps de leur phrase
    au prorata de leur longueur."""
    cues = []
    for idx, ((part, text), (a, b)) in enumerate(zip(segments, spans)):
        chunks = split_words(text)
        weights = [len(c) + 3 for c in chunks]
        total = sum(weights)
        t = a
        for c, w in zip(chunks, weights):
            d = (b - a) * w / total
            cues.append(Cue(round(t, 3), round(t + d, 3), c, idx, part))
            t += d
    return cues


def highlight_spans(text: str, language: str = "fr") -> list[tuple[str, bool]]:
    """Découpe le texte en morceaux (texte, mis_en_evidence)."""
    words = sorted(catalog.HIGHLIGHT_WORDS.get(language, []), key=len, reverse=True)
    if not words:
        return [(text, False)]
    pattern = re.compile("(" + "|".join(re.escape(w) for w in words) + ")", re.IGNORECASE)
    out = []
    for piece in pattern.split(text):
        if piece:
            out.append((piece, bool(pattern.fullmatch(piece))))
    return out


def _ts(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def to_srt(cues: list[Cue]) -> str:
    return "\n".join(f"{i}\n{_ts(c.start)} --> {_ts(c.end)}\n{c.text}\n"
                     for i, c in enumerate(cues, 1))


def from_srt(srt: str) -> list[Cue]:
    """Relit un SRT édité à la main (texte et horaires modifiables)."""
    cues = []
    for block in re.split(r"\n\s*\n", srt.strip()):
        lines = [l for l in block.strip().splitlines() if l.strip()]
        if len(lines) < 2:
            continue
        m = re.match(r"(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)",
                     lines[1] if "-->" in lines[1] else lines[0])
        if not m:
            continue
        g = [int(x) for x in m.groups()]
        start = g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000
        end = g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000
        text_lines = lines[2:] if "-->" in lines[1] else lines[1:]
        cues.append(Cue(start, end, " ".join(text_lines)))
    return cues


def cues_to_dicts(cues: list[Cue]) -> list[dict]:
    return [asdict(c) for c in cues]
