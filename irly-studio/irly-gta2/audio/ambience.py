# Sons naturels recréés pour chaque plan (aucune musique). Les clips d'origine avaient une bande-son musicale : coupée.
# Usage : python3 audio/ambience.py  -> audio/music.wav (nom attendu par mix.mjs ; ce n'est pas une musique)
import numpy as np, wave, os
SR = 48000; T = 54.4; N = int(SR * T)
rng = np.random.default_rng(7)
out = np.zeros((N, 2))
def noise(n): return rng.standard_normal(n)
def lp(x, a):  # passe-bas simple (a proche de 1 = plus grave)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)): acc = a * acc + (1 - a) * x[i]; y[i] = acc
    return y
def bp(x, lo, hi): return lp(x, lo) - lp(x, hi)
def seg(t0, t1): return int(t0 * SR), int(t1 * SR)
def env(n, fade=0.12):
    e = np.ones(n); f = int(fade * SR); e[:f] = np.linspace(0, 1, f); e[-f:] = np.linspace(1, 0, f); return e
def add(t0, t1, sig, gain, pan=0.0):
    a, b = seg(t0, t1); n = min(b - a, len(sig)); b = a + n; sig = sig[:n] * env(n) * gain
    out[a:b, 0] += sig * (1 - max(0, pan)); out[a:b, 1] += sig * (1 + min(0, pan))
def tt(n): return np.arange(n) / SR
# eau projetée (voiture sur l'eau) : bruit large qui « souffle » avec le mouvement
def spray(dur, rate=0.7):
    n = int(dur * SR); x = bp(noise(n), 0.995, 0.6); m = 0.55 + 0.45 * np.sin(2 * np.pi * rate * tt(n)) ** 2
    return x * m
def waves(dur):
    n = int(dur * SR); x = lp(noise(n), 0.985); m = 0.4 + 0.6 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.18 * tt(n))) ** 2
    return x * m
def wind(dur, depth=0.6):
    n = int(dur * SR); x = bp(noise(n), 0.998, 0.93); m = 1 - depth + depth * (0.5 + 0.5 * np.sin(2 * np.pi * 0.23 * tt(n) + 1.3 * np.sin(2 * np.pi * 0.07 * tt(n))))
    return x * m
def engine(dur, f0=58, detune=1.0):
    n = int(dur * SR); t = tt(n); f = f0 * detune * (1 + 0.06 * np.sin(2 * np.pi * 0.9 * t) + 0.02 * noise(n).cumsum() / np.sqrt(SR))
    ph = 2 * np.pi * np.cumsum(f) / SR; saw = 2 * ((ph / (2 * np.pi)) % 1) - 1
    return lp(saw * (0.7 + 0.3 * np.sin(ph * 0.5)) + 0.25 * noise(n), 0.85)
def pock(dur):  # impact de balle de padel
    n = int(dur * SR); t = tt(n); return (np.sin(2 * np.pi * 1450 * t) * 0.6 + bp(noise(n), 0.5, 0.05) * 0.5) * np.exp(-t * 55)
def boom(dur):
    n = int(dur * SR); t = tt(n); return lp(noise(n), 0.995) * 12 * np.exp(-t * 3.5) + np.sin(2 * np.pi * 55 * t) * np.exp(-t * 6) * 0.6
def crackle(dur):
    n = int(dur * SR); x = np.zeros(n); k = rng.integers(0, n, 260); x[k] = rng.uniform(-1, 1, 260); return bp(x, 0.6, 0.02) * 6 * np.exp(-tt(n) * 1.2)
def norm(x): return x / (np.max(np.abs(x)) + 1e-9)
# plans (débuts dans le film) — un clip par mission, v2
names=['heli','lambo','water','burj','rooftop','camels','quads','palm','khalifa','fireworks','club','irly']
durs=[3.6,3.6,4.5,3.5,4.0,5.0,4.5,4.0,4.2,4.5,4.6,8.4]
S={}; acc=0.0
for n,d in zip(names,durs): S[n]=(acc,acc+d); acc+=d
def rotor(dur):  # pales d'hélicoptère : impulsions graves régulières
    n=int(dur*SR); t=tt(n); x=lp(noise(n),0.97)*(0.35+0.65*(0.5+0.5*np.sign(np.sin(2*np.pi*11*t)))) ; return x+0.4*np.sin(2*np.pi*42*t)
def crowd(dur):  # foule qui crie / applaudit
    n=int(dur*SR); x=bp(noise(n),0.99,0.75); m=0.6+0.4*np.abs(np.sin(2*np.pi*0.7*tt(n)))+0.2*lp(noise(n),0.9995)*8; return x*m
a,b=S['heli']; add(a,b,norm(rotor(b-a)),0.25); add(a,b,norm(wind(b-a,0.3)),0.06)
a,b=S['lambo']; add(a,b,norm(engine(b-a,48)),0.22); add(a,b,norm(crowd(b-a)),0.05)
a,b=S['water']; add(a,b,norm(spray(b-a,0.6)),0.30); add(a,b,norm(engine(b-a,95)),0.05)
a,b=S['burj']; add(a,b,norm(waves(b-a)),0.20)
a,b=S['rooftop']; add(a,b,norm(waves(b-a)),0.09); add(a,b,norm(wind(b-a,0.4)),0.07)
a,b=S['camels']; add(a,b,norm(wind(b-a,0.7)),0.22)
a,b=S['quads']; add(a,b,norm(engine(b-a,62)),0.16,-0.2); add(a,b,norm(engine(b-a,62,1.13)),0.10,0.3); add(a,b,norm(wind(b-a,0.3)),0.06)
a,b=S['palm']; add(a,b,norm(waves(b-a)),0.08); add(a,b,norm(wind(b-a,0.3)),0.05)
a,b=S['khalifa']; add(a,b,norm(crowd(b-a)),0.07); add(a,b,norm(wind(b-a,0.3)),0.04)
a,b=S['fireworks']; add(a,b,norm(waves(b-a)),0.05)
for i,h in enumerate([0.2,0.9,1.5,2.3,2.9,3.6]): add(a+h,min(b,a+h+1.4),norm(boom(1.4)),0.30,pan=float(rng.uniform(-0.5,0.5))); add(a+h+0.25,min(b,a+h+1.4),norm(crackle(1.15)),0.07)
a,b=S['club']; add(a,b,norm(crowd(b-a)),0.20)
for h in [0.4,1.6,2.8]: add(a+h,min(b,a+h+1.0),norm(crackle(1.0)),0.10)
out = np.clip(out, -1, 1)
os.makedirs('audio', exist_ok=True)
with wave.open('audio/music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype('<i2').tobytes())
print('ok', out.shape)
