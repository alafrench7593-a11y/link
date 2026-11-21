// IRLY — « Dubaï c'est déjà GTA » (51 s, 9:16). Aucune musique : sons naturels recréés + notifications de mission.
// Chaque clip vidéo est chargé image par image (assets/clips/<plan>/fNNNN.jpg, 30 i/s) via prepare().
// Les incrustations s'inspirent des jeux en monde ouvert sans reprendre l'identité d'un jeu existant.
import * as M from './lib/motion.js';


const { W, H, E, TAU, prog, lerp, clamp, springU, SPRING, font, layout, text, fill, cover, rrect, bump, hash01 } = M;
const EN = false;
const SUBS_ON = false;
const C = { bg: '#050506', ink: '#0B0B0D', white: '#FFFFFF', steel: '#8EA5BF', steelL: '#C9D6E4', mute: 'rgba(255,255,255,0.62)', green: '#34C759', red: '#FF453A', gold: '#F2C14E', blue: '#0A84FF' };
const D = 'Display', UI = 'UI';
const SW = 1170, SH = 2532;
// ---------------------------------------------------------------- temps
const sp = (t, t0, cfg = SPRING.snappy) => springU(M.U(t), M.U(t0), cfg);
const io = (t, a, b, c, d) => prog(t, a, b) * (1 - prog(t, c, d)); // monte a→b, descend c→d
function hexA(hex, a) { const [r, g, b] = M.hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }

// ---------------------------------------------------------------- outils de dessin
function bgPhoto(ctx, img, { zoom = 1, fx = 0.5, fy = 0.5, alpha = 1, dark = 0, blur = 0 } = {}) {
  if (!img || alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha; if (blur) ctx.filter = `blur(${blur}px)`;
  const m = blur ? 60 : 0; cover(ctx, img, -m, -m, W + 2 * m, H + 2 * m, { fx, fy, zoom }); ctx.restore();
  if (dark > 0) { ctx.fillStyle = `rgba(5,5,6,${dark * alpha})`; ctx.fillRect(0, 0, W, H); }
}
function vignette(ctx, k = 0.6) {
  const g = ctx.createRadialGradient(W / 2, H * 0.45, W * 0.3, W / 2, H * 0.5, H * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${k})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function shade(ctx, top = 0.75, bottom = 0.5) {
  let g = ctx.createLinearGradient(0, 0, 0, H * 0.4); g.addColorStop(0, `rgba(5,5,6,${top})`); g.addColorStop(1, 'rgba(5,5,6,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.4);
  g = ctx.createLinearGradient(0, H * 0.58, 0, H); g.addColorStop(0, 'rgba(5,5,6,0)'); g.addColorStop(1, `rgba(5,5,6,${bottom})`); ctx.fillStyle = g; ctx.fillRect(0, H * 0.58, W, H * 0.42);
}
function glow(ctx, x, y, r, color, a) { if (a <= 0) return; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, hexA(color, a)); g.addColorStop(1, hexA(color, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }
// Lumières qui dérivent (bokeh de ville la nuit).
function bokeh(ctx, t, n = 18, a = 0.35, seed = 3, color = '#FFD9A0') {
  ctx.save();
  for (let i = 0; i < n; i++) {
    const x = ((hash01(i, seed) + t * 0.006 * (0.5 + hash01(i, seed + 1))) % 1) * W;
    const y = H * (0.1 + 0.8 * hash01(i, seed + 2)) + 20 * Math.sin(t * 0.4 + i);
    const r = 30 + 90 * hash01(i, seed + 3);
    ctx.globalAlpha = a * (0.4 + 0.6 * hash01(i, seed + 4)) * (0.7 + 0.3 * Math.sin(t * 1.3 + i));
    glow(ctx, x, y, r, i % 3 ? color : C.steelL, 0.5);
  }
  ctx.restore();
}
// Mots qui montent un par un derrière un masque ; la ligne se réduit si elle dépasse maxW.
function words(ctx, str, cx, y, size, color, t, t0, { weight = 800, family = UI, step = 0.07, maxW = 940, track = -0.01, out = null, shadow = true, align = 'center' } = {}) {
  let f = font(size, weight, family);
  const w0 = layout(ctx, str, f, track * size).width;
  if (w0 > maxW) { size = size * maxW / w0; f = font(size, weight, family); }
  const ok = out == null ? 1 : 1 - E.inCubic(prog(t, out, out + 0.3));
  if (ok <= 0 || t < t0 - 0.05) return;
  const L = layout(ctx, str, f, track * size);
  let x = align === 'center' ? cx - L.width / 2 : cx;
  const spaceW = size * 0.28 + track * size;
  str.split(' ').forEach((w, k) => {
    const Lw = layout(ctx, w, f, track * size);
    const p = sp(t, t0 + k * step);
    if (p > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(x - 30, y - size * 1.1, Lw.width + 60, size * 1.45); ctx.clip();
      ctx.globalAlpha = ok;
      if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = size * 0.35; }
      text(ctx, w, x, y + (1 - p) * size * 1.15 - (1 - ok) * size * 0.4, f, color, 'left', track * size);
      ctx.restore();
    }
    x += Lw.width + spaceW;
  });
}
const head = (ctx, str, y, size, color, t, t0, o = {}) => words(ctx, str, W / 2, y, size, color, t, t0, o);
function pill(ctx, str, cx, cy, size, fg, bg, { a = 1, border = null, weight = 800, icon = null } = {}) {
  if (a <= 0) return;
  const f = font(size, weight, UI); const L = layout(ctx, str, f);
  const iw = icon ? size * 1.2 : 0, w = L.width + size * 1.5 + iw, h = size * 2.1;
  ctx.save(); ctx.globalAlpha = a; rrect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
  if (border) { ctx.lineWidth = 3; ctx.strokeStyle = border; ctx.stroke(); }
  if (icon === 'check') { ctx.strokeStyle = fg; ctx.lineWidth = size * 0.16; ctx.lineCap = 'round'; ctx.beginPath(); const x0 = cx - w / 2 + size * 0.75, y0 = cy; ctx.moveTo(x0, y0); ctx.lineTo(x0 + size * 0.3, y0 + size * 0.3); ctx.lineTo(x0 + size * 0.8, y0 - size * 0.35); ctx.stroke(); }
  if (icon === 'lock') lockIcon(ctx, cx - w / 2 + size * 1.05, cy, size * 0.75, fg);
  text(ctx, str, cx + iw / 2, cy + size * 0.36, f, fg, 'center'); ctx.restore();
}
function lockIcon(ctx, x, y, s, color, open = 0) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = color; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, -s * 0.15 - open * s * 0.35, s * 0.32, Math.PI, 0); ctx.lineTo(s * 0.32, -s * 0.05 - open * s * 0.35); ctx.stroke();
  rrect(ctx, -s * 0.48, -s * 0.12, s * 0.96, s * 0.72, s * 0.14); ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}
function tag(ctx, label, a, y = 190) { // mention discrète en haut à gauche
  if (a <= 0) return;
  const f = font(24, 700, UI), L = layout(ctx, label, f, 1.5);
  ctx.save(); ctx.globalAlpha = a; rrect(ctx, 64, y - 30, L.width + 36, 44, 22); ctx.fillStyle = 'rgba(5,5,6,0.66)'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.stroke();
  text(ctx, label, 82, y, f, 'rgba(255,255,255,0.86)', 'left', 1.5); ctx.restore();
}
// Carte photo : cadre blanc fin, ombre, légère inclinaison.
function photoCard(ctx, img, cx, cy, w, h, { rot = 0, k = 1, a = 1, fx = 0.5, fy = 0.5, zoom = 1, sat = 1, label = null, crop = null } = {}) {
  if (!img || k <= 0 || a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(k, k);
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
  rrect(ctx, -w / 2 - 10, -h / 2 - 10, w + 20, h + 20, 38); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.save(); if (sat < 1) ctx.filter = `saturate(${sat}) brightness(${0.6 + 0.4 * sat})`;
  if (crop) { ctx.save(); rrect(ctx, -w / 2, -h / 2, w, h, 30); ctx.clip(); const [sx, sy, sw, sh] = crop; const s = Math.max(w / sw, h / sh) * zoom; ctx.drawImage(img, sx, sy, sw, sh, -sw * s / 2, -sh * s / 2, sw * s, sh * s); ctx.restore(); }
  else cover(ctx, img, -w / 2, -h / 2, w, h, { fx, fy, zoom, radius: 30 });
  ctx.restore();
  if (label) pill(ctx, label, 0, h / 2 - 70, 34, C.ink, C.white, { weight: 900 });
  ctx.restore();
}
// Téléphone dont l'écran est dessiné en coordonnées de capture (1170x2532).
function phone(ctx, cx, cy, w, drawScreen, { rotY = 0, tilt = 0, alpha = 1, scale = 1, glowA = 0 } = {}) {
  const h = w * SH / SW, r = w * 0.13, sx = Math.cos(rotY);
  if (Math.abs(sx) < 0.01 || alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.rotate(tilt); ctx.scale(sx * scale, scale);
  ctx.shadowColor = glowA ? hexA(C.steelL, 0.5 * glowA) : 'rgba(0,0,0,0.75)'; ctx.shadowBlur = glowA ? 90 : 70; ctx.shadowOffsetY = glowA ? 0 : 30;
  rrect(ctx, -w / 2 - 14, -h / 2 - 14, w + 28, h + 28, r + 14); ctx.fillStyle = '#111'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke();
  if (sx > 0) { ctx.save(); rrect(ctx, -w / 2, -h / 2, w, h, r); ctx.clip(); ctx.translate(-w / 2, -h / 2); ctx.scale(w / SW, w / SW); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH); drawScreen(ctx); ctx.restore(); }
  ctx.restore();
}
const shot = (s, img, dy = 0, a = 1) => { if (!img || a <= 0) return; s.save(); s.globalAlpha *= a; s.drawImage(img, 0, dy, SW, SH); s.restore(); };
// Défilement réel entre deux captures prises 1260 px plus bas : seul le contenu glisse.
function scrollPair(s, A, B, p, d = 1260) {
  p = clamp(p); const T = 170, Bt = 2200, band = Bt - T;
  const drawBand = (img, off) => { if (img) s.drawImage(img, 0, T, SW, band, 0, T + off, SW, band); };
  s.fillStyle = '#000'; s.fillRect(0, 0, SW, SH);
  s.save(); s.beginPath(); s.rect(0, T, SW, band); s.clip(); drawBand(A, -d * p);
  s.save(); s.beginPath(); s.rect(0, Bt - d * p, SW, d * p + 1); s.clip(); drawBand(B, d * (1 - p)); s.restore(); s.restore();
  const C2 = p > 0.5 ? B : A; if (C2) { s.drawImage(C2, 0, 0, SW, T, 0, 0, SW, T); s.drawImage(C2, 0, Bt, SW, SH - Bt, 0, Bt, SW, SH - Bt); }
}
function navTo(s, A, B, p, mode = 'push') {
  p = E.outCubic(clamp(p));
  if (p <= 0) { shot(s, A); return; }
  if (mode === 'push') { s.save(); s.translate(-SW * 0.25 * p, 0); shot(s, A); s.restore(); s.save(); s.translate(SW * (1 - p), 0); s.shadowColor = 'rgba(0,0,0,0.6)'; s.shadowBlur = 60; shot(s, B); s.restore(); }
  else if (mode === 'sheet') { shot(s, A); s.fillStyle = `rgba(0,0,0,${0.45 * p})`; s.fillRect(0, 0, SW, SH); s.save(); s.translate(0, SH * (1 - p)); shot(s, B); s.restore(); }
  else { shot(s, A); shot(s, B, 0, p); }
}
function tap(s, t, t0, x, y, k = 1) {
  const a = prog(t, t0 - 0.22, t0 - 0.06) * (1 - prog(t, t0 + 0.22, t0 + 0.38)); if (a <= 0) return;
  const press = bump(t, t0, 0.12);
  s.save(); s.globalAlpha = a; s.fillStyle = 'rgba(255,255,255,0.3)'; s.strokeStyle = 'rgba(255,255,255,0.95)'; s.lineWidth = 6 * k;
  s.beginPath(); s.arc(x, y, (70 - 14 * press) * k, 0, TAU); s.fill(); s.stroke();
  const rp = prog(t, t0, t0 + 0.32); if (rp > 0 && rp < 1) { s.globalAlpha = a * (1 - rp); s.beginPath(); s.arc(x, y, (70 + 160 * rp) * k, 0, TAU); s.stroke(); }
  s.restore();
}
// Des visages autour du téléphone : les portraits d'exemple de l'app. Aucun chiffre de membres.
const FACES = ['p-samuel', 'p-layla', 'p-nadia', 'p-omar', 'g-zara', 'p-chloe', 'p-james', 'p-khalid', 'p-amira', 'p-priya', 'p-noah', 'p-sofia', 'p-ketut', 'p-yusuf', 'w-adaeze', 'w-naomi', 'p-lea', 'p-arjun', 'g-sofia', 'p-mia', 'w-salma', 'p-jonas', 'g-maya', 'p-elena'];
function face(ctx, IMG, i, x, y, r, a = 1, ring = 'rgba(255,255,255,0.92)', online = true) {
  if (r <= 0 || a <= 0) return;
  const img = IMG['face' + (i % FACES.length)];
  ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.arc(x, y, r + Math.max(2, r * 0.08), 0, TAU); ctx.fillStyle = ring; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip(); if (img) cover(ctx, img, x - r, y - r, 2 * r, 2 * r, { fy: 0.35 }); ctx.restore();
  if (online && r > 24) { ctx.beginPath(); ctx.arc(x + r * 0.7, y + r * 0.7, r * 0.2, 0, TAU); ctx.fillStyle = C.green; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.bg; ctx.stroke(); }
  ctx.restore();
}
function faceCloud(ctx, t, IMG, t0, t1, seed = 0, top = 560) {
  const out = 1 - E.inCubic(prog(t, t1 - 0.3, t1)); if (out <= 0 || t < t0) return;
  for (let i = 0; i < 12; i++) {
    const k = sp(t, t0 + i * 0.07, SPRING.bouncy); if (k <= 0) continue;
    const right = i % 2 === 1, row = i >> 1;
    const x = (right ? 975 : 105) + (hash01(i, 7 + seed) - 0.5) * 40;
    const y = top + row * 170 + (hash01(i, 11 + seed) - 0.5) * 60 + 10 * Math.sin(t * 2 + i);
    face(ctx, IMG, i + seed * 5, x, y, (42 + 14 * hash01(i, 13 + seed)) * k, clamp(k * 2) * out);
  }
}
// Sous-titres : bande sombre, une ou deux lignes, au-dessus de l'interface TikTok.
function subtitles(ctx, t, list) {
  if (!SUBS_ON) return;
  const cur = list.find(([a, b]) => t >= a - 0.05 && t < b + 0.12); if (!cur) return;
  const [a, , str] = cur; const k = E.outCubic(prog(t, a - 0.05, a + 0.1));
  const f = font(48, 800, UI), maxW = 860;
  const lines = []; let line = '';
  for (const w of str.split(' ')) { const tryL = line ? line + ' ' + w : w; if (layout(ctx, tryL, f).width > maxW && line) { lines.push(line); line = w; } else line = tryL; }
  lines.push(line);
  const lh = 62, y0 = 1470 - (lines.length - 1) * lh;
  ctx.save(); ctx.globalAlpha = k;
  lines.forEach((l, i) => {
    const Lw = layout(ctx, l, f).width, y = y0 + i * lh;
    rrect(ctx, W / 2 - Lw / 2 - 22, y - 46, Lw + 44, 62, 14); ctx.fillStyle = 'rgba(5,5,6,0.78)'; ctx.fill();
    text(ctx, l, W / 2, y + (1 - k) * 10, f, C.white, 'center');
  });
  ctx.restore();
}



// ---------------------------------------------------------------- les plans (clip, durée) dans l'ordre du montage
// Zoo (hippocampe) : à insérer dès réception de la vidéo (voir docs/GTA_DUBAI.md).
const SHOTS = [
  { id: 'hook', clip: 'hook', dur: 3.5 },
  { id: 'burj', clip: 'burj', dur: 3.5 },
  { id: 'water', clip: 'water', dur: 4.9, label: 'NOUVELLE MISSION', title: 'Rouler sur l’eau', at: 0.15 },
  { id: 'rooftop', clip: 'rooftop', dur: 5.5, label: 'POINT DE VUE DÉBLOQUÉ', title: 'Coucher de soleil sur la mer', at: 0.6 },
  { id: 'padel', photo: 'padel', dur: 4.0, label: 'MISSION SPORT', title: 'Faire une partie de padel', at: 0.35 },
  { id: 'camels', clip: 'camels', dur: 5.5, label: 'NOUVELLE ZONE DÉBLOQUÉE', title: 'Le désert', at: 0.2, label2: 'OBJECTIF', title2: 'Safari à dos de chameau', at2: 2.4 },
  { id: 'quads', clip: 'quads', dur: 5.5, label: 'NOUVELLE MISSION', title: 'Course de quads dans les dunes', at: 0.25 },
  { id: 'palm', clip: 'palm', dur: 4.7, label: 'OBJECTIF', title: 'Piscine avec vue sur la Palm', at: 0.5 },
  { id: 'fireworks', clip: 'fireworks', dur: 6.0, label: 'MISSION DE NUIT', title: 'Feux d’artifice en mer', at: 0.6 },
  { id: 'irly', dur: 7.9 },
];
let acc = 0; for (const s of SHOTS) { s.t0 = acc; acc += s.dur; }
const TOTAL = acc; // 51 s
const shotAt = (t) => SHOTS.find((s) => t >= s.t0 && t < s.t0 + s.dur) || SHOTS[SHOTS.length - 1];

// ---------------------------------------------------------------- images des clips, chargées à la demande
const cache = new Map();
const frameKey = (clip, i) => `assets/clips/${clip}/f${String(i).padStart(4, '0')}.jpg`;
const frameIndex = (s, t) => Math.max(1, Math.min(Math.round(s.dur * 30), 1 + Math.floor((t - s.t0) * 30)));
async function load(src) {
  if (cache.has(src)) return cache.get(src);
  const im = new Image(); im.src = src; await im.decode().catch(() => null);
  cache.set(src, im); if (cache.size > 90) cache.delete(cache.keys().next().value);
  return im;
}
async function prepare(t) { const s = shotAt(t); if (s.clip) await load(frameKey(s.clip, frameIndex(s, t))); }
function clipFrame(ctx, s, t, { zoom = 1, dark = 0 } = {}) {
  const im = cache.get(frameKey(s.clip, frameIndex(s, t)));
  if (im && im.width) cover(ctx, im, 0, 0, W, H, { zoom }); else fill(ctx, '#000');
  if (dark > 0) { ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(0, 0, W, H); }
}

// ---------------------------------------------------------------- texte blanc avec contour noir, zone haute (loin des boutons et de la légende TikTok)
function outlined(ctx, str, x, y, size, { weight = 900, family = UI, color = '#fff', align = 'center', maxW = 960, stroke = 0.16, a = 1 } = {}) {
  if (a <= 0) return;
  let f = font(size, weight, family); const w = layout(ctx, str, f).width; if (w > maxW) { size *= maxW / w; f = font(size, weight, family); }
  ctx.save(); ctx.globalAlpha = a; ctx.font = f; ctx.textAlign = align; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  ctx.lineWidth = size * stroke; ctx.strokeStyle = '#000'; ctx.strokeText(str, x, y); ctx.fillStyle = color; ctx.fillText(str, x, y); ctx.restore();
}
// Carte de mission : petite étiquette, trait qui se dessine, titre qui glisse depuis la gauche.
function mission(ctx, t, t0, label, title, y = 330, { out = null, accent = C.gold } = {}) {
  if (t < t0) return;
  const k = E.outCubic(prog(t, t0, t0 + 0.3)), kt = E.outCubic(prog(t, t0 + 0.12, t0 + 0.45));
  const o = out == null ? 1 : 1 - prog(t, out - 0.25, out);
  if (o <= 0) return;
  ctx.save(); ctx.globalAlpha = o;
  const lf = font(34, 900, UI), lw = layout(ctx, label, lf, 4).width;
  ctx.translate((1 - k) * -120, 0);
  rrect(ctx, W / 2 - lw / 2 - 26, y - 44, lw + 52, 60, 10); ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fill();
  ctx.fillStyle = accent; ctx.fillRect(W / 2 - lw / 2 - 26, y - 44, 8, 60);
  text(ctx, label, W / 2 + 4, y - 2, lf, accent, 'center', 4);
  ctx.restore();
  ctx.save(); ctx.globalAlpha = o; ctx.fillStyle = accent; ctx.fillRect(W / 2 - 280 * kt, y + 30, 560 * kt, 5); ctx.restore();
  ctx.save(); ctx.translate((1 - kt) * 80, 0); outlined(ctx, title, W / 2, y + 120, 76, { a: o * kt }); ctx.restore();
}
function done(ctx, t, t0, str, y = 560) { // tampon « accompli »
  if (t < t0) return; const k = E.outBack(prog(t, t0, t0 + 0.25), 2.4), o = 1 - prog(t, t0 + 1.4, t0 + 1.7); if (o <= 0) return;
  ctx.save(); ctx.translate(W / 2, y); ctx.scale(k, k); ctx.globalAlpha = o; outlined(ctx, str, 0, 0, 64, { color: C.green }); ctx.restore();
}

// ---------------------------------------------------------------- l'accroche : interface de jeu générique sur le premier plan
function hud(ctx, t, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  // mini-carte en haut à droite
  const cx = W - 150, cy = 330, r = 92;
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = 'rgba(20,30,40,0.75)'; ctx.fill(); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 6; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx - r + ((i * 37 + t * 20) % 60), cy - r); ctx.lineTo(cx - r + ((i * 37 + t * 20) % 60) + 80, cy + r); ctx.stroke(); }
  ctx.fillStyle = '#3BA4FF'; ctx.globalAlpha = a * 0.7; ctx.fillRect(cx - r, cy - r, r * 0.8, r * 2);
  ctx.restore();
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(cx, cy - 18); ctx.lineTo(cx + 12, cy + 12); ctx.lineTo(cx, cy + 5); ctx.lineTo(cx - 12, cy + 12); ctx.closePath(); ctx.fill();
  // barres vie / énergie sous la mini-carte
  [[C.green, 0.82], ['#3BA4FF', 0.55]].forEach(([c, v], i) => { const y = cy + r + 26 + i * 18; rrect(ctx, cx - r, y, r * 2, 11, 5); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill(); rrect(ctx, cx - r, y, r * 2 * v, 11, 5); ctx.fillStyle = c; ctx.fill(); });
  // compteur d'argent en haut à droite au-dessus de la carte (style jeu, sans chiffre de personnes)
  outlined(ctx, 'AED 0', cx + r, cy - r - 24, 40, { align: 'right', color: '#9BE37B' });
  ctx.restore();
}
function scan(ctx, a) { if (a <= 0) return; ctx.save(); ctx.globalAlpha = 0.08 * a; ctx.fillStyle = '#000'; for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2); ctx.restore(); }

// ---------------------------------------------------------------- les scènes
let IMGS = {};
function sceneClip(ctx, s, t, IMG) {
  const lt = t - s.t0;
  clipFrame(ctx, s, t, { zoom: 1.0 + 0.03 * prog(lt, 0, s.dur) });
  const g = ctx.createLinearGradient(0, 180, 0, 760); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 180, W, 580);
  if (s.label) mission(ctx, t, s.t0 + s.at, s.label, s.title, 330, { out: s.label2 ? s.t0 + s.at2 : s.t0 + s.dur });
  if (s.label2) mission(ctx, t, s.t0 + s.at2, s.label2, s.title2, 330, { out: s.t0 + s.dur });
}
function scenePadel(ctx, s, t, IMG) {
  const lt = t - s.t0;
  // la photo bouge au rythme des échanges : petits coups de zoom sur chaque « pock »
  let p = 0; [0.35, 1.25, 2.1, 2.95].forEach((a) => { p += bump(lt, a, 0.12); });
  bgPhoto(ctx, IMG.padel, { zoom: 1.12 - 0.06 * prog(lt, 0, s.dur) + 0.025 * p, fx: 0.5 + 0.04 * Math.sin(lt * 1.3), fy: 0.55 });
  const g = ctx.createLinearGradient(0, 180, 0, 760); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 180, W, 580);
  mission(ctx, t, s.t0 + s.at, s.label, s.title, 330, { out: s.t0 + s.dur });
}
function sceneHook(ctx, s, t) {
  clipFrame(ctx, s, t, { zoom: 1.04 });
  scan(ctx, 1); hud(ctx, t, 1 - prog(t, 3.3, 3.5));
  const g = ctx.createLinearGradient(0, 180, 0, 900); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 180, W, 720);
  const a1 = E.outCubic(prog(t, 0.15, 0.4)), a2 = E.outCubic(prog(t, 1.5, 1.75));
  outlined(ctx, 'POV : t’as pas de potes à Dubaï,', W / 2 - 40, 560, 60, { a: a1, maxW: 820 });
  outlined(ctx, 'donc tu saignes GTA 6…', W / 2 - 40, 650, 60, { a: a2, maxW: 820 });
  // le « bug » qui fait sortir du jeu
  const gl = prog(t, 3.2, 3.5); if (gl > 0) { ctx.save(); for (let i = 0; i < 8; i++) { const y = hash01(i + Math.floor(t * 30), 3) * H, h = 30 + 90 * hash01(i, 5); ctx.drawImage(ctx.canvas, 0, y * M.DPR, W * M.DPR, h * M.DPR, (hash01(i + Math.floor(t * 30), 9) - 0.5) * 120 * gl, y, W, h); } ctx.restore(); }
}
function sceneBurj(ctx, s, t) {
  clipFrame(ctx, s, t, { zoom: 1.06 - 0.04 * prog(t - s.t0, 0, s.dur) });
  const g = ctx.createLinearGradient(0, 180, 0, 900); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 180, W, 720);
  const a = E.outCubic(prog(t, s.t0 + 0.2, s.t0 + 0.45)), b = E.outCubic(prog(t, s.t0 + 0.9, s.t0 + 1.15));
  outlined(ctx, '… alors que dehors,', W / 2, 520, 66, { a });
  outlined(ctx, 'Dubaï c’est déjà GTA 😭', W / 2, 620, 72, { a: b, color: '#fff' });
}
function sceneIrly(ctx, s, t, IMG) {
  const lt = t - s.t0;
  bgPhoto(ctx, cache.get(frameKey('fireworks', 180)) || null, { blur: 30, dark: 0.65, zoom: 1.2 });
  if (!cache.get(frameKey('fireworks', 180))) fill(ctx, '#05060A');
  bokeh(ctx, t, 16, 0.3, 9, '#BFD4FF');
  // le vrai écran « Lancer une activité » : on propose une activité
  const pk = sp(t, s.t0 + 0.05, SPRING.gentle);
  phone(ctx, W / 2, lerp(H + 500, 1180, pk), 470, (sc) => {
    navTo(sc, IMG.social1, IMG.create, prog(lt, 0.9, 1.25), 'sheet');
    tap(sc, t, s.t0 + 0.75, 585, 2151);
    tap(sc, t, s.t0 + 1.7, 243, 1422 - 0); tap(sc, t, s.t0 + 2.2, 811, 1557); tap(sc, t, s.t0 + 2.8, 584, 2365);
  }, { tilt: -0.02 * (1 - pk) });
  mission(ctx, t, s.t0 + 0.3, 'MISSION PRINCIPALE', 'Trouve avec qui faire tout ça à Dubaï.', 330, { accent: C.green, out: s.t0 + 4.3 });
  // fin : IRLY · App gratuite · Lien en bio (figé)
  const e = E.outCubic(prog(t, s.t0 + 4.35, s.t0 + 4.7));
  if (e > 0) {
    ctx.save(); ctx.globalAlpha = e;
    if (IMG.logo) { const lw = 300, lh = lw * IMG.logo.height / IMG.logo.width; ctx.drawImage(IMG.logo, W / 2 - lw / 2, 230, lw, lh); }
    ctx.restore();
    outlined(ctx, 'IRLY · App gratuite · Lien en bio', W / 2, 470, 58, { a: e, color: '#fff' });
  }
}

// ---------------------------------------------------------------- sons courts de notification (pas de boucle)
const B = (s) => s / 0.5;
const HITS = [];
SHOTS.forEach((s) => {
  if (s.label) HITS.push([B(s.t0 + s.at), 'mission ' + s.id, 'blip+bell', { pitch: 'E6', gain: 0.5 }]);
  if (s.label2) HITS.push([B(s.t0 + s.at2), 'objectif ' + s.id, 'blip', { pitch: 'A6', gain: 0.5 }]);
});
HITS.push([B(3.2), 'bug', 'click'], [B(SHOTS[9].t0 + 0.3), 'mission principale', 'bell', { pitch: 'A5' }], [B(SHOTS[9].t0 + 4.35), 'fin', 'blip', { pitch: 'D6' }]);

M.film({
  fonts: [font(100, 900, D), font(40, 900, UI), font(40, 800, UI), font(40, 700, UI)],
  images: { padel: 'assets/photos/padel.jpg', create: 'assets/real/create.png', social1: 'assets/real/social_01.png', logo: 'assets/irly_wordmark_ivory.png' },
  hits: HITS,
  samples: 1,
  prepare: async (t) => { await prepare(t); if (t > SHOTS[9].t0 - 0.1) await load(frameKey('fireworks', 180)); },
  init(ctx, IMG) { IMGS = IMG; },
  draw(ctx, u, t, IMG) {
    const s = shotAt(t);
    if (s.id === 'hook') sceneHook(ctx, s, t);
    else if (s.id === 'burj') sceneBurj(ctx, s, t);
    else if (s.id === 'padel') scenePadel(ctx, s, t, IMG);
    else if (s.id === 'irly') sceneIrly(ctx, s, t, IMG);
    else sceneClip(ctx, s, t, IMG);
  },
});
