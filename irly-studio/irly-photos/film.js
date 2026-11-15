// IRLY — « Dubaï, en vrai » (30 s, 9:16) : les photos fournies par IRLY, mises en scène comme des sorties d'IRLY.
// Deux versions avec le même code : irly-launch (français) et irly-launch-en (anglais).
// Temps en secondes, calés sur la transcription horodatée de chaque voix (table T plus bas).
// Écrans : captures réelles de la version démo de l'app (contenus d'exemple).
// Ce qui n'existe pas dans l'app (compteur des 100 inscrits, invitation) est une animation étiquetée « illustration ».
// Aucune interface de l'App Store n'est reproduite ; aucun logo Apple n'est dessiné.
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


// Mise en scène : les cartes « sortie » sont des visuels promotionnels (pas des captures), étiquetés à l'écran.
// Aucun chiffre de participants ou de membres n'est affiché.
const BEAT = 60 / 112;
const b = (n) => n * BEAT; // temps musical -> secondes
let IMGS = {};
function logo(ctx, IMG, cx, cy, w, k, a = 1) {
  if (!IMG.logo || k <= 0 || a <= 0) return;
  const h = w * IMG.logo.height / IMG.logo.width;
  ctx.save(); ctx.globalAlpha = a * clamp(k * 1.5); ctx.translate(cx, cy); ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
  ctx.shadowColor = 'rgba(201,214,228,0.55)'; ctx.shadowBlur = 50; ctx.drawImage(IMG.logo, -w / 2, -h / 2, w, h); ctx.restore();
}
function bigLine(ctx, str, y, size, color, t, t0, o = {}) { words(ctx, str, W / 2, y, size, color, t, t0, { family: D, weight: 900, step: 0.06, maxW: 960, ...o }); }
// Les sorties mises en scène : photo, titre, quand, visages (portraits d'exemple de l'app), bouton.
const OUTINGS = [
  ['f2', 'Sortie du soir', 'Ce soir · Downtown', 0.55],
  ['f7', 'Rooftop au coucher du soleil', 'Vendredi · 18:00', 0.5],
  ['f9', 'Padel 2v2', 'Demain · 19:30', 0.45],
  ['f10', 'Après-midi beach club', 'Samedi · 13:00', 0.5],
  ['u14', 'Dîner entre filles', 'Jeudi · 21:00', 0.45],
  ['f4', 'Café & matcha', 'Dimanche · 11:00', 0.5],
  ['f8', 'Piscine avec vue', 'Samedi · 15:00', 0.4],
  ['u12', 'Soirée skyline', 'Ce soir · 22:00', 0.5],
  ['f3', 'Road trip désert', 'Week-end · 08:00', 0.45],
  ['u15', 'Soirée bateau', 'Vendredi · 20:00', 0.75],
];
function outingCard(ctx, IMG, o, i, cx, cy, w, k, t, { rot = 0, joined = 0, a = 1 } = {}) {
  if (k <= 0 || a <= 0) return;
  const [key, title, when, fy] = o, img = IMG[key], h = w * 1.42;
  ctx.save(); ctx.globalAlpha = a * clamp(k * 1.6); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(k, k);
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
  rrect(ctx, -w / 2, -h / 2, w, h, 44); ctx.fillStyle = '#111'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.save(); rrect(ctx, -w / 2, -h / 2, w, h, 44); ctx.clip();
  if (img) { if (key === 'u15') { const sx = 0, sy = img.height * 0.46, sw = img.width * 0.62, sh = img.height * 0.54, s = Math.max(w / sw, h / sh) * 1.04; ctx.drawImage(img, sx, sy, sw, sh, -sw * s / 2, -sh * s / 2, sw * s, sh * s); } else cover(ctx, img, -w / 2, -h / 2, w, h, { fy, zoom: 1.04 + 0.04 * Math.sin(t * 0.7 + i) }); }
  const g = ctx.createLinearGradient(0, h * 0.05, 0, h / 2); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.88)'); ctx.fillStyle = g; ctx.fillRect(-w / 2, 0, w, h / 2);
  ctx.restore();
  const s = w / 600;
  pill(ctx, 'IRL', -w / 2 + 70 * s, -h / 2 + 60 * s, 24 * s, '#fff', 'rgba(255,69,58,0.95)', { weight: 900 });
  let f = font(50 * s, 900, UI); const tw = layout(ctx, title, f).width; if (tw > w - 70 * s) f = font(50 * s * (w - 70 * s) / tw, 900, UI);
  text(ctx, title, -w / 2 + 36 * s, h / 2 - 170 * s, f, '#fff', 'left');
  text(ctx, when, -w / 2 + 36 * s, h / 2 - 118 * s, font(32 * s, 700, UI), 'rgba(255,255,255,0.75)', 'left');
  for (let j = 0; j < 4; j++) face(ctx, IMGS, i * 4 + j, -w / 2 + (60 + j * 52) * s, h / 2 - 52 * s, 26 * s, 1, '#111', false);
  const bw = 210 * s, bx = w / 2 - bw / 2 - 30 * s, by = h / 2 - 52 * s;
  rrect(ctx, bx - bw / 2, by - 34 * s, bw, 68 * s, 34 * s); ctx.fillStyle = joined > 0.5 ? C.green : '#fff'; ctx.fill();
  text(ctx, joined > 0.5 ? 'Partant·e ✓' : 'Rejoindre', bx, by + 11 * s, font(28 * s, 900, UI), joined > 0.5 ? '#fff' : C.ink, 'center');
  ctx.restore();
}
function stagedTag(ctx, a) { tag(ctx, 'MISE EN SCÈNE · PHOTOS D’ILLUSTRATION', a, 190); }

// 0 → b(8) : Dubaï ce soir
function sA(ctx, t, IMG) {
  bgPhoto(ctx, IMG.f6, { zoom: 1.3 - 0.18 * E.outCubic(prog(t, 0, b(8))), fy: 0.4, dark: 0.2 });
  bokeh(ctx, t, 16, 0.3, 2);
  shade(ctx, 0.75, 0.5);
  bigLine(ctx, 'DUBAÏ, CE SOIR.', 380, 120, '#fff', t, b(1), { out: b(5.6) });
  bigLine(ctx, 'QU’EST-CE QU’ON FAIT ?', 380, 96, C.green, t, b(6), { out: b(7.8) });
  vignette(ctx, 0.45);
  const fl = bump(t, b(8), 0.1); if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${0.6 * fl})`; ctx.fillRect(0, 0, W, H); }
}
// b(8) → b(24) : les sorties défilent, une par temps fort
function sB(ctx, t, IMG) {
  const i = Math.min(OUTINGS.length - 1, Math.floor((t - b(8)) / b(1.6))), t0 = b(8) + i * b(1.6);
  const o = OUTINGS[i];
  bgPhoto(ctx, IMG[o[0]], { blur: 34, dark: 0.5, zoom: 1.25, fy: o[3] });
  bokeh(ctx, t, 12, 0.25, 4);
  // la carte précédente part sur le côté, la nouvelle arrive
  if (i > 0) { const p = E.inCubic(prog(t, t0, t0 + 0.25)); outingCard(ctx, IMG, OUTINGS[i - 1], i - 1, W / 2 - p * 900, 1020, 640, 1, t, { rot: -p * 0.3, joined: 1, a: 1 - p }); }
  const k = sp(t, t0, SPRING.bouncy), join = prog(t, t0 + b(1.0), t0 + b(1.05));
  outingCard(ctx, IMG, o, i, W / 2, 1020 + (1 - k) * 200, 640, k, t, { rot: (i % 2 ? 0.03 : -0.03), joined: join });
  if (t > t0 + b(0.7)) { // toucher le bouton
    const s = 640 / 600, bx = W / 2 + 640 / 2 - 105 * s - 30 * s, by = 1020 + 640 * 1.42 / 2 - 52 * s;
    const a = prog(t, t0 + b(0.7), t0 + b(0.85)) * (1 - prog(t, t0 + b(1.2), t0 + b(1.45)));
    if (a > 0) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(bx, by, 48 - 10 * bump(t, t0 + b(1.0), 0.1), 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); }
  }
  shade(ctx, 0.8, 0.35);
  const lines = [[b(8), 'Chaque soir,'], [b(8.5), 'quelque chose à faire.']];
  bigLine(ctx, 'CHAQUE SOIR,', 320, 92, '#fff', t, b(8.2), { out: b(15.8) });
  bigLine(ctx, 'QUELQUE CHOSE À FAIRE.', 420, 80, C.steelL, t, b(8.8), { out: b(15.8) });
  bigLine(ctx, 'ET DES GENS', 320, 92, '#fff', t, b(16.2), { out: b(23.8) });
  bigLine(ctx, 'AVEC QUI LE FAIRE.', 420, 86, C.green, t, b(16.8), { out: b(23.8) });
  stagedTag(ctx, 0.9);
  vignette(ctx, 0.45);
}
// b(24) → b(42) : dans l'app (écrans réels) + mur de photos
function sC(ctx, t, IMG) {
  fill(ctx, C.bg);
  // mur de photos qui défile en arrière-plan
  const keys = ['f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'u11', 'u12', 'u13', 'u14', 'f2', 'f7', 'f9', 'f10', 'u12'];
  const cw = 340, ch = 470;
  for (let c = 0; c < 3; c++) {
    const off = ((t * (c % 2 ? 90 : -90)) % (ch + 30) + (ch + 30)) % (ch + 30);
    for (let r = -1; r < 5; r++) {
      const key = keys[(c * 5 + r + 6) % keys.length], x = 60 + c * (cw + 30) + cw / 2 - 30, y = r * (ch + 30) + off;
      ctx.save(); ctx.globalAlpha = 0.55; cover(ctx, IMG[key], x - cw / 2, y, cw, ch, { radius: 30 }); ctx.restore();
    }
  }
  ctx.fillStyle = 'rgba(5,5,6,0.55)'; ctx.fillRect(0, 0, W, H);
  const k = sp(t, b(24), SPRING.gentle);
  const seq = [[b(24), 'home_00'], [b(28), 'social_00'], [b(32), 'discover_00'], [b(36), 'girl_00']];
  let i = 0; seq.forEach((s, j) => { if (t >= s[0]) i = j; });
  phone(ctx, W / 2, lerp(H + 600, 1100, k), 540, (s) => {
    if (i === 0 && t > b(25)) scrollPair(s, IMG.home_00, IMG.home_01, E.inOutCubic(prog(t, b(25), b(27.5))));
    else navTo(s, IMG[seq[Math.max(0, i - 1)][1]], IMG[seq[i][1]], prog(t, seq[i][0], seq[i][0] + 0.3), 'push');
  }, { rotY: 0.12 * Math.sin(t * 0.8), tilt: -0.02 });
  faceCloud(ctx, t, IMG, b(24.5), b(42), 2, 620);
  shade(ctx, 0.85, 0.35);
  logo(ctx, IMG, W / 2, 250, 300, sp(t, b(24), SPRING.snappy));
  bigLine(ctx, 'TOUT SE PASSE SUR IRLY.', 400, 76, '#fff', t, b(24.4), { out: b(41.8) });
  tag(ctx, 'ÉCRANS RÉELS DE L’APP · CONTENUS DE DÉMO', 0.9, 1660);
  vignette(ctx, 0.45);
}
// b(42) → fin : signature
function sD(ctx, t, IMG) {
  bgPhoto(ctx, IMG.u14, { dark: 0.62, zoom: 1.15 - 0.06 * prog(t, b(42), b(56)), fy: 0.45 });
  bokeh(ctx, t, 18, 0.3, 9, '#BFD4FF');
  logo(ctx, IMG, W / 2, 620, 520, sp(t, b(42), SPRING.bouncy));
  words(ctx, 'MAKE FRIENDS IRL', W / 2, 840, 46, C.steelL, t, b(42.6), { weight: 800, track: 0.18 });
  bigLine(ctx, 'DUBAÏ EST PLUS BELLE', 1010, 84, '#fff', t, b(43.4));
  bigLine(ctx, 'À PLUSIEURS.', 1110, 96, C.green, t, b(44.2));
  const bk = sp(t, b(45.5), SPRING.bouncy);
  if (bk > 0) { ctx.save(); ctx.translate(W / 2, 1290); ctx.scale(bk, bk); rrect(ctx, -250, -65, 500, 130, 26); ctx.fillStyle = '#000'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke(); text(ctx, 'Disponible sur l’', 0, -10, font(26, 700, UI), '#fff', 'center'); text(ctx, 'App Store', 0, 42, font(50, 800, UI), '#fff', 'center'); ctx.restore(); }
  const fk = sp(t, b(46.3), SPRING.bouncy); if (fk > 0) { ctx.save(); ctx.translate(W / 2, 1430); ctx.scale(fk, fk); pill(ctx, '100 % GRATUIT', 0, 0, 44, '#fff', C.green, { weight: 900 }); ctx.restore(); }
  vignette(ctx, 0.45);
}
const HITS = [
  [1, 'titre', 'impact'], [6, 'question', 'thud'], [8, 'flash', 'whoosh', { len: 0.4, from: 500, to: 3000 }],
  ...OUTINGS.map((_, i) => [8 + i * 1.6, 'sortie ' + (i + 1), 'whoosh', { len: 0.25, from: 900, to: 2600, gain: 0.5 }]),
  ...OUTINGS.map((_, i) => [9 + i * 1.6, 'rejoindre ' + (i + 1), 'pop', { pitch: ['A5', 'C6', 'E6', 'A6'][i % 4], gain: 0.6 }]),
  [24, 'téléphone', 'impact'], [28, 'social', 'tick'], [32, 'découvrir', 'tick'], [36, 'girl', 'tick'],
  [42, 'logo', 'impact'], [42.1, 'logo cloche', 'bell', { pitch: 'A5' }], [45.5, 'badge', 'pop', { pitch: 'E6' }], [46.3, 'gratuit', 'pop', { pitch: 'A6' }],
];
M.film({
  fonts: [font(100, 900, D), font(100, 700, D), font(40, 800, UI), font(40, 700, UI)],
  images: {
    ...Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => ['f' + i, `assets/photos/f${i}.jpg`])),
    ...Object.fromEntries([11, 12, 13, 14, 15].map((i) => ['u' + i, `assets/photos/u${i}.jpg`])),
    ...Object.fromEntries(FACES.map((n, i) => ['face' + i, `assets/faces/${n}.jpg`])),
    ...Object.fromEntries(['home_00', 'home_01', 'social_00', 'discover_00', 'girl_00'].map((k) => [k, `assets/real/${k}.png`])),
    logo: 'assets/irly_wordmark_ivory.png',
  },
  hits: HITS,
  samples: 4,
  init(ctx, IMG) { IMGS = IMG; },
  draw(ctx, u, t, IMG) {
    if (t < b(8)) sA(ctx, t, IMG);
    else if (t < b(24)) sB(ctx, t, IMG);
    else if (t < b(42)) sC(ctx, t, IMG);
    else sD(ctx, t, IMG);
  },
  post(ctx, u) {
    ctx.save(); ctx.globalAlpha = 0.03;
    for (let i = 0; i < 200; i++) { const x = hash01(i + Math.floor(u * 96) * 997, 3) * W, y = hash01(i + Math.floor(u * 96) * 991, 7) * H; ctx.fillStyle = i % 2 ? '#fff' : '#000'; ctx.fillRect(x, y, 3, 3); }
    ctx.restore();
  },
});
