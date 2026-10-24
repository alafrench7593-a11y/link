// IRLY motion engine: every frame is drawn from time alone (window.seek(t)), so a render is
// reproducible frame for frame. Durations follow the app's motion tokens (src/motion/tokens.ts):
// fast 0.16 s, standard 0.30 s, emphasized 0.50 s, cinematic 0.76 s, stagger 0.055 s.
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = {
  out: (x) => 1 - Math.pow(1 - x, 4), // arrivals
  expo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  in: (x) => x * x * x, // exits
  inOut: (x) => 0.5 - 0.5 * Math.cos(Math.PI * x), // camera moves
  linear: (x) => x,
  // Spring with the app's "soft" feel (damping ratio ~0.8): a touch of overshoot.
  spring: (x) => (x >= 1 ? 1 : 1 - Math.exp(-6.5 * x) * Math.cos(9 * x)),
};
const prog = (t, a, b, e = ease.out) => e(clamp((t - a) / (b - a)));

// ---- Image sequences (real screen recordings and films, as frame folders) ----
const SEQ = {};
function seq(name, dir, count, fps = 30) {
  SEQ[name] = { dir, count, fps };
}
async function showSeq(img, name, localT, { speed = 1, hold = true } = {}) {
  const s = SEQ[name];
  let i = Math.floor(localT * s.fps * speed);
  i = hold ? clamp(i, 0, s.count - 1) : ((i % s.count) + s.count) % s.count;
  const src = `${s.dir}/${String(i).padStart(5, '0')}.jpg`;
  if (img.dataset.cur !== src) {
    img.dataset.cur = src;
    img.src = src;
    try { await img.decode(); } catch {}
  }
}
async function showStill(img, src) {
  if (img.dataset.cur !== src) {
    img.dataset.cur = src;
    img.src = src;
    try { await img.decode(); } catch {}
  }
}

// ---- Words that rise in one by one, the way the app's home question arrives ----
function splitWords(el) {
  if (el.dataset.split) return;
  el.dataset.split = '1';
  // Wrap each word of every text node, keeping inline elements (italic accents, colours) intact.
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
        continue;
      }
      if (child.nodeType !== Node.TEXT_NODE) continue;
      const frag = document.createDocumentFragment();
      for (const part of child.textContent.split(/([ \t\n]+)/)) {
        if (!part) continue;
        if (/^[ \t\n]+$/.test(part)) {
          frag.appendChild(document.createTextNode(' '));
          continue;
        }
        const w = document.createElement('span');
        w.className = 'w';
        const inner = document.createElement('span');
        inner.textContent = part;
        w.appendChild(inner);
        frag.appendChild(w);
      }
      child.replaceWith(frag);
    }
  };
  walk(el);
}
// Each word fades up whole (opacity, a short rise, a blur that clears): no mask, so a letter,
// an accent or a descender is never cut while the line writes itself.
function words(el, t, start, { stagger = 0.075, dur = 0.55, out = Infinity, outDur = 0.3, rise = 0.35 } = {}) {
  splitWords(el);
  const ws = el.querySelectorAll('.w > span');
  ws.forEach((w, i) => {
    const k = prog(t, start + i * stagger, start + i * stagger + dur, ease.out);
    const o = 1 - prog(t, out, out + outDur, ease.in);
    w.style.transform = `translateY(${(1 - k) * rise}em)`;
    w.style.opacity = String(clamp(k * 1.25) * o);
    w.style.filter = k < 0.999 ? `blur(${(1 - k) * 10}px)` : 'none';
  });
}

function style(el, { o, x = 0, y = 0, s = 1, r = 0, blur = 0, clip } = {}) {
  if (o !== undefined) el.style.opacity = String(o);
  el.style.transform = `translate(${x}px, ${y}px) scale(${s}) rotate(${r}deg)`;
  el.style.filter = blur > 0.05 ? `blur(${blur}px)` : 'none';
  if (clip !== undefined) el.style.clipPath = clip;
}

// ---- Scenes ----
const SCENES = [];
function scene(id, start, end, render) {
  SCENES.push({ el: document.getElementById(id), start, end, render });
}
window.seek = async (t) => {
  const jobs = [];
  for (const s of SCENES) {
    const on = t >= s.start && t < s.end;
    s.el.style.display = on ? '' : 'none';
    if (on) jobs.push(s.render(t - s.start, t, s.end - s.start));
  }
  await Promise.all(jobs);
};
window.__ready = document.fonts.ready;
// ?f=45 lays the film out for the Instagram feed (4:5, 1080 x 1350); see video.css.
if (/[?&]f=45/.test(location.search)) document.documentElement.classList.add('f45');

// ---- The IRLY wordmark lighting up dot by dot (as in features/intro/AppIntro), accent last ----
function logoReveal(el, t, start, { sweep = 0.7, accentAt = 0.85 } = {}) {
  const cs = [...el.querySelectorAll('circle')];
  if (!el.dataset.sorted) {
    el.dataset.sorted = '1';
    const xs = cs.map((c) => Number(c.getAttribute('cx')));
    const max = Math.max(...xs);
    cs.forEach((c, i) => { c.dataset.k = String(xs[i] / max); c.style.transformBox = 'fill-box'; c.style.transformOrigin = 'center'; });
  }
  cs.forEach((c) => {
    // Accent dots sit above the caps: rows -2.2 and -1.2 of the glyph grid (see images/common.js).
    const pitch = Number(c.getAttribute('r')) / 0.44;
    const accent = Number(c.getAttribute('cy')) < 2.2 * pitch;
    const at = accent ? start + accentAt : start + Number(c.dataset.k) * sweep;
    const k = prog(t, at, at + (accent ? 0.5 : 0.28), accent ? ease.spring : ease.out);
    c.style.opacity = String(clamp(k * 1.5));
    c.style.transform = `scale(${accent ? k : 0.6 + 0.4 * k})`;
  });
}

// A phone that plays one or more real screen recordings, one after the other.
async function phonePlay(img, t, plays) {
  for (const p of plays) {
    if (t >= p.at && (p.until === undefined || t < p.until)) {
      if (p.still) return showStill(img, p.still);
      return showSeq(img, p.seq, t - p.at, { speed: p.speed || 1 });
    }
  }
}
