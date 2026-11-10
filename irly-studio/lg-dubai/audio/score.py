# /// script
# requires-python = ">=3.10"
# dependencies = ["librosa>=0.10", "numpy", "scipy", "soundfile"]
# ///
"""IRLY Loup-Garou : partition synthétisée (aucun son externe, donc utilisable en publicité).

96 BPM, 80 temps = 50 s (v3 : mode Dubaï). Ré mineur.
  0-8   nuit : vent, bourdon, hurlement de loup, impact, griffures
  8-24  jeu : percussions graves, ostinato
  24-36 modes : batterie complète
  36-52 Dubaï : ré « hijaz », darbouka (bols synthétisés), basse
  52-64 vraie vie : ré majeur, chaud
  64-72 final : montée, impact du logo, accord tenu
"""
import json, os, sys
from pathlib import Path
import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(os.environ["MOTION_REEL_SKILL"]) / "scripts"))
from dsp import *  # noqa

HERE = Path(__file__).resolve().parent
FILM = HERE.parent
BPM = 96
BEAT = 60 / BPM
NB = 80
DUR = NB * BEAT
N = int(SR * DUR)
seed(4401)

music, drums, fx = Bus(DUR, BPM), Bus(DUR, BPM), Bus(DUR, BPM)


def noise(n):
    return np.random.default_rng(7).standard_normal(n)


def wind(length):
    n = int(length * SR); t = tvec(n)
    fc = 500 + 380 * np.sin(2 * np.pi * 0.23 * t) + 200 * np.sin(2 * np.pi * 0.61 * t + 1)
    x = sweep_filter(noise(n), fc, "bandpass", 2.5)
    return x * np.clip(t / 1.2, 0, 1) * np.clip((length - t) / 1.5, 0, 1)


def howl(length=2.9):
    n = int(length * SR); t = tvec(n); p = t / length
    f = np.interp(p, [0, .12, .45, .75, 1], [330, 560, 600, 540, 380])
    f = f * (1 + 0.012 * np.sin(2 * np.pi * 5.2 * t) * np.clip(p * 3, 0, 1))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
    x += 0.08 * filt(noise(n), "bandpass", [800, 3000])
    x = peq(peq(x, 750, 6, 2), 1300, 4, 2)
    env = np.interp(p, [0, .08, .7, 1], [0, 1, .85, 0])
    return x * env


def scratch(length=0.32, f0=6000, f1=1800):
    n = int(length * SR); p = np.linspace(0, 1, n)
    x = sweep_filter(noise(n) * (1 + 0.6 * np.sign(np.sin(2 * np.pi * 70 * p * length))), f0 * (f1 / f0) ** p, "bandpass", 3)
    return x * np.sin(np.pi * p) ** 0.6


def tom(f0=90, length=0.7):
    n = int(length * SR); t = tvec(n)
    f = f0 * (1 + 0.6 * np.exp(-t / 0.04))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.28)
    x += filt(noise(n) * np.exp(-t / 0.01), "lowpass", 1200) * 0.4
    return np.tanh(1.5 * x)


def stereo_add(bus, sig, beat, gain=1.0):
    bus.add(sig, beat, gain)


# ---------------------------------------------------------------- harmonie
MIN = [("D", ["D3", "F3", "A3"]), ("Bb", ["Bb2", "D3", "F3"]), ("G", ["G2", "Bb2", "D3"]), ("A", ["A2", "C#3", "E3"])]
HIJ = [("D", ["D3", "F#3", "A3"]), ("Eb", ["Eb3", "G3", "Bb3"]), ("D", ["D3", "F#3", "A3"]), ("C", ["C3", "Eb3", "G3"])]
MAJ = [("D", ["D3", "F#3", "A3"]), ("B", ["B2", "D3", "F#3"]), ("G", ["G2", "B2", "D3"]), ("A", ["A2", "C#3", "E3"])]
LOFI = [("F", ["F3", "A3", "C4", "E4"]), ("E", ["E3", "G3", "B3", "D4"]), ("D", ["D3", "F3", "A3", "C4"]), ("D", ["D3", "F3", "A3", "C4"])]
BASS = {"D": "D2", "Bb": "Bb1", "G": "G1", "A": "A1", "Eb": "Eb2", "C": "C2", "B": "B1", "F": "F2", "E": "E2"}

def chords(start, end, prog, gain, kind="pad", cutoff=1600):
    for i, b in enumerate(range(start, end, 4)):
        root, notes = prog[i % len(prog)]
        if kind == "pad":
            music.add(pad_chord(notes, 4 * BEAT + 0.3, cutoff), b, gain)
        else:
            music.add(np.stack([keys(notes, 4 * BEAT)] * 2), b, gain)
        yield b, BASS[root]

# A 0-10 : la flemme, lofi tranquille
for b, bn in chords(0, 12, LOFI, 0.42, "keys"):
    for k in range(4):
        drums.add(kick(soft=True), b + k, 0.3 if k % 2 == 0 else 0.0)
        if k % 2:
            drums.add(clap(tight=True), b + k, 0.1)
        drums.add(hat(), b + k + 0.5, 0.035)
    music.add(bass_note(bn, BEAT * 3.5, 400), b, 0.22)
fx.add(riser(1.5 * BEAT), 9, 0.3)
# B 10.4-21.4 : IRLY, ça s'ouvre
drums.add(sub_drop(0.9), 10.4, 0.5)
for b, bn in chords(12, 21, MAJ, 0.36, "pad", 2600):
    for k in range(4):
        drums.add(kick(), b + k, 0.5 if k % 2 == 0 else 0.35)
        if k % 2:
            drums.add(clap(), b + k, 0.25)
        drums.add(hat(), b + k + 0.5, 0.07)
    music.add(bass_note(bn, BEAT * 1.8, 800), b, 0.3)
# C 21.4-30.7 : bascule nuit sur Dubaï (vent, hurlement, puis hijaz)
fx.add(whoosh(1.2, 300, 4000, 0.8), 21.0, 0.35)
music.add(wind(6 * BEAT), 21.4, 0.35)
music.add(pad_chord(["D2", "A2", "D3", "F#3"], 6 * BEAT, (200, 900), attack=0.6, release=0.5), 21.6, 0.6)
music.add(reverb(np.stack([howl(), howl()]) * 0.4, wet=0.6, length=2.4, decay=0.8), 22.4, 0.45)
drums.add(sub_drop(1.2), 22.6, 0.7)
drums.add(sub_drop(1.2), 26.6, 0.8)
fx.add(crash(2.0), 26.6, 0.25)
# D 26.6-46.6 : Dubaï, maqsum
for b, bn in chords(27, 47, HIJ, 0.36, "pad", 2600):
    for k in range(4):
        drums.add(kick(), b + k, 0.7 if k in (0, 2) else 0.0)
        if k in (1, 3):
            drums.add(clap(tight=True), b + k, 0.3)
    for off, name in [(0, "dha"), (0.5, "na"), (1.5, "na"), (2, "dha"), (3, "na"), (3.5, "ti")]:
        drums.add(bol(name, sa=587.33), b + off, 0.26, pan=0.25)
    music.add(bass_note(bn, BEAT * 1.9, 800), b, 0.4)
    for k, nt in enumerate(["D5", "Eb5", "F#5", "G5", "A5", "G5", "F#5", "Eb5"]):
        music.add(ks_pluck(hz(nt), 0.5, 0.7, 0.3), b + k * 0.5, 0.12, pan=0.4 if k % 2 else -0.2)
# E 46.6-58.7 : la partie
for b, bn in chords(47, 59, MIN, 0.4, "pad", 2000):
    for k in range(4):
        drums.add(kick(), b + k, 0.7 if k % 2 == 0 else 0.45)
        if k % 2:
            drums.add(clap(), b + k, 0.35)
        for h in range(2):
            drums.add(hat(), b + k + h * 0.5, 0.09 if h else 0.05)
    for k in range(8):
        music.add(bass_note(bn, BEAT * 0.45, 900), b + k * 0.5, 0.32)
# F 58.7-66.9 : les rencontres, chaud
for b, bn in chords(59, 67, MAJ, 0.42, "keys"):
    music.add(pad_chord(["D3", "F#3", "A3"], 4 * BEAT + 0.3, 1400, attack=0.3), b, 0.2)
    for k in range(4):
        drums.add(kick(soft=True), b + k, 0.5 if k % 2 == 0 else 0.3)
        if k % 2:
            drums.add(clap(), b + k, 0.22)
        drums.add(hat(), b + k + 0.5, 0.06)
    music.add(bass_note(bn, BEAT * 3.6, 700), b, 0.34)
fx.add(riser(2 * BEAT), 65, 0.4)
# G 67-80 : lancement
drums.add(sub_drop(2.0), 67, 1.0)
drums.add(kick(), 67, 1.0)
fx.add(crash(3.5), 67, 0.3)
for b, bn in chords(67, 79, HIJ, 0.38, "pad", 3000):
    for k in range(4):
        drums.add(kick(), b + k, 0.6 if k in (0, 2) else 0.0)
        drums.add(clap(tight=True), b + k, 0.25 if k in (1, 3) else 0.0)
    for off, name in [(0, "dha"), (1.5, "na"), (2, "dha"), (3, "na")]:
        drums.add(bol(name, sa=587.33), b + off, 0.22)
    music.add(bass_note(bn, BEAT * 1.9, 800), b, 0.35)
drums.add(sub_drop(1.5), 73.6, 0.8)
music.add(pad_chord(["D2", "A2", "D3", "F#3", "A3", "D4"], 6 * BEAT, (3500, 900), attack=0.02, release=1.5), 74, 0.5)

# ---------------------------------------------------------------- mix
def cut(b):
    return b.x[:, :N]

m = reverb(cut(music), wet=0.22, length=2.0, decay=0.55)
d = cut(drums)
f = reverb(cut(fx), wet=0.3)
mix = (m + d + f) * np.clip((DUR - tvec(N)) / 1.2, 0, 1)
mix = mix / np.abs(mix).max() * 10 ** (-3 / 20)
sf.write(HERE / "music.wav", mix.T.astype(np.float32), SR)
grid = {"bpm": BPM, "period": BEAT, "offset": 0.0, "beats": [round(i * BEAT, 5) for i in range(NB + 1)],
        "downbeats": [round(i * BEAT, 5) for i in range(0, NB + 1, 4)],
        "sections": [{"name": n, "beat": b} for n, b in [("flemme", 0), ("irly", 10.4), ("dubai", 21.4), ("personnages", 30.7), ("partie", 46.6), ("rencontres", 58.7), ("lancement", 66.9)]],
        "bar_energy": [0.3] * 3 + [0.55] * 3 + [0.7] * 6 + [0.85] * 3 + [0.6] * 2 + [0.9] * 3,
        "source": "audio/score.py (synthétisée, grille exacte)"}
(FILM / "beats.json").write_text(json.dumps(grid, indent=1))
print(f"music.wav {DUR:.2f}s, {NB} temps @ {BPM} bpm")
