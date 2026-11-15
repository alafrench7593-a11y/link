// IRLY — campagne de précommande. Fonction pure du temps : window.seek(t) peint l'image t.
// Trois variantes avec le même code, choisies par le dossier du film :
//   irly-preorder        75 s, sous-titres incrustés (TikTok / Reels)
//   irly-preorder-clean  75 s, sans sous-titres (version principale propre, et base de la version sans voix)
//   irly-preorder-15     15 s, sous-titres incrustés
// Temps en secondes. Plan : docs/storyboard.md.
// Écrans : captures réelles de la version démo de l'app (contenus d'exemple, aucun compte réel).
// Paywall : maquette générique fictive (aucune appli réelle). Compteur 0 → 100 : illustration de l'objectif.
import * as M from './lib/motion.js';
import { SUBS75, SUBS15 } from './subs.js';

const { W, H, E, TAU, prog, lerp, clamp, springU, SPRING, font, layout, text, fill, cover, rrect, bump, hash01, noise1 } = M;
const FILM = location.pathname.includes('irly-preorder-15') ? '15' : location.pathname.includes('irly-preorder-clean') ? 'clean' : 'main';
const SUBS_ON = FILM !== 'clean';

// ---------------------------------------------------------------- texte modifiable en un seul endroit
// L'ouverture des précommandes dépend de la validation d'Apple : changer ici si la date bouge.
const COPY = {
  preorder: 'PRÉCOMMANDES DANS 24 H',
  preorderShort: 'dans 24 h',
  store: 'sur l’App Store',
  storeNote: 'Ouverture sous réserve de validation par l’App Store',
  goal: 'OBJECTIF : 100 PREMIERS MEMBRES',
  free: '100 % GRATUIT',
  luxury: ['SE FAIRE DES AMIS', 'NE DEVRAIT JAMAIS', 'ÊTRE UN LUXE.'],
  motto: ['Seul, on va plus vite.', 'Ensemble, on va plus loin.'],
  handle: '@irlyofficial',
};

const C = { bg: '#050506', ink: '#0B0B0D', white: '#FFFFFF', steel: '#8EA5BF', steelL: '#C9D6E4', mute: 'rgba(255,255,255,0.62)', green: '#34C759', red: '#FF453A', pink: '#E2336B', gold: '#F2C14E' };
const D = 'Display', UI = 'UI';
const SW = 1170, SH = 2532; // captures 390x844 @3x

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
  const lh = 62, y0 = 1460 - (lines.length - 1) * lh;
  ctx.save(); ctx.globalAlpha = k;
  lines.forEach((l, i) => {
    const Lw = layout(ctx, l, f).width, y = y0 + i * lh;
    rrect(ctx, W / 2 - Lw / 2 - 22, y - 46, Lw + 44, 62, 14); ctx.fillStyle = 'rgba(5,5,6,0.78)'; ctx.fill();
    text(ctx, l, W / 2, y + (1 - k) * 10, f, C.white, 'center');
  });
  ctx.restore();
}

// ---------------------------------------------------------------- primitives réutilisées (75 s et 15 s)
// Appli payante générique : grille de profils floutés et verrouillés, puis une feuille « Premium » fictive.
function paywallScreen(s, t, t0, IMG) {
  const lt = t - t0;
  s.fillStyle = '#16161A'; s.fillRect(0, 0, SW, SH);
  text(s, 'Découvrir', 80, 250, font(84, 900, UI), '#fff');
  text(s, 'Personnes près de toi', 80, 330, font(42, 700, UI), 'rgba(255,255,255,0.55)');
  for (let i = 0; i < 6; i++) {
    const x = 70 + (i % 2) * 530, y = 410 + Math.floor(i / 2) * 610, w = 500, h = 580;
    s.save(); rrect(s, x, y, w, h, 46); s.clip(); s.filter = 'blur(26px) saturate(0.7)';
    const img = IMG['face' + ((i * 5 + 3) % FACES.length)]; if (img) cover(s, img, x - 40, y - 40, w + 80, h + 80, { fy: 0.35 });
    s.filter = 'none'; s.fillStyle = 'rgba(10,10,14,0.35)'; s.fillRect(x, y, w, h); s.restore();
    const lk = sp(t, t0 + 0.25 + i * 0.08, SPRING.bouncy);
    if (lk > 0) { s.save(); s.translate(x + w / 2, y + h / 2); s.scale(lk, lk); s.beginPath(); s.arc(0, 0, 80, 0, TAU); s.fillStyle = 'rgba(0,0,0,0.55)'; s.fill(); lockIcon(s, 0, 0, 90, '#fff'); s.restore(); }
  }
  // feuille d'abonnement fictive
  const sh = E.outCubic(prog(lt, 1.4, 1.8));
  if (sh > 0) {
    s.fillStyle = `rgba(0,0,0,${0.5 * sh})`; s.fillRect(0, 0, SW, SH);
    const y = SH - 1180 * sh;
    s.save(); rrect(s, 0, y, SW, 1300, 70); s.fillStyle = '#232329'; s.fill();
    rrect(s, SW / 2 - 70, y + 30, 140, 12, 6); s.fillStyle = 'rgba(255,255,255,0.3)'; s.fill();
    lockIcon(s, SW / 2, y + 170, 110, C.gold);
    text(s, 'Passe à Premium', SW / 2, y + 340, font(76, 900, UI), '#fff', 'center');
    ['Voir qui veut te rencontrer', 'Écrire sans limite', 'Rejoindre les groupes'].forEach((l, i) => { lockIcon(s, 170, y + 470 + i * 100 - 14, 46, C.gold); text(s, l, 220, y + 470 + i * 100, font(46, 700, UI), 'rgba(255,255,255,0.85)'); });
    rrect(s, 80, y + 790, SW - 160, 170, 85); s.fillStyle = C.gold; s.fill();
    text(s, 'S’abonner · 29,99 / mois', SW / 2, y + 895, font(54, 900, UI), '#1A1A1A', 'center');
    s.restore();
  }
}
function paywallPhone(ctx, t, t0, t1, IMG, { cy = 1010, w = 520 } = {}) {
  const k = sp(t, t0, SPRING.gentle);
  const fall = E.inCubic(prog(t, t1 - 0.35, t1));
  phone(ctx, W / 2, lerp(H + 700, cy, k) + fall * 300, w, (s) => paywallScreen(s, t, t0, IMG), { tilt: -0.04 + 0.02 * Math.sin(t), alpha: 1 - fall, rotY: 0.15 * Math.sin(t * 0.7) });
}
// Étiquettes « payant » qui flottent autour.
function priceTags(ctx, t, t0, t1) {
  const L = [['Voir les profils', 210, 560, -0.12], ['Messages illimités', 860, 700, 0.1], ['Rejoindre un groupe', 230, 1180, 0.08], ['Mode Premium', 850, 1300, -0.08]];
  const out = 1 - prog(t, t1 - 0.3, t1);
  L.forEach(([s, x, y, r], i) => {
    const k = sp(t, t0 + i * 0.35, SPRING.bouncy); if (k <= 0 || out <= 0) return;
    ctx.save(); ctx.translate(x, y + 12 * Math.sin(t * 2 + i)); ctx.rotate(r); ctx.scale(k, k);
    pill(ctx, s, 0, 0, 34, '#1A1A1A', C.gold, { a: clamp(k * 2) * out, weight: 900, icon: 'lock' });
    ctx.restore();
  });
}
// Le cadenas éclate : éclats qui volent depuis le centre.
function shatter(ctx, t, t0, x = W / 2, y = 1000) {
  const p = prog(t, t0, t0 + 0.9); if (p <= 0 || p >= 1) return;
  ctx.save();
  for (let i = 0; i < 26; i++) {
    const a = hash01(i, 21) * TAU, v = 500 + 1300 * hash01(i, 22), r = 18 + 50 * hash01(i, 23);
    const px = x + Math.cos(a) * v * E.outCubic(p), py = y + Math.sin(a) * v * E.outCubic(p) + 900 * p * p;
    ctx.save(); ctx.globalAlpha = 1 - p; ctx.translate(px, py); ctx.rotate(p * 8 * (hash01(i, 24) - 0.5));
    ctx.beginPath(); ctx.moveTo(-r, -r * 0.4); ctx.lineTo(r * 0.8, -r * 0.7); ctx.lineTo(r * 0.2, r); ctx.closePath();
    ctx.fillStyle = i % 3 ? C.gold : '#fff'; ctx.fill(); ctx.restore();
  }
  ctx.restore();
  glow(ctx, x, y, 700, '#ffffff', 0.7 * (1 - p));
}
function logo(ctx, IMG, cx, cy, w, k, a = 1) {
  if (!IMG.logo || k <= 0 || a <= 0) return;
  const h = w * IMG.logo.height / IMG.logo.width;
  ctx.save(); ctx.globalAlpha = a * clamp(k * 1.5); ctx.translate(cx, cy); ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
  ctx.shadowColor = 'rgba(201,214,228,0.55)'; ctx.shadowBlur = 50; ctx.drawImage(IMG.logo, -w / 2, -h / 2, w, h); ctx.restore();
}
// Tampon « 100 % GRATUIT » qui s'abat sur l'écran.
function freeStamp(ctx, t, t0, cy = 1000, { out = null, size = 150 } = {}) {
  const k = E.outBack(prog(t, t0, t0 + 0.28), 2.2); if (k <= 0) return;
  const o = out == null ? 1 : 1 - prog(t, out, out + 0.3); if (o <= 0) return;
  const sc = lerp(2.6, 1, k);
  ctx.save(); ctx.globalAlpha = clamp(prog(t, t0, t0 + 0.12)) * o; ctx.translate(W / 2, cy); ctx.rotate(-0.07); ctx.scale(sc, sc);
  let f = font(size, 900, D), L = layout(ctx, COPY.free, f, 2);
  if (L.width + 110 > 940) { size *= 830 / L.width; f = font(size, 900, D); L = layout(ctx, COPY.free, f, 2); }
  const w = L.width + 110, h = size * 1.55;
  ctx.shadowColor = 'rgba(52,199,89,0.6)'; ctx.shadowBlur = 70;
  rrect(ctx, -w / 2, -h / 2, w, h, 36); ctx.fillStyle = C.green; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 8; ctx.strokeStyle = '#fff'; rrect(ctx, -w / 2 + 16, -h / 2 + 16, w - 32, h - 32, 26); ctx.stroke();
  text(ctx, COPY.free, 0, size * 0.36, f, '#fff', 'center', 2);
  ctx.restore();
  // éclats de lumière
  const p = prog(t, t0 + 0.2, t0 + 1.1);
  if (p > 0 && p < 1) { ctx.save(); for (let i = 0; i < 24; i++) { const a = i / 24 * TAU + hash01(i, 5), d = lerp(300, 700, E.outCubic(p)); ctx.globalAlpha = (1 - p) * o; ctx.fillStyle = i % 2 ? '#fff' : C.green; ctx.beginPath(); ctx.arc(W / 2 + Math.cos(a) * d * 1.1, cy + Math.sin(a) * d * 0.7, 8 + 8 * hash01(i, 6), 0, TAU); ctx.fill(); } ctx.restore(); }
}
// Grille de 100 places qui se remplit : illustration de l'objectif (pas un compteur réel).
function goalGrid(ctx, t, IMG, t0, tFill0, tFill1, { cy = 1000, size = 860, alpha = 1, showNum = true } = {}) {
  if (alpha <= 0) return;
  const n = Math.round(100 * E.inOutCubic(prog(t, tFill0, tFill1)));
  const cell = size / 10, x0 = W / 2 - size / 2, y0 = cy - size / 2 + 60;
  ctx.save(); ctx.globalAlpha = alpha;
  if (showNum) {
    const done = n >= 100, k = done ? sp(t, tFill1, SPRING.bouncy) : 1;
    ctx.save(); ctx.translate(W / 2, y0 - 120); ctx.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
    text(ctx, String(n), 0, 0, font(190, 900, D), done ? C.green : '#fff', 'center');
    ctx.restore();
    text(ctx, '/ 100', W / 2 + 230, y0 - 120, font(56, 800, UI), C.mute, 'left');
  }
  const order = [...Array(100).keys()].sort((a, b) => hash01(a, 77) - hash01(b, 77));
  const rank = new Array(100); order.forEach((c, i) => { rank[c] = i; });
  for (let c = 0; c < 100; c++) {
    const x = x0 + (c % 10 + 0.5) * cell, y = y0 + (Math.floor(c / 10) + 0.5) * cell;
    const appear = sp(t, t0 + (c % 10 + Math.floor(c / 10)) * 0.015, SPRING.snappy);
    if (appear <= 0) continue;
    const r = cell * 0.4;
    if (rank[c] < n) {
      const fillT = tFill0 + (tFill1 - tFill0) * E.inOutCubic(1) * (rank[c] / 100);
      const pk = sp(t, fillT, SPRING.bouncy);
      face(ctx, IMG, c * 7 + 3, x, y, r * Math.min(1.15, pk), 1, 'rgba(255,255,255,0.9)', false);
    } else {
      ctx.save(); ctx.globalAlpha = alpha * appear * 0.6; ctx.setLineDash([6, 6]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.arc(x, y, r * appear, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }
  ctx.restore();
}
// Anneau « 24 h » et texte de précommande.
function preorderRing(ctx, t, t0, cy = 900, { alpha = 1 } = {}) {
  const k = sp(t, t0, SPRING.gentle); if (k <= 0 || alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha * clamp(k * 1.5); ctx.translate(W / 2, cy); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
  const R = 250, p = E.outCubic(prog(t, t0 + 0.1, t0 + 1.4));
  ctx.lineWidth = 26; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  ctx.strokeStyle = C.white; ctx.shadowColor = 'rgba(201,214,228,0.7)'; ctx.shadowBlur = 40; ctx.beginPath(); ctx.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke(); ctx.shadowColor = 'transparent';
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU - Math.PI / 2; ctx.fillStyle = i / 24 < p ? '#fff' : 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(Math.cos(a) * (R + 50), Math.sin(a) * (R + 50), 6, 0, TAU); ctx.fill(); }
  text(ctx, '24', 0, 50, font(200, 900, D), '#fff', 'center');
  text(ctx, 'HEURES', 0, 120, font(40, 800, UI), C.steelL, 'center', 8);
  ctx.restore();
}
function endCard(ctx, t, t0, IMG, { short = false } = {}) {
  fill(ctx, C.bg);
  bokeh(ctx, t, 16, 0.35, 9);
  glow(ctx, W / 2, 620, 600, C.steel, 0.25);
  // un anneau de visages qui tourne doucement autour du logo
  const rk = sp(t, t0 + 0.1, SPRING.gentle);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * TAU + t * 0.15, R = 400 * rk;
    face(ctx, IMG, i * 3 + 1, W / 2 + Math.cos(a) * R, 620 + Math.sin(a) * R * 0.55, 38 * rk, 0.55 * clamp(rk), 'rgba(255,255,255,0.6)', false);
  }
  logo(ctx, IMG, W / 2, 600, 560, sp(t, t0, SPRING.bouncy));
  words(ctx, 'MAKE FRIENDS IRL', W / 2, 760, 40, C.steelL, t, t0 + 0.3, { weight: 800, track: 0.18, step: 0.06 });
  const fk = E.outBack(prog(t, t0 + 0.6, t0 + 0.9)); if (fk > 0) { ctx.save(); ctx.translate(W / 2, 960); ctx.scale(fk, fk); pill(ctx, COPY.free, 0, 0, 56, '#fff', C.green, { weight: 900 }); ctx.restore(); }
  words(ctx, COPY.preorder, W / 2, 1140, 60, '#fff', t, t0 + 0.9, { weight: 900, step: 0.06 });
  words(ctx, COPY.store, W / 2, 1210, 46, C.steelL, t, t0 + 1.1, { weight: 700, step: 0.06 });
  words(ctx, COPY.goal, W / 2, 1330, 40, C.white, t, t0 + 1.3, { weight: 800, step: 0.05, track: 0.06 });
  const ha = prog(t, t0 + 1.6, t0 + 1.9);
  if (ha > 0) { ctx.save(); ctx.globalAlpha = ha; text(ctx, COPY.handle, W / 2, 1440, font(44, 800, UI), '#fff', 'center'); text(ctx, COPY.storeNote, W / 2, 1500, font(26, 700, UI), 'rgba(255,255,255,0.5)', 'center'); ctx.restore(); }
  if (!short) { /* rien d'autre */ }
}

// ================================================================ FILM 75 s
const VO = 1.0; // la voix commence à 1 s

// S1 le problème (0 → 8,1)
function s1Problem(ctx, t, IMG) {
  bgPhoto(ctx, IMG.u11, { blur: 28, dark: 0.55, zoom: 1.2 });
  bokeh(ctx, t, 14, 0.25, 2);
  const swap = E.inOutCubic(prog(t, 4.0, 4.6));
  // carte 1 : seule face à la ville
  const k1 = sp(t, 0.1, SPRING.gentle);
  photoCard(ctx, IMG.u11, lerp(W / 2, W / 2 - 520, swap), 1000, 760, 1090, { rot: lerp(-0.03, -0.25, swap), k: k1 * lerp(1, 0.8, swap), zoom: 1.12 - 0.08 * prog(t, 0, 4.5), fy: 0.4, a: 1 - swap * 0.7 });
  // carte 2 : entourée de monde, mais sur son téléphone (photo 15 recadrée sur les personnes, sans l'arrière-plan)
  const k2 = sp(t, 4.0, SPRING.gentle);
  if (IMG.u15) photoCard(ctx, IMG.u15, W / 2 + 20, lerp(1060, 1000, k2), 760, 900, { rot: 0.03, k: k2, crop: [0, IMG.u15.height * 0.46, IMG.u15.width * 0.62, IMG.u15.height * 0.54], zoom: 1.05 + 0.08 * prog(t, 4, 8.1) });
  shade(ctx, 0.85, 0.4);
  head(ctx, 'Dubaï est magnifique…', 330, 78, '#fff', t, 1.1, { out: 3.9 });
  head(ctx, 'Mais même entourée de monde…', 310, 64, '#fff', t, 4.3, { out: 7.9 });
  head(ctx, 'on peut se sentir seule.', 400, 70, C.steelL, t, 6.5, { out: 7.9 });
  vignette(ctx, 0.5);
}
// S2 le quotidien (8,1 → 13,7)
function s2Daily(ctx, t, IMG) {
  bgPhoto(ctx, IMG.p_runMix, { blur: 30, dark: 0.6, zoom: 1.2 });
  const doubt = E.inOutCubic(prog(t, 11.85, 12.3));
  const cards = [[IMG.u13, 8.3, 'SORTIR', -0.1, -250, 0.5], [IMG.p_runMix, 9.25, 'FAIRE DU SPORT', 0.06, 0, 0.45], [IMG.p_beachMix, 10.25, 'DÉCOUVRIR', -0.04, 250, 0.5]];
  cards.forEach(([img, t0, label, r, dx, fy], i) => {
    const k = sp(t, t0, SPRING.bouncy);
    const x = W / 2 + dx * (1 + doubt * 0.6), y = 980 + (i - 1) * 40 + doubt * (i === 1 ? -40 : 60);
    photoCard(ctx, img, x, y, 520, 740, { rot: r * (1 + doubt), k: k * lerp(1, 0.85, doubt), fy, label, sat: 1 - doubt * 0.85, zoom: 1.05 + 0.05 * prog(t, t0, 13.7) });
  });
  // le cercle vide « avec qui ? »
  const qk = sp(t, 12.3, SPRING.bouncy);
  if (qk > 0) {
    ctx.save(); ctx.translate(W / 2, 1000); ctx.scale(qk, qk);
    ctx.beginPath(); ctx.arc(0, 0, 150, 0, TAU); ctx.fillStyle = 'rgba(5,5,6,0.75)'; ctx.fill();
    ctx.setLineDash([16, 12]); ctx.lineDashOffset = -t * 40; ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.setLineDash([]);
    text(ctx, '?', 0, 60, font(170, 900, D), '#fff', 'center'); ctx.restore();
  }
  shade(ctx, 0.85, 0.4);
  head(ctx, 'Sortir. Bouger. Découvrir.', 330, 70, '#fff', t, 8.2, { out: 11.7, step: 0.35 });
  head(ctx, '…mais avec qui ?', 360, 92, C.steelL, t, 11.9, { out: 13.5 });
  vignette(ctx, 0.5);
}
// S3 les applis payantes (13,7 → 22,3)
function s3Paywall(ctx, t, IMG) {
  fill(ctx, '#0E0E11');
  const red = prog(t, 19.3, 19.8);
  glow(ctx, W / 2, 1000, 900, C.gold, 0.12 * (1 - red)); glow(ctx, W / 2, 1000, 900, C.red, 0.18 * red);
  if (t < 19.9) {
    paywallPhone(ctx, t, 13.7, 19.9, IMG, { cy: 1040, w: 500 });
    priceTags(ctx, t, 16.2, 19.6);
    tag(ctx, 'EXEMPLE FICTIF · AUCUNE APPLI RÉELLE', prog(t, 14, 14.3) * (1 - prog(t, 19.4, 19.7)));
  }
  shade(ctx, 0.85, 0.3);
  head(ctx, 'Payer pour rencontrer', 320, 72, '#fff', t, 14.0, { out: 19.3 });
  head(ctx, 'du monde ?', 410, 72, C.gold, t, 14.4, { out: 19.3 });
  // le manifeste
  if (t >= 19.3) {
    COPY.luxury.forEach((l, i) => head(ctx, l, 860 + i * 150, i === 2 ? 128 : 104, i === 2 ? C.gold : '#fff', t, 19.4 + i * 0.6, { family: D, weight: 900, step: 0.1, out: 22.1 }));
    const ul = E.outCubic(prog(t, 21.0, 21.4)); if (ul > 0) { ctx.save(); ctx.globalAlpha = 1 - prog(t, 22.1, 22.3); ctx.fillStyle = C.gold; ctx.fillRect(W / 2 - 360 * ul, 1190, 720 * ul, 10); ctx.restore(); }
  }
  vignette(ctx, 0.5);
}
// S4 la révélation (22,3 → 31,6)
const HOME = ['H0', 'H1', 'H2', 'H3'];
function homeScroll(s, t, a, b) { const p = clamp((t - a) / (b - a)) * 3, i = Math.min(2, Math.floor(p)); scrollPair(s, IMGS[HOME[i]], IMGS[HOME[i + 1]], E.inOutCubic(p - i)); }
let IMGS = {};
function s4Reveal(ctx, t, IMG) {
  fill(ctx, C.bg);
  if (t < 24.2) {
    // le cadenas qui s'ouvre puis éclate, et le logo
    const lk = sp(t, 22.35, SPRING.bouncy) * (1 - prog(t, 22.95, 23.0));
    if (lk > 0) { lockIcon(ctx, W / 2, 1000, 260 * lk, C.gold, E.outBack(prog(t, 22.6, 22.9))); }
    shatter(ctx, t, 22.95, W / 2, 1000);
    bokeh(ctx, t, 18, 0.3 * prog(t, 23, 23.5), 5);
    logo(ctx, IMG, W / 2, 960, 640, sp(t, 23.4, SPRING.bouncy));
    head(ctx, 'C’est pour ça qu’on a créé', 700, 58, C.mute, t, 22.4, { out: 24.0 });
    return;
  }
  bgPhoto(ctx, IMG.u12, { blur: 34, dark: 0.6, zoom: 1.25, fy: 0.5 });
  const k = sp(t, 24.2, SPRING.gentle), sink = E.inOutCubic(prog(t, 29.0, 29.6));
  phone(ctx, W / 2, lerp(H + 600, 1080, k) + sink * 60, 540, (s) => { if (t < 25.2) shot(s, IMG.H0); else homeScroll(s, t, 25.2, 28.8); }, { rotY: 0.12 * Math.sin((t - 24) * 0.8), tilt: -0.02, scale: lerp(1, 0.92, sink) });
  faceCloud(ctx, t, IMG, 24.8, 31.5, 0, 600);
  shade(ctx, 0.85, 0.3);
  logo(ctx, IMG, W / 2, 230, 300, sp(t, 24.25, SPRING.snappy), 1 - prog(t, 31.2, 31.5));
  head(ctx, 'L’appli sociale pour se faire', 360, 58, '#fff', t, 24.4, { out: 28.9 });
  head(ctx, 'des amis à Dubaï.', 440, 70, C.steelL, t, 25.6, { out: 28.9 });
  head(ctx, 'Et surtout…', 400, 84, '#fff', t, 29.0, { out: 31.4 });
  if (t >= 30.55) { ctx.fillStyle = `rgba(5,5,6,${0.45 * prog(t, 30.55, 30.75)})`; ctx.fillRect(0, 0, W, H); }
  freeStamp(ctx, t, 30.6, 1000, { out: 31.4 });
  tag(ctx, 'DÉMO DE L’APP · CONTENUS D’EXEMPLE', prog(t, 24.6, 24.9) * (1 - prog(t, 30.4, 30.6)), 1600);
  vignette(ctx, 0.45);
}
// S5 démo de l'app (31,6 → 40,6)
const DEMO = [ // [début, capture, transition, légende]
  [31.6, 'msg', 'fade', 'COMMUNAUTÉS & CHATS'],
  [33.75, 'S1', 'push', 'SORTIES'],
  [34.45, 'CR', 'sheet', 'SORTIES'],
  [35.25, 'S0', 'fade', 'RENCONTRES'],
  [36.6, 'G0', 'push', 'IRLY GIRL'],
  [38.0, 'N0', 'push', 'IRLY NETWORK'],
  [39.3, 'N1', 'fade', 'IRLY NETWORK'],
];
function s5Demo(ctx, t, IMG) {
  bgPhoto(ctx, t < 36.6 ? IMG.p_girlsOut : IMG.p_networkingGirl, { blur: 34, dark: 0.62, zoom: 1.25 });
  let i = 0; DEMO.forEach((d, k) => { if (t >= d[0]) i = k; });
  const [t0, key, mode, label] = DEMO[i], prev = i > 0 ? DEMO[i - 1][1] : 'H3';
  const k = sp(t, 31.6, SPRING.gentle);
  phone(ctx, W / 2, 1020, 540, (s) => {
    navTo(s, IMG[prev], IMG[key], prog(t, t0, t0 + 0.35), mode);
    if (key === 'S1') tap(s, t, 34.3, 585, 2151);
    if (key === 'CR') { tap(s, t, 34.85, 811, 1557); tap(s, t, 35.15, 584, 2365); }
    if (key === 'S0') tap(s, t, 36.3, 585, 1280);
    if (key === 'G0' && t > 37.0) scrollPair(s, IMG.G0, IMG.G1, E.inOutCubic(prog(t, 37.0, 37.8)));
  }, { rotY: 0.1 * Math.sin(t * 0.9), tilt: 0.02 * Math.sin(t * 0.6), scale: lerp(0.92, 1, k) });
  faceCloud(ctx, t, IMG, 31.7, 40.5, 3, 640);
  shade(ctx, 0.85, 0.35);
  // la légende de l'écran
  const la = sp(t, t0, SPRING.snappy);
  if (!(i > 0 && DEMO[i - 1][3] === label)) { ctx.save(); ctx.translate(W / 2, 320); ctx.scale(la, la); pill(ctx, label, 0, 0, 46, C.ink, '#fff', { weight: 900 }); ctx.restore(); }
  else pill(ctx, label, W / 2, 320, 46, C.ink, '#fff', { weight: 900 });
  // sans abonnement, sans payer
  [[37.65, 'Sans abonnement'], [38.65, 'Sans payer pour créer des liens']].forEach(([a, s], j) => {
    const kk = sp(t, a, SPRING.bouncy); if (kk <= 0) return;
    ctx.save(); ctx.translate(W / 2, 430 + j * 100); ctx.scale(kk, kk); pill(ctx, s, 0, 0, 38, '#fff', C.green, { weight: 900, icon: 'check' }); ctx.restore();
  });
  tag(ctx, 'DÉMO DE L’APP · CONTENUS D’EXEMPLE', 0.9, 1640);
  vignette(ctx, 0.45);
}
// S6 pourquoi 100 (40,6 → 50,5)
function s6Hundred(ctx, t, IMG) {
  fill(ctx, C.bg); bokeh(ctx, t, 16, 0.25, 7);
  const ph = IMG.u14, bga = prog(t, 47.8, 48.6);
  if (ph) bgPhoto(ctx, ph, { alpha: bga, dark: 0.55, zoom: 1.15 - 0.05 * prog(t, 47.8, 50.5), fy: 0.45 });
  const up = E.inOutCubic(prog(t, 47.6, 48.3));
  ctx.save(); ctx.translate(W / 2, 1000); ctx.scale(lerp(1, 0.62, up), lerp(1, 0.62, up)); ctx.translate(-W / 2, -1000 - up * 420);
  goalGrid(ctx, t, IMG, 42.5, 44.4, 46.9, { cy: 1130, size: 800 });
  ctx.restore();
  shade(ctx, 0.85, 0.5);
  head(ctx, 'On fait les choses', 330, 74, '#fff', t, 40.65, { out: 42.4 });
  head(ctx, 'autrement.', 420, 74, C.steelL, t, 41.3, { out: 42.4 });
  head(ctx, 'Avant d’ouvrir, on veut', 300, 60, '#fff', t, 42.55, { out: 47.5 });
  head(ctx, 'réunir 100 personnes.', 380, 72, C.green, t, 43.7, { out: 47.5 });
  const ia = prog(t, 44.4, 44.7) * (1 - prog(t, 47.4, 47.7));
  if (ia > 0) { ctx.save(); ctx.globalAlpha = ia; text(ctx, 'Illustration de l’objectif · ce n’est pas un compteur réel', W / 2, 1640, font(28, 700, UI), 'rgba(255,255,255,0.6)', 'center'); ctx.restore(); }
  // pour que, dès le premier jour…
  head(ctx, 'Pour que, dès le premier jour,', 1060, 58, '#fff', t, 45.7 + 2.4, { out: 50.3 });
  [[48.9, 'Échanger'], [49.3, 'Sortir'], [49.75, 'Se rencontrer']].forEach(([a, s], j) => {
    const kk = sp(t, a, SPRING.bouncy); if (kk <= 0) return;
    ctx.save(); ctx.translate(W / 2 + (j - 1) * 320, 1200); ctx.scale(kk, kk); pill(ctx, s, 0, 0, 40, C.ink, '#fff', { weight: 900, a: 1 - prog(t, 50.2, 50.5) }); ctx.restore();
  });
  vignette(ctx, 0.5);
}
// S7 l'appel à l'action (50,5 → 60,8)
function s7Cta(ctx, t, IMG) {
  fill(ctx, C.bg);
  bgPhoto(ctx, IMG.u14, { alpha: 1, dark: 0.72, zoom: 1.1, fy: 0.45, blur: 18 });
  bokeh(ctx, t, 18, 0.3, 11);
  // JOUEZ LE JEU
  const jk = sp(t, 50.5, SPRING.bouncy), ja = 1 - prog(t, 51.55, 51.8);
  if (ja > 0 && jk > 0) { ctx.save(); ctx.globalAlpha = ja; ctx.translate(W / 2, 960); ctx.scale(lerp(1.6, 1, jk), lerp(1.6, 1, jk)); ctx.rotate(-0.04); text(ctx, 'JOUEZ', 0, -40, font(210, 900, D), '#fff', 'center'); text(ctx, 'LE JEU', 0, 170, font(210, 900, D), C.green, 'center'); ctx.restore(); }
  // 24 h
  const ra = prog(t, 51.7, 51.9) * (1 - prog(t, 54.4, 54.7));
  preorderRing(ctx, t, 51.7, 920, { alpha: ra });
  head(ctx, 'Les précommandes ouvrent', 330, 62, '#fff', t, 52.7, { out: 54.4 });
  head(ctx, COPY.store, 410, 68, C.steelL, t, 53.8, { out: 54.4 });
  const na = prog(t, 52.5, 52.8) * (1 - prog(t, 54.4, 54.7));
  if (na > 0) { ctx.save(); ctx.globalAlpha = na; text(ctx, COPY.storeNote, W / 2, 1290, font(28, 700, UI), 'rgba(255,255,255,0.6)', 'center'); ctx.restore(); }
  // précommande + partage
  if (t >= 54.6 && t < 58.0) {
    const bk = sp(t, 54.65, SPRING.bouncy), press = bump(t, 55.3, 0.15), out = 1 - prog(t, 57.7, 58);
    ctx.save(); ctx.globalAlpha = out; ctx.translate(W / 2, 760); ctx.scale(bk * (1 - 0.06 * press), bk * (1 - 0.06 * press));
    rrect(ctx, -380, -80, 760, 160, 80); ctx.fillStyle = '#fff'; ctx.fill();
    text(ctx, t < 55.35 ? 'Précommander · Gratuit' : 'Précommandé ✓', 0, 18, font(50, 900, UI), C.ink, 'center'); ctx.restore();
    // le partage : trois bulles vers trois amis
    for (let j = 0; j < 3; j++) {
      const a0 = 56.3 + j * 0.25, p = E.inOutCubic(prog(t, a0, a0 + 0.55));
      const fx = W / 2 + (j - 1) * 330, fy = 1250;
      face(ctx, IMG, j * 6 + 2, fx, fy, 85 * sp(t, 56.0 + j * 0.12, SPRING.bouncy), out);
      if (p > 0 && p < 1) { ctx.save(); ctx.globalAlpha = out; const bx = lerp(W / 2, fx, p), by = lerp(840, fy - 130, p) - Math.sin(p * Math.PI) * 120; rrect(ctx, bx - 60, by - 40, 120, 80, 30); ctx.fillStyle = C.green; ctx.fill(); text(ctx, 'IRLY', bx, by + 12, font(30, 900, UI), '#fff', 'center'); ctx.restore(); }
      if (p >= 1) { ctx.save(); ctx.globalAlpha = out; pill(ctx, 'Invité·e', fx, fy + 125, 26, C.ink, '#fff', { weight: 900 }); ctx.restore(); }
    }
    head(ctx, 'Précommande gratuitement', 330, 64, '#fff', t, 54.65, { out: 57.7 });
    head(ctx, 'et partage à tes amis.', 410, 64, C.steelL, t, 56.3, { out: 57.7 });
  }
  // plus vite on sera 100
  if (t >= 57.9) {
    const pa = prog(t, 57.9, 58.1) * (1 - prog(t, 60.5, 60.8)), p = E.inOutCubic(prog(t, 58.0, 60.0));
    ctx.save(); ctx.globalAlpha = pa;
    rrect(ctx, 120, 990, W - 240, 44, 22); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
    rrect(ctx, 120, 990, (W - 240) * p, 44, 22); ctx.fillStyle = C.green; ctx.fill();
    for (let j = 0; j < 8; j++) face(ctx, IMG, j * 4 + 5, 150 + (W - 300) * (j / 7), 920, 34 * clamp((p - j / 8) * 6), 1, '#fff', false);
    text(ctx, '100', W - 120, 1100, font(56, 900, D), C.green, 'right');
    text(ctx, 'Illustration', 120, 1100, font(26, 700, UI), 'rgba(255,255,255,0.55)', 'left');
    ctx.restore();
    head(ctx, 'Plus vite on sera 100,', 330, 68, '#fff', t, 57.95, { out: 60.6 });
    head(ctx, 'plus vite on commence.', 420, 68, C.green, t, 59.2, { out: 60.6 });
  }
  shade(ctx, 0.7, 0.3);
  vignette(ctx, 0.5);
}
// S8 la conclusion (60,8 → 75)
function s8End(ctx, t, IMG) {
  if (t < 64.0) {
    const swap = E.inOutCubic(prog(t, 62.4, 63.0));
    bgPhoto(ctx, IMG.u12, { zoom: 1.18 - 0.08 * prog(t, 60.8, 63), fy: 0.55, alpha: 1 - swap, dark: 0.25 });
    if (swap > 0) bgPhoto(ctx, IMG.u14, { zoom: 1.12 - 0.04 * prog(t, 62.4, 64), fy: 0.5, alpha: swap, dark: 0.25 });
    bokeh(ctx, t, 12, 0.2, 13);
    shade(ctx, 0.85, 0.5);
    head(ctx, 'Dubaï est encore plus belle', 330, 66, '#fff', t, 60.85, { out: 63.8 });
    head(ctx, 'quand on la partage.', 420, 72, C.steelL, t, 62.4, { out: 63.8 });
    vignette(ctx, 0.45); return;
  }
  if (t < 67.6) {
    // écran partagé : seule / ensemble
    const split = E.inOutCubic(prog(t, 65.6, 66.1));
    const mid = lerp(W, W * 0.38, split);
    fill(ctx, C.bg);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, mid, H); ctx.clip(); ctx.filter = `saturate(${lerp(1, 0.2, split)})`; cover(ctx, IMG.u11, 0, 0, Math.max(mid, W * 0.38), H, { fy: 0.45, zoom: 1.1 }); ctx.restore();
    if (split > 0) { ctx.save(); ctx.beginPath(); ctx.rect(mid, 0, W - mid, H); ctx.clip(); cover(ctx, IMG.u14, mid, 0, W * 0.62, H, { fy: 0.5, fx: 0.45, zoom: 1.08 }); ctx.restore(); ctx.fillStyle = '#fff'; ctx.fillRect(mid - 3, 0, 6, H); }
    shade(ctx, 0.85, 0.55);
    head(ctx, COPY.motto[0], 330, 70, '#fff', t, 64.05, { out: 67.4 });
    head(ctx, COPY.motto[1], 430, 76, C.green, t, 65.7, { out: 67.4 });
    vignette(ctx, 0.4); return;
  }
  endCard(ctx, t, 67.6, IMG);
}

// ================================================================ FILM 15 s (voix à 0,4 s)
function f15(ctx, t, IMG) {
  if (t < 3.2) { // tu galères à te faire des amis
    bgPhoto(ctx, IMG.u11, { blur: 28, dark: 0.55, zoom: 1.2 });
    const cards = [[IMG.u11, 0.0, -0.12, -230, null], [IMG.u15, 0.7, 0.08, 230, 'crop'], [IMG.u13, 1.4, -0.03, 0, null]];
    cards.forEach(([img, t0, r, dx, c]) => photoCard(ctx, img, W / 2 + dx, 1000, 560, 800, { rot: r, k: sp(t, t0, SPRING.bouncy), fy: 0.45, sat: 1 - 0.8 * prog(t, 2.2, 2.6), crop: c && img ? [0, img.height * 0.46, img.width * 0.62, img.height * 0.54] : null }));
    shade(ctx, 0.85, 0.4);
    head(ctx, 'Tu vis à Dubaï', 320, 76, '#fff', t, 0.45, { out: 3.05 });
    head(ctx, 'et tu galères à te faire des amis ?', 410, 60, C.steelL, t, 1.5, { out: 3.05 });
    vignette(ctx, 0.5); return;
  }
  if (t < 5.85) { // payer ?
    fill(ctx, '#0E0E11'); glow(ctx, W / 2, 1000, 900, C.gold, 0.12);
    paywallPhone(ctx, t, 3.0, 6.2, IMG, { cy: 1050, w: 500 });
    priceTags(ctx, t, 3.6, 5.85);
    tag(ctx, 'EXEMPLE FICTIF · AUCUNE APPLI RÉELLE', 0.9);
    shade(ctx, 0.85, 0.3);
    head(ctx, 'Pourquoi payer un abonnement', 320, 60, '#fff', t, 3.2, { out: 5.7 });
    head(ctx, 'pour rencontrer du monde ?', 400, 64, C.gold, t, 4.3, { out: 5.7 });
    vignette(ctx, 0.5); return;
  }
  if (t < 9.2) { // IRLY arrive, 100 % gratuit
    fill(ctx, C.bg);
    if (t < 6.9) { shatter(ctx, t, 5.85, W / 2, 1000); bokeh(ctx, t, 18, 0.3, 5); logo(ctx, IMG, W / 2, 960, 640, sp(t, 5.9, SPRING.bouncy)); head(ctx, 'arrive.', 1180, 80, C.steelL, t, 6.2); return; }
    bgPhoto(ctx, IMG.u12, { blur: 34, dark: 0.6, zoom: 1.25 });
    const seq = ['H0', 'S0', 'G0', 'N0'], i = Math.min(3, Math.floor((t - 6.9) / 0.4));
    phone(ctx, W / 2, 1060, 540, (s) => navTo(s, IMG[seq[Math.max(0, i - 1)]], IMG[seq[i]], prog(t, 6.9 + i * 0.4, 6.9 + i * 0.4 + 0.25), 'push'), { scale: lerp(0.9, 1, sp(t, 6.9, SPRING.gentle)), rotY: 0.1 * Math.sin(t) });
    faceCloud(ctx, t, IMG, 6.95, 9.2, 1, 620);
    shade(ctx, 0.85, 0.3);
    logo(ctx, IMG, W / 2, 230, 300, 1);
    head(ctx, 'Une appli sociale', 360, 72, '#fff', t, 6.95, { out: 8.2 });
    if (t >= 8.25) { ctx.fillStyle = `rgba(5,5,6,${0.45 * prog(t, 8.25, 8.4)})`; ctx.fillRect(0, 0, W, H); }
    freeStamp(ctx, t, 8.3, 1000, { out: 9.1, size: 140 });
    tag(ctx, 'DÉMO DE L’APP · CONTENUS D’EXEMPLE', 0.9, 1640);
    vignette(ctx, 0.45); return;
  }
  if (t < 11.0) { // précommandes dans 24 h
    fill(ctx, C.bg); bgPhoto(ctx, IMG.u14, { dark: 0.72, blur: 18, zoom: 1.1 }); bokeh(ctx, t, 16, 0.3, 11);
    preorderRing(ctx, t, 9.2, 930, { alpha: 1 - prog(t, 10.8, 11.0) });
    head(ctx, 'PRÉCOMMANDES', 330, 92, '#fff', t, 9.2, { family: D, weight: 900, out: 10.85 });
    head(ctx, COPY.store, 420, 60, C.steelL, t, 9.6, { out: 10.85 });
    const na = prog(t, 9.6, 9.9) * (1 - prog(t, 10.8, 11)); if (na > 0) { ctx.save(); ctx.globalAlpha = na; text(ctx, COPY.storeNote, W / 2, 1300, font(28, 700, UI), 'rgba(255,255,255,0.6)', 'center'); ctx.restore(); }
    vignette(ctx, 0.5); return;
  }
  if (t < 12.7) { // objectif 100
    fill(ctx, C.bg); bokeh(ctx, t, 16, 0.25, 7);
    goalGrid(ctx, t, IMG, 11.0, 11.2, 12.4, { cy: 1030, size: 760 });
    shade(ctx, 0.8, 0.4);
    head(ctx, 'Objectif :', 300, 64, '#fff', t, 11.05, { out: 12.6 });
    head(ctx, '100 premiers membres', 390, 76, C.green, t, 11.6, { out: 12.6 });
    const ia = prog(t, 11.2, 11.4); ctx.save(); ctx.globalAlpha = ia; text(ctx, 'Illustration de l’objectif', W / 2, 1640, font(28, 700, UI), 'rgba(255,255,255,0.6)', 'center'); ctx.restore();
    vignette(ctx, 0.5); return;
  }
  if (t < 13.6) { // jouez le jeu
    fill(ctx, C.bg); bgPhoto(ctx, IMG.u14, { dark: 0.6, zoom: 1.1 - 0.04 * prog(t, 12.7, 13.6) });
    const jk = sp(t, 12.7, SPRING.bouncy);
    ctx.save(); ctx.translate(W / 2, 960); ctx.scale(lerp(1.6, 1, jk), lerp(1.6, 1, jk)); ctx.rotate(-0.04); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 40; text(ctx, 'JOUEZ', 0, -40, font(210, 900, D), '#fff', 'center'); text(ctx, 'LE JEU', 0, 170, font(210, 900, D), C.green, 'center'); ctx.restore();
    vignette(ctx, 0.5); return;
  }
  endCard(ctx, t, 13.6, IMG, { short: true });
}

// ---------------------------------------------------------------- sons (temps en secondes → temps musicaux)
const B = (s) => s / 0.625; // 96 BPM (beats.json)
const HITS75 = [
  [B(0.1), 'carte', 'whoosh', { len: 0.5, from: 500, to: 2400, gain: 0.5 }],
  [B(4.0), 'carte 2', 'whoosh', { len: 0.5, from: 500, to: 2400, gain: 0.5 }],
  [B(8.3), 'sortir', 'pop', { pitch: 'D5' }], [B(9.25), 'sport', 'pop', { pitch: 'F#5' }], [B(10.25), 'découvrir', 'pop', { pitch: 'A5' }],
  [B(12.3), 'avec qui', 'thud'],
  [B(13.7), 'appli payante', 'whoosh', { len: 0.6, from: 300, to: 2000 }],
  ...[0, 1, 2, 3, 4, 5].map((i) => [B(13.95 + i * 0.08), 'cadenas ' + (i + 1), 'click']),
  [B(15.1), 'feuille premium', 'whoosh', { len: 0.35, from: 900, to: 2200, gain: 0.5 }],
  ...[0, 1, 2, 3].map((i) => [B(16.2 + i * 0.35), 'prix ' + (i + 1), 'blip', { pitch: ['E5', 'G5', 'B5', 'D6'][i] }]),
  [B(19.4), 'manifeste 1', 'impact'], [B(20.0), 'manifeste 2', 'thud'], [B(20.6), 'manifeste 3', 'impact'],
  [B(22.95), 'cadenas éclate', 'impact'],
  [B(23.4), 'logo', 'bell', { pitch: 'D6' }],
  [B(24.2), 'téléphone', 'whoosh', { len: 0.5, from: 400, to: 2600 }],
  [B(24.8), 'visages', 'pop', { pitch: 'A5' }],
  [B(30.6), '100 % gratuit', 'impact'], [B(30.65), 'gratuit cloche', 'bell', { pitch: 'A5' }],
  ...DEMO.map((d, i) => [B(d[0]), 'écran ' + (i + 1), 'tick']),
  [B(34.3), 'lancer', 'click'], [B(35.15), 'publier', 'click'], [B(36.3), 'suivre', 'click'],
  [B(37.65), 'sans abonnement', 'blip', { pitch: 'A5' }], [B(38.65), 'sans payer', 'blip', { pitch: 'D6' }],
  [B(42.5), 'grille', 'whoosh', { len: 0.5, from: 600, to: 2600, gain: 0.5 }],
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => [B(44.4 + i * 0.25), 'membres ' + (i + 1), 'pop', { pitch: ['D5', 'E5', 'F#5', 'G5', 'A5', 'B5', 'C#6', 'D6', 'E6', 'F#6'][i], gain: 0.5 }]),
  [B(46.9), '100', 'impact'],
  [B(48.9), 'échanger', 'tick'], [B(49.3), 'sortir', 'tick'], [B(49.75), 'se rencontrer', 'tick'],
  [B(50.5), 'jouez le jeu', 'impact'],
  [B(51.7), '24 h', 'whoosh', { len: 0.6, from: 400, to: 2600 }],
  [B(55.3), 'précommander', 'click'],
  ...[0, 1, 2].map((j) => [B(56.85 + j * 0.25), 'partage ' + (j + 1), 'blip', { pitch: ['A5', 'C#6', 'E6'][j] }]),
  [B(60.0), 'barre pleine', 'bell', { pitch: 'A5' }],
  [B(62.4), 'photo groupe', 'whoosh', { len: 0.5, from: 500, to: 2400, gain: 0.5 }],
  [B(65.6), 'ensemble', 'whoosh', { len: 0.4, from: 700, to: 2600 }],
  [B(67.6), 'logo fin', 'impact'], [B(67.7), 'logo cloche', 'bell', { pitch: 'D6' }],
  [B(68.2), 'gratuit fin', 'pop', { pitch: 'A5' }],
];
const HITS15 = [
  [B(0.0), 'carte 1', 'pop', { pitch: 'D5' }], [B(0.7), 'carte 2', 'pop', { pitch: 'F#5' }], [B(1.4), 'carte 3', 'pop', { pitch: 'A5' }],
  [B(3.0), 'appli payante', 'whoosh', { len: 0.5, from: 300, to: 2000 }],
  ...[0, 1, 2, 3].map((i) => [B(3.6 + i * 0.35), 'prix ' + (i + 1), 'blip', { pitch: ['E5', 'G5', 'B5', 'D6'][i] }]),
  [B(5.85), 'éclat', 'impact'], [B(5.9), 'logo', 'bell', { pitch: 'D6' }],
  [B(6.9), 'écrans', 'whoosh', { len: 0.4, from: 500, to: 2600 }],
  [B(8.3), 'gratuit', 'impact'],
  [B(9.2), '24 h', 'whoosh', { len: 0.5, from: 400, to: 2600 }],
  [B(11.2), 'grille', 'pop', { pitch: 'A5' }], [B(12.4), '100', 'impact'],
  [B(12.7), 'jouez le jeu', 'impact'],
  [B(13.6), 'logo fin', 'bell', { pitch: 'D6' }],
];

M.film({
  fonts: [font(100, 900, D), font(100, 700, D), font(40, 800, UI), font(40, 700, UI)],
  images: {
    u11: 'assets/photos/u11.jpg', u12: 'assets/photos/u12.jpg', u13: 'assets/photos/u13.jpg', u14: 'assets/photos/u14.jpg', u15: 'assets/photos/u15.jpg',
    ...Object.fromEntries(['runMix', 'beachMix', 'girlsOut', 'networkingGirl', 'padelMix', 'brunchGirl'].map((k) => ['p_' + k, `assets/places/${k}.jpg`])),
    ...Object.fromEntries(FACES.map((n, i) => ['face' + i, `assets/faces/${n}.jpg`])),
    H0: 'assets/real/home_00.png', H1: 'assets/real/home_01.png', H2: 'assets/real/home_02.png', H3: 'assets/real/home_03.png',
    S0: 'assets/real/social_00.png', S1: 'assets/real/social_01.png', CR: 'assets/real/create.png', msg: 'assets/real/messages.png',
    G0: 'assets/real/girl_00.png', G1: 'assets/real/girl_01.png', N0: 'assets/real/network_00.png', N1: 'assets/real/network_01.png',
    logo: 'assets/irly_wordmark_ivory.png',
  },
  hits: FILM === '15' ? HITS15 : HITS75,
  samples: 4,
  init(ctx, IMG) { IMGS = IMG; },
  draw(ctx, u, t, IMG) {
    if (FILM === '15') { f15(ctx, t, IMG); subtitles(ctx, t, SUBS15); return; }
    if (t < 8.1) s1Problem(ctx, t, IMG);
    else if (t < 13.7) s2Daily(ctx, t, IMG);
    else if (t < 22.3) s3Paywall(ctx, t, IMG);
    else if (t < 31.6) s4Reveal(ctx, t, IMG);
    else if (t < 40.6) s5Demo(ctx, t, IMG);
    else if (t < 50.5) s6Hundred(ctx, t, IMG);
    else if (t < 60.8) s7Cta(ctx, t, IMG);
    else s8End(ctx, t, IMG);
    subtitles(ctx, t, SUBS75);
  },
  post(ctx, u, t) {
    ctx.save(); ctx.globalAlpha = 0.035;
    for (let i = 0; i < 200; i++) { const x = hash01(i + Math.floor(u * 96) * 997, 3) * W, y = hash01(i + Math.floor(u * 96) * 991, 7) * H; ctx.fillStyle = i % 2 ? '#fff' : '#000'; ctx.fillRect(x, y, 3, 3); }
    ctx.restore();
  },
});
