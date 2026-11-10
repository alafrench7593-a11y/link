// IRLY Game · Loup-Garou mode Dubaï (vidéo 3) : 50 s, 9:16. Fonction pure du temps : window.seek(t) peint l'image t.
// Temps en temps musicaux (u) : 96 BPM, 1 u = 0,625 s. Plan : docs/shotlist.md.
// Images : uniquement les écrans réels de l'app (version démo) et ses illustrations officielles.
// La partie (joueurs, chat, vote) est une mise en scène, signalée à l'écran.
import * as M from './lib/motion.js';

const { W, H, E, TAU, prog, lerp, clamp, springU, SPRING, wobble, font, layout, glyph, text, fill, cover, crop, rrect, bump, hash01, noise1, shake, kf, mix } = M;

// Palette du jeu dans l'app (src/features/games/werewolf/dubai/theme.tsx)
const C = { black: '#0B0907', panel: 'rgba(14,10,8,0.84)', gold: '#E2B653', goldL: '#F7DE97', goldD: '#8E6A24', red: '#8E1B22', redL: '#C9343C', night: '#141B33', ivory: '#F6EEDD', muted: '#C9BFA9', blue: '#8FB2FF' };
const D = 'Display', UI = 'UI';
const SAFE = { x: 72, y: 250, r: 930, b: 1490 };

// Joueurs de la mise en scène. Pour utiliser de vraies photos de profil (avec l'accord des personnes),
// déposer assets/players/p1.jpg … p8.jpg : elles remplacent automatiquement les initiales.
const PLAYERS = ['Léa', 'Sami', 'Inès', 'Yanis', 'Maya', 'Karim', 'Nora', 'Toi'];

// ---------------------------------------------------------------- outils
const ease = E.outQuint;
function bgImg(ctx, img, { zoom = 1, fx = 0.5, fy = 0.5, alpha = 1, dark = 0 } = {}) {
  if (!img) return;
  ctx.save(); ctx.globalAlpha = alpha; cover(ctx, img, 0, 0, W, H, { fx, fy, zoom }); ctx.restore();
  if (dark > 0) { ctx.fillStyle = `rgba(5,4,3,${dark * alpha})`; ctx.fillRect(0, 0, W, H); }
}
function vignette(ctx, k = 0.75) {
  const g = ctx.createRadialGradient(W / 2, H * 0.45, W * 0.25, W / 2, H * 0.5, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${k})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function shade(ctx, top, bottom) { // dégradés haut et bas pour la lisibilité des textes
  let g = ctx.createLinearGradient(0, 0, 0, H * 0.42);
  g.addColorStop(0, `rgba(5,4,3,${top})`); g.addColorStop(1, 'rgba(5,4,3,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.42);
  g = ctx.createLinearGradient(0, H * 0.55, 0, H);
  g.addColorStop(0, 'rgba(5,4,3,0)'); g.addColorStop(1, `rgba(5,4,3,${bottom})`); ctx.fillStyle = g; ctx.fillRect(0, H * 0.55, W, H * 0.45);
}
function moon(ctx, x, y, r, a = 1, tint = '#F3EBD6', glow = 0.5) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 3.2);
  g.addColorStop(0, hexA(tint, 0.35 * glow)); g.addColorStop(1, hexA(tint, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, TAU); ctx.fill();
  const b = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  b.addColorStop(0, '#FFFFFF'); b.addColorStop(0.6, tint); b.addColorStop(1, mix(tint, '#7A7468', 0.45));
  ctx.fillStyle = b; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.globalAlpha = a * 0.12; ctx.fillStyle = '#5E584C';
  for (let i = 0; i < 7; i++) { const cx = x + (hash01(i, 2) - 0.5) * r * 1.2, cy = y + (hash01(i, 5) - 0.5) * r * 1.2, cr = r * (0.08 + 0.14 * hash01(i, 9)); ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function hexA(hex, a) { const [r, g, b] = M.hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function fog(ctx, u, a = 0.35, seed = 1, y0 = 0.55) {
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const x = ((hash01(i, seed) * 1.6 - 0.3 + u * 0.012 * (0.5 + hash01(i, seed + 3))) % 1.6) * W;
    const y = H * (y0 + hash01(i, seed + 7) * 0.4);
    const r = W * (0.35 + 0.3 * hash01(i, seed + 11));
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(200,205,215,${a * 0.35})`); g.addColorStop(1, 'rgba(200,205,215,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}
function dust(ctx, u, n = 40, color = C.goldL, a = 0.6, seed = 4) { // poussière d'or qui dérive (comme l'app : GoldDust)
  ctx.save();
  for (let i = 0; i < n; i++) {
    const sp = 0.5 + hash01(i, seed);
    const x = (hash01(i, seed + 1) * W + noise1(u * 0.2 + i, seed) * 40);
    const y = (((hash01(i, seed + 2) - u * 0.02 * sp) % 1) + 1) % 1 * H;
    const tw = 0.5 + 0.5 * Math.sin(u * 2.4 * sp + i);
    ctx.globalAlpha = a * tw * (0.3 + 0.7 * hash01(i, seed + 3));
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 1.5 + 2.5 * hash01(i, seed + 5), 0, TAU); ctx.fill();
  }
  ctx.restore();
}
// Texte centré, mot par mot, chaque mot monte derrière un masque.
function words(ctx, str, cx, y, size, color, u, u0, { weight = 900, family = D, step = 0.18, maxW = 880, lh = 1.08, track = 0.02, out = null, align = 'center', shadow = true } = {}) {
  let f = font(size, weight, family);
  const w0 = layout(ctx, str, f, track * size).width;
  if (w0 > maxW) { size = size * maxW / w0; f = font(size, weight, family); }
  const lines = [str.split(' ')];
  let k = 0;
  const ok = out == null ? 1 : 1 - E.inCubic(prog(u, out, out + 0.5));
  if (ok <= 0) return lines.length;
  lines.forEach((line, li) => {
    const full = line.join(' '), L = layout(ctx, full, f, track * size);
    let x = align === 'center' ? cx - L.width / 2 : cx;
    const by = y + li * size * lh;
    const spaceW = size * 0.28 + track * size;
    for (const w of line) {
      const Lw = layout(ctx, w, f, track * size);
      const p = springU(u, u0 + k * step, SPRING.snappy);
      if (p > 0) {
        ctx.save(); ctx.beginPath(); ctx.rect(x - 20, by - size * 1.05, Lw.width + 40, size * 1.35); ctx.clip();
        ctx.globalAlpha = ok;
        const dy = (1 - p) * size * 1.1 + (1 - ok) * -size * 0.5;
        if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = size * 0.35; }
        text(ctx, w, x, by + dy, f, color, 'left', track * size);
        ctx.restore();
      }
      x += Lw.width + spaceW; k++;
    }
  });
  return lines.length;
}
function pill(ctx, str, cx, cy, size, fg, bg, a = 1, border = null, family = UI, weight = 800) {
  const f = font(size, weight, family); const L = layout(ctx, str, f);
  const w = L.width + size * 1.4, h = size * 2.0;
  ctx.save(); ctx.globalAlpha = a; rrect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
  if (border) { ctx.lineWidth = 3; ctx.strokeStyle = border; ctx.stroke(); }
  text(ctx, str, cx, cy + size * 0.36, f, fg, 'center'); ctx.restore();
}
function stagedTag(ctx, a, label = 'MISE EN SCÈNE PROMOTIONNELLE') {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a * 0.9;
  const f = font(22, 700, UI), L = layout(ctx, label, f, 2);
  rrect(ctx, SAFE.x, SAFE.y - 70, L.width + 36, 40, 20); ctx.fillStyle = 'rgba(11,9,7,0.7)'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = hexA(C.gold, 0.6); ctx.stroke();
  text(ctx, label, SAFE.x + 18, SAFE.y - 42, f, C.goldL, 'left', 2); ctx.restore();
}
// Téléphone : cadre noir arrondi, écran réel de l'app. rotY en radians (rotation sur l'axe vertical).
function phone(ctx, img, cx, cy, w, { rotY = 0, tilt = 0, scroll = 0, alpha = 1, zoom = 1, fx = 0.5, glow = 0 } = {}) {
  const h = w * 2.164, r = w * 0.13;
  const sx = Math.cos(rotY);
  if (Math.abs(sx) < 0.01) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.rotate(tilt); ctx.scale(sx, 1);
  ctx.shadowColor = glow ? hexA(C.gold, 0.55 * glow) : 'rgba(0,0,0,0.7)'; ctx.shadowBlur = glow ? 90 : 70; ctx.shadowOffsetY = glow ? 0 : 30;
  rrect(ctx, -w / 2 - 14, -h / 2 - 14, w + 28, h + 28, r + 14); ctx.fillStyle = '#121212'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 3; ctx.strokeStyle = sx > 0 ? 'rgba(226,182,83,0.55)' : 'rgba(80,80,80,0.6)'; ctx.stroke();
  if (sx > 0 && img) {
    const ih = img.width * (h / w);
    const sy = clamp(scroll) * Math.max(0, img.height - ih);
    ctx.save(); rrect(ctx, -w / 2, -h / 2, w, h, r); ctx.clip();
    const zw = img.width / zoom, zh = ih / zoom;
    ctx.drawImage(img, (img.width - zw) * fx, sy + (ih - zh) * 0.5, zw, zh, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  ctx.restore();
}
// Carte de personnage : illustration officielle dans un cadre doré, retournement 3D (flip 0 = dos, 1 = face).
function card(ctx, img, cx, cy, w, { flip = 1, rot = 0, alpha = 1, glow = 0, label = null, sub = null, subColor = C.redL, lift = 0 } = {}) {
  const h = w * 4 / 3;
  const ang = (1 - clamp(flip)) * Math.PI, sx = Math.cos(ang);
  if (Math.abs(sx) < 0.01 || alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy - lift); ctx.rotate(rot); ctx.scale(Math.abs(sx), 1);
  ctx.shadowColor = glow ? hexA(C.gold, 0.7 * glow) : 'rgba(0,0,0,0.75)'; ctx.shadowBlur = glow ? 60 : 40; ctx.shadowOffsetY = glow ? 0 : 18;
  rrect(ctx, -w / 2, -h / 2, w, h, w * 0.07); ctx.fillStyle = sx > 0 ? '#120D09' : C.red; ctx.fill(); ctx.shadowColor = 'transparent';
  if (sx > 0) {
    if (img) cover(ctx, img, -w / 2 + w * 0.035, -h / 2 + w * 0.035, w * 0.93, h - w * 0.07, { radius: w * 0.05, fy: 0.3 });
    if (label) {
      const g = ctx.createLinearGradient(0, h * 0.1, 0, h / 2); g.addColorStop(0, 'rgba(11,9,7,0)'); g.addColorStop(1, 'rgba(11,9,7,0.95)');
      ctx.fillStyle = g; ctx.fillRect(-w / 2 + w * 0.035, h * 0.1, w * 0.93, h * 0.4 - w * 0.035);
      const ls = Math.min(w * 0.12, (w * 0.86) / Math.max(5, label.length) * 1.55);
      text(ctx, label, 0, h / 2 - (sub ? w * 0.16 : w * 0.08), font(ls, 900, D), C.goldL, 'center', 1);
      if (sub) text(ctx, sub, 0, h / 2 - w * 0.06, font(w * 0.065, 800, UI), subColor, 'center', 1);
    }
  } else {
    // dos de carte
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, h * 0.7); g.addColorStop(0, '#5A1218'); g.addColorStop(1, '#1A0507');
    rrect(ctx, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, w * 0.06); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = hexA(C.gold, 0.8); rrect(ctx, -w / 2 + w * 0.08, -h / 2 + w * 0.08, w * 0.84, h - w * 0.16, w * 0.04); ctx.stroke();
    moon(ctx, 0, -h * 0.05, w * 0.16, 0.9, C.goldL, 0.3);
    text(ctx, 'IRLY', 0, h * 0.28, font(w * 0.11, 900, D), C.gold, 'center', 4);
  }
  ctx.lineWidth = Math.max(2, w * 0.012); ctx.strokeStyle = C.gold; rrect(ctx, -w / 2, -h / 2, w, h, w * 0.07); ctx.stroke();
  ctx.restore();
}
function claw(ctx, u, u0, x0, y0, x1, y1, wmax) { // griffure rouge qui se dessine puis s'efface
  const p = E.outCubic(prog(u, u0, u0 + 0.22)), f = 1 - prog(u, u0 + 1.2, u0 + 2.4);
  if (p <= 0 || f <= 0) return;
  const xe = lerp(x0, x1, p), ye = lerp(y0, y1, p), dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
  ctx.save(); ctx.globalAlpha = f; ctx.shadowColor = 'rgba(201,52,60,0.8)'; ctx.shadowBlur = 30;
  ctx.beginPath(); ctx.moveTo(x0, y0);
  const N = 24;
  for (let i = 0; i <= N; i++) { const t = i / N * p, w = wmax * Math.sin(Math.PI * Math.min(1, t / Math.max(p, 0.01))) ** 0.7; ctx.lineTo(x0 + dx * t + nx * w, y0 + dy * t + ny * w); }
  for (let i = N; i >= 0; i--) { const t = i / N * p, w = wmax * 0.35 * Math.sin(Math.PI * Math.min(1, t / Math.max(p, 0.01))); ctx.lineTo(x0 + dx * t - nx * w, y0 + dy * t - ny * w); }
  ctx.closePath(); const g = ctx.createLinearGradient(x0, y0, xe, ye); g.addColorStop(0, '#5A0A10'); g.addColorStop(1, C.redL); ctx.fillStyle = g; ctx.fill();
  ctx.restore();
}
function avatar(ctx, IMG, i, x, y, r, { a = 1, dead = 0, ring = C.gold, you = false } = {}) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 20;
  ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, TAU); ctx.fillStyle = you ? C.goldL : ring; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
  const img = IMG['p' + (i + 1)];
  if (img) cover(ctx, img, -r, -r, r * 2, r * 2, { fy: 0.35 });
  else {
    const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, ['#3B2A55', '#1F3A5C', '#5A2A2A', '#2A4A3A', '#4A3A20', '#203050', '#4A2040', '#3A3020'][i % 8]); g.addColorStop(1, C.night);
    ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
    text(ctx, PLAYERS[i][0], 0, r * 0.36, font(r * 1.0, 900, D), C.goldL, 'center');
  }
  if (dead > 0) { ctx.fillStyle = `rgba(10,8,8,${0.65 * dead})`; ctx.fillRect(-r, -r, r * 2, r * 2); }
  ctx.restore();
  if (dead > 0) { ctx.globalAlpha = a * dead; ctx.strokeStyle = C.redL; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.6); ctx.lineTo(r * 0.6, r * 0.6); ctx.moveTo(r * 0.6, -r * 0.6); ctx.lineTo(-r * 0.6, r * 0.6); ctx.stroke(); }
  ctx.restore();
}
function bubble(ctx, who, msg, x, y, w, p, right = false) {
  if (p <= 0) return;
  const f = font(34, 700, UI), fn = font(26, 800, UI);
  const h = 108;
  ctx.save(); ctx.globalAlpha = clamp(p * 1.5);
  ctx.translate(x + (right ? w : 0), y + h); ctx.scale(0.85 + 0.15 * p, 0.85 + 0.15 * p); ctx.translate(-(x + (right ? w : 0)), -(y + h));
  ctx.translate(0, (1 - p) * 30);
  rrect(ctx, x, y, w, h, 26); ctx.fillStyle = C.panel; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = hexA(C.gold, 0.5); ctx.stroke();
  text(ctx, who, x + 26, y + 38, fn, C.gold);
  text(ctx, msg, x + 26, y + 84, f, C.ivory);
  ctx.restore();
}

// ================================================================ v2 : l'histoire IRLY (50 s, 80 temps)
// Écrans : captures réelles de la version démo de l'app (assets/app, app2, scroll, games_path).
// La partie (joueurs, nuit, chat, vote) est une mise en scène, étiquetée à l'écran.
const SW = 1170, SH = 2532; // taille des captures (390x844 @3x)
const TAB = { home: [126, 2379], discover: [312, 2379], social: [861, 2379] };
const IRLY = { bg: '#050506', steel: '#8EA5BF', white: '#FFFFFF' };

// Téléphone dont l'écran est dessiné par drawScreen(ctx) en coordonnées de capture (1170x2532).
function phone2(ctx, cx, cy, w, drawScreen, { rotY = 0, tilt = 0, alpha = 1, glow = 0, scale = 1 } = {}) {
  const h = w * SH / SW, r = w * 0.13, sx = Math.cos(rotY);
  if (Math.abs(sx) < 0.01 || alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.rotate(tilt); ctx.scale(sx * scale, scale);
  ctx.shadowColor = glow ? hexA(C.gold, 0.5 * glow) : 'rgba(0,0,0,0.75)'; ctx.shadowBlur = glow ? 90 : 70; ctx.shadowOffsetY = glow ? 0 : 30;
  rrect(ctx, -w / 2 - 14, -h / 2 - 14, w + 28, h + 28, r + 14); ctx.fillStyle = '#111'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.stroke();
  if (sx > 0) {
    ctx.save(); rrect(ctx, -w / 2, -h / 2, w, h, r); ctx.clip();
    ctx.translate(-w / 2, -h / 2); ctx.scale(w / SW, w / SW);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
    drawScreen(ctx);
    ctx.restore();
  }
  ctx.restore();
}
// Une capture plein écran (dans le repère écran).
const shot = (ctx, img, dy = 0, a = 1) => { if (!img || a <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.drawImage(img, 0, dy, SW, SH); ctx.restore(); };
// Défilement réel entre deux captures prises 1260 px plus bas (molette 420 px @3x) : le contenu glisse,
// la barre du haut et la barre d'onglets restent fixes.
function scrollPair(ctx, A, B, p, d = 1260) {
  p = clamp(p);
  const T = 170, Bt = 2200, band = Bt - T;
  const drawBand = (img, off) => { if (img) ctx.drawImage(img, 0, T, SW, band, 0, T + off, SW, band); };
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
  ctx.save(); ctx.beginPath(); ctx.rect(0, T, SW, band); ctx.clip();
  drawBand(A, -d * p);
  ctx.save(); ctx.beginPath(); ctx.rect(0, Bt - d * p, SW, d * p + 1); ctx.clip(); drawBand(B, d * (1 - p)); ctx.restore();
  ctx.restore();
  const C2 = p > 0.5 ? B : A;
  if (C2) { ctx.drawImage(C2, 0, 0, SW, T, 0, 0, SW, T); ctx.drawImage(C2, 0, Bt, SW, SH - Bt, 0, Bt, SW, SH - Bt); }
}
// Changement d'écran : le nouvel écran glisse depuis la droite (navigation) ou monte (feuille).
function navTo(ctx, A, B, p, mode = 'push') {
  p = E.outCubic(clamp(p));
  if (mode === 'push') { shot(ctx, A, 0); ctx.save(); ctx.translate(-SW * 0.3 * p, 0); ctx.restore(); ctx.save(); ctx.translate(SW * (1 - p), 0); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 60; shot(ctx, B); ctx.restore(); }
  else if (mode === 'sheet') { shot(ctx, A); ctx.fillStyle = `rgba(0,0,0,${0.4 * p})`; ctx.fillRect(0, 0, SW, SH); ctx.save(); ctx.translate(0, SH * (1 - p)); shot(ctx, B); ctx.restore(); }
  else { shot(ctx, A); shot(ctx, B, 0, p); }
}
// Toucher : un doigt (cercle) qui appuie puis une onde.
function tap(ctx, u, u0, x, y, s = 1) {
  const a = prog(u, u0 - 0.35, u0 - 0.1) * (1 - prog(u, u0 + 0.35, u0 + 0.6));
  if (a <= 0) return;
  const press = bump(u, u0, 0.18);
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 6 * s;
  ctx.beginPath(); ctx.arc(x, y, (70 - 14 * press) * s, 0, TAU); ctx.fill(); ctx.stroke();
  const rp = prog(u, u0, u0 + 0.5);
  if (rp > 0 && rp < 1) { ctx.globalAlpha = a * (1 - rp); ctx.beginPath(); ctx.arc(x, y, (70 + 160 * rp) * s, 0, TAU); ctx.stroke(); }
  ctx.restore();
}
// Grand texte style TikTok (Manrope), avec contour sombre pour la lisibilité.
function tik(ctx, str, y, size, color, u, u0, { out = null, step = 0.1, maxW = 900 } = {}) {
  return words(ctx, str, W / 2, y, size, color, u, u0, { family: UI, weight: 800, step, out, maxW, track: -0.01 });
}
function blurBg(ctx, img, { blur = 22, dark = 0.5, zoom = 1.2, fx = 0.5 } = {}) {
  if (!img) { fill(ctx, IRLY.bg); return; }
  ctx.save(); ctx.filter = `blur(${blur}px)`; cover(ctx, img, -40, -40, W + 80, H + 80, { zoom, fx }); ctx.restore();
  ctx.fillStyle = `rgba(5,5,6,${dark})`; ctx.fillRect(0, 0, W, H);
}

// ================================================================ v3 : IRLY Game · Loup-Garou mode Dubaï (50 s, 80 temps)
// Voix off « Hugo » (ElevenLabs, FR), une seule prise posée à 0,5 s. Sous-titres synchronisés en bas.
const OFF = 0.5;
const SUBS = [
  [0, 3.06, 'Tu connais ces soirs à Dubaï où t’as juste la flemme de sortir ?'],
  [3.55, 5.65, 'Mais en même temps… t’aimerais bien rencontrer du monde ?'],
  [6.02, 9.47, 'Bah justement, sur IRLY, t’es pas obligé de sortir pour faire des rencontres.'],
  [9.87, 12.53, 'Si t’as pas envie de rejoindre une activité ce soir… regarde ça.'],
  [12.89, 15.79, 'Sur IRLY Game, tu peux jouer au Loup-Garou avec d’autres personnes.'],
  [16.12, 18.41, 'Et on a même créé un mode spécial Dubaï !'],
  [18.69, 22.09, 'Ici, les Loups deviennent des Escrocs… et les Villageois, des Expats.'],
  [22.37, 25.6, 'Entre l’Influenceuse, le CEO, le Millionnaire… ou même le Charo,'],
  [25.6, 28.33, 'fais attention à qui tu fais confiance !'],
  [28.63, 32.09, 'Tu rejoins une partie, tu discutes, tu bluffes, tu votes…'],
  [32.34, 35.95, 'Et franchement, tu peux vite te retrouver à rigoler avec des gens que tu connaissais même pas.'],
  [36.26, 40.87, 'Et qui sait ? Les personnes avec qui tu joues aujourd’hui, ce sera peut-être ton prochain groupe de potes à Dubaï.'],
  [41.34, 43.03, 'IRLY arrive très bientôt à Dubaï.'],
  [43.36, 45.21, 'Alors follow… et patiente encore un peu.'],
  [45.5, 46.2, 'On arrive !'],
];
function subtitles(ctx, t) {
  const s = SUBS.find(([a, b]) => t >= a + OFF && t < b + OFF + 0.15);
  if (!s) return;
  const a = clamp((t - s[0] - OFF) / 0.12) * clamp((s[1] + OFF + 0.15 - t) / 0.12);
  const f = font(36, 800, UI), maxW = 880;
  ctx.font = f;
  const words2 = s[2].split(' '), lines = [''];
  for (const w of words2) { const tr = (lines[lines.length - 1] + ' ' + w).trim(); if (layout(ctx, tr, f).width > maxW && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = tr; }
  const lh = 48, y0 = 1478 - (lines.length - 1) * lh;
  ctx.save(); ctx.globalAlpha = a;
  lines.forEach((ln, i) => {
    const w = layout(ctx, ln, f).width + 36;
    rrect(ctx, W / 2 - w / 2, y0 + i * lh - 37, w, 46, 12); ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fill();
    text(ctx, ln, W / 2, y0 + i * lh, f, '#fff', 'center');
  });
  ctx.restore();
}
const tt = (u) => u * 0.625; // temps -> secondes

// ---------------------------------------------------------------- HITS
const HITS = [
  ...[1, 2, 3, 4, 5, 6, 7].map((b) => [b, 'swipe', 'whoosh', { len: 0.18, from: 2600, to: 900, gain: 0.5 }]),
  [9.2, 'soupir', 'thud', { gain: 0.4 }],
  [10.4, 'irly', 'impact'],
  [14.8, 'onglet social', 'tick'], [19, 'retour accueil', 'tick'],
  [21.6, 'jouer', 'click'], [22.2, 'plongée', 'whoosh', { len: 0.6, from: 400, to: 3200 }],
  [26.4, 'tuile dubaï', 'tick'], [27, 'dubaï', 'impact'],
  [29, 'expats vs escrocs', 'thud'],
  [30.8, 'carte escroc', 'click'], [33.8, 'carte expat', 'click'],
  [36.6, 'influenceuse', 'click'], [38, 'ceo', 'click'], [39.2, 'millionnaire', 'click'], [40.8, 'charo', 'click'],
  [42.2, 'émirati', 'click'], [43.4, 'faux millionnaire', 'click'],
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => [46.8 + i * 0.18, 'joueur ' + (i + 1), 'pop', { pitch: ['D5', 'F5', 'A5', 'C6', 'D6', 'E6', 'F6'][i] }]),
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => [48.3 + i * 0.1, 'carte ' + (i + 1), 'click']),
  [49.4, 'ta carte', 'whoosh', { len: 0.35, from: 800, to: 2400 }],
  [50.6, 'nuit', 'sub', { len: 1.0 }], [51.3, 'pouvoir', 'bell', { pitch: 'A5' }],
  [52.4, 'chat 1', 'blip', { pitch: 'A5' }], [53.1, 'chat 2', 'blip', { pitch: 'C6' }], [53.8, 'chat 3', 'blip', { pitch: 'E6' }], [54.5, 'chat 4', 'blip', { pitch: 'G6' }],
  [55.4, 'vote 1', 'tick'], [55.7, 'vote 2', 'tick'], [56, 'vote 3', 'tick'], [56.3, 'vote 4', 'tick'],
  [56.9, 'éliminé', 'thud'], [58.7, 'victoire', 'bell', { pitch: 'D6' }],
  [61, 'social', 'tick'], [62, 'suivre', 'click'], [63.5, 'activités', 'tick'], [64.4, 'partant', 'click'],
  [67, 'lancement', 'impact'], [67.5, 'logo', 'bell', { pitch: 'D6' }], [70.6, 'follow', 'pop', { pitch: 'A5' }], [73.6, 'on arrive', 'impact'],
];

// ---------------------------------------------------------------- S1 la flemme de sortir (u 0..10.4)
const FEED3 = ['f6', 'f2', 'f4', 'f3', 'f7', 'f1', 'f5', 'f6', 'f2', 'f4'];
function s1(ctx, u, IMG) {
  blurBg(ctx, IMG.f6, { blur: 26, dark: 0.6, zoom: 1.3 });
  const pos = [...Array(7)].reduce((s, _, i) => s + springU(u, i + 1, SPRING.snappy), 0);
  const sink = E.inOutCubic(prog(u, 8.6, 10.2)); // il repose la tête : le téléphone descend et s'éloigne
  const z = (1.0 * (1.1 / 1.0) ** prog(u, 0, 8.6)) * (1 - 0.18 * sink);
  ctx.save(); ctx.translate(W / 2, H / 2 + sink * 260); ctx.rotate(-0.08 * sink); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
  phone2(ctx, W / 2, 1060, 600, (s) => {
    FEED3.forEach((k, i) => { const y = (i - pos) * SH; if (y > SH || y < -SH) return; cover(s, IMG[k], 0, y, SW, SH, { fy: 0.45 }); });
    text(s, '22:41', 90, 95, font(46, 700, UI), '#fff'); text(s, '41 %', SW - 90, 95, font(40, 700, UI), '#fff', 'right');
    if (sink > 0) { s.fillStyle = `rgba(0,0,0,${0.55 * sink})`; s.fillRect(0, 0, SW, SH); }
  }, { tilt: -0.03 });
  ctx.restore();
  shade(ctx, 0.8, 0.25);
  tik(ctx, 'LA FLEMME DE SORTIR', 330, 76, '#fff', u, 0.4, { out: 5.8 });
  tik(ctx, 'À DUBAÏ ? 😭🇦🇪', 420, 76, C.goldL, u, 1.2, { out: 5.8 });
  tik(ctx, 'MAIS ENVIE DE', 330, 76, '#fff', u, 6.1, { out: 10.2 });
  tik(ctx, 'RENCONTRER DU MONDE ? 👀', 420, 70, C.goldL, u, 6.6, { out: 10.2 });
  vignette(ctx, 0.55);
}

// ---------------------------------------------------------------- S2 IRLY (u 10.4..21.4)
function s2screen(s, u, IMG) {
  if (u < 11.3) { s.fillStyle = IRLY.bg; s.fillRect(0, 0, SW, SH); const k = springU(u, 10.4, SPRING.bouncy); const lw = 620 * (0.7 + 0.3 * k), lh = lw * IMG.logoW.height / IMG.logoW.width; s.drawImage(IMG.logoW, SW / 2 - lw / 2, SH / 2 - lh / 2, lw, lh); if (u > 11) shot(s, IMG.H0, 0, prog(u, 11, 11.3)); return; }
  if (u < 12.6) { shot(s, IMG.H0); return; }
  if (u < 14.7) { const p = E.inOutCubic(prog(u, 12.6, 14.4)); if (p < 0.5) scrollPair(s, IMG.H1, IMG.H2, p * 2); else scrollPair(s, IMG.H2, IMG.H3, p * 2 - 1); tap(s, u, 14.8, ...TAB.social); return; }
  if (u < 18.9) { navTo(s, IMG.H3, IMG.s1, prog(u, 14.85, 15.3), 'fade'); tap(s, u, 19, ...TAB.home); return; }
  navTo(s, IMG.s1, IMG.H1, prog(u, 19.05, 19.4), 'fade');
  const ha = prog(u, 19.6, 19.9);
  if (ha > 0) { s.save(); s.globalAlpha = ha; s.lineWidth = 10; s.strokeStyle = C.gold; s.shadowColor = C.gold; s.shadowBlur = 40; rrect(s, 40, 700, 640, 740, 50); s.stroke(); s.restore(); }
}
function s2(ctx, u, IMG) {
  blurBg(ctx, IMG.f6, { blur: 30, dark: 0.55, zoom: 1.25 });
  const k = springU(u, 10.4, SPRING.gentle);
  phone2(ctx, W / 2, 1120, 640, (s) => s2screen(s, u, IMG), { scale: lerp(1.2, 1, k), rotY: 0.06 * Math.sin((u - 10) * 0.4) });
  shade(ctx, 0.8, 0.2);
  tik(ctx, 'PAS ENVIE DE SORTIR ?', 320, 72, '#fff', u, 10.6, { out: 19.2 });
  tik(ctx, 'AUCUN PROBLÈME.', 405, 72, IRLY.steel, u, 11.4, { out: 19.2 });
  tik(ctx, 'DÉCOUVRE IRLY GAME 🎮', 360, 74, C.goldL, u, 19.5);
  vignette(ctx, 0.45);
}

// ---------------------------------------------------------------- S3 IRLY Game -> mode Dubaï (u 21.4..30.7)
function s3(ctx, u, IMG) {
  const dive = E.inCubic(prog(u, 21.9, 23));
  const night = E.inOutCubic(prog(u, 22.4, 23.4));
  blurBg(ctx, IMG.f6, { blur: 30, dark: 0.55, zoom: 1.25 });
  if (night > 0) { bgImg(ctx, IMG.d_bg_night, { zoom: 1.2 * (1.05 / 1.2) ** prog(u, 22.4, 30.7), alpha: night, dark: 0.1 }); moon(ctx, W * 0.66, H * 0.16, 100, E.outCubic(prog(u, 22.8, 23.8)), '#F7E9C8', 0.9); dust(ctx, u, 50, C.goldL, 0.7 * night, 33); }
  const pw = 640, ph = pw * SH / SW, py = 1120;
  if (u < 23) {
    const fx = W / 2 - pw / 2 + pw * (373 / SW), fy = py - ph / 2 + ph * (1313 / SH);
    ctx.save(); ctx.translate(fx, fy); ctx.scale(7 ** dive, 7 ** dive); ctx.translate(-fx, -fy); ctx.globalAlpha = 1 - prog(u, 22.5, 23);
    phone2(ctx, W / 2, py, pw, (s) => { shot(s, IMG.H1); tap(s, u, 21.6, 373, 1313, 1.2); });
    ctx.restore();
  } else if (u < 28) {
    // IRLY Game -> Loup-Garou : le vrai écran des modes ; toucher Dubaï
    const k = E.outCubic(prog(u, 23.6, 24.6));
    ctx.save(); ctx.globalAlpha = k;
    phone2(ctx, W / 2, py, pw, (s) => { if (u < 26.6) shot(s, IMG.modes); else navTo(s, IMG.modes, IMG.m_dubai, prog(u, 26.6, 27), 'fade'); tap(s, u, 26.4, 951, 1485); }, { scale: lerp(1.6, 1, k), glow: 0.5 });
    ctx.restore();
  } else {
    // le titre réel du mode Dubaï en grand, sous la lune
    const k = springU(u, 28, SPRING.bouncy), w = 1000, h = w * 470 / 1170;
    ctx.save(); ctx.globalAlpha = clamp(k * 1.5); ctx.translate(W / 2, 760); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k); ctx.shadowColor = hexA(C.gold, 0.5); ctx.shadowBlur = 60;
    crop(ctx, IMG.m_dubai, [0, 150, 1170, 470], -w / 2, -h / 2, w, h); ctx.restore();
    const DC = ['d_expat', 'd_escroc', 'd_influencer', 'd_ceo', 'd_charo'];
    DC.forEach((key, i) => { const kk = springU(u, 28.3 + i * 0.12, SPRING.snappy); if (kk <= 0) return; const a = (i - 2) * 0.16; card(ctx, IMG[key], W / 2 + (i - 2) * 175, 1230 + Math.abs(i - 2) * 30 + (1 - kk) * 300, 220, { rot: a, alpha: clamp(kk * 2), glow: 0.3 }); });
  }
  shade(ctx, 0.8, 0.25);
  if (u < 27) tik(ctx, 'IRLY GAME 🎮', 330, 80, '#fff', u, 21.5, { out: 26.6 });
  if (u >= 26.7) { words(ctx, 'LOUP-GAROU : MODE DUBAÏ 🇦🇪', W / 2, 320, 60, C.gold, u, 26.8, { family: D, maxW: 940 }); }
  if (u >= 28.8) { ctx.save(); const k = springU(u, 29, SPRING.snappy); ctx.globalAlpha = clamp(k * 1.5); ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 30; text(ctx, 'EXPATS', W / 2 - 34 - (1 - k) * 300, 1010, font(68, 900, D), C.blue, 'right', 2); text(ctx, 'VS', W / 2, 1003, font(38, 900, D), C.goldL, 'center'); text(ctx, 'ESCROCS 🐺', W / 2 + 34 + (1 - k) * 300, 1010, font(68, 900, D), '#E25A60', 'left', 2); ctx.restore(); }
  vignette(ctx, 0.5);
}

// ---------------------------------------------------------------- S4 les personnages (u 30.7..46.6)
const CAST = [
  [30.8, 'd_escroc', "L'ESCROC", 'Escrocs', C.redL, 'Chaque nuit, les Escrocs choisissent ensemble une victime.'],
  [33.8, 'd_expat', "L'EXPAT", 'Expats', C.blue, 'Aucun pouvoir : ton vote et ton instinct.'],
  [36.6, 'd_influencer', "L'INFLUENCEUSE", 'Expats', C.blue, 'Bad Buzz : une fois, le vote d’un joueur compte double.'],
  [38.0, 'd_ceo', 'LE CEO', 'Expats', C.blue, 'Conseil d’administration : une fois, ton vote compte double.'],
  [39.2, 'd_millionaire', 'LE MILLIONNAIRE', 'Expats', C.blue, 'Seconde Chance : survit une fois à l’attaque des Escrocs.'],
  [40.8, 'd_charo', 'LE CHARO', 'Indépendants', '#B77BE6', 'Chaque nuit, tente de séduire un nouveau joueur.'],
  [42.2, 'd_emirati', "L'ÉMIRATI", 'Expats', C.blue, 'Connaissance du terrain : découvre si un joueur est un Escroc.'],
  [43.4, 'd_fake_millionaire', 'LE FAUX MILLIONNAIRE', 'Indépendants', '#B77BE6', 'Bluff : une fois, il passe pour un Expat aux enquêtes.'],
];
function s4(ctx, u, IMG) {
  bgImg(ctx, IMG.d_bg_home, { zoom: 1.15 + 0.05 * prog(u, 30.7, 46.6), dark: 0.45 });
  dust(ctx, u, 40, C.goldL, 0.6, 12);
  // la vraie collection du mode Dubaï qui défile, dans le téléphone à gauche
  const sp = clamp((u - 31) / 14) * 5, i0 = Math.min(4, Math.floor(sp));
  phone2(ctx, 300, 1080, 470, (s) => scrollPair(s, IMG['cx' + i0], IMG['cx' + (i0 + 1)], E.inOutCubic(sp - i0)), { rotY: 0.18, tilt: -0.03, glow: 0.3 });
  // la carte en vedette à droite, retournée en 3D
  let cur = 0; CAST.forEach((c, i) => { if (u >= c[0] - 0.3) cur = i; });
  const [u0, key, name, camp, col, power] = CAST[cur];
  const flip = E.outBack(prog(u, u0, u0 + 0.4), 1.2);
  const next = CAST[cur + 1], outp = next ? E.inCubic(prog(u, next[0] - 0.3, next[0])) : 0;
  card(ctx, IMG[key], 770 + outp * 500, 980, 380, { flip, label: name, sub: camp.toUpperCase(), subColor: col, glow: 0.6, rot: 0.04 - outp * 0.3, alpha: 1 - outp });
  const pa = prog(u, u0 + 0.25, u0 + 0.45) * (1 - outp);
  if (pa > 0) {
    ctx.save(); ctx.globalAlpha = pa; const f = font(28, 700, UI); ctx.font = f;
    const ws = power.split(' '), ls = ['']; for (const w of ws) { const tr = (ls[ls.length - 1] + ' ' + w).trim(); if (layout(ctx, tr, f).width > 380 && ls[ls.length - 1]) ls.push(w); else ls[ls.length - 1] = tr; }
    rrect(ctx, 570, 1280, 400, 30 + ls.length * 38, 18); ctx.fillStyle = 'rgba(11,9,7,0.85)'; ctx.fill(); ctx.strokeStyle = hexA(C.gold, 0.6); ctx.lineWidth = 2; ctx.stroke();
    ls.forEach((l, j) => text(ctx, l, 590, 1322 + j * 38, f, C.ivory)); ctx.restore();
  }
  shade(ctx, 0.85, 0.2);
  tik(ctx, '20 PERSONNAGES À DÉCOUVRIR', 330, 64, C.goldL, u, 31, { out: 42.6 });
  tik(ctx, 'CHACUN A SON RÔLE.', 330, 70, '#fff', u, 42.8, { out: 44.4 });
  tik(ctx, 'PERSONNE N’EST VRAIMENT', 300, 64, '#fff', u, 44.5);
  tik(ctx, 'INNOCENT… 👀', 382, 70, '#E25A60', u, 44.9);
  vignette(ctx, 0.5);
}

// ---------------------------------------------------------------- S5 la partie, mode Dubaï (u 46.6..58.7), mise en scène
const SEATS3 = PLAYERS.map((_, i) => { const a = -Math.PI / 2 + (i / PLAYERS.length) * TAU; return [W / 2 + Math.cos(a) * 310, 880 + Math.sin(a) * 250]; });
function s5(ctx, u, IMG) {
  const night = E.inOutCubic(prog(u, 50.4, 50.9)) * (1 - E.inOutCubic(prog(u, 51.9, 52.3)));
  bgImg(ctx, IMG.d_bg_day, { zoom: 1.15, dark: 0.62 });
  if (night > 0) { bgImg(ctx, IMG.d_bg_night, { zoom: 1.15, alpha: night, dark: 0.3 }); moon(ctx, W * 0.72, H * 0.17, 90, night, '#F7E9C8'); }
  dust(ctx, u, 25, C.goldL, 0.5, 18);
  ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = hexA(C.gold, 0.4); ctx.beginPath(); ctx.ellipse(W / 2, 880, 310, 250, 0, 0, TAU); ctx.stroke(); ctx.restore();
  if (u < 50.4) { text(ctx, 'MODE', W / 2, 860, font(26, 900, D), C.goldL, 'center', 6); text(ctx, 'DUBAÏ', W / 2, 918, font(52, 900, D), C.gold, 'center', 2); text(ctx, `${Math.min(8, Math.max(1, Math.floor((u - 46.6) / 0.18) + 1))}/10 joueurs`, W / 2, 965, font(28, 800, UI), C.ivory, 'center'); }
  else {
    const ph = u < 52.1 ? ['NUIT', 45, 50.6, C.blue] : u < 55.2 ? ['JOUR · DÉBAT', 150, 52.1, C.gold] : ['VOTE', 60, 55.2, C.redL];
    const left = Math.max(0, Math.round(ph[1] - (u - ph[2]) * 0.625 * 7));
    ctx.lineWidth = 8; ctx.strokeStyle = hexA(ph[3], 0.25); ctx.beginPath(); ctx.arc(W / 2, 880, 92, 0, TAU); ctx.stroke();
    ctx.strokeStyle = ph[3]; ctx.beginPath(); ctx.arc(W / 2, 880, 92, -Math.PI / 2, -Math.PI / 2 + TAU * (left / ph[1])); ctx.stroke();
    text(ctx, `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, W / 2, 898, font(50, 800, UI), C.ivory, 'center');
    text(ctx, ph[0], W / 2, 762, font(26, 900, D), ph[3], 'center', 3);
  }
  PLAYERS.forEach((name, i) => {
    const u0 = i === 7 ? 46.6 : 46.8 + i * 0.18, k = springU(u, u0, SPRING.bouncy); if (k <= 0) return;
    const [x, y] = SEATS3[i];
    avatar(ctx, IMG, i, x, y, 58 * k, { a: clamp(k * 2) * (1 - night * (i === 7 ? 0 : 0.5)), dead: i === 3 ? E.outCubic(prog(u, 56.9, 57.2)) : 0, you: i === 7 });
    text(ctx, name, x, y + 98, font(28, 800, UI), i === 7 ? C.goldL : C.ivory, 'center');
  });
  if (u >= 48.2 && u < 49.9) PLAYERS.forEach((_, i) => { const p = E.outCubic(prog(u, 48.3 + i * 0.1, 48.6 + i * 0.1)), f = 1 - prog(u, 49.5, 49.9); if (p <= 0) return; const [x, y] = SEATS3[i]; card(ctx, null, lerp(W / 2, x + 46, p), lerp(880, y - 40, p), 70, { flip: 0, rot: (1 - p) * 3 + 0.2, alpha: f }); });
  const mine = prog(u, 49.3, 49.6) * (1 - prog(u, 52, 52.3));
  if (mine > 0) {
    const flip = E.outCubic(prog(u, 49.4, 50)), sm = E.inOutCubic(prog(u, 50.4, 50.8));
    const cx = lerp(W / 2, W - 150, sm), cy = lerp(1300, 1380, sm), cw = lerp(320, 170, sm);
    card(ctx, IMG.d_emirati, cx, cy, cw, { flip, alpha: mine, glow: 0.6, label: "L'ÉMIRATI", sub: 'TA CARTE', subColor: C.blue });
    if (flip > 0.9) { ctx.save(); ctx.globalAlpha = mine; text(ctx, 'Toi seul la vois', cx, cy + cw * 0.67 + 34, font(lerp(28, 22, sm), 800, UI), C.goldL, 'center'); ctx.restore(); }
  }
  if (u >= 50.7 && u < 52.2) {
    const a = prog(u, 50.7, 50.9) * (1 - prog(u, 51.9, 52.2));
    ctx.save(); ctx.globalAlpha = a; pill(ctx, 'Connaissance du terrain : enquête sur un joueur', W / 2, 1240, 28, C.ivory, 'rgba(20,27,51,0.92)', 1, C.blue); ctx.restore();
    const [x, y] = SEATS3[5]; tap(ctx, u, 51.3, x, y, 1);
    const r = E.outBack(prog(u, 51.4, 51.7)); if (r > 0) { ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y - 125); ctx.scale(r, r); rrect(ctx, -110, -34, 220, 68, 34); ctx.fillStyle = 'rgba(20,27,51,0.95)'; ctx.fill(); ctx.strokeStyle = C.blue; ctx.lineWidth = 2; ctx.stroke(); text(ctx, '🔒 vu par toi seul', 0, 10, font(24, 800, UI), C.ivory, 'center'); ctx.restore(); }
  }
  const chatOut = 1 - prog(u, 55.1, 55.4);
  const MSG = [['Sami', 'Wsh c’est toi l’Escroc 😂', 52.4], ['Inès', 'Pourquoi tu m’accuses ?', 53.1], ['Karim', 'Lui il ment depuis le début 💀', 53.8], ['Nora', 'Je vote contre le CEO perso.', 54.5]];
  const n = MSG.filter((m) => u >= m[2]).length;
  MSG.forEach(([who, msg, u0], j) => {
    if (u < u0) return; const slot = n - 1 - j; if (slot >= 3) return;
    const push = slot > 0 ? 1 - E.outCubic(prog(u, MSG[j + slot][2], MSG[j + slot][2] + 0.3)) : 0;
    const yy = 1330 - (slot - push) * 118, w = 680, x = j % 2 ? W - 90 - w : 90;
    bubble(ctx, who, msg, x, yy - 108, w, E.outBack(prog(u, u0, u0 + 0.35)) * chatOut, j % 2 === 1);
  });
  [[0, 55.4], [2, 55.7], [6, 56], [7, 56.3]].forEach(([from, u0]) => {
    const p = E.outCubic(prog(u, u0, u0 + 0.3)), f = 1 - prog(u, 57.2, 57.6); if (p <= 0 || f <= 0) return;
    const [x0, y0] = SEATS3[from], [x1, y1] = SEATS3[3], ang = Math.atan2(y1 - y0, x1 - x0), d = Math.hypot(x1 - x0, y1 - y0) - 150;
    const sx = x0 + Math.cos(ang) * 70, sy = y0 + Math.sin(ang) * 70, ex = sx + Math.cos(ang) * d * p, ey = sy + Math.sin(ang) * d * p;
    ctx.save(); ctx.globalAlpha = f; ctx.strokeStyle = C.redL; ctx.fillStyle = C.redL; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.translate(ex, ey); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-18, -14); ctx.lineTo(-18, 14); ctx.closePath(); ctx.fill(); ctx.restore();
  });
  if (u >= 56.9) pill(ctx, 'Yanis est éliminé', W / 2, 1250, 36, C.ivory, 'rgba(142,27,34,0.95)', E.outBack(prog(u, 56.9, 57.2)) * (1 - prog(u, 58.3, 58.7)), C.gold);
  shade(ctx, 0.85, 0.15);
  tik(ctx, 'REJOINS UNE PARTIE', 330, 74, '#fff', u, 46.7, { out: 50.3 });
  if (u >= 50.4 && u < 52.2) words(ctx, 'La nuit tombe sur Dubaï 🌙', W / 2, 330, 58, C.ivory, u, 50.5, { family: D, out: 51.9 });
  tik(ctx, 'DISCUTE AVEC LES JOUEURS', 330, 68, '#fff', u, 52.2, { out: 55.1 });
  tik(ctx, 'DÉMASQUE LES ESCROCS', 330, 72, '#E25A60', u, 55.2);
  stagedTag(ctx, 1);
  vignette(ctx, 0.5);
}

// ---------------------------------------------------------------- S6 du jeu aux rencontres (u 58.7..66.9)
function s6(ctx, u, IMG) {
  if (u < 60.6) {
    // fin de partie : les joueurs continuent de discuter (mise en scène)
    bgImg(ctx, IMG.d_bg_victory, { zoom: 1.15, dark: 0.45 }); dust(ctx, u, 60, C.goldL, 0.8, 51);
    const k = springU(u, 58.7, SPRING.bouncy);
    ctx.save(); ctx.globalAlpha = clamp(k * 1.5); ctx.translate(W / 2, 720); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k); ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 30; text(ctx, 'VICTOIRE DES EXPATS', 0, 0, font(70, 900, D), C.gold, 'center', 2); ctx.restore();
    [[0, 830], [1, 1000], [2, 1170], [4, 1340]].forEach(([i], j) => { const kk = springU(u, 59 + j * 0.15, SPRING.bouncy); if (kk > 0) avatar(ctx, IMG, i, 180 + j * 240, 900, 64 * kk, {}); });
    bubble(ctx, 'Sami', 'Trop drôle 😂 on en refait une ?', 90, 1040, 760, E.outBack(prog(u, 59.4, 59.7)));
    bubble(ctx, 'Léa', 'Grave ! Vous êtes à Dubaï Marina ?', 230, 1160, 760, E.outBack(prog(u, 59.9, 60.2)), true);
    shade(ctx, 0.8, 0.2);
    tik(ctx, 'D’UNE PARTIE EN LIGNE…', 330, 70, '#fff', u, 58.8);
    stagedTag(ctx, 1);
    vignette(ctx, 0.5);
    return;
  }
  blurBg(ctx, IMG.f6, { blur: 30, dark: 0.5, zoom: 1.25 });
  const k = springU(u, 60.4, SPRING.gentle);
  phone2(ctx, W / 2, lerp(H * 1.2, 1120, k), 640, (s) => {
    if (u < 63.2) { shot(s, IMG.a_social); tap(s, u, 62, 507, 1539); const ok = prog(u, 62.05, 62.2); if (ok > 0) { s.save(); s.globalAlpha = ok; rrect(s, 95, 1480, 820, 120, 60); s.fillStyle = '#2E7D4F'; s.fill(); text(s, 'Abonné·e ✓', 505, 1560, font(48, 800, UI), '#fff', 'center'); s.restore(); } return; }
    if (u < 65.2) { navTo(s, IMG.a_social, IMG.s1, prog(u, 63.2, 63.6), 'fade'); tap(s, u, 64.4, 849, 1398); const ok = prog(u, 64.45, 64.6); if (ok > 0) { s.save(); s.globalAlpha = ok; rrect(s, 650, 1340, 400, 116, 58); s.fillStyle = '#2E7D4F'; s.fill(); text(s, 'Partant·e ✓', 850, 1418, font(44, 800, UI), '#fff', 'center'); s.restore(); } return; }
    navTo(s, IMG.s1, IMG.a_discover, prog(u, 65.2, 65.6), 'fade');
  });
  shade(ctx, 0.8, 0.2);
  tik(ctx, 'À DE VRAIES RENCONTRES ❤️', 340, 70, C.goldL, u, 60.7);
  vignette(ctx, 0.45);
}

// ---------------------------------------------------------------- S7 lancement (u 66.9..80)
function s7(ctx, u, IMG) {
  bgImg(ctx, IMG.d_bg_victory, { zoom: 1.2 * (1.04 / 1.2) ** E.outCubic(prog(u, 66.9, 80)), fy: 0.45, dark: 0.4 });
  dust(ctx, u, 80, C.goldL, 0.85, 61);
  // personnages Dubaï en éventail + l'écran réel du mode Dubaï
  const ck = springU(u, 67, SPRING.gentle);
  ['d_influencer', 'd_escroc', 'd_ceo'].forEach((key, i) => card(ctx, IMG[key], W / 2 + (i - 1) * 300 * ck, 1360 + Math.abs(i - 1) * 40, 260, { rot: (i - 1) * 0.14 * ck, glow: 0.4, alpha: clamp(ck * 2) * (i === 1 ? 0 : 1) }));
  phone2(ctx, W / 2, lerp(H + 600, 1380, ck), 300, (s) => shot(s, IMG.m_dubai), { glow: 0.6 });
  shade(ctx, 0.55, 0.6);
  const lk = springU(u, 67, SPRING.bouncy);
  if (lk > 0) { const lw = 520, lh = lw * IMG.logo.height / IMG.logo.width; ctx.save(); ctx.translate(W / 2, 470); ctx.scale(0.6 + 0.4 * lk, 0.6 + 0.4 * lk); ctx.globalAlpha = clamp(lk * 1.4); ctx.shadowColor = hexA(C.gold, 0.5 + 0.3 * bump(u, 67.5, 0.6)); ctx.shadowBlur = 60; ctx.drawImage(IMG.logo, -lw / 2, -lh / 2, lw, lh); ctx.restore(); }
  words(ctx, 'MAKE FRIENDS IRL', W / 2, 640, 38, C.goldL, u, 67.6, { step: 0.1, weight: 800, family: UI, track: 0.18 });
  tik(ctx, 'IRLY ARRIVE TRÈS BIENTÔT', 780, 62, '#fff', u, 67.2);
  words(ctx, 'À DUBAÏ 🇦🇪', W / 2, 885, 96, C.gold, u, 67.8, { step: 0.12 });
  const fp = E.outBack(prog(u, 70.6, 71.1)); if (fp > 0) { ctx.save(); ctx.translate(W / 2, 1010); ctx.scale(fp, fp); pill(ctx, 'FOLLOW & PATIENTE 👀', 0, 0, 44, C.black, C.gold, 1, null, UI, 800); ctx.restore(); }
  const oa = springU(u, 73.6, SPRING.bouncy); if (oa > 0) { ctx.save(); ctx.globalAlpha = clamp(oa * 1.5); ctx.translate(W / 2, 1110); ctx.scale(0.7 + 0.3 * oa, 0.7 + 0.3 * oa); ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 30; text(ctx, 'ON ARRIVE !', 0, 0, font(64, 900, D), C.ivory, 'center', 3); ctx.restore(); }
  vignette(ctx, 0.45);
}

M.film({
  fonts: [font(100, 900, D), font(100, 700, D), font(40, 800, UI), font(40, 700, UI)],
  images: {
    ...Object.fromEntries(['bg_day', 'bg_night', 'bg_home', 'bg_victory', 'expat', 'escroc', 'influencer', 'ceo', 'millionaire', 'charo', 'emirati', 'fake_millionaire'].map((k) => ['d_' + k, `assets/art/d_${k}.webp`])),
    m_dubai: 'assets/v3/m_dubai.png', modes: 'assets/v3/modes_00.png',
    ...Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => ['cx' + i, `assets/dx/cards_0${i}.png`])),
    ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((i) => ['f' + i, `assets/feed/${i}.webp`])),
    ...Object.fromEntries(PLAYERS.map((_, i) => ['p' + (i + 1), `assets/players/p${i + 1}.jpg`])),
    a_social: 'assets/app2/social.png', a_discover: 'assets/app2/discover.png',
    H0: 'assets/home2/home_00.png', H1: 'assets/home2/home_01.png', H2: 'assets/home2/home_02.png', H3: 'assets/home2/home_03.png',
    s1: 'assets/scroll/social_01.png',
    logo: 'assets/irly_wordmark_ivory.png', logoW: 'assets/irly_wordmark.png',
  },
  hits: HITS,
  samples: 4,
  draw(ctx, u, t, IMG) {
    if (u < 10.4) s1(ctx, u, IMG);
    else if (u < 21.4) s2(ctx, u, IMG);
    else if (u < 30.7) s3(ctx, u, IMG);
    else if (u < 46.6) s4(ctx, u, IMG);
    else if (u < 58.7) s5(ctx, u, IMG);
    else if (u < 66.9) s6(ctx, u, IMG);
    else s7(ctx, u, IMG);
    subtitles(ctx, t);
  },
  post(ctx, u) {
    ctx.save(); ctx.globalAlpha = 0.04;
    for (let i = 0; i < 220; i++) { const x = hash01(i + Math.floor(u * 96) * 997, 3) * W, y = hash01(i + Math.floor(u * 96) * 991, 7) * H; ctx.fillStyle = i % 2 ? '#fff' : '#000'; ctx.fillRect(x, y, 3, 3); }
    ctx.restore();
  },
});
