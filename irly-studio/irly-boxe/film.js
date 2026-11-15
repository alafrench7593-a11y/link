// IRLY × Jake Paul vs Cédric Doumbé — vidéo concours (40 s, 9:16, rendu natif 2160x3840 avec DSF=2).
// Variantes (même code) : irly-boxe (affiches + sous-titres), irly-boxe-clean (affiches, sans sous-titres),
// irly-boxe-safe (sans les affiches ni les visages des boxeurs : à utiliser tant que MVP n'a pas autorisé leur usage).
// IRLY n'est ni organisateur ni partenaire de l'événement : c'est dit à l'écran.
// Temps en secondes, calés sur la transcription horodatée de chaque voix (table T plus bas).
// Écrans : captures réelles de la version démo de l'app (contenus d'exemple).
// Ce qui n'existe pas dans l'app (compteur des 100 inscrits, invitation) est une animation étiquetée « illustration ».
// Aucune interface de l'App Store n'est reproduite ; aucun logo Apple n'est dessiné.
import * as M from './lib/motion.js';
import { SUBS } from './subs.js';

const { W, H, E, TAU, prog, lerp, clamp, springU, SPRING, font, layout, text, fill, cover, rrect, bump, hash01 } = M;
const VARIANT = location.pathname.includes('irly-boxe-safe') ? 'safe' : location.pathname.includes('irly-boxe-clean') ? 'clean' : 'main';
const POSTERS = VARIANT !== 'safe';
const SUBS_ON = VARIANT !== 'clean';
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



// ---------------------------------------------------------------- minutage (début des phrases de la voix, posée à 0,4 s)
const T = { hook: 0.48, want: 3.5, s2: 6.2, irly: 8.56, s3: 9.39, free: 11.2, meet: 12.64, comm: 14.24, orga: 15.28, notDating: 17.12, friends: 19.12, s4: 20.86, concours: 22.4, places: 24.36, s5: 25.33, join: 27.12, share: 28.6, rules: 30.35, s6: 32.43, alone: 33.56, rejoins: 36.32, tente: 38.4, end: 39.7 };
const GOLD = '#E8C36A';
let IMGS = {};
function logo(ctx, IMG, cx, cy, w, k, a = 1) {
  if (!IMG.logo || k <= 0 || a <= 0) return;
  const h = w * IMG.logo.height / IMG.logo.width;
  ctx.save(); ctx.globalAlpha = a * clamp(k * 1.5); ctx.translate(cx, cy); ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
  ctx.shadowColor = 'rgba(201,214,228,0.55)'; ctx.shadowBlur = 50; ctx.drawImage(IMG.logo, -w / 2, -h / 2, w, h); ctx.restore();
}
function bigLine(ctx, str, y, size, color, t, t0, o = {}) { words(ctx, str, W / 2, y, size, color, t, t0, { family: D, weight: 900, step: 0.06, maxW: 960, ...o }); }
function flash(ctx, t, t0, k = 0.7, w = 0.12) { const f = bump(t, t0, w); if (f > 0) { ctx.fillStyle = `rgba(255,255,255,${k * f})`; ctx.fillRect(0, 0, W, H); } }
function sparks(ctx, t, t0, n = 40, cx = W / 2, cy = 900, color = GOLD) { // éclats au moment des annonces
  const p = prog(t, t0, t0 + 1.4); if (p <= 0 || p >= 1) return;
  ctx.save();
  for (let i = 0; i < n; i++) { const a = hash01(i, 41) * TAU, v = 300 + 900 * hash01(i, 42); const x = cx + Math.cos(a) * v * E.outCubic(p), y = cy + Math.sin(a) * v * E.outCubic(p) + 500 * p * p;
    ctx.globalAlpha = (1 - p) * (0.6 + 0.4 * hash01(i, 43)); ctx.fillStyle = i % 3 ? color : '#fff'; ctx.beginPath(); ctx.arc(x, y, 4 + 6 * hash01(i, 44), 0, TAU); ctx.fill(); }
  ctx.restore();
}
// Affiche officielle recadrée : on coupe la bande des logos de sponsors en bas (y > 768).
const OFF = { w: 647, h: 752 };
function posterCard(ctx, IMG, cx, cy, w, { k = 1, rot = 0, tiltY = 0, a = 1, glowA = 0 } = {}) {
  const img = IMG.official; if (!img || k <= 0 || a <= 0) return;
  const h = w * OFF.h / OFF.w;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(k * Math.cos(tiltY), k);
  ctx.shadowColor = glowA ? `rgba(232,195,106,${0.6 * glowA})` : 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = glowA ? 0 : 30;
  rrect(ctx, -w / 2, -h / 2, w, h, 26); ctx.fillStyle = '#000'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.save(); rrect(ctx, -w / 2, -h / 2, w, h, 26); ctx.clip(); ctx.drawImage(img, 0, 0, OFF.w, OFF.h, -w / 2, -h / 2, w, h);
  // reflet qui glisse
  const p = (t0g * 0.3) % 1, xx = -w + p * w * 3; const g = ctx.createLinearGradient(xx - 140, 0, xx + 140, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore(); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(232,195,106,0.7)'; rrect(ctx, -w / 2, -h / 2, w, h, 26); ctx.stroke();
  ctx.restore();
}
let t0g = 0;
function santaBanner(ctx, IMG, cx, cy, w, { k = 1, a = 1, zoom = 1 } = {}) { // affiche « Santa vs Grinch », sans les bandes noires
  const img = IMG.santa; if (!img || k <= 0 || a <= 0) return;
  const sy = 100, sh = 490, h = w * sh / 1200;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(k, k); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 70;
  rrect(ctx, -w / 2, -h / 2, w, h, 24); ctx.fillStyle = '#000'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.save(); rrect(ctx, -w / 2, -h / 2, w, h, 24); ctx.clip(); const zw = 1200 / zoom, zh = sh / zoom; ctx.drawImage(img, (1200 - zw) / 2, sy + (sh - zh) / 2, zw, zh, -w / 2, -h / 2, w, h); ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(232,195,106,0.7)'; rrect(ctx, -w / 2, -h / 2, w, h, 24); ctx.stroke(); ctx.restore();
}
function ticket(ctx, cx, cy, w, rot, k, a = 1) { // billet stylisé : aucune vraie référence de place ni de prix
  if (k <= 0 || a <= 0) return;
  const h = w * 0.42;
  ctx.save(); ctx.globalAlpha = a * clamp(k * 1.5); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(k, k);
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
  ctx.beginPath(); ctx.moveTo(-w / 2 + 24, -h / 2); ctx.lineTo(w / 2 - 24, -h / 2); ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + 24); ctx.lineTo(w / 2, h / 2 - 24); ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - 24, h / 2); ctx.lineTo(-w / 2 + 24, h / 2); ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - 24); ctx.lineTo(-w / 2, -h / 2 + 24); ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + 24, -h / 2); ctx.closePath();
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, '#F6DE9A'); g.addColorStop(0.5, GOLD); g.addColorStop(1, '#B98E36'); ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = 'transparent';
  // encoches et pointillés
  const nx = w * 0.22; ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(nx, -h / 2, 22, 0, TAU); ctx.arc(nx, h / 2, 22, 0, TAU); ctx.fill();
  ctx.setLineDash([10, 10]); ctx.strokeStyle = 'rgba(40,28,8,0.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(nx, -h / 2 + 30); ctx.lineTo(nx, h / 2 - 30); ctx.stroke(); ctx.setLineDash([]);
  const s = w / 640;
  text(ctx, 'PLACE À GAGNER', -w / 2 + 40 * s, -h / 2 + 62 * s, font(30 * s, 800, UI), '#3A2A0A', 'left', 3 * s);
  text(ctx, 'PAUL vs DOUMBÉ', -w / 2 + 40 * s, 8 * s, font(58 * s, 900, D), '#1A1206', 'left');
  text(ctx, '24 DÉC. · DUBAÏ', -w / 2 + 40 * s, h / 2 - 34 * s, font(32 * s, 800, UI), '#3A2A0A', 'left', 2 * s);
  ctx.save(); ctx.translate(nx + (w / 2 - nx) / 2, 0); ctx.rotate(-Math.PI / 2); text(ctx, 'IRLY', 0, 14 * s, font(46 * s, 900, UI), '#1A1206', 'center', 6 * s); ctx.restore();
  ctx.restore();
}
function disclaimer(ctx, a, y = 1690) {
  if (a <= 0) return; ctx.save(); ctx.globalAlpha = a;
  text(ctx, 'IRLY n’est ni organisateur ni partenaire de l’événement.', W / 2, y, font(24, 700, UI), 'rgba(255,255,255,0.6)', 'center'); ctx.restore();
}

// ---------------------------------------------------------------- S1 l'accroche (0 → 6,2)
function s1(ctx, t, IMG) {
  fill(ctx, '#050505');
  const img = IMG.official;
  if (POSTERS && img) {
    bgPhoto(ctx, img, { blur: 40, dark: 0.55, zoom: 1.4, fy: 0.25 });
    // face-à-face : les deux visages (recadrés dans l'affiche) arrivent de chaque côté, en parallaxe
    const k = E.outCubic(prog(t, 0.0, 1.0)), out = E.inCubic(prog(t, 3.2, 3.9));
    const fw = 560, fh = fw * 440 / 323;
    const drift = 14 * Math.sin(t * 1.3);
    [[0, 0, 323, 440, -1], [324, 0, 323, 440, 1]].forEach(([sx, sy, sw, sh, side]) => {
      const x = W / 2 + side * (lerp(W, fw / 2 - 10, k) + out * 600) + side * drift, y = 860 - side * 10;
      ctx.save(); ctx.translate(x, y); ctx.rotate(side * 0.02);
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 60; ctx.fillStyle = '#000'; ctx.fillRect(-fw / 2, -fh / 2, fw, fh); ctx.shadowColor = 'transparent';
      ctx.beginPath(); ctx.rect(-fw / 2, -fh / 2, fw, fh); ctx.clip(); const z = 1.08 + 0.06 * prog(t, 0, 3.5);
      ctx.drawImage(img, sx + sw * (1 - 1 / z) / 2, sy + sh * (1 - 1 / z) / 2, sw / z, sh / z, -fw / 2, -fh / 2, fw, fh); ctx.restore();
    });
    // l'affiche complète se révèle quand la question tombe
    const pk = sp(t, 3.4, SPRING.gentle);
    t0g = t; posterCard(ctx, IMG, W / 2, 1010, 620, { k: pk, rot: -0.02 + 0.01 * Math.sin(t), tiltY: 0.25 * (1 - pk) + 0.06 * Math.sin(t * 0.8), glowA: 0.4 });
  } else {
    bgPhoto(ctx, IMG.dubaiNight, { zoom: 1.25 - 0.1 * prog(t, 0, 6), dark: 0.45 });
    const k = E.outCubic(prog(t, 0.0, 0.9));
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 40;
    text(ctx, 'JAKE', lerp(-400, W / 2, k), 700, font(150, 900, D), '#fff', 'center'); text(ctx, 'PAUL', lerp(-400, W / 2, k), 840, font(190, 900, D), '#fff', 'center');
    text(ctx, 'VS', W / 2, 960, font(80, 900, D), GOLD, 'center');
    text(ctx, 'CÉDRIC', lerp(W + 400, W / 2, k), 1080, font(120, 900, D), C.green, 'center'); text(ctx, 'DOUMBÉ', lerp(W + 400, W / 2, k), 1220, font(170, 900, D), C.green, 'center');
    ctx.restore();
  }
  flash(ctx, t, 0.9, 0.6); flash(ctx, t, 3.4, 0.5);
  shade(ctx, 0.85, 0.35);
  bigLine(ctx, 'JAKE PAUL VS CÉDRIC DOUMBÉ', 300, 76, '#fff', t, T.hook, { out: 3.3 });
  bigLine(ctx, 'À DUBAÏ.', 400, 96, GOLD, t, 2.4, { out: 3.3 });
  bigLine(ctx, 'TU VEUX Y ALLER ?', 290, 104, '#fff', t, T.want, { out: 6.0 });
  bigLine(ctx, 'MAIS T’AS PERSONNE AVEC QUI ?', 400, 70, C.steelL, t, 4.5, { out: 6.0 });
  vignette(ctx, 0.55);
}
// ---------------------------------------------------------------- S2 la solution (6,2 → 9,39)
function s2(ctx, t, IMG) {
  fill(ctx, C.bg);
  const back = E.inOutCubic(prog(t, T.s2, T.s2 + 0.8));
  if (POSTERS) { t0g = t; ctx.save(); ctx.filter = `blur(${Math.round(18 * back)}px)`; posterCard(ctx, IMG, W / 2, lerp(1010, 900, back), lerp(620, 900, back), { k: 1, a: 1 - 0.75 * back }); ctx.restore(); ctx.fillStyle = `rgba(5,5,6,${0.5 * back})`; ctx.fillRect(0, 0, W, H); }
  else bgPhoto(ctx, IMG.dubaiNight, { blur: 30, dark: 0.6, zoom: 1.2 });
  bokeh(ctx, t, 18, 0.3, 5, '#BFD4FF');
  const k = sp(t, T.s2 + 0.3, SPRING.gentle);
  phone(ctx, W / 2, lerp(H + 700, 1150, k), 520, (s) => navTo(s, IMG.intro, IMG.home_00, prog(t, T.irly, T.irly + 0.35), 'fade'), { rotY: lerp(0.9, 0, k) + 0.05 * Math.sin(t), tilt: -0.03, glowA: 0.3 });
  logo(ctx, IMG, W / 2, 560, 380, sp(t, T.irly - 0.2, SPRING.bouncy));
  bigLine(ctx, 'T’INQUIÈTE,', 290, 100, '#fff', t, T.s2, { out: 9.2 });
  bigLine(ctx, 'ON A PENSÉ À TOI !', 400, 86, C.green, t, 7.0, { out: 9.2 });
  vignette(ctx, 0.45);
}
// ---------------------------------------------------------------- S3 IRLY (9,39 → 20,86) : écrans réels
function s3(ctx, t, IMG) {
  fill(ctx, C.bg); bokeh(ctx, t, 16, 0.28, 8, '#BFD4FF'); glow(ctx, W / 2, 1150, 800, C.steel, 0.25);
  const seq = [[T.s3, 'home_00'], [T.comm, 'messages'], [T.orga, 'social_01'], [T.notDating, 'padel'], [T.friends, 'social_00']];
  let i = 0; seq.forEach((s, j) => { if (t >= s[0]) i = j; });
  phone(ctx, W / 2, 1150, 520, (s) => {
    if (i === 0 && t > T.s3 + 0.6) scrollPair(s, IMG.home_00, IMG.home_01, E.inOutCubic(prog(t, T.s3 + 0.6, T.comm - 0.3)));
    else navTo(s, IMG[seq[Math.max(0, i - 1)][1] === 'home_00' ? 'home_01' : seq[Math.max(0, i - 1)][1]], IMG[seq[i][1]], prog(t, seq[i][0], seq[i][0] + 0.35), 'push');
    if (i === 2) tap(s, t, T.orga + 1.2, 585, 2151);
  }, { rotY: 0.1 * Math.sin(t * 0.8), tilt: 0.02 * Math.sin(t * 0.5) });
  shade(ctx, 0.85, 0.3);
  const fk = sp(t, T.free, SPRING.bouncy); if (fk > 0) { ctx.save(); ctx.translate(W / 2 + 300, 640); ctx.rotate(0.08); ctx.scale(fk, fk); pill(ctx, '100 % GRATUIT', 0, 0, 42, '#fff', C.green, { weight: 900, a: 1 - prog(t, 20.6, 20.86) }); ctx.restore(); }
  bigLine(ctx, 'RENCONTRE DU MONDE', 300, 92, '#fff', t, T.meet - 0.2, { out: T.orga - 0.15 });
  bigLine(ctx, 'À DUBAÏ', 410, 104, C.green, t, T.meet + 0.3, { out: T.orga - 0.15 });
  bigLine(ctx, 'ORGANISE', 300, 104, '#fff', t, T.orga, { out: T.friends - 0.15 });
  bigLine(ctx, 'TES SORTIES', 410, 104, C.green, t, T.orga + 0.3, { out: T.friends - 0.15 });
  bigLine(ctx, 'FAIS-TOI', 300, 104, '#fff', t, T.friends, { out: 20.7 });
  bigLine(ctx, 'DE VRAIS AMIS', 410, 104, C.green, t, T.friends + 0.3, { out: 20.7 });
  const nk = sp(t, T.notDating, SPRING.bouncy); if (nk > 0) { ctx.save(); ctx.translate(W / 2, 520); ctx.scale(nk, nk); pill(ctx, 'Pas une appli de rencontres amoureuses', 0, 0, 34, C.ink, '#fff', { weight: 900, a: 1 - prog(t, T.friends - 0.2, T.friends) }); ctx.restore(); }
  tag(ctx, 'ÉCRANS RÉELS DE L’APP · CONTENUS DE DÉMO', 0.9, 1680);
  vignette(ctx, 0.45);
}
// ---------------------------------------------------------------- S4 le concours (20,86 → 25,33)
function s4(ctx, t, IMG) {
  fill(ctx, '#060504');
  glow(ctx, W / 2, 900, 900, GOLD, 0.18 + 0.12 * prog(t, T.concours, T.concours + 0.5));
  bokeh(ctx, t, 22, 0.35, 12, '#FFD9A0');
  if (POSTERS) {
    const k1 = sp(t, T.s4 + 0.1, SPRING.gentle), k2 = sp(t, T.s4 + 0.5, SPRING.gentle);
    santaBanner(ctx, IMG, W / 2, lerp(-300, 760, k1), 980, { k: 1, zoom: 1.0 + 0.06 * prog(t, T.s4, T.s5) });
    t0g = t; posterCard(ctx, IMG, W / 2, lerp(H + 600, 1230, k2), 470, { rot: 0.03, tiltY: 0.05 * Math.sin(t), glowA: 0.6 * prog(t, T.concours, T.concours + 0.4) });
    ctx.fillStyle = `rgba(6,5,4,${0.55 * prog(t, T.concours, T.concours + 0.3)})`; ctx.fillRect(0, 0, W, H);
  }
  flash(ctx, t, T.concours, 0.8, 0.14); sparks(ctx, t, T.concours, 60, W / 2, 900);
  // billets
  [[-250, 1080, -0.18, 0], [250, 1180, 0.14, 0.15], [0, 1300, -0.04, 0.3]].forEach(([dx, y, r, d]) => {
    const k = sp(t, T.places + d - 0.4, SPRING.bouncy);
    ticket(ctx, W / 2 + dx, y + 20 * Math.sin(t * 2 + d * 10), 560, r + 0.04 * Math.sin(t * 1.5 + d), k);
  });
  sparks(ctx, t, T.places - 0.3, 40, W / 2, 1180);
  const zk = E.outBack(prog(t, T.concours, T.concours + 0.3), 2) * (t >= T.concours ? 1 : 0);
  if (zk > 0) { ctx.save(); ctx.translate(W / 2, 420); ctx.scale(zk, zk); ctx.shadowColor = 'rgba(232,195,106,0.8)'; ctx.shadowBlur = 50;
    text(ctx, 'DES PLACES', 0, -40, font(140, 900, D), '#fff', 'center'); text(ctx, 'À GAGNER !', 0, 100, font(150, 900, D), GOLD, 'center'); ctx.restore(); }
  bigLine(ctx, 'ET POUR FÊTER L’OUVERTURE D’IRLY…', 380, 56, '#fff', t, T.s4, { out: T.concours - 0.35 });
  words(ctx, 'JAKE PAUL VS CÉDRIC DOUMBÉ · 24 DÉCEMBRE · DUBAÏ', W / 2, 640, 40, '#fff', t, T.concours + 0.4, { weight: 800, track: 0.04, maxW: 960 });
  disclaimer(ctx, prog(t, T.s4 + 0.3, T.s4 + 0.6), 1690);
  vignette(ctx, 0.5);
}
// ---------------------------------------------------------------- S5 comment participer (25,33 → 32,43)
function s5(ctx, t, IMG) {
  fill(ctx, C.bg); bokeh(ctx, t, 16, 0.25, 7, '#BFD4FF');
  const steps = [[T.s5, '1. TÉLÉCHARGE IRLY'], [T.join, '2. REJOINS LA COMMUNAUTÉ'], [T.share, '3. PARTAGE L’APPLICATION']];
  steps.forEach(([t0, s], j) => {
    const k = sp(t, t0, SPRING.snappy); if (k <= 0) return;
    const y = 300 + j * 120, active = (j === 2 ? t >= t0 : t >= t0 && t < steps[j + 1][0]);
    ctx.save(); ctx.translate(lerp(-W, 0, k), 0); ctx.globalAlpha = active ? 1 : 0.5;
    const f = font(60, 900, D); let lw = layout(ctx, s, f).width, ff = f; if (lw > 880) { ff = font(60 * 880 / lw, 900, D); lw = 880; }
    rrect(ctx, W / 2 - lw / 2 - 40, y - 64, lw + 80, 92, 46); ctx.fillStyle = active ? '#fff' : 'rgba(255,255,255,0.12)'; ctx.fill();
    text(ctx, s, W / 2, y, ff, active ? C.ink : '#fff', 'center'); ctx.restore();
  });
  const k = sp(t, T.s5, SPRING.gentle);
  const cy = 1180;
  if (t < T.join) { // étape 1 : l'icône réelle de l'app
    const ik = sp(t, T.s5 + 0.15, SPRING.bouncy);
    if (IMG.icon && ik > 0) { ctx.save(); ctx.translate(W / 2, cy - 180); ctx.scale(ik, ik); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 60; rrect(ctx, -170, -170, 340, 340, 76); ctx.fillStyle = '#000'; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.clip(); ctx.drawImage(IMG.icon, -170, -170, 340, 340); ctx.restore(); }
    const ak = sp(t, T.s5 + 0.6, SPRING.bouncy); if (ak > 0) { ctx.save(); ctx.translate(W / 2, cy + 110); ctx.scale(ak, ak); rrect(ctx, -240, -60, 480, 120, 26); ctx.fillStyle = '#000'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke(); text(ctx, 'Disponible sur l’', 0, -10, font(24, 700, UI), '#fff', 'center'); text(ctx, 'App Store', 0, 38, font(46, 800, UI), '#fff', 'center'); ctx.restore(); }
  } else if (t < T.share) { // étape 2 : les communautés (écran réel)
    const pk = sp(t, T.join, SPRING.gentle);
    phone(ctx, W / 2, lerp(H + 500, cy + 80, pk), 460, (s) => shot(s, IMG.messages), { rotY: 0.08 * Math.sin(t), tilt: -0.02 });
    tag(ctx, 'ÉCRAN RÉEL DE L’APP · CONTENUS DE DÉMO', 0.9, 1680);
  } else { // étape 3 : partager (icône de partage, illustration)
    const sk = sp(t, T.share, SPRING.bouncy);
    ctx.save(); ctx.translate(W / 2, cy); ctx.scale(sk, sk); ctx.beginPath(); ctx.arc(0, 0, 170, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, -90); ctx.moveTo(-45, -45); ctx.lineTo(0, -90); ctx.lineTo(45, -45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-40, -10); ctx.lineTo(-75, -10); ctx.lineTo(-75, 90); ctx.lineTo(75, 90); ctx.lineTo(75, -10); ctx.lineTo(40, -10); ctx.stroke(); ctx.restore();
    for (let j = 0; j < 8; j++) { const p = E.outCubic(prog(t, T.share + 0.3 + j * 0.12, T.share + 1.1 + j * 0.12)); if (p <= 0) continue; const a = j / 8 * TAU - 0.4; ctx.save(); ctx.globalAlpha = 1 - prog(t, T.rules + 0.6, T.rules + 1); ctx.fillStyle = j % 2 ? C.green : C.blue; ctx.beginPath(); ctx.arc(W / 2 + Math.cos(a) * 340 * p, cy + Math.sin(a) * 340 * p, 26, 0, TAU); ctx.fill(); ctx.restore(); }
  }
  const rk = sp(t, T.rules, SPRING.bouncy);
  if (rk > 0) { ctx.save(); ctx.translate(W / 2, 1560); ctx.scale(rk, rk); pill(ctx, 'Règles du concours : très bientôt', 0, 0, 40, '#1A1206', GOLD, { weight: 900 }); ctx.restore(); }
  ctx.save(); ctx.globalAlpha = 0.8; text(ctx, 'Étapes indicatives, en attendant le règlement officiel', W / 2, 1690, font(24, 700, UI), 'rgba(255,255,255,0.6)', 'center'); ctx.restore();
  vignette(ctx, 0.45);
}
// ---------------------------------------------------------------- S6 final (32,43 → 40)
function s6(ctx, t, IMG) {
  bgPhoto(ctx, IMG.dubaiNight, { zoom: 1.2 - 0.08 * prog(t, T.s6, 40), dark: 0.5 });
  if (POSTERS) { t0g = t; ctx.save(); ctx.filter = 'blur(14px)'; posterCard(ctx, IMG, W / 2, 1000, 900, { k: 1, a: 0.16 }); ctx.restore(); ctx.fillStyle = 'rgba(5,5,6,0.45)'; ctx.fillRect(0, 0, W, H); }
  bokeh(ctx, t, 20, 0.35, 9, '#BFD4FF');
  flash(ctx, t, T.s6, 0.5);
  bigLine(ctx, 'ALORS, TU ATTENDS QUOI ?', 330, 80, '#fff', t, T.s6, { out: T.alone - 0.1 });
  logo(ctx, IMG, W / 2, 700, 560, sp(t, T.alone, SPRING.bouncy));
  words(ctx, 'MAKE FRIENDS IRL', W / 2, 870, 46, C.steelL, t, T.alone + 0.3, { weight: 800, track: 0.18 });
  bigLine(ctx, 'NE RESTE PLUS SEUL À DUBAÏ.', 1040, 72, '#fff', t, T.alone + 0.2);
  bigLine(ctx, 'TÉLÉCHARGE IRLY MAINTENANT.', 1140, 72, '#fff', t, T.rejoins);
  const fk = sp(t, T.rejoins + 0.9, SPRING.bouncy); if (fk > 0) { ctx.save(); ctx.translate(W / 2, 1270); ctx.scale(fk, fk); pill(ctx, '100 % GRATUIT', 0, 0, 46, '#fff', C.green, { weight: 900 }); ctx.restore(); }
  const tk = sp(t, T.tente, SPRING.bouncy); if (tk > 0) { ticket(ctx, W / 2 + 330, 560, 300, 0.2, tk); ticket(ctx, W / 2 - 330, 600, 300, -0.2, sp(t, T.tente + 0.12, SPRING.bouncy)); }
  disclaimer(ctx, prog(t, T.alone, T.alone + 0.4), 1690);
  vignette(ctx, 0.45);
}

const B = (s) => s / 0.625;
const HITS = [
  [B(0.05), 'entrée', 'whoosh', { len: 0.6, from: 300, to: 2400 }],
  [B(0.9), 'face-à-face', 'impact'], [B(2.4), 'Dubaï', 'thud'], [B(3.4), 'affiche', 'impact'],
  [B(T.s2), 'recul', 'whoosh', { len: 0.5, from: 1800, to: 400 }], [B(T.s2 + 0.4), 'téléphone', 'whoosh', { len: 0.5, from: 400, to: 2600 }],
  [B(T.irly - 0.2), 'logo', 'bell', { pitch: 'D6' }],
  [B(T.free), 'gratuit', 'pop', { pitch: 'A5' }],
  [B(T.meet - 0.2), 'rencontre', 'thud'], [B(T.comm), 'communautés', 'tick'], [B(T.orga), 'organise', 'thud'], [B(T.notDating), 'pas dating', 'blip', { pitch: 'E6' }], [B(T.friends), 'vrais amis', 'thud'],
  [B(T.s4 - 0.6), 'montée', 'riser', { len: 0.6 }],
  [B(T.s4 + 0.1), 'affiche santa', 'whoosh', { len: 0.5, from: 500, to: 2600 }],
  [B(T.concours), 'des places', 'impact'], [B(T.concours + 0.05), 'places cloche', 'coins'],
  ...[0, 0.15, 0.3].map((d, i) => [B(T.places + d - 0.4), 'billet ' + (i + 1), 'pop', { pitch: ['A5', 'C#6', 'E6'][i] }]),
  [B(T.s5), 'étape 1', 'click'], [B(T.join), 'étape 2', 'click'], [B(T.share), 'étape 3', 'click'],
  [B(T.rules), 'règles', 'bell', { pitch: 'A5' }],
  [B(T.s6), 'final', 'whoosh', { len: 0.6, from: 400, to: 3000 }],
  [B(T.alone), 'logo final', 'impact'], [B(T.rejoins + 0.9), 'gratuit final', 'pop', { pitch: 'D6' }], [B(T.tente), 'billets final', 'coins'],
];
M.film({
  fonts: [font(100, 900, D), font(100, 700, D), font(40, 800, UI), font(40, 700, UI)],
  images: {
    official: 'assets/posters/poster_official.jpg', santa: 'assets/posters/poster_santa.jpg', dubaiNight: 'assets/dubaiNight.webp',
    ...Object.fromEntries(['intro', 'home_00', 'home_01', 'messages', 'social_00', 'social_01', 'padel'].map((k) => [k, `assets/real/${k}.png`])),
    logo: 'assets/irly_wordmark_ivory.png', icon: 'assets/app_icon.png',
  },
  hits: HITS,
  samples: 4,
  init(ctx, IMG) { IMGS = IMG; },
  draw(ctx, u, t, IMG) {
    if (t < T.s2) s1(ctx, t, IMG);
    else if (t < T.s3) s2(ctx, t, IMG);
    else if (t < T.s4) s3(ctx, t, IMG);
    else if (t < T.s5) s4(ctx, t, IMG);
    else if (t < T.s6) s5(ctx, t, IMG);
    else s6(ctx, t, IMG);
    subtitles(ctx, t, SUBS);
  },
  post(ctx, u) {
    ctx.save(); ctx.globalAlpha = 0.035;
    for (let i = 0; i < 200; i++) { const x = hash01(i + Math.floor(u * 96) * 997, 3) * W, y = hash01(i + Math.floor(u * 96) * 991, 7) * H; ctx.fillStyle = i % 2 ? '#fff' : '#000'; ctx.fillRect(x, y, 3, 3); }
    ctx.restore();
  },
});
