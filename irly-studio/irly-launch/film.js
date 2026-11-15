// IRLY — vidéo officielle de lancement (44 s, 9:16, rendu natif 2160x3840 avec DSF=2).
// Deux versions avec le même code : irly-launch (français) et irly-launch-en (anglais).
// Temps en secondes, calés sur la transcription horodatée de chaque voix (table T plus bas).
// Écrans : captures réelles de la version démo de l'app (contenus d'exemple).
// Ce qui n'existe pas dans l'app (compteur des 100 inscrits, invitation) est une animation étiquetée « illustration ».
// Aucune interface de l'App Store n'est reproduite ; aucun logo Apple n'est dessiné.
import * as M from './lib/motion.js';
import { SUBS_FR, SUBS_EN } from './subs.js';

const { W, H, E, TAU, prog, lerp, clamp, springU, SPRING, font, layout, text, fill, cover, rrect, bump, hash01 } = M;
const EN = location.pathname.includes('irly-launch-en');
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


// ---------------------------------------------------------------- textes et minutage par langue
const TXT = EN ? {
  hook: ['LIVING IN DUBAI?', 'WANT TO MEET', 'NEW PEOPLE?'],
  live: 'IRLY IS OUT!', liveSub: 'AVAILABLE NOW ON THE APP STORE', badge: 'Available on the App Store',
  steps: ['OPEN THE APP STORE', 'SEARCH “IRLY”', 'DOWNLOAD IT · FREE', 'CREATE YOUR ACCOUNT'], step: 'STEP',
  stepsTag: 'STEPS ILLUSTRATED · NOT THE APP STORE', realTag: 'REAL APP SCREENS · DEMO CONTENT', free: 'Free',
  open: ['WE OPEN THE COMMUNITY', 'AT 100 MEMBERS!'], conceptTag: 'CONCEPT ANIMATION · NOT THE LIVE MEMBER COUNT', unlock: 'Community opens at 100',
  invite: 'INVITE YOUR FRIENDS!', more: ['THE MORE OF US,', 'THE MORE PEOPLE TO MEET.'], inviteBtn: 'Invite my friends', bubble: 'Get IRLY 👉 App Store', illus: 'ILLUSTRATION',
  feats: ['Sports', 'Nights out', 'Activities', 'Networking'], three: ['ACTIVITIES.', 'NEW PEOPLE.', 'REAL FRIENDS.'], notDating: 'Not a dating app',
  cta: ['IRLY IS OUT.', 'DOWNLOAD IT NOW.', 'JOIN THE FIRST 100.'], free100: '100% FREE. FOREVER.', motto: 'Dubai is better together.', tagline: 'MAKE FRIENDS IRL',
} : {
  hook: ['TU VIS À DUBAÏ ?', 'ET TU VEUX RENCONTRER', 'DU MONDE ?'],
  live: 'IRLY EST DISPONIBLE !', liveSub: 'DÈS MAINTENANT SUR L’APP STORE', badge: 'Disponible sur l’App Store',
  steps: ['OUVRE L’APP STORE', 'RECHERCHE « IRLY »', 'TÉLÉCHARGE · GRATUIT', 'CRÉE TON COMPTE'], step: 'ÉTAPE',
  stepsTag: 'ÉTAPES ILLUSTRÉES · PAS L’APP STORE', realTag: 'ÉCRANS RÉELS DE L’APP · CONTENUS DE DÉMO', free: 'Gratuit',
  open: ['ON OUVRE LA COMMUNAUTÉ', 'À 100 INSCRITS !'], conceptTag: 'ANIMATION CONCEPTUELLE · PAS LE NOMBRE RÉEL D’INSCRITS', unlock: 'Ouverture à 100 inscrits',
  invite: 'INVITE TES AMIS !', more: ['PLUS ON EST,', 'PLUS ON FAIT DE RENCONTRES.'], inviteBtn: 'Inviter mes amis', bubble: 'Télécharge IRLY 👉 App Store', illus: 'ILLUSTRATION',
  feats: ['Sport', 'Sorties', 'Activités', 'Networking'], three: ['DES ACTIVITÉS.', 'DES RENCONTRES.', 'DE VRAIS AMIS.'], notDating: 'Pas une appli de rencontres amoureuses',
  cta: ['IRLY EST DISPONIBLE.', 'TÉLÉCHARGE-LA MAINTENANT.', 'REJOINS LES 100 PREMIERS.'], free100: '100 % GRATUIT. POUR TOUJOURS.', motto: 'Dubaï est plus belle à plusieurs.', tagline: 'MAKE FRIENDS IRL',
};
// Début de chaque phrase de la voix (s), voix posée à 0,6 s.
const T = EN ? { hook: 0.68, s2: 6.0, irly: 6.92, store: 9.24, s3: 10.16, open: 11.16, search: 12.4, download: 13.56, account: 14.84, s4: 16.28, hundred: 20.56, s5: 21.6, share: 22.72, friends: 23.8, colleagues: 24.12, people: 25.12, s6: 26.84, f2: 27.56, f3: 28.6, f4: 29.36, irl: 30.28, s7: 33.56, join: 34.76, shareCta: 36.16, motto: 37.2, end: 38.92 }
  : { hook: 0.68, s2: 5.0, irly: 6.2, store: 8.12, s3: 9.16, open: 9.93, search: 11.0, download: 12.24, account: 14.2, s4: 15.52, hundred: 19.8, s5: 20.84, share: 22.12, friends: 23.08, colleagues: 23.56, people: 24.36, s6: 26.48, f2: 27.0, f3: 27.68, f4: 28.6, irl: 29.68, s7: 33.16, join: 34.68, shareCta: 36.08, motto: 37.44, end: 39.4 };
let IMGS = {};
const R = (k) => IMGS[k];

// ---------------------------------------------------------------- petits éléments
function bigLine(ctx, str, y, size, color, t, t0, o = {}) { words(ctx, str, W / 2, y, size, color, t, t0, { family: D, weight: 900, step: 0.08, maxW: 960, ...o }); }
function lightSweep(ctx, t, t0, dur = 0.7) { // bande de lumière diagonale qui balaie l'écran
  const p = prog(t, t0, t0 + dur); if (p <= 0 || p >= 1) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(lerp(-W, W * 2, E.inOutCubic(p)), 0); ctx.rotate(0.35);
  const g = ctx.createLinearGradient(-260, 0, 260, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(220,232,255,${0.65 * Math.sin(p * Math.PI)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(-260, -H, 520, H * 3); ctx.restore();
}
function reflection(ctx, x, y, w, h, t) { // reflet discret qui glisse sur la vitre du téléphone
  const p = (t * 0.25) % 1; ctx.save(); rrect(ctx, x - w / 2, y - h / 2, w, h, w * 0.13); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
  const xx = x - w + p * w * 3; const g = ctx.createLinearGradient(xx - 120, 0, xx + 120, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.07)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x - w / 2, y - h / 2, w, h); ctx.restore();
}
function badge(ctx, cx, cy, k, a = 1) { // mention textuelle (pas de logo Apple : le badge officiel se télécharge chez Apple)
  if (k <= 0 || a <= 0) return;
  const f1 = font(26, 700, UI), f2 = font(50, 800, UI), s = TXT.badge.split(' ');
  const top = EN ? 'Available on the' : 'Disponible sur l’', bottom = 'App Store';
  const w = Math.max(layout(ctx, top, f1).width, layout(ctx, bottom, f2).width) + 90, h = 130;
  ctx.save(); ctx.globalAlpha = a * clamp(k * 1.5); ctx.translate(cx, cy); ctx.scale(k, k);
  rrect(ctx, -w / 2, -h / 2, w, h, 26); ctx.fillStyle = '#000'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
  text(ctx, top, 0, -10, f1, '#fff', 'center'); text(ctx, bottom, 0, 42, f2, '#fff', 'center'); ctx.restore();
}
function appIcon(ctx, IMG, cx, cy, s, k = 1, a = 1) {
  if (!IMG.icon || k <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(k, k); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
  rrect(ctx, -s / 2, -s / 2, s, s, s * 0.225); ctx.fillStyle = '#000'; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.clip();
  ctx.drawImage(IMG.icon, -s / 2, -s / 2, s, s); ctx.restore();
}
function stepHeader(ctx, t, i, t0, t1) {
  const a = prog(t, t0, t0 + 0.15) * (1 - prog(t, t1 - 0.12, t1)); if (a <= 0) return;
  // pastilles de progression
  for (let j = 0; j < 4; j++) { const on = j <= i; ctx.save(); ctx.globalAlpha = a; rrect(ctx, W / 2 - 230 + j * 120, 210, 100, 12, 6); ctx.fillStyle = on ? '#fff' : 'rgba(255,255,255,0.22)'; ctx.fill(); ctx.restore(); }
  ctx.save(); ctx.globalAlpha = a; text(ctx, `${TXT.step} ${i + 1}`, W / 2, 300, font(36, 800, UI), C.steelL, 'center', 6); ctx.restore();
  bigLine(ctx, TXT.steps[i], 400, 84, '#fff', t, t0 + 0.02, { out: t1 - 0.25 });
}

// ---------------------------------------------------------------- S1 accroche
function s1(ctx, t, IMG) {
  const cut = 2.45;
  if (t < cut) bgPhoto(ctx, IMG.dubaiNight, { zoom: 1.25 - 0.15 * E.outCubic(prog(t, 0, cut)), fy: 0.45, dark: 0.25 });
  else {
    bgPhoto(ctx, IMG.u11, { blur: 30, dark: 0.55, zoom: 1.2 });
    photoCard(ctx, IMG.u11, W / 2 - 170, 1010, 560, 820, { rot: -0.08, k: sp(t, cut, SPRING.gentle), fy: 0.4, zoom: 1.1 - 0.05 * prog(t, cut, T.s2) });
    if (IMG.u15) photoCard(ctx, IMG.u15, W / 2 + 190, 1080, 520, 640, { rot: 0.07, k: sp(t, cut + 0.9, SPRING.bouncy), crop: [0, IMG.u15.height * 0.46, IMG.u15.width * 0.62, IMG.u15.height * 0.54] });
  }
  bokeh(ctx, t, 16, 0.3, 2);
  // fondu de coupe (flash bref)
  const fl = bump(t, cut, 0.12); if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${0.5 * fl})`; ctx.fillRect(0, 0, W, H); }
  shade(ctx, 0.8, 0.45);
  bigLine(ctx, TXT.hook[0], 360, 110, '#fff', t, T.hook, { out: cut - 0.2 });
  bigLine(ctx, TXT.hook[1], 330, 82, '#fff', t, cut + 0.1, { out: T.s2 - 0.2 });
  bigLine(ctx, TXT.hook[2], 440, 104, C.green, t, cut + 0.6, { out: T.s2 - 0.2 });
  vignette(ctx, 0.5);
  lightSweep(ctx, t, T.s2 - 0.35, 0.7);
}
// ---------------------------------------------------------------- S2 annonce
function s2(ctx, t, IMG) {
  fill(ctx, C.bg); bokeh(ctx, t, 20, 0.35, 5, '#BFD4FF');
  glow(ctx, W / 2, 1150, 800, C.steel, 0.35 * prog(t, T.s2, T.s2 + 0.6));
  const k = sp(t, T.s2, SPRING.gentle), rot = lerp(1.0, 0, E.outCubic(prog(t, T.s2, T.s2 + 1.4))) + 0.06 * Math.sin(t * 0.9);
  const cy = lerp(H + 600, 1300, k), pw = 520;
  phone(ctx, W / 2, cy, pw, (s) => { navTo(s, IMG.intro, IMG.H0, prog(t, T.store, T.store + 0.4), 'fade'); }, { rotY: rot, tilt: -0.03, glowA: 0.4 });
  reflection(ctx, W / 2, cy, pw, pw * SH / SW, t);
  logo(ctx, IMG, W / 2, 330, 420, sp(t, T.irly - 0.25, SPRING.bouncy));
  bigLine(ctx, TXT.live, 500, 92, '#fff', t, T.irly, { out: T.s3 - 0.2 });
  words(ctx, TXT.liveSub, W / 2, 580, 44, C.steelL, t, T.store, { weight: 800, track: 0.06, out: T.s3 - 0.2 });
  badge(ctx, W / 2, 690, sp(t, T.store + 0.15, SPRING.bouncy), 1 - prog(t, T.s3 - 0.25, T.s3));
  lightSweep(ctx, t, T.s2 - 0.35, 0.7);
  vignette(ctx, 0.45);
}
function logo(ctx, IMG, cx, cy, w, k, a = 1) {
  if (!IMG.logo || k <= 0 || a <= 0) return;
  const h = w * IMG.logo.height / IMG.logo.width;
  ctx.save(); ctx.globalAlpha = a * clamp(k * 1.5); ctx.translate(cx, cy); ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
  ctx.shadowColor = 'rgba(201,214,228,0.55)'; ctx.shadowBlur = 50; ctx.drawImage(IMG.logo, -w / 2, -h / 2, w, h); ctx.restore();
}
// ---------------------------------------------------------------- S3 tutoriel
function s3(ctx, t, IMG) {
  fill(ctx, C.bg); bokeh(ctx, t, 14, 0.25, 8, '#BFD4FF');
  const st = [T.s3, T.search, T.download, T.account, T.s4];
  let i = 0; for (let j = 0; j < 4; j++) if (t >= st[j]) i = j;
  stepHeader(ctx, t, i, st[i], st[i + 1]);
  const cy = 1120;
  if (i === 0) { // ouvre l'App Store : une icône neutre (pas celle d'Apple) qui s'ouvre
    const k = sp(t, T.s3 + 0.1, SPRING.bouncy), z = E.inCubic(prog(t, T.open + 0.2, T.search - 0.05));
    ctx.save(); ctx.globalAlpha = 1 - z * 0.9; ctx.translate(W / 2, cy); ctx.scale(k * (1 + z * 3), k * (1 + z * 3));
    rrect(ctx, -150, -150, 300, 300, 68); const g = ctx.createLinearGradient(0, -150, 0, 150); g.addColorStop(0, '#2A2D35'); g.addColorStop(1, '#121318'); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -80); ctx.lineTo(0, 50); ctx.moveTo(-55, 0); ctx.lineTo(0, 55); ctx.lineTo(55, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-80, 95); ctx.lineTo(80, 95); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.globalAlpha = k * (1 - z); text(ctx, 'App Store', W / 2, cy + 230, font(44, 800, UI), '#fff', 'center'); ctx.restore();
  } else if (i === 1) { // recherche « IRLY » : un champ qui se tape
    const k = sp(t, T.search, SPRING.snappy), n = Math.floor(clamp((t - T.search - 0.15) / 0.5) * 4);
    ctx.save(); ctx.translate(W / 2, cy - 120); ctx.scale(k, k);
    rrect(ctx, -400, -70, 800, 140, 70); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(-320, -8, 26, 0, TAU); ctx.moveTo(-301, 11); ctx.lineTo(-280, 32); ctx.stroke();
    text(ctx, 'IRLY'.slice(0, n), -240, 22, font(64, 800, UI), '#fff', 'left');
    if (Math.floor(t * 3) % 2 === 0) { const cw = layout(ctx, 'IRLY'.slice(0, n), font(64, 800, UI)).width; ctx.fillStyle = C.blue; ctx.fillRect(-236 + cw, -30, 5, 66); }
    ctx.restore();
    const rk = sp(t, T.search + 0.8, SPRING.bouncy);
    if (rk > 0) { appIcon(ctx, IMG, W / 2 - 230, cy + 160, 190, rk); ctx.save(); ctx.globalAlpha = clamp(rk); text(ctx, 'IRLY', W / 2 - 100, cy + 140, font(56, 900, UI), '#fff', 'left'); text(ctx, 'Make Friends IRL', W / 2 - 100, cy + 200, font(38, 700, UI), C.mute, 'left'); ctx.restore(); }
  } else if (i === 2) { // télécharge : l'icône réelle d'IRLY, anneau de progression
    const k = sp(t, T.download, SPRING.bouncy), p = E.inOutCubic(prog(t, T.download + 0.3, T.account - 0.2));
    appIcon(ctx, IMG, W / 2, cy - 60, 360, k);
    ctx.save(); ctx.translate(W / 2, cy + 230); ctx.globalAlpha = clamp(k);
    if (p < 1) { ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(0, 0, 50, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 50, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke(); }
    else { const ck = sp(t, T.account - 0.2, SPRING.bouncy); ctx.scale(ck, ck); ctx.beginPath(); ctx.arc(0, 0, 56, 0, TAU); ctx.fillStyle = C.green; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-22, 2); ctx.lineTo(-6, 18); ctx.lineTo(24, -16); ctx.stroke(); }
    ctx.restore();
    pill(ctx, TXT.free, W / 2, cy - 330, 40, C.ink, '#fff', { a: clamp(k), weight: 900 });
  } else { // crée ton compte : l'onboarding réel de l'app
    const k = sp(t, T.account, SPRING.gentle), seq = ['ob_you', 'ob_interests', 'ob_looking', 'ob_ready'];
    const span = (T.s4 - T.account) / 4, j = Math.min(3, Math.floor((t - T.account) / span));
    phone(ctx, W / 2, lerp(H + 500, 1180, k), 470, (s) => {
      navTo(s, IMG[seq[Math.max(0, j - 1)]], IMG[seq[j]], j === 0 ? 1 : prog(t, T.account + j * span, T.account + j * span + 0.3), 'push');
      tap(s, t, T.account + (j + 1) * span - 0.12, 585, 2440);
    }, { tilt: 0.02 * Math.sin(t), rotY: 0.08 * Math.sin(t * 0.8) });
  }
  tag(ctx, i < 3 ? TXT.stepsTag : TXT.realTag, 0.9, 1660);
  vignette(ctx, 0.45);
}
// ---------------------------------------------------------------- S4 les 100 premiers (animation conceptuelle)
function s4(ctx, t, IMG) {
  fill(ctx, C.bg); bokeh(ctx, t, 16, 0.25, 7, '#BFD4FF');
  const t0 = T.s4, size = 760, cell = size / 10, x0 = W / 2 - size / 2, y0 = 700;
  const fillP = E.inOutCubic(prog(t, t0 + 0.6, T.hundred + 0.2)), n = Math.round(100 * fillP);
  for (let c = 0; c < 100; c++) {
    const x = x0 + (c % 10 + 0.5) * cell, y = y0 + (Math.floor(c / 10) + 0.5) * cell;
    const ap = sp(t, t0 + (c % 10 + Math.floor(c / 10)) * 0.012, SPRING.snappy); if (ap <= 0) continue;
    const on = hash01(c, 31) < fillP; // les points s'allument dans le désordre : pas des personnes, juste des places
    ctx.save(); ctx.translate(x, y);
    if (on) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, cell * 0.5); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(201,214,228,0.9)'); g.addColorStop(1, 'rgba(142,165,191,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, cell * 0.5, 0, TAU); ctx.fill(); }
    else { ctx.globalAlpha = 0.5 * ap; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(0, 0, cell * 0.22 * ap, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  // barre de progression et cadenas qui s'ouvre à 100
  const by = y0 + size + 90, bw = 820;
  rrect(ctx, W / 2 - bw / 2, by, bw, 36, 18); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
  if (fillP > 0) { rrect(ctx, W / 2 - bw / 2, by, bw * fillP, 36, 18); ctx.fillStyle = n >= 100 ? C.green : '#fff'; ctx.fill(); }
  const done = sp(t, T.hundred + 0.2, SPRING.bouncy);
  ctx.save(); ctx.translate(W / 2 + bw / 2 + 0, by + 18); lockIcon(ctx, 0, 0, 60, n >= 100 ? C.green : '#fff', n >= 100 ? done : 0); ctx.restore();
  text(ctx, TXT.unlock, W / 2, by + 110, font(40, 800, UI), n >= 100 ? C.green : '#fff', 'center');
  bigLine(ctx, TXT.open[0], 330, 74, '#fff', t, t0 + 0.05, { out: T.s5 - 0.2 });
  bigLine(ctx, TXT.open[1], 430, 96, C.green, t, T.hundred - 0.6, { out: T.s5 - 0.2 });
  tag(ctx, TXT.conceptTag, 0.9, 190);
  vignette(ctx, 0.45);
}
// ---------------------------------------------------------------- S5 partage (illustration)
function s5(ctx, t, IMG) {
  fill(ctx, C.bg); glow(ctx, W / 2, 1100, 900, C.green, 0.12);
  // réseau qui se propage depuis le téléphone : des points abstraits, pas des inscriptions
  const cx = W / 2, cy = 1150, prop = prog(t, T.share, T.s6);
  ctx.save();
  for (let i = 0; i < 46; i++) {
    const ring = 1 + Math.floor(hash01(i, 3) * 3), a = hash01(i, 4) * TAU, r = 260 + ring * 170 + hash01(i, 5) * 60;
    const t0 = T.share + (ring - 1) * 0.9 + hash01(i, 6) * 0.6, k = sp(t, t0, SPRING.bouncy); if (k <= 0) continue;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.9;
    const px = cx + Math.cos(a) * (r - 170), py = cy + Math.sin(a) * (r - 170) * 0.9;
    ctx.globalAlpha = 0.35 * clamp(k); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ring === 1 ? cx : px, ring === 1 ? cy : py); ctx.lineTo(x, y); ctx.stroke();
    ctx.globalAlpha = clamp(k); ctx.fillStyle = i % 3 ? '#fff' : C.green; ctx.beginPath(); ctx.arc(x, y, 9 * k, 0, TAU); ctx.fill();
  }
  ctx.restore();
  const k = sp(t, T.s5, SPRING.gentle);
  phone(ctx, cx, lerp(H + 500, cy, k), 420, (s) => shot(s, IMG.H0), { tilt: -0.03, rotY: 0.1 * Math.sin(t) });
  // le bouton d'invitation (illustration, posé au-dessus du téléphone)
  const bk = sp(t, T.share - 0.1, SPRING.bouncy), press = bump(t, T.share + 0.55, 0.15);
  if (bk > 0) { ctx.save(); ctx.translate(cx, cy + 150); ctx.scale(bk * (1 - 0.07 * press), bk * (1 - 0.07 * press)); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 40; rrect(ctx, -300, -70, 600, 140, 70); ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowColor = 'transparent';
    // icône de partage
    ctx.strokeStyle = C.ink; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-215, -22); ctx.lineTo(-215, 22); ctx.moveTo(-232, -8); ctx.lineTo(-215, -26); ctx.lineTo(-198, -8); ctx.stroke(); rrect(ctx, -240, -2, 50, 40, 8); ctx.stroke();
    text(ctx, TXT.inviteBtn, 30, 16, font(46, 900, UI), C.ink, 'center'); ctx.restore(); }
  // bulles de message (couleurs génériques, sans logo) qui partent vers les contacts
  const targets = [[-330, -420, C.green, T.friends], [330, -330, C.blue, T.friends + 0.3], [-360, 330, C.blue, T.colleagues], [360, 420, C.green, T.colleagues + 0.3], [0, -560, C.green, T.people], [0, 640, C.blue, T.people + 0.3]];
  targets.forEach(([dx, dy, col, t0]) => {
    const p = E.outCubic(prog(t, t0, t0 + 0.6)); if (p <= 0) return;
    const x = cx + dx * p, y = cy + 150 + (dy - 150) * p - Math.sin(p * Math.PI) * 60;
    ctx.save(); ctx.globalAlpha = clamp(p * 3); ctx.translate(x, y); ctx.scale(0.6 + 0.4 * p, 0.6 + 0.4 * p);
    const f = font(30, 800, UI), w = layout(ctx, TXT.bubble, f).width + 50;
    rrect(ctx, -w / 2, -38, w, 76, 34); ctx.fillStyle = col; ctx.fill(); text(ctx, TXT.bubble, 0, 11, f, '#fff', 'center'); ctx.restore();
  });
  shade(ctx, 0.85, 0.3);
  bigLine(ctx, TXT.invite, 360, 104, '#fff', t, T.s5 + 0.05, { out: T.colleagues - 0.1 });
  bigLine(ctx, TXT.more[0], 330, 80, '#fff', t, T.colleagues, { out: T.s6 - 0.2 });
  bigLine(ctx, TXT.more[1], 430, 70, C.green, t, T.colleagues + 0.4, { out: T.s6 - 0.2 });
  tag(ctx, TXT.illus, 0.9, 1660);
  vignette(ctx, 0.45);
}
// ---------------------------------------------------------------- S6 ce qui t'attend
function s6(ctx, t, IMG) {
  const cuts = [[T.s6, 'p_runMix', 'running', TXT.feats[0]], [T.f2, 'p_beachClubGirl', 'discover', TXT.feats[1]], [T.f3, 'p_padelMix', 'padel', TXT.feats[2]], [T.f4, 'p_networkingGirl', 'network', TXT.feats[3]], [T.irl, 'p_girlsOut', 'social', null]];
  let i = 0; cuts.forEach((c, j) => { if (t >= c[0]) i = j; });
  const [t0, ph, scr, label] = cuts[i];
  const local = t - t0;
  bgPhoto(ctx, IMG[ph], { zoom: 1.18 - 0.06 * clamp(local / 1.2), fx: 0.5 + 0.03 * Math.sin(t), dark: i === 4 ? 0.55 : 0.3 });
  const fl = bump(t, t0, 0.08); if (fl > 0 && i > 0) { ctx.fillStyle = `rgba(255,255,255,${0.35 * fl})`; ctx.fillRect(0, 0, W, H); }
  const pk = sp(t, t0, SPRING.snappy);
  const px = i === 4 ? W / 2 : W / 2 + 190, py = i === 4 ? 1180 : 1150, pw = i === 4 ? 460 : 400;
  phone(ctx, px, py + (1 - pk) * 120, pw, (s) => { if (scr === 'discover' || scr === 'social') scrollPair(s, IMG[scr + '0'], IMG[scr + '1'], E.inOutCubic(prog(t, t0 + 0.2, t0 + 1.4))); else shot(s, IMG[scr]); }, { tilt: i === 4 ? 0 : 0.06, rotY: -0.18 * (1 - pk) + 0.05 * Math.sin(t) });
  shade(ctx, 0.75, 0.5);
  if (label) { const lk = sp(t, t0 + 0.02, SPRING.bouncy); let f = font(130, 900, D); const lw = layout(ctx, label.toUpperCase(), f).width; if (lw > 900) f = font(130 * 900 / lw, 900, D);
    ctx.save(); ctx.translate(W / 2, 480); ctx.rotate(-0.04); ctx.scale(lk, lk); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 30; text(ctx, label.toUpperCase(), 0, 0, f, '#fff', 'center'); ctx.restore(); }
  if (i === 4) {
    TXT.three.forEach((s, j) => bigLine(ctx, s, 340 + j * 110, 92, j === 2 ? C.green : '#fff', t, T.irl + 0.05 + j * 0.55, { out: T.s7 - 0.15 }));
    const nk = sp(t, T.irl + 1.8, SPRING.bouncy); if (nk > 0) { ctx.save(); ctx.translate(W / 2, 1700); ctx.scale(nk, nk); pill(ctx, TXT.notDating, 0, 0, 34, C.ink, '#fff', { weight: 900, a: 1 - prog(t, T.s7 - 0.2, T.s7) }); ctx.restore(); }
  }
  tag(ctx, TXT.realTag, 0.85, 190);
  vignette(ctx, 0.45);
}
// ---------------------------------------------------------------- S7 appel à l'action
function s7(ctx, t, IMG) {
  fill(ctx, C.bg); bokeh(ctx, t, 22, 0.38, 9, '#BFD4FF');
  glow(ctx, W / 2, 560, 700, C.steel, 0.3);
  const fin = sp(t, T.end + 0.3, SPRING.gentle);
  // anneau de lumière autour du logo
  ctx.save(); ctx.translate(W / 2, lerp(520, 820, fin)); ctx.rotate(t * 0.3); for (let i = 0; i < 60; i++) { const a = i / 60 * TAU; ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 2 + i); ctx.fillStyle = i % 5 ? '#fff' : C.green; ctx.beginPath(); ctx.arc(Math.cos(a) * 330, Math.sin(a) * 330, 4, 0, TAU); ctx.fill(); } ctx.restore();
  logo(ctx, IMG, W / 2, lerp(520, 820, fin), lerp(470, 640, fin), sp(t, T.s7, SPRING.bouncy));
  const out = T.end + 0.2;
  bigLine(ctx, TXT.cta[0], 920, 78, '#fff', t, T.s7 + 0.05, { out });
  bigLine(ctx, TXT.cta[1], 1020, 78, '#fff', t, T.s7 + 0.7, { out });
  bigLine(ctx, TXT.cta[2], 1120, 78, C.green, t, T.join, { out });
  badge(ctx, W / 2, 1220, sp(t, T.shareCta, SPRING.bouncy), 1 - prog(t, out, out + 0.3));
  const fk = sp(t, T.shareCta + 0.35, SPRING.bouncy); if (fk > 0) { ctx.save(); ctx.translate(W / 2, 1335); ctx.scale(fk, fk); pill(ctx, TXT.free100, 0, 0, 42, '#fff', C.green, { weight: 900, a: 1 - prog(t, out, out + 0.3) }); ctx.restore(); }
  // final : logo + signature
  if (t >= T.end) {
    words(ctx, TXT.tagline, W / 2, 1040, 50, C.steelL, t, T.end + 0.5, { weight: 800, track: 0.18 });
    words(ctx, TXT.motto, W / 2, 1160, 56, '#fff', t, T.end + 0.8, { weight: 800 });
    badge(ctx, W / 2, 1370, sp(t, T.end + 1.1, SPRING.bouncy));
    const fk2 = sp(t, T.end + 1.3, SPRING.bouncy); if (fk2 > 0) { ctx.save(); ctx.translate(W / 2, 1530); ctx.scale(fk2, fk2); pill(ctx, TXT.free100, 0, 0, 40, '#fff', C.green, { weight: 900 }); ctx.restore(); }
  }
  vignette(ctx, 0.4);
}

// ---------------------------------------------------------------- sons
const B = (s) => s / 0.625;
const HITS = [
  [B(0.3), 'ville', 'whoosh', { len: 0.8, from: 300, to: 1800, gain: 0.5 }],
  [B(2.45), 'coupe', 'impact'], [B(3.35), 'photo', 'pop', { pitch: 'A5' }],
  [B(T.s2 - 0.05), 'lumière', 'whoosh', { len: 0.7, from: 400, to: 3200 }],
  [B(T.irly - 0.2), 'logo', 'impact'], [B(T.irly - 0.15), 'logo cloche', 'bell', { pitch: 'D6' }],
  [B(T.store + 0.15), 'badge', 'pop', { pitch: 'A5' }],
  [B(T.s3), 'étape 1', 'tick'], [B(T.search), 'étape 2', 'tick'], [B(T.download), 'étape 3', 'tick'], [B(T.account), 'étape 4', 'tick'],
  ...[0, 1, 2, 3].map((i) => [B(T.search + 0.15 + i * 0.125), 'frappe ' + (i + 1), 'click']),
  [B(T.account - 0.2), 'téléchargé', 'bell', { pitch: 'A5' }],
  [B(T.s4), 'grille', 'whoosh', { len: 0.5, from: 600, to: 2600, gain: 0.5 }],
  [B(T.hundred + 0.2), 'ouverture', 'impact'], [B(T.hundred + 0.25), 'ouverture cloche', 'bell', { pitch: 'D6' }],
  [B(T.s5), 'téléphone', 'whoosh', { len: 0.5, from: 400, to: 2600 }],
  [B(T.share + 0.55), 'inviter', 'click'],
  [B(T.friends), 'bulle 1', 'blip', { pitch: 'A5' }], [B(T.friends + 0.3), 'bulle 2', 'blip', { pitch: 'C#6' }], [B(T.colleagues), 'bulle 3', 'blip', { pitch: 'E6' }], [B(T.colleagues + 0.3), 'bulle 4', 'blip', { pitch: 'A5' }], [B(T.people), 'bulle 5', 'blip', { pitch: 'C#6' }], [B(T.people + 0.3), 'bulle 6', 'blip', { pitch: 'E6' }],
  [B(T.s6), 'sport', 'impact'], [B(T.f2), 'sorties', 'thud'], [B(T.f3), 'activités', 'thud'], [B(T.f4), 'networking', 'thud'], [B(T.irl), 'vrais amis', 'whoosh', { len: 0.5, from: 600, to: 2600 }],
  [B(T.s7), 'logo fin', 'impact'], [B(T.join), '100 premiers', 'pop', { pitch: 'A5' }], [B(T.shareCta), 'badge fin', 'pop', { pitch: 'D6' }],
  [B(T.end + 0.3), 'signature', 'bell', { pitch: 'D6' }],
];

M.film({
  fonts: [font(100, 900, D), font(100, 700, D), font(40, 800, UI), font(40, 700, UI)],
  images: {
    u11: 'assets/photos/u11.jpg', u15: 'assets/photos/u15.jpg',
    dubaiNight: 'assets/places/dubaiNight.webp',
    ...Object.fromEntries(['runMix', 'beachClubGirl', 'padelMix', 'networkingGirl', 'girlsOut'].map((k) => ['p_' + k, `assets/places/${k}.jpg`])),
    ...Object.fromEntries(FACES.map((n, i) => ['face' + i, `assets/faces/${n}.jpg`])),
    ...Object.fromEntries(['intro', 'ob_you', 'ob_interests', 'ob_looking', 'ob_ready', 'padel', 'running', 'messages'].map((k) => [k, `assets/real_${EN ? 'en' : 'fr'}/${k}.png`])),
    H0: `assets/real_${EN ? 'en' : 'fr'}/home_00.png`,
    discover0: `assets/real_${EN ? 'en' : 'fr'}/discover_00.png`, discover1: `assets/real_${EN ? 'en' : 'fr'}/discover_01.png`,
    social0: `assets/real_${EN ? 'en' : 'fr'}/social_00.png`, social1: `assets/real_${EN ? 'en' : 'fr'}/social_01.png`,
    network: `assets/real_${EN ? 'en' : 'fr'}/network_00.png`,
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
    else if (t < T.s7) s6(ctx, t, IMG);
    else s7(ctx, t, IMG);
    subtitles(ctx, t, EN ? SUBS_EN : SUBS_FR);
  },
  post(ctx, u, t) {
    ctx.save(); ctx.globalAlpha = 0.03;
    for (let i = 0; i < 200; i++) { const x = hash01(i + Math.floor(u * 96) * 997, 3) * W, y = hash01(i + Math.floor(u * 96) * 991, 7) * H; ctx.fillStyle = i % 2 ? '#fff' : '#000'; ctx.fillRect(x, y, 3, 3); }
    ctx.restore();
  },
});
