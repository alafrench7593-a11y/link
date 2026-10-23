"""Original music and sound design for the IRLY films, synthesised from scratch (no samples,
no third-party rights). python3 music.py <cue.json> <out.wav>

cue.json: {
  "duration": 30, "bpm": 100, "key": "A",
  "energy": [[0, 0], [4, 1], [8, 2], [24, 1], [27, 3]],   # level from t on: 0 pad, 1 +arp, 2 +beat, 3 +full
  "sfx": [[3.9, "whoosh"], [8.0, "tick"], [27.0, "shimmer"]],
  "end": 30
}
"""
import json
import sys
import wave

import numpy as np

SR = 44100
cue = json.load(open(sys.argv[1]))
out = sys.argv[2]
dur = float(cue["duration"])
bpm = float(cue.get("bpm", 100))
beat = 60.0 / bpm
n = int(dur * SR)
t = np.arange(n) / SR
rng = np.random.default_rng(7)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def energy_at(x):
    lvl = 0
    for at, e in cue["energy"]:
        if x >= at:
            lvl = e
    return lvl


# Energy curve per sample, smoothed so layers fade in and out instead of switching.
lv = np.array([energy_at(x) for x in np.arange(0, dur, 0.01)])
lv_s = np.repeat(lv, SR // 100)[:n]
lv_s = np.pad(lv_s, (0, max(0, n - len(lv_s))), mode="edge")
k = int(0.6 * SR)
# Moving average through a cumulative sum (a 0.6 s convolution kernel is far too slow).
c = np.cumsum(np.pad(lv_s, (k // 2, k - k // 2), mode="edge"))
lv_s = (c[k:] - c[:-k])[:n] / k


def gate(level):
    return np.clip(lv_s - (level - 1), 0, 1)


# Am - F - C - G, one chord per bar (4 beats), warm voicings around A3.
root = {"A": 57, "C": 60, "D": 62, "E": 64}[cue.get("key", "A")] - 57
progression = [[57, 60, 64, 69], [53, 57, 60, 65], [55, 60, 64, 67], [55, 59, 62, 67]]
bar = 4 * beat


def chord_at(x):
    return [m + root for m in progression[int(x // bar) % 4]]


mix = np.zeros(n)

# Pad: additive soft partials, slow attack on each chord, gentle detune for width.
pad = np.zeros(n)
nbars = int(np.ceil(dur / bar)) + 1
for b in range(nbars):
    s0 = int(b * bar * SR)
    s1 = min(n, int((b + 1) * bar * SR + 0.8 * SR))
    if s0 >= n:
        break
    tt = t[s0:s1] - b * bar
    env = np.minimum(1, tt / 0.9) * np.exp(-np.maximum(0, tt - bar) / 0.35)
    seg = np.zeros(s1 - s0)
    for m in chord_at(b * bar + 0.01):
        f = hz(m - 12 if m > 64 else m)
        for h in range(1, 6):
            for det in (-0.12, 0.12):
                seg += np.sin(2 * np.pi * f * h * (1 + det / 100) * tt + h) / (h ** 1.6)
    pad[s0:s1] += seg * env
pad *= 0.030
mix += pad

# Arpeggio: plucked sine eighth notes walking up the chord.
arp = np.zeros(n)
step = beat / 2
i = 0
while i * step < dur:
    x = i * step
    notes = chord_at(x)
    m = notes[i % 4] + 12
    s0 = int(x * SR)
    s1 = min(n, s0 + int(0.6 * SR))
    tt = t[s0:s1] - x
    tone = np.sin(2 * np.pi * hz(m) * tt) + 0.3 * np.sin(2 * np.pi * hz(m) * 2 * tt)
    arp[s0:s1] += tone * np.exp(-tt / 0.18) * np.minimum(1, tt / 0.004)
    i += 1
mix += arp * 0.055 * gate(1)

# Beat: soft kick on every beat, closed hat on off-beats, clap on 2 and 4.
kick = np.zeros(n)
hat = np.zeros(n)
clap = np.zeros(n)
j = 0
while j * beat < dur:
    x = j * beat
    s0 = int(x * SR)
    s1 = min(n, s0 + int(0.35 * SR))
    tt = t[s0:s1] - x
    f = 48 + 90 * np.exp(-tt / 0.035)
    kick[s0:s1] += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.16)
    h0 = int((x + beat / 2) * SR)
    h1 = min(n, h0 + int(0.06 * SR))
    if h0 < n:
        hat[h0:h1] += rng.standard_normal(h1 - h0) * np.exp(-(t[h0:h1] - x - beat / 2) / 0.012)
    if j % 2 == 1:
        c1 = min(n, s0 + int(0.2 * SR))
        clap[s0:c1] += rng.standard_normal(c1 - s0) * np.exp(-(t[s0:c1] - x) / 0.05)
    j += 1
hat = np.diff(hat, prepend=0)  # crude high-pass: keeps the tick, drops the hiss body
hat = np.convolve(hat, np.ones(3) / 3, mode="same")  # and rounds off the harshest top
mix += kick * 0.20 * gate(2) + hat * 0.022 * gate(2) + clap * 0.035 * gate(3)

# Bass: root note, eighth-note pulse in full sections.
bass = np.zeros(n)
i = 0
while i * step < dur:
    x = i * step
    m = chord_at(x)[0] - 24
    s0 = int(x * SR)
    s1 = min(n, s0 + int(step * SR))
    tt = t[s0:s1] - x
    bass[s0:s1] += (np.sin(2 * np.pi * hz(m) * tt) + 0.25 * np.sin(4 * np.pi * hz(m) * tt)) * np.exp(-tt / 0.25)
    i += 1
mix += bass * 0.11 * gate(3)

# Sound design.
for at, kind in cue.get("sfx", []):
    s0 = int(at * SR)
    if kind == "whoosh":
        L = int(0.55 * SR)
        s0 = max(0, s0 - int(0.35 * SR))
        s1 = min(n, s0 + L)
        noise = rng.standard_normal(s1 - s0)
        # Moving average of decreasing width: the sweep brightens towards the cut.
        tt = np.linspace(0, 1, s1 - s0)
        lo = np.convolve(noise, np.ones(24) / 24, mode="same")
        hi = noise - np.convolve(noise, np.ones(4) / 4, mode="same")
        env = np.sin(np.pi * tt) ** 2
        mix[s0:s1] += (lo * (1 - 0.5 * tt) + hi * tt * 0.22) * env * 0.075
    elif kind == "tick":
        s1 = min(n, s0 + int(0.05 * SR))
        tt = t[s0:s1] - at
        mix[s0:s1] += np.sin(2 * np.pi * 1850 * tt) * np.exp(-tt / 0.008) * 0.10
    elif kind == "pop":
        s1 = min(n, s0 + int(0.12 * SR))
        tt = t[s0:s1] - at
        f = 900 - 500 * tt / 0.12
        mix[s0:s1] += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.03) * 0.12
    elif kind == "shimmer":
        s1 = min(n, s0 + int(2.4 * SR))
        tt = t[s0:s1] - at
        sh = np.zeros(s1 - s0)
        for m in (81, 84, 88, 93):
            sh += np.sin(2 * np.pi * hz(m + root) * tt) * np.exp(-tt / 0.9)
        mix[s0:s1] += sh * np.minimum(1, tt / 0.02) * 0.05
    elif kind == "hit":
        s1 = min(n, s0 + int(1.6 * SR))
        tt = t[s0:s1] - at
        f = 42 + 60 * np.exp(-tt / 0.06)
        mix[s0:s1] += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.5) * 0.32

# Master: fade out, normalise to -1 dBFS peak, stereo with a slight delay on the right for width.
end = float(cue.get("end", dur))
fade = np.clip((end - t) / 1.6, 0, 1)
fade_in = np.clip(t / 0.4, 0, 1)
mix *= fade * fade_in
mix /= max(1e-9, np.max(np.abs(mix))) / 0.89
d = int(0.012 * SR)
right = np.concatenate([np.zeros(d), mix[:-d]]) * 0.9 + mix * 0.1
stereo = np.stack([mix, right], axis=1)
pcm = (np.clip(stereo, -1, 1) * 32767).astype(np.int16)
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wav", out, f"{dur:.1f}s")
