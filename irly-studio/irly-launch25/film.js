// IRLY — lancement 25 s (9:16), monté sur « Triangle des Bermudes » (Aye, instrumental) : drop à 3,50 s.
// Tes photos sont au cœur du montage : cartes d'activités (mise en scène, étiquetée) qui s'ouvrent en plein écran.
// Interface : vraies captures de la version démo de l'app. Aucun compteur d'utilisateurs ou de participants.
// Temps en secondes, calés sur la transcription horodatée de chaque voix (table T plus bas).
// Écrans : captures réelles de la version démo de l'app (contenus d'exemple).
// Ce qui n'existe pas dans l'app (compteur des 100 inscrits, invitation) est une animation étiquetée « illustration ».
// Aucune interface de l'App Store n'est reproduite ; aucun logo Apple n'est dessiné.
import * as M from './lib/motion.js';
import { SUBS } from './subs.js';

const { W, H, E, TAU, prog, lerp, clamp, springU, SPRING, font, layout, text, fill, cover, rrect, bump, hash01 } = M;
const EN = false;
const SUBS_ON = true;
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



// ---------------------------------------------------------------- rythme
const BEAT = 0.469;              // 127,9 BPM (beats.json), extrait du morceau à partir de 68,02 s
const DROP = 3.5;                // le drop (fin du silence de 1,3 s)
const bt = (k) => k * BEAT;      // temps du k-ième temps
const PINK = '#E2336B', VIOLET = '#7B61FF';
let IMGS = {};

// ---------------------------------------------------------------- cartes d'activités (mise en scène avec tes photos)
const CARDS = [
  { img: 'f2', title: 'Sortie du soir', place: 'Downtown', when: 'Ce soir · 21:00', tag: 'SORTIE', col: '#FFFFFF', fy: 0.55 },
  { img: 'f9', title: 'Padel 2v2', place: 'Al Quoz', when: 'Demain · 19:30', tag: 'SPORT', col: '#34C759', fy: 0.45 },
  { img: 'f7', title: 'Afterwork rooftop', place: 'Business Bay', when: 'Jeudi · 18:30', tag: 'IRLY NETWORK', col: VIOLET, fy: 0.5 },
  { img: 'f10', title: 'Beach club entre filles', place: 'Palm Jumeirah', when: 'Samedi · 13:00', tag: 'IRLY GIRL', col: PINK, fy: 0.5 },
  { img: 'f4', title: 'Café & matcha', place: 'City Walk', when: 'Dimanche · 11:00', tag: 'SORTIE', col: '#FFFFFF', fy: 0.5 },
  { img: 'f8', title: 'Piscine avec vue', place: 'Dubai Marina', when: 'Samedi · 15:00', tag: 'SORTIE', col: '#FFFFFF', fy: 0.4 },
  { img: 'u12', title: 'Soirée skyline', place: 'Downtown', when: 'Vendredi · 22:00', tag: 'SORTIE', col: '#FFFFFF', fy: 0.5 },
  { img: 'f3', title: 'Road trip désert', place: 'Al Qudra', when: 'Week-end · 08:00', tag: 'SORTIE', col: '#FFFFFF', fy: 0.45 },
  { img: 'u13', title: 'Dîner avec vue', place: 'Downtown', when: 'Ce soir · 20:30', tag: 'SORTIE', col: '#FFFFFF', fy: 0.5 },
  { img: 'f5', title: 'Balade au Burj', place: 'Downtown', when: 'Demain · 18:00', tag: 'SORTIE', col: '#FFFFFF', fy: 0.4 },
];
// Carte dessinée en coordonnées libres (x, y = coin haut gauche ; w ; h).
function activityCard(ctx, c, x, y, w, h, { k = 1, a = 1, joined = 0 } = {}) {
  if (k <= 0 || a <= 0) return;
  const img = IMGS[c.img]; const s = w / 520;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x + w / 2, y + h / 2); ctx.scale(k, k); ctx.translate(-w / 2, -h / 2);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30 * s; ctx.shadowOffsetY = 10 * s;
  rrect(ctx, 0, 0, w, h, 42 * s); ctx.fillStyle = '#15161A'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.save(); rrect(ctx, 0, 0, w, h, 42 * s); ctx.clip();
  const ph = h * 0.66; if (img) cover(ctx, img, 0, 0, w, ph, { fy: c.fy });
  const g = ctx.createLinearGradient(0, ph * 0.55, 0, ph); g.addColorStop(0, 'rgba(21,22,26,0)'); g.addColorStop(1, 'rgba(21,22,26,1)'); ctx.fillStyle = g; ctx.fillRect(0, ph * 0.55, w, ph * 0.45 + 2);
  ctx.restore();
  // étiquette de catégorie
  const tf = font(22 * s, 900, UI), tw = layout(ctx, c.tag, tf, 1.5 * s).width + 30 * s;
  rrect(ctx, 22 * s, 22 * s, tw, 44 * s, 22 * s); ctx.fillStyle = c.col === '#FFFFFF' ? 'rgba(255,255,255,0.92)' : c.col; ctx.fill();
  text(ctx, c.tag, 22 * s + tw / 2, 52 * s, tf, c.col === '#FFFFFF' ? '#111' : '#fff', 'center', 1.5 * s);
  let f = font(40 * s, 800, UI); const lw = layout(ctx, c.title, f).width; if (lw > w - 44 * s) f = font(40 * s * (w - 44 * s) / lw, 800, UI);
  text(ctx, c.title, 22 * s, ph + 34 * s, f, '#fff', 'left');
  text(ctx, `${c.when} · ${c.place}`, 22 * s, ph + 80 * s, font(26 * s, 700, UI), 'rgba(255,255,255,0.6)', 'left');
  const bw = 170 * s, by = h - 56 * s;
  rrect(ctx, w - bw - 22 * s, by - 26 * s, bw, 52 * s, 26 * s); ctx.fillStyle = joined > 0.5 ? '#34C759' : '#fff'; ctx.fill();
  text(ctx, joined > 0.5 ? 'Partant·e ✓' : 'Rejoindre', w - bw / 2 - 22 * s, by + 9 * s, font(24 * s, 900, UI), joined > 0.5 ? '#fff' : '#111', 'center');
  ctx.restore();
}
// Le feed dans le téléphone : en-tête réel de l'accueil, puis les cartes en deux colonnes qui défilent.
function feedScreen(s, t, scroll, appearT0) {
  s.fillStyle = '#060607'; s.fillRect(0, 0, SW, SH);
  const head = 230; // seulement la barre du haut de l'accueil réel (sans compteur)
  const colW = 535, gap = 34, cardH = 760, x0 = 34;
  s.save(); s.beginPath(); s.rect(0, head, SW, SH - head); s.clip();
  CARDS.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = x0 + col * (colW + gap), y = head + 40 + row * (cardH + gap) + (col ? 200 : 0) - scroll;
    if (y > SH || y + cardH < head) return;
    const k = sp(t, appearT0 + i * 0.09, SPRING.bouncy);
    activityCard(s, c, x, y, colW, cardH, { k: Math.min(1, k), a: clamp(k * 2) });
  });
  s.restore();
  if (IMGS.home_dark_00) s.drawImage(IMGS.home_dark_00, 0, 0, SW, head, 0, 0, SW, head);
  const g = s.createLinearGradient(0, head - 10, 0, head + 60); g.addColorStop(0, 'rgba(6,6,7,1)'); g.addColorStop(1, 'rgba(6,6,7,0)'); s.fillStyle = g; s.fillRect(0, head - 10, SW, 70);
}
function cardRect(i, scroll) { // position de la carte i dans l'écran du téléphone
  const col = i % 2, row = Math.floor(i / 2);
  return [34 + col * (535 + 34), 230 + 40 + row * (760 + 34) + (col ? 200 : 0) - scroll, 535, 760];
}
const PHONE = { cx: W / 2, cy: 1110, w: 560 };
const PHONE_S = PHONE.w / SW;
function screenToCanvas([x, y, w, h], cy = PHONE.cy) { const ph = PHONE.w * SH / SW; return [PHONE.cx - PHONE.w / 2 + x * PHONE_S, cy - ph / 2 + y * PHONE_S, w * PHONE_S, h * PHONE_S]; }
function chip(ctx, str, cx, cy, k, col = '#fff', fg = '#111', size = 40) { if (k <= 0) return; ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); pill(ctx, str, 0, 0, size, fg, col, { weight: 900 }); ctx.restore(); }
function bigLine(ctx, str, y, size, color, t, t0, o = {}) { words(ctx, str, W / 2, y, size, color, t, t0, { family: D, weight: 900, step: 0.05, maxW: 960, ...o }); }
function logo(ctx, IMG, cx, cy, w, k, a = 1) {
  if (!IMG.logo || k <= 0 || a <= 0) return;
  const h = w * IMG.logo.height / IMG.logo.width;
  ctx.save(); ctx.globalAlpha = a * clamp(k * 1.5); ctx.translate(cx, cy); ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
  ctx.shadowColor = 'rgba(201,214,228,0.6)'; ctx.shadowBlur = 50; ctx.drawImage(IMG.logo, -w / 2, -h / 2, w, h); ctx.restore();
}
function flash(ctx, t, t0, k = 0.8, w = 0.1) { const f = bump(t, t0, w); if (f > 0) { ctx.fillStyle = `rgba(255,255,255,${k * f})`; ctx.fillRect(0, 0, W, H); } }
function punch(t, from, n) { let p = 0; for (let k = 0; k < n; k++) p += bump(t, from + bt(k), 0.12); return p; } // petit zoom sur chaque temps
function fullPhoto(ctx, img, t, t0, { fy = 0.5, zoom0 = 1.15, zoom1 = 1.02, dur = 1.2, dark = 0.15 } = {}) { bgPhoto(ctx, img, { zoom: lerp(zoom0, zoom1, E.outCubic(prog(t, t0, t0 + dur))), fy, dark }); }
function staged(ctx, a, y = 190) { tag(ctx, 'MISE EN SCÈNE · PHOTOS D’ILLUSTRATION', a, y); }

// ---------------------------------------------------------------- S1 l'accroche (0 → 3,5)
function s1(ctx, t, IMG) {
  const tension = E.inOutCubic(prog(t, 2.2, DROP));
  fullPhoto(ctx, IMG.u11, t, 0, { fy: 0.42, zoom0: 1.22 - 0.01 * punch(t, 0, 5), zoom1: 1.08 + 0.04 * tension, dur: 3.5, dark: 0.15 + 0.35 * tension });
  bokeh(ctx, t, 12, 0.22 * (1 - tension), 2);
  shade(ctx, 0.85, 0.4);
  bigLine(ctx, 'T’ES À DUBAÏ', 330, 118, '#fff', t, 0.15);
  bigLine(ctx, 'ET TU CONNAIS', 455, 86, '#fff', t, 0.9);
  bigLine(ctx, 'ENCORE PERSONNE ?', 560, 92, C.green, t, 1.3);
  vignette(ctx, 0.5 + 0.3 * tension);
  flash(ctx, t, DROP - 0.02, 1, 0.07);
}
// ---------------------------------------------------------------- S2 le drop : logo, puis plongée dans le feed (3,5 → 7)
function s2(ctx, t, IMG) {
  fill(ctx, C.bg); bokeh(ctx, t, 22, 0.4, 5, '#BFD4FF');
  glow(ctx, W / 2, 900, 700, C.steel, 0.35 * (1 - prog(t, 4.6, 5.2)));
  // anneaux de lumière sur le drop
  for (let j = 0; j < 3; j++) { const p = prog(t, DROP + j * 0.12, DROP + 0.9 + j * 0.12); if (p > 0 && p < 1) { ctx.save(); ctx.globalAlpha = (1 - p) * 0.6; ctx.lineWidth = 6; ctx.strokeStyle = j === 1 ? C.green : '#fff'; ctx.beginPath(); ctx.arc(W / 2, 900, 120 + 700 * E.outCubic(p), 0, TAU); ctx.stroke(); ctx.restore(); } }
  const lk = sp(t, DROP, SPRING.bouncy), toTop = E.inOutCubic(prog(t, 4.35, 4.9));
  logo(ctx, IMG, W / 2, lerp(900, 165, toTop), lerp(760, 230, toTop), lk);
  // le téléphone arrive en grand puis se pose : effet de zoom dans le feed
  const pk = E.outCubic(prog(t, 4.35, 5.0));
  if (pk > 0) phone(ctx, PHONE.cx, lerp(PHONE.cy + 900, PHONE.cy, pk), PHONE.w, (s) => feedScreen(s, t, 120 * prog(t, 5.0, 7.0), 4.6), { scale: lerp(1.9, 1, pk), alpha: clamp(pk * 3) });
  shade(ctx, 0.6, 0.3);
  bigLine(ctx, 'TROUVE TA PROCHAINE', 300, 72, '#fff', t, 4.9, { out: 7.0 });
  bigLine(ctx, 'SORTIE.', 390, 92, C.green, t, 5.15, { out: 7.0 });
  staged(ctx, prog(t, 5.0, 5.3), 1770);
  vignette(ctx, 0.45);
  flash(ctx, t, DROP, 0.9, 0.12);
}
// ---------------------------------------------------------------- S3 les activités, IRLY Network, IRLY Girl (7 → 14)
const NET = 2, GIRL = 3, NET_T = 8.45, GIRL_T = 11.2;
function expand(ctx, IMG, i, t, t0, scroll) { // la carte quitte l'interface et prend tout l'écran
  const p = E.inOutCubic(prog(t, t0, t0 + 0.42));
  const [x, y, w, h] = screenToCanvas(cardRect(i, scroll));
  const X = lerp(x, 0, p), Y = lerp(y, 0, p), Ww = lerp(w, W, p), Hh = lerp(h * 0.66, H, p);
  ctx.save(); rrect(ctx, X, Y, Ww, Hh, lerp(24, 0, p)); ctx.clip(); cover(ctx, IMG[CARDS[i].img], X, Y, Ww, Hh, { fy: CARDS[i].fy, zoom: lerp(1, 1.12, p) }); ctx.restore();
}
function s3(ctx, t, IMG) {
  fill(ctx, C.bg); bokeh(ctx, t, 18, 0.3, 8, '#BFD4FF');
  const scroll = 120 + (t < NET_T ? 1600 * E.inOutCubic(prog(t, 7.0, 8.2)) : 1600) - 120;
  const sScroll = Math.max(0, Math.min(scroll, 1600)) + (t < NET_T ? 0 : 0);
  // phase 1 : le feed défile
  if (t < NET_T + 0.42) {
    const pk = 1;
    phone(ctx, PHONE.cx, PHONE.cy, PHONE.w, (s) => { feedScreen(s, t, sScroll + 120, 4.6); tap(s, t, NET_T - 0.05, ...(([x, y, w, h]) => [x + w / 2, y + h * 0.35])(cardRect(NET, sScroll + 120))); }, { tilt: 0.01 * Math.sin(t * 2) });
    if (t >= NET_T) expand(ctx, IMG, NET, t, NET_T, sScroll + 120);
  } else if (t < 9.9) { // IRLY Network en plein écran
    fullPhoto(ctx, IMG[CARDS[NET].img], t, NET_T + 0.42, { fy: CARDS[NET].fy, zoom0: 1.12, zoom1: 1.04, dur: 1.4 });
    const k = sp(t, NET_T + 0.45, SPRING.bouncy); chip(ctx, 'IRLY NETWORK', W / 2, 1200, k, VIOLET, '#fff', 64);
    words(ctx, 'Rencontre celles qui construisent quelque chose', W / 2, 1310, 36, '#fff', t, NET_T + 0.6, { weight: 800 });
  } else if (t < GIRL_T + 0.42) { // retour dans l'app : le vrai écran IRLY Network, puis on rouvre le feed
    const p = sp(t, 9.9, SPRING.gentle);
    phone(ctx, PHONE.cx, PHONE.cy, PHONE.w, (s) => {
      if (t < 10.3) { shot(s, IMG.net1, -330); s.drawImage(IMG.net1, 0, 0, SW, 230, 0, 0, SW, 230); }
      else navTo(s, IMG.net1, null, 0), feedScreen(s, t, 2 * 794 - 300, -10), tap(s, t, GIRL_T - 0.05, ...(([x, y, w, h]) => [x + w / 2, y + h * 0.35])(cardRect(GIRL, 2 * 794 - 300)));
    }, { scale: lerp(1.3, 1, p) });
    if (t >= GIRL_T) expand(ctx, IMG, GIRL, t, GIRL_T, 2 * 794 - 300);
  } else if (t < 12.6) { // IRLY Girl en plein écran
    fullPhoto(ctx, IMG[CARDS[GIRL].img], t, GIRL_T + 0.42, { fy: CARDS[GIRL].fy, zoom0: 1.12, zoom1: 1.04, dur: 1.2 });
    const k = sp(t, GIRL_T + 0.45, SPRING.bouncy); chip(ctx, 'IRLY GIRL', W / 2, 1200, k, PINK, '#fff', 64);
    words(ctx, 'Les sorties entre filles', W / 2, 1310, 40, '#fff', t, GIRL_T + 0.6, { weight: 800 });
  } else if (t < 13.2) { // le vrai écran IRLY Girl
    const p = sp(t, 12.6, SPRING.gentle);
    phone(ctx, PHONE.cx, PHONE.cy, PHONE.w, (s) => shot(s, IMG.girl1), { scale: lerp(1.3, 1, p) });
  } else { // montage plein écran sur le temps
    const seq = ['f9', 'f8', 'u13', 'f2'], j = Math.min(3, Math.floor((t - 13.2) / BEAT));
    const c = CARDS.find((x) => x.img === seq[j]);
    fullPhoto(ctx, IMG[seq[j]], t, 13.2 + j * BEAT, { fy: c ? c.fy : 0.5, zoom0: 1.18, zoom1: 1.05, dur: BEAT });
    if (c) { const k = sp(t, 13.2 + j * BEAT, SPRING.snappy); chip(ctx, `${c.title} · ${c.when}`, W / 2, 1250, k, 'rgba(255,255,255,0.95)', '#111', 36); }
    flash(ctx, t, 13.2 + j * BEAT, 0.35, 0.05);
  }
  shade(ctx, 0.75, 0.35);
  // la ligne des espaces se construit
  const items = [[7.05, 'Sorties', '#fff', '#111'], [NET_T + 0.45, 'Networking', VIOLET, '#fff'], [GIRL_T + 0.45, 'IRLY Girl', PINK, '#fff']];
  const ks = items.map(([a]) => sp(t, a, SPRING.bouncy));
  const xs = [W / 2 - 300, W / 2 + 290, W / 2 - 5];
  items.forEach(([a, s, bg, fg], i) => chip(ctx, s, xs[i], 330, ks[i], bg, fg, 40));
  staged(ctx, 0.9);
  vignette(ctx, 0.45);
}
// ---------------------------------------------------------------- S4 la carte de Dubaï (illustrée), une activité, la vraie vie (14 → 19)
const PINS = [ // positions sur la carte illustrée (canevas), photo
  [300, 880, 'f8', 'Dubai Marina'], [430, 760, 'f10', 'Palm Jumeirah'], [640, 1040, 'f2', 'Downtown'], [760, 900, 'f7', 'Business Bay'], [560, 1240, 'f9', 'Al Quoz'], [860, 1180, 'f4', 'City Walk'], [380, 1100, 'u12', 'JBR'],
];
const PADEL_PIN = 4, OPEN_T = 15.95;
function dubaiMap(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0A1220'); g.addColorStop(1, '#070A10'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // la mer (en haut à gauche) et la côte
  ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 380); ctx.bezierCurveTo(820, 520, 620, 600, 480, 700); ctx.bezierCurveTo(330, 800, 160, 900, 0, 1000); ctx.closePath();
  ctx.fillStyle = '#0B2236'; ctx.fill(); ctx.restore();
  // la Palm : un tronc et des branches
  ctx.save(); ctx.translate(380, 700); ctx.rotate(-0.6); ctx.strokeStyle = 'rgba(232,210,160,0.55)'; ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -220); ctx.stroke(); for (let i = 0; i < 8; i++) { const y = -60 - i * 20; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(-70 + i * 4, y - 40); ctx.moveTo(0, y); ctx.lineTo(70 - i * 4, y - 40); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, -150, 140, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.restore();
  // routes (Sheikh Zayed Road et quelques axes)
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(120, 1020); ctx.bezierCurveTo(400, 1000, 700, 900, 1080, 600); ctx.stroke();
  ctx.lineWidth = 3; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(150 + i * 110, 1700); ctx.lineTo(260 + i * 110, 850 - i * 20); ctx.stroke(); } ctx.restore();
  // le Creek
  ctx.save(); ctx.strokeStyle = '#0B2236'; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(1080, 700); ctx.bezierCurveTo(960, 820, 980, 980, 1080, 1100); ctx.stroke(); ctx.restore();
  text(ctx, 'DUBAÏ', 820, 470, font(54, 900, D), 'rgba(255,255,255,0.18)', 'center', 12);
}
function s4(ctx, t, IMG) {
  if (t < 17.4) {
    const cam = E.inOutCubic(prog(t, 14.0, 17.4));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(1.12 - 0.08 * cam, 1.12 - 0.08 * cam); ctx.translate(-W / 2 + 30 * Math.sin(t * 0.6), -H / 2);
    dubaiMap(ctx, t);
    PINS.forEach(([x, y, img, name], i) => {
      const t0 = 14.15 + i * BEAT * 0.5, k = sp(t, t0, SPRING.bouncy); if (k <= 0) return;
      const pulse = (t - t0) % 1.4 / 1.4;
      ctx.save(); ctx.globalAlpha = 0.5 * (1 - pulse); ctx.strokeStyle = C.green; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 30 + 60 * pulse, 0, TAU); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.translate(x, y - 80 * k); ctx.scale(k, k);
      ctx.beginPath(); ctx.moveTo(-18, 52); ctx.lineTo(0, 82); ctx.lineTo(18, 52); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 62, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 56, 0, TAU); ctx.clip(); cover(ctx, IMG[img], -56, -56, 112, 112, { fy: 0.45 }); ctx.restore();
      ctx.restore();
      ctx.save(); ctx.globalAlpha = clamp(k); text(ctx, name, x, y + 40, font(26, 800, UI), 'rgba(255,255,255,0.85)', 'center'); ctx.restore();
    });
    ctx.restore();
    // ouvrir une activité : la carte Padel monte, puis le vrai écran de l'activité
    if (t >= OPEN_T) {
      const ck = sp(t, OPEN_T, SPRING.snappy), toPhone = E.inOutCubic(prog(t, 16.45, 16.8));
      if (toPhone < 1) activityCard(ctx, CARDS[1], W / 2 - 230, 1100 - 330, 460, 660, { k: ck * (1 - toPhone * 0.3), a: 1 - toPhone });
      if (toPhone > 0) phone(ctx, PHONE.cx, PHONE.cy, PHONE.w, (s) => { shot(s, IMG.activity); const g = s.createLinearGradient(0, 1700, 0, 1950); g.addColorStop(0, 'rgba(6,8,12,0)'); g.addColorStop(1, 'rgba(6,8,12,1)'); s.fillStyle = g; s.fillRect(0, 1700, SW, 250); s.fillStyle = '#06080C'; s.fillRect(0, 1950, SW, SH - 1950); }, { scale: lerp(0.8, 1, toPhone), alpha: toPhone });
    }
    shade(ctx, 0.8, 0.3);
    tag(ctx, 'CARTE ILLUSTRÉE · PHOTOS D’ILLUSTRATION', 0.9, 190);
    bigLine(ctx, 'DE L’APP', 330, 92, '#fff', t, 14.2, { out: 17.3 });
    bigLine(ctx, 'À LA VRAIE VIE.', 440, 92, C.green, t, 14.6, { out: 17.3 });
    vignette(ctx, 0.45);
    flash(ctx, t, 17.4, 0.9, 0.08);
    return;
  }
  // la photo de groupe
  fullPhoto(ctx, IMG.u14, t, 17.4, { fy: 0.45, zoom0: 1.2, zoom1: 1.06, dur: 1.6, dark: 0.1 });
  shade(ctx, 0.8, 0.45);
  bigLine(ctx, 'DE L’APP', 330, 104, '#fff', t, 17.45);
  bigLine(ctx, 'À LA VRAIE VIE.', 450, 104, C.green, t, 17.75);
  vignette(ctx, 0.4);
}
// ---------------------------------------------------------------- S5 l'appel à l'action (19 → 25)
function badge(ctx, cx, cy, k) {
  if (k <= 0) return; const w = 520, h = 140;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); rrect(ctx, -w / 2, -h / 2, w, h, 28); ctx.fillStyle = '#000'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
  text(ctx, 'Télécharger dans l’', 0, -12, font(30, 700, UI), '#fff', 'center'); text(ctx, 'App Store', 0, 46, font(58, 800, UI), '#fff', 'center'); ctx.restore();
}
function s5(ctx, t, IMG) {
  bgPhoto(ctx, IMG.u14, { blur: 30, dark: 0.7, zoom: 1.2, fy: 0.45 });
  bokeh(ctx, t, 18, 0.3, 9, '#BFD4FF');
  const settled = t >= 21.9; // les 3 dernières secondes : tout est figé et lisible
  const tt = settled ? 21.9 : t;
  logo(ctx, IMG, W / 2, 165, 280, sp(tt, 19.0, SPRING.bouncy));
  words(ctx, 'MAKE FRIENDS IRL', W / 2, 268, 38, C.steelL, tt, 19.2, { weight: 800, track: 0.18 });
  const pk = sp(tt, 19.1, SPRING.gentle);
  phone(ctx, W / 2, lerp(H + 400, 800, pk) + (settled ? 0 : 6 * Math.sin(t * 2)), 300, (s) => shot(s, IMG.home_dark_00), { tilt: settled ? 0 : -0.02 * (1 - pk) });
  bigLine(ctx, 'TÉLÉCHARGE IRLY', 385, 76, '#fff', tt, 20.85);
  const bk = sp(tt, 21.0, SPRING.bouncy); badge(ctx, W / 2, 1235, Math.min(1, bk));
  // « Lien en bio » : flèche vers le haut (le lien est dans le profil)
  const lk = sp(tt, 21.4, SPRING.bouncy);
  chip(ctx, 'Lien en bio ↑', W / 2, 1368, Math.min(1, lk), C.green, '#fff', 38);
  vignette(ctx, 0.4);
}

// ---------------------------------------------------------------- sons
const B = (s) => (s + 0.0066) / BEAT;
const HITS = [
  [B(0.15), 'accroche', 'thud'], [B(0.9), 'ligne 2', 'tick'], [B(1.3), 'ligne 3', 'tick'],
  [B(DROP - 0.6), 'montée', 'riser', { len: 0.6 }],
  [B(DROP), 'drop logo', 'impact'], [B(DROP + 0.02), 'logo cloche', 'bell', { pitch: 'D6' }],
  [B(4.35), 'plongée feed', 'whoosh', { len: 0.5, from: 400, to: 3000 }],
  ...CARDS.slice(0, 6).map((_, i) => [B(4.6 + i * 0.09), 'carte ' + (i + 1), 'pop', { pitch: ['D5', 'F#5', 'A5', 'C#6', 'D6', 'E6'][i], gain: 0.4 }]),
  [B(7.0), 'défilement', 'whoosh', { len: 0.4, from: 2400, to: 700, gain: 0.5 }],
  [B(NET_T), 'tap network', 'click'], [B(NET_T + 0.1), 'plein écran', 'whoosh', { len: 0.4, from: 500, to: 2800 }],
  [B(9.9), 'retour app', 'whoosh', { len: 0.3, from: 2600, to: 900, gain: 0.5 }],
  [B(GIRL_T), 'tap girl', 'click'], [B(GIRL_T + 0.1), 'plein écran 2', 'whoosh', { len: 0.4, from: 500, to: 2800 }],
  [B(12.6), 'écran girl', 'tick'],
  ...[0, 1].map((j) => [B(13.2 + j * BEAT), 'montage ' + (j + 1), 'thud', { gain: 0.5 }]),
  [B(14.0), 'carte', 'whoosh', { len: 0.5, from: 300, to: 2000 }],
  ...PINS.map((_, i) => [B(14.15 + i * BEAT * 0.5), 'épingle ' + (i + 1), 'pop', { pitch: ['A5', 'C#6', 'E6', 'A6', 'E6', 'C#6', 'A5'][i], gain: 0.5 }]),
  [B(OPEN_T), 'ouvrir activité', 'click'],
  [B(17.4), 'vraie vie', 'impact'],
  [B(19.0), 'fin', 'whoosh', { len: 0.5, from: 400, to: 2600 }], [B(19.05), 'logo fin', 'bell', { pitch: 'D6' }],
  [B(21.0), 'badge', 'pop', { pitch: 'A5' }], [B(21.4), 'lien en bio', 'pop', { pitch: 'E6' }],
];

M.film({
  fonts: [font(100, 900, D), font(100, 700, D), font(40, 800, UI), font(40, 700, UI), font(40, 900, UI)],
  images: {
    ...Object.fromEntries([2, 3, 4, 5, 7, 8, 9, 10].map((i) => ['f' + i, `assets/photos/f${i}.jpg`])),
    ...Object.fromEntries([11, 12, 13, 14].map((i) => ['u' + i, `assets/photos/u${i}.jpg`])),
    home_dark_00: 'assets/real/home_dark_00.png', net1: 'assets/real/network_01.png', girl1: 'assets/real/girl_01.png', activity: 'assets/real/activity.png',
    logo: 'assets/irly_wordmark_ivory.png',
  },
  hits: HITS,
  samples: 4,
  init(ctx, IMG) { IMGS = IMG; },
  draw(ctx, u, t, IMG) {
    if (t < DROP) s1(ctx, t, IMG);
    else if (t < 7.0) s2(ctx, t, IMG);
    else if (t < 14.0) s3(ctx, t, IMG);
    else if (t < 19.0) s4(ctx, t, IMG);
    else s5(ctx, t, IMG);
    subtitles(ctx, t, SUBS);
  },
  post(ctx, u) {
    ctx.save(); ctx.globalAlpha = 0.03;
    for (let i = 0; i < 200; i++) { const x = hash01(i + Math.floor(u * 96) * 997, 3) * W, y = hash01(i + Math.floor(u * 96) * 991, 7) * H; ctx.fillStyle = i % 2 ? '#fff' : '#000'; ctx.fillRect(x, y, 3, 3); }
    ctx.restore();
  },
});
