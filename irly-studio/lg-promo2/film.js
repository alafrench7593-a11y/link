// IRLY Loup-Garou v2 (l'histoire IRLY) : 50 s, 9:16. Fonction pure du temps : window.seek(t) peint l'image t.
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

// Des membres partout : les portraits d'exemple de l'app (version démo), qui apparaissent autour du téléphone.
// Aucun chiffre de membres n'est affiché.
const FACES = ['p-samuel', 'p-layla', 'p-nadia', 'p-omar', 'g-zara', 'p-chloe', 'p-james', 'p-khalid', 'p-amira', 'p-priya', 'p-noah', 'p-sofia', 'p-ketut', 'p-yusuf', 'w-adaeze', 'w-naomi', 'p-lea', 'p-arjun', 'g-sofia', 'p-mia', 'w-salma', 'p-jonas', 'g-maya', 'p-elena'];
function faceCloud(ctx, u, IMG, u0, u1, seed = 0) {
  const out = 1 - E.inCubic(prog(u, u1 - 0.4, u1));
  if (out <= 0 || u < u0) return;
  for (let i = 0; i < 12; i++) {
    const k = springU(u, u0 + i * 0.12, SPRING.bouncy); if (k <= 0) continue;
    const right = i % 2 === 1, row = i >> 1;
    const x = (right ? 968 : 112) + (hash01(i, 7 + seed) - 0.5) * 50;
    const y = 560 + row * 175 + (hash01(i, 11 + seed) - 0.5) * 60 + 10 * Math.sin(u * 1.3 + i);
    const r = (44 + 14 * hash01(i, 13 + seed)) * k;
    const img = IMG['face' + ((i + seed * 5) % FACES.length)];
    ctx.save(); ctx.globalAlpha = clamp(k * 2) * out;
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(x, y, r + 4, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip(); if (img) cover(ctx, img, x - r, y - r, 2 * r, 2 * r, { fy: 0.35 }); ctx.restore();
    ctx.beginPath(); ctx.arc(x + r * 0.7, y + r * 0.7, r * 0.2, 0, TAU); ctx.fillStyle = '#34C759'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#050506'; ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- HITS (son sur chaque accent)
const HITS = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((b) => [b, 'swipe', 'whoosh', { len: 0.18, from: 2600, to: 900, gain: 0.5 }]),
  [8.2, 'notif', 'blip', { pitch: 'E6' }],
  [13.2, 'bug', 'click'],
  [14, 'irly', 'impact'],
  [18, 'onglet social', 'tick'], [21, 'onglet découvrir', 'tick'], [23, 'accueil', 'tick'],
  [25.2, 'jouer', 'click'],
  [25.6, 'plongée', 'whoosh', { len: 0.6, from: 400, to: 3200 }],
  [27.5, 'titre loup-garou', 'impact'],
  [30, 'mode chaos', 'tick'], [31, 'mode cauchemar', 'tick'], [32, 'mode dubaï', 'tick'], [33, 'mode classique', 'tick'],
  [34.6, 'en ligne', 'tick'], [35.3, 'dix joueurs', 'tick'], [36, 'créer la table', 'click'],
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => [36.8 + i * 0.2, 'joueur ' + (i + 1), 'pop', { pitch: ['D5', 'F5', 'A5', 'C6', 'D6', 'E6', 'F6'][i] }]),
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => [38.6 + i * 0.12, 'carte ' + (i + 1), 'click']),
  [39.9, 'ta carte', 'whoosh', { len: 0.35, from: 800, to: 2400 }],
  [40.6, 'nuit', 'sub', { len: 1.0 }],
  [41.9, 'pouvoir', 'bell', { pitch: 'A5' }],
  [43.3, 'chat 1', 'blip', { pitch: 'A5' }], [44.1, 'chat 2', 'blip', { pitch: 'C6' }], [44.9, 'chat 3', 'blip', { pitch: 'E6' }], [45.7, 'chat 4', 'blip', { pitch: 'G6' }],
  [47.2, 'vote 1', 'tick'], [47.6, 'vote 2', 'tick'], [48, 'vote 3', 'tick'], [48.4, 'vote 4', 'tick'],
  [48.9, 'éliminé', 'thud'],
  [50.45, 'tuile dubaï', 'tick'], [51, 'dubaï', 'impact'],
  ...[0, 1, 2, 3, 4, 5].map((i) => [51.6 + i * 0.5, 'carte dubaï ' + (i + 1), 'click']),
  [52.9, 'expats vs escrocs', 'thud'],
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => [55.9 + i * 0.26, 'mode ' + (i + 2), 'click']),
  [58, 'retour irly', 'thud'],
  [59, 'onglet social', 'tick'], [61.5, 'partant', 'click'], [62.5, 'lancer', 'click'],
  [63.6, 'demain', 'tick'], [64.1, '19h30', 'tick'], [64.7, 'publier', 'click'],
  [66.2, 'en présentiel', 'tick'], [66.9, 'créer la table', 'click'],
  [67.6, 'téléphone tourne', 'whoosh', { len: 0.6, from: 400, to: 3200 }],
  [68.4, 'vraie vie', 'bell', { pitch: 'A5' }],
  [72.3, 'carrousel', 'whoosh', { len: 0.5, from: 600, to: 2600 }],
  [75, 'logo', 'impact'], [75.5, 'logo brille', 'bell', { pitch: 'D6' }],
  [77, 'appel', 'pop', { pitch: 'A5' }],
];

// ---------------------------------------------------------------- A  l'ennui (u 0..14)
const FEED = ['f8', 'f6', 'f9', 'f4', 'f10', 'f2', 'f3', 'f7', 'f5', 'f8', 'f9', 'f10', 'f6', 'f4'];
function sBored(ctx, u, IMG) {
  blurBg(ctx, IMG.f6, { blur: 26, dark: 0.62, zoom: 1.3 });
  const z = 1.0 * (1.12 / 1.0) ** prog(u, 0, 13);
  const pos = [...Array(11)].reduce((s, _, i) => s + springU(u, i + 1, SPRING.snappy), 0); // un swipe par temps
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
  const glitch = prog(u, 13.1, 14);
  phone2(ctx, W / 2, 1010, 560, (s) => {
    FEED.forEach((k, i) => {
      const y = (i - pos) * SH;
      if (y > SH || y < -SH) return;
      cover(s, IMG[k], 0, y, SW, SH, { fy: 0.45 });
      const g = s.createLinearGradient(0, y + SH * 0.6, 0, y + SH); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)'); s.fillStyle = g; s.fillRect(0, y, SW, SH);
    });
    // barre d'état générique
    text(s, '23:47', 90, 95, font(46, 700, UI), '#fff'); text(s, '62 %', SW - 90, 95, font(40, 700, UI), '#fff', 'right');
    // notification générique de temps d'écran
    const np = E.outBack(prog(u, 8.2, 8.7)) * (1 - E.inCubic(prog(u, 10.3, 10.7)));
    if (np > 0) {
      s.save(); s.translate(0, -260 * (1 - np)); s.globalAlpha = clamp(np * 2);
      rrect(s, 40, 130, SW - 80, 200, 50); s.fillStyle = 'rgba(40,40,46,0.92)'; s.fill();
      text(s, 'Temps d’écran', 100, 210, font(46, 800, UI), '#fff');
      text(s, '1 h 04 de scroll ce soir', 100, 280, font(42, 700, UI), 'rgba(255,255,255,0.75)');
      s.restore();
    }
    // le bug, puis IRLY
    if (glitch > 0) {
      for (let i = 0; i < 9; i++) { const yy = hash01(i + Math.floor(u * 24) * 13, 3) * SH, hh = 40 + 120 * hash01(i, 5); s.drawImage(IMG.f6, 0, yy, SW, hh, (hash01(i + Math.floor(u * 24), 9) - 0.5) * 140 * glitch, yy, SW, hh); }
      s.fillStyle = `rgba(5,5,6,${E.inCubic(prog(u, 13.4, 14))})`; s.fillRect(0, 0, SW, SH);
    }
  }, { tilt: -0.03 + 0.01 * Math.sin(u * 0.5) });
  ctx.restore();
  shade(ctx, 0.75, 0.3);
  const lines = [[0.5, 'T’es à Dubaï… 🇦🇪'], [2.6, 'T’es posé chez toi…'], [4.9, 'Tu sais pas quoi faire…'], [7.1, 'Tu scrolles depuis 1 heure 💀'], [10.3, 'Et t’as personne avec qui sortir ?']];
  lines.forEach(([u0, str], i) => { const nx = lines[i + 1] ? lines[i + 1][0] - 0.35 : 13.4; tik(ctx, str, 360, 72, i === 4 ? C.goldL : '#fff', u, u0, { out: nx }); });
  vignette(ctx, 0.55);
}

// ---------------------------------------------------------------- B  la découverte d'IRLY (u 14..23)
function irlyScreens(s, u, IMG) {
  // 14 splash -> 15.2 accueil -> 16.2..17.6 défilement -> 18 Social -> 19.4 défilement activités -> 21 Découvrir
  if (u < 15.2) { s.fillStyle = IRLY.bg; s.fillRect(0, 0, SW, SH); const k = springU(u, 14, SPRING.bouncy); if (IMG.logo) { const lw = 620 * (0.7 + 0.3 * k), lh = lw * IMG.logo.height / IMG.logo.width; s.drawImage(IMG.logoW, SW / 2 - lw / 2, SH / 2 - lh / 2, lw, lh); } if (u > 14.9) shot(s, IMG.H0, 0, prog(u, 14.9, 15.2)); return; }
  if (u < 16.2) { shot(s, IMG.H0); return; }
  if (u < 18.2) { if (u < 16.6) { scrollPair(s, IMG.H0, IMG.H1, E.inOutCubic(prog(u, 16.2, 16.6))); return; }
    const p = E.inOutCubic(prog(u, 16.6, 17.8)); if (p < 0.5) scrollPair(s, IMG.H1, IMG.H2, p * 2); else scrollPair(s, IMG.H2, IMG.H3, p * 2 - 1); tap(s, u, 18, ...TAB.social); return; }
  if (u < 21.2) {
    const nav = prog(u, 18.05, 18.5);
    if (nav < 1) navTo(s, IMG.H3, IMG.a_social, nav, 'fade');
    else { const p = E.inOutCubic(prog(u, 19.3, 20.4)); navTo(s, IMG.a_social, IMG.s1, p, 'fade'); if (p > 0 && p < 1) { s.save(); s.globalAlpha = 1 - Math.abs(p - 0.5) * 2; s.restore(); } }
    tap(s, u, 21, ...TAB.discover); return;
  }
  navTo(s, IMG.s1, IMG.a_discover, prog(u, 21.05, 21.5), 'fade');
}
function sIrly(ctx, u, IMG) {
  blurBg(ctx, IMG.f6, { blur: 30, dark: 0.55, zoom: 1.25 });
  const k = springU(u, 14, SPRING.gentle);
  const yaw = 0.18 * Math.sin((u - 14) * 0.35);
  phone2(ctx, W / 2, 1125, 640, (s) => irlyScreens(s, u, IMG), { rotY: yaw * 0.4, tilt: -0.02, scale: lerp(1.25, 1, k) });
  faceCloud(ctx, u, IMG, 15.4, 22.9, 0);
  shade(ctx, 0.8, 0.25);
  tik(ctx, 'Attends… tu connais IRLY ? 👀', 330, 70, '#fff', u, 14.2, { out: 16.6 });
  tik(ctx, 'L’appli pour rencontrer', 320, 66, '#fff', u, 16.9, { out: 22.6 });
  tik(ctx, 'du monde à Dubaï.', 405, 66, IRLY.steel, u, 17.3, { out: 22.6 });
  // légende discrète de ce qu'on voit
  const cap = u < 18 ? 'Accueil' : u < 21 ? 'Social · profils et activités' : 'Découvrir · trouve ta bande';
  const ca = prog(u, 15.3, 15.6) * (1 - prog(u, 22.7, 23));
  if (false && ca > 0) { ctx.save(); ctx.globalAlpha = ca; pill(ctx, cap, W / 2, 1745, 30, '#fff', 'rgba(255,255,255,0.12)', 1, 'rgba(255,255,255,0.3)'); ctx.restore(); }
  vignette(ctx, 0.45);
}

// ---------------------------------------------------------------- C  accès au Loup-Garou depuis IRLY (u 23..34)
function sAccess(ctx, u, IMG) {
  const dive = E.inCubic(prog(u, 25.6, 27.2));      // la caméra plonge dans l'écran
  const back = E.outCubic(prog(u, 28.6, 29.8));      // puis ressort sur l'accueil du Loup-Garou
  // fond : le flou social qui devient la nuit du village
  blurBg(ctx, IMG.f6, { blur: 30, dark: 0.55, zoom: 1.25 });
  const night = E.inOutCubic(prog(u, 26.2, 27.6));
  if (night > 0) { bgImg(ctx, IMG.c_bg_night, { zoom: 1.25 * (1.08 / 1.25) ** prog(u, 26.2, 30), alpha: night, dark: 0.15 }); moon(ctx, W * 0.66, H * 0.2, 110, E.outCubic(prog(u, 26.6, 27.6)), '#F3EBD6', 0.9); fog(ctx, u, 0.4 * night, 2, 0.55); }
  const showPhone = u < 27.2 || u >= 28.6;
  if (showPhone) {
    const s0 = u < 27.2 ? 1 * (7 / 1) ** dive : lerp(2.2, 1, back);
    // point visé pendant la plongée : le bouton « Jouer » de la carte Loup-Garou
    const pw = 640, ph = pw * SH / SW, px = W / 2, py = 1125;
    const fx = px - pw / 2 + pw * (373 / SW), fy = py - ph / 2 + ph * (1313 / SH);
    ctx.save();
    if (u < 27.2) { ctx.translate(fx, fy); ctx.scale(s0, s0); ctx.translate(-fx, -fy); ctx.globalAlpha = 1 - prog(u, 26.6, 27.2); }
    else { ctx.translate(W / 2, py); ctx.scale(s0, s0); ctx.translate(-W / 2, -py); ctx.globalAlpha = back; }
    phone2(ctx, px, py, pw, (s) => {
      if (u < 28.6) {
        if (u < 23.4) navTo(s, IMG.a_discover, IMG.H0, prog(u, 23.05, 23.4), 'fade');
        else scrollPair(s, IMG.H0, IMG.H1, E.inOutCubic(prog(u, 23.5, 24.4)));
        tap(s, u, 23, ...TAB.home);
        // halo sur la vraie carte « IRLY Games » puis toucher « Jouer »
        const ha = prog(u, 24.4, 24.7) * (1 - prog(u, 25.5, 25.8));
        if (ha > 0) { s.save(); s.globalAlpha = ha; s.lineWidth = 10; s.strokeStyle = C.gold; s.shadowColor = C.gold; s.shadowBlur = 40; rrect(s, 40, 700, 640, 740, 50); s.stroke(); s.restore(); }
        tap(s, u, 25.2, 373, 1313, 1.2);
      } else {
        // l'accueil réel du Loup-Garou ; on touche les modes : Chaos, Cauchemar, Dubaï, Classique
        const seq = [[28.6, 'm_classique'], [30.15, 'm_chaos'], [31.15, 'm_manipulation'], [32.15, 'm_apocalypse'], [33.15, 'm_dubai']];
        let cur = seq[0][1], prev = null, t0 = 0;
        for (const [b, k] of seq) if (u >= b) { prev = cur; cur = k; t0 = b; }
        if (prev && prev !== cur) navTo(s, IMG[prev], IMG[cur], prog(u, t0, t0 + 0.35), 'fade'); else shot(s, IMG[cur]);
        tap(s, u, 30, 582, 873); tap(s, u, 31, 219, 1179); tap(s, u, 32, 582, 1485); tap(s, u, 33, 951, 1485);
      }
    }, { tilt: u < 27.2 ? -0.02 : 0.03 * (1 - back), glow: u >= 28.6 ? 0.4 : 0 });
    ctx.restore();
  }
  // la révélation : le vrai titre du Loup-Garou (recadré de l'écran de l'app) sous la pleine lune
  const ta = E.outCubic(prog(u, 27.3, 27.9)) * (1 - prog(u, 28.5, 28.9));
  if (ta > 0) {
    const sw = 1170, sh = 470, w = 1000, h = w * sh / sw, k = springU(u, 27.4, SPRING.bouncy);
    ctx.save(); ctx.globalAlpha = ta; ctx.translate(W / 2, 1000); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
    ctx.shadowColor = hexA(C.gold, 0.45); ctx.shadowBlur = 60;
    crop(ctx, IMG.m_classique, [0, 150, sw, sh], -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  shade(ctx, 0.8, 0.25);
  if (u < 27.2) {
    tik(ctx, 'Et maintenant, tu peux même', 310, 64, '#fff', u, 23.3, { out: 26.8 });
    tik(ctx, 'jouer au Loup-Garou 🐺', 395, 74, C.goldL, u, 23.8, { out: 26.8 });
  }
  if (u >= 28.4) {
    tik(ctx, 'Directement depuis IRLY !', 330, 72, '#fff', u, 28.6, { out: 30.8 });
    words(ctx, 'Chaos · Manipulation · Apocalypse…', W / 2, 330, 46, C.goldL, u, 31, { family: D, weight: 700, step: 0.25, out: 33.8 });
  }
  vignette(ctx, 0.5);
}

// ---------------------------------------------------------------- D  la partie (u 34..50), mise en scène
const SEATS = PLAYERS.map((_, i) => { const a = -Math.PI / 2 + (i / PLAYERS.length) * TAU; return [W / 2 + Math.cos(a) * 310, 900 + Math.sin(a) * 255]; });
const VICTIM = 3, SEEN = 5;
function sGame(ctx, u, IMG) {
  // 34..36.5 : créer le salon dans l'app (vraie fenêtre « Nouvelle table de Loup-Garou »)
  if (u < 36.6) {
    bgImg(ctx, IMG.c_bg_night, { zoom: 1.12, dark: 0.45 }); dust(ctx, u, 30, C.goldL, 0.5);
    const zoomIn = E.inCubic(prog(u, 36.1, 36.6));
    ctx.save(); ctx.translate(W / 2, 1060); ctx.scale(1 * (3 / 1) ** zoomIn, 1 * (3 / 1) ** zoomIn); ctx.translate(-W / 2, -1060); ctx.globalAlpha = 1 - zoomIn;
    phone2(ctx, W / 2, 1125, 640, (s) => {
      navTo(s, IMG.m_classique, IMG.ct, prog(u, 34, 34.4), 'sheet');
      tap(s, u, 34.6, 243, 1600); tap(s, u, 35.3, 438, 2028); tap(s, u, 36, 585, 2302);
    });
    ctx.restore();
    shade(ctx, 0.8, 0.2);
    tik(ctx, 'Tu crées ton salon…', 340, 74, '#fff', u, 34.3, { out: 36.4 });
    vignette(ctx, 0.5);
    return;
  }
  const night = bump(u, 42, 1.6) > 0 ? E.inOutCubic(prog(u, 40.4, 40.9)) * (1 - E.inOutCubic(prog(u, 42.9, 43.3))) : 0;
  bgImg(ctx, IMG.c_bg_day, { zoom: 1.12 + 0.04 * prog(u, 36.6, 50), dark: 0.6 });
  if (night > 0) { bgImg(ctx, IMG.c_bg_night, { zoom: 1.15, alpha: night, dark: 0.35 }); moon(ctx, W * 0.72, H * 0.17, 90, night); }
  dust(ctx, u, 20, C.goldL, 0.4, 8);
  // table
  const ta = E.outCubic(prog(u, 36.6, 37));
  ctx.save(); ctx.globalAlpha = ta; ctx.lineWidth = 2; ctx.strokeStyle = hexA(C.gold, 0.35); ctx.beginPath(); ctx.ellipse(W / 2, 900, 310, 255, 0, 0, TAU); ctx.stroke(); ctx.restore();
  // centre de la table : mode, puis phase + chrono
  if (u < 40.4) { if (ta > 0) { ctx.save(); ctx.globalAlpha = ta; text(ctx, 'MODE', W / 2, 880, font(26, 900, D), C.goldL, 'center', 6); text(ctx, 'CLASSIQUE', W / 2, 935, font(46, 900, D), C.gold, 'center', 2); text(ctx, `${Math.min(8, Math.max(1, Math.floor((u - 36.6) / 0.2) + 1))}/10 joueurs`, W / 2, 985, font(28, 800, UI), C.ivory, 'center'); ctx.restore(); } }
  else {
    const ph = u < 43.1 ? ['NUIT 1', 45, 40.6] : u < 47 ? ['JOUR · DÉBAT', 150, 43.1] : ['VOTE', 60, 47];
    const left = Math.max(0, Math.round(ph[1] - (u - ph[2]) * 0.625 * 7));
    const col = ph[0] === 'VOTE' ? C.redL : ph[0] === 'NUIT 1' ? C.blue : C.gold;
    ctx.lineWidth = 8; ctx.strokeStyle = hexA(col, 0.25); ctx.beginPath(); ctx.arc(W / 2, 900, 92, 0, TAU); ctx.stroke();
    ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(W / 2, 900, 92, -Math.PI / 2, -Math.PI / 2 + TAU * (left / ph[1])); ctx.stroke();
    text(ctx, `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, W / 2, 918, font(50, 800, UI), C.ivory, 'center');
    text(ctx, ph[0], W / 2, 782, font(26, 900, D), col, 'center', 3);
  }
  // joueurs qui rejoignent
  PLAYERS.forEach((name, i) => {
    const u0 = i === 7 ? 36.6 : 36.8 + i * 0.2, k = springU(u, u0, SPRING.bouncy);
    if (k <= 0) return;
    const [x, y] = SEATS[i];
    const dead = i === VICTIM ? E.outCubic(prog(u, 48.9, 49.2)) : 0;
    const sleep = night * (i === 7 ? 0 : 0.5);
    avatar(ctx, IMG, i, x, y, 58 * k, { a: clamp(k * 2) * (1 - sleep), dead, you: i === 7 });
    text(ctx, name, x, y + 98, font(28, 800, UI), i === 7 ? C.goldL : C.ivory, 'center');
    if (u >= 36.8 && u < 38.3 && i < 7) { const ja = prog(u, u0, u0 + 0.15) * (1 - prog(u, u0 + 0.9, u0 + 1.1)); if (ja > 0) { ctx.save(); ctx.globalAlpha = ja; text(ctx, 'a rejoint', x, y - 76, font(22, 800, UI), C.goldL, 'center'); ctx.restore(); } }
  });
  // distribution des cartes (dos), puis la tienne se retourne
  if (u >= 38.5 && u < 40.6) {
    PLAYERS.forEach((_, i) => {
      const p = E.outCubic(prog(u, 38.6 + i * 0.12, 38.9 + i * 0.12)), f = 1 - prog(u, 40.2, 40.6);
      if (p <= 0) return;
      const [x, y] = SEATS[i];
      card(ctx, null, lerp(W / 2, x + 46, p), lerp(900, y - 40, p), 70, { flip: 0, rot: (1 - p) * 3 + 0.2, alpha: f });
    });
  }
  const mine = prog(u, 39.8, 40.1) * (1 - prog(u, 42.9, 43.2));
  if (mine > 0) {
    const flip = E.outCubic(prog(u, 39.9, 40.5)), sm = E.inOutCubic(prog(u, 40.9, 41.3));
    const cx = lerp(W / 2, W - 150, sm), cy = lerp(1330, 1420, sm), cw = lerp(330, 170, sm);
    card(ctx, IMG.c_seer, cx, cy, cw, { flip, alpha: mine, glow: 0.6, label: 'VOYANTE', sub: 'TA CARTE', subColor: C.blue });
    if (flip > 0.9) { ctx.save(); ctx.globalAlpha = mine; text(ctx, 'Toi seul la vois', cx, cy + cw * 0.67 + 34, font(lerp(28, 22, sm), 800, UI), C.goldL, 'center'); ctx.restore(); }
  }
  // la nuit : ton pouvoir (Voyante) sur Karim ; le résultat n'est montré qu'à toi
  if (u >= 41.2 && u < 43.3) {
    const a = prog(u, 41.2, 41.5) * (1 - prog(u, 42.9, 43.3));
    ctx.save(); ctx.globalAlpha = a; pill(ctx, '🔮 Voyante : observe un joueur', W / 2, 1290, 32, C.ivory, 'rgba(20,27,51,0.92)', 1, C.blue); ctx.restore();
    const [x, y] = SEATS[SEEN];
    tap(ctx, u, 41.9, x, y, 1);
    const r = E.outBack(prog(u, 42, 42.4));
    if (r > 0) { ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y - 125); ctx.scale(r, r); rrect(ctx, -110, -34, 220, 68, 34); ctx.fillStyle = 'rgba(20,27,51,0.95)'; ctx.fill(); ctx.strokeStyle = C.blue; ctx.lineWidth = 2; ctx.stroke(); text(ctx, '🔒 vu par toi seul', 0, 10, font(24, 800, UI), C.ivory, 'center'); ctx.restore(); }
  }
  // le débat, dans le chat de la table
  const chatOut = 1 - prog(u, 46.8, 47.1);
  const MSG = [['Sami', 'Wsh pourquoi tu votes contre moi ? 😂', 43.3], ['Inès', 'C’est lui le loup, j’en suis sûre', 44.1], ['Karim', 'Mais vous êtes trop naïfs 💀', 44.9], ['Nora', 'Attendez, j’ai une théorie…', 45.7]];
  const n = MSG.filter((m) => u >= m[2]).length;
  MSG.forEach(([who, msg, u0], j) => {
    if (u < u0) return;
    const slot = n - 1 - j;
    if (slot >= 3) return;
    const push = slot > 0 ? 1 - E.outCubic(prog(u, MSG[j + slot][2], MSG[j + slot][2] + 0.3)) : 0;
    const yy = 1385 - (slot - push) * 118;
    const w = 720, x = j % 2 ? W - 90 - w : 90;
    bubble(ctx, who, msg, x, yy - 108, w, E.outBack(prog(u, u0, u0 + 0.35)) * chatOut, j % 2 === 1);
  });
  // le vote : flèches publiques, puis l'élimination (sans révéler le rôle)
  [[0, 47.2], [2, 47.6], [6, 48], [7, 48.4]].forEach(([from, u0]) => {
    const p = E.outCubic(prog(u, u0, u0 + 0.3)), f = 1 - prog(u, 49.2, 49.6);
    if (p <= 0 || f <= 0) return;
    const [x0, y0] = SEATS[from], [x1, y1] = SEATS[VICTIM];
    const ang = Math.atan2(y1 - y0, x1 - x0), d = Math.hypot(x1 - x0, y1 - y0) - 150;
    const sx = x0 + Math.cos(ang) * 70, sy = y0 + Math.sin(ang) * 70, ex = sx + Math.cos(ang) * d * p, ey = sy + Math.sin(ang) * d * p;
    ctx.save(); ctx.globalAlpha = f; ctx.strokeStyle = C.redL; ctx.fillStyle = C.redL; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.translate(ex, ey); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-18, -14); ctx.lineTo(-18, 14); ctx.closePath(); ctx.fill(); ctx.restore();
  });
  const nv = [47.2, 47.6, 48, 48.4].filter((b) => u >= b + 0.3).length;
  if (nv > 0 && u < 49.6) { const [x, y] = SEATS[VICTIM]; pill(ctx, `${nv} vote${nv > 1 ? 's' : ''}`, x - 150, y + 20, 26, '#fff', C.redL, 1 - prog(u, 49.2, 49.6)); }
  if (u >= 48.9) pill(ctx, 'Yanis est éliminé', W / 2, 1300, 36, C.ivory, 'rgba(142,27,34,0.95)', E.outBack(prog(u, 48.9, 49.2)) * (1 - prog(u, 49.7, 50)), C.gold);
  shade(ctx, 0.85, 0.15);
  tik(ctx, 'Tu rejoins d’autres joueurs…', 340, 66, '#fff', u, 36.6, { out: 38.5 });
  tik(ctx, 'Et là, faut trouver qui ment 😂', 340, 66, C.goldL, u, 38.7, { out: 40.3 });
  if (u >= 40.5 && u < 43.2) words(ctx, 'La nuit tombe… 🌙', W / 2, 340, 64, C.ivory, u, 40.6, { family: D, out: 42.9 });
  if (u >= 43.2 && u < 47) words(ctx, 'Le village débat', W / 2, 340, 64, C.gold, u, 43.2, { family: D, out: 46.8 });
  if (u >= 47) words(ctx, 'Qui est le loup ?', W / 2, 340, 72, '#E25A60', u, 47, { family: D, out: 49.7 });
  stagedTag(ctx, ta);
  vignette(ctx, 0.5);
}

// ---------------------------------------------------------------- E  Dubaï d'abord, puis les 8 autres modes en rafale (u 50..58)
// Tuiles réelles de l'écran des modes (nouvelle version de l'app, assets/v3/modes_00.png).
const TILE = (c, r) => [54 + c * 366, 741 + r * 306, 330, 264];
const OTHERS = [['CLASSIQUE', TILE(0, 0)], ['CHAOS', TILE(1, 0)], ['CAUCHEMAR', TILE(2, 0)], ['MANIPULATION', TILE(0, 1)], ['CAUCHEMAR CHAOS', TILE(1, 1)], ['MANIPULATION CHAOS', TILE(2, 1)], ['CAUCHEMAR MANIPULATION', TILE(0, 2)], ['APOCALYPSE', TILE(1, 2)]];
function sModes(ctx, u, IMG) {
  if (u < 51) {
    // l'écran réel des modes, toucher Dubaï, puis on plonge dans sa tuile
    blurBg(ctx, IMG.c_bg_night, { blur: 24, dark: 0.5, zoom: 1.2 });
    const dive = E.inCubic(prog(u, 50.6, 51));
    const pw = 640, ph = pw * SH / SW, px = W / 2, py = 1125, fx = px - pw / 2 + pw * (951 / SW), fy = py - ph / 2 + ph * (1485 / SH);
    ctx.save(); ctx.translate(fx, fy); ctx.scale(6 ** dive, 6 ** dive); ctx.translate(-fx, -fy);
    phone2(ctx, px, py, pw, (s) => { shot(s, IMG.modes); tap(s, u, 50.45, 951, 1485); }, { glow: 0.4 });
    ctx.restore();
    shade(ctx, 0.8, 0.2);
    tik(ctx, 'Un mode spécial Dubaï 🇦🇪', 340, 70, '#fff', u, 50.1, { out: 50.9 });
    return;
  }
  if (u < 55.85) {
    bgImg(ctx, IMG.d_bg_day, { zoom: 1.3 * (1.08 / 1.3) ** prog(u, 51, 56), dark: 0.15 });
    const flash = 1 - prog(u, 51, 51.35); if (flash > 0) { ctx.fillStyle = `rgba(255,214,150,${0.5 * flash})`; ctx.fillRect(0, 0, W, H); }
    dust(ctx, u, 40, C.goldL, 0.6, 21);
    shade(ctx, 0.75, 0.55);
    words(ctx, 'UN MODE SPÉCIAL', W / 2, 330, 64, C.ivory, u, 51.05, { family: D });
    words(ctx, 'DUBAÏ 🇦🇪', W / 2, 425, 96, C.gold, u, 51.35, { family: D });
    const k = springU(u, 52.9, SPRING.snappy);
    if (k > 0) { ctx.save(); ctx.globalAlpha = clamp(k * 1.5); ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 30; text(ctx, 'EXPATS', W / 2 - 34 - (1 - k) * 300, 1580, font(72, 900, D), C.blue, 'right', 2); text(ctx, 'VS', W / 2, 1572, font(40, 900, D), C.goldL, 'center'); text(ctx, 'ESCROCS', W / 2 + 34 + (1 - k) * 300, 1580, font(72, 900, D), '#E25A60', 'left', 2); ctx.restore(); }
    const DC = [['d_expat', "L'EXPAT", 'EXPATS', C.blue], ['d_escroc', "L'ESCROC", 'ESCROCS', C.redL], ['d_influencer', "L'INFLUENCEUSE", 'EXPATS', C.blue], ['d_millionaire', 'LE MILLIONNAIRE', 'EXPATS', C.blue], ['d_ceo', 'LE CEO', 'EXPATS', C.blue], ['d_charo', 'LE CHARO', 'INDÉPENDANTS', '#B77BE6']];
    DC.forEach(([key, name, camp, col], i) => {
      const u0 = 51.6 + i * 0.5, kk = springU(u, u0 - 0.35, SPRING.snappy); if (kk <= 0) return;
      const x = [W / 2 - 300, W / 2, W / 2 + 300][i % 3], y = [800, 1180][Math.floor(i / 3)] + (1 - kk) * 240;
      card(ctx, IMG[key], x, y, 250, { flip: E.outBack(prog(u, u0, u0 + 0.45), 1.2), alpha: clamp(kk * 2), label: name, sub: camp, subColor: col, glow: bump(u, u0 + 0.2, 0.5) * 0.8, rot: i % 2 ? 0.02 : -0.02 });
    });
    vignette(ctx, 0.5);
    return;
  }
  // + 8 autres modes : chaque tuile réelle passe en plein cadre, un quart de temps chacune
  bgImg(ctx, IMG.c_bg_night, { zoom: 1.2, dark: 0.55 });
  const i = Math.min(7, Math.floor((u - 55.9) / 0.26)), lu = u - 55.9 - i * 0.26;
  if (u >= 55.9) {
    const [name, rect] = OTHERS[i];
    ctx.save(); ctx.filter = 'blur(26px)'; crop(ctx, IMG.modes, rect, -60, -60, W + 120, H + 120); ctx.restore();
    ctx.fillStyle = 'rgba(5,4,3,0.45)'; ctx.fillRect(0, 0, W, H);
    const k = 0.92 + 0.08 * E.outCubic(clamp(lu / 0.12)), tw = 820 * k, th = tw * rect[3] / rect[2];
    ctx.save(); ctx.translate(W / 2, 1000); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 50;
    rrect(ctx, -tw / 2, -th / 2, tw, th, 50); ctx.save(); ctx.clip(); crop(ctx, IMG.modes, rect, -tw / 2, -th / 2, tw, th); ctx.restore();
    ctx.lineWidth = 6; ctx.strokeStyle = C.gold; rrect(ctx, -tw / 2, -th / 2, tw, th, 50); ctx.stroke(); ctx.restore();
    const n = `${i + 2} / 9`;
    text(ctx, n, W / 2, 1450, font(40, 900, D), C.goldL, 'center', 4);
  }
  shade(ctx, 0.75, 0.2);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 30;
  text(ctx, '+ 8 AUTRES MODES', W / 2, 400, font(80, 900, D), C.gold, 'center', 2);
  ctx.restore();
  vignette(ctx, 0.5);
}

// ---------------------------------------------------------------- F  du jeu à la vraie vie (u 58..72)
function irlScreens(s, u, IMG) {
  if (u < 59.1) { shot(s, IMG.H0); tap(s, u, 59, ...TAB.social); return; }
  if (u < 60.6) { navTo(s, IMG.H0, IMG.a_social, prog(u, 59.1, 59.5), 'fade'); return; }
  if (u < 62.6) { navTo(s, IMG.a_social, IMG.s1, E.inOutCubic(prog(u, 60.6, 61.1)), 'fade'); tap(s, u, 61.5, 849, 1398); tap(s, u, 62.5, 585, 2151);
    const ok = prog(u, 61.55, 61.7); if (ok > 0) { s.save(); s.globalAlpha = ok; rrect(s, 650, 1340, 400, 116, 58); s.fillStyle = '#2E7D4F'; s.fill(); text(s, 'Partant·e ✓', 850, 1418, font(44, 800, UI), '#fff', 'center'); s.restore(); } return; }
  if (u < 65.4) { navTo(s, IMG.s1, IMG.cr, prog(u, 62.6, 63.0), 'sheet'); tap(s, u, 63.6, 508, 1422); tap(s, u, 64.1, 811, 1557); tap(s, u, 64.7, 584, 2365); return; }
  navTo(s, IMG.m_classique, IMG.ct, prog(u, 65.4, 65.8), 'sheet'); tap(s, u, 66.2, 777, 1600); tap(s, u, 66.9, 585, 2302);
}
function sIrl(ctx, u, IMG) {
  blurBg(ctx, IMG.f6, { blur: 30, dark: 0.5, zoom: 1.25 });
  const rot = E.inOutCubic(prog(u, 67.4, 68.3));
  const k = springU(u, 57.5, SPRING.gentle);
  if (rot < 0.5) {
    phone2(ctx, W / 2, lerp(H * 1.2, 1125, k), 640, (s) => irlScreens(s, u, IMG), { rotY: rot * Math.PI, tilt: -0.02 });
  } else {
    const pk = E.outCubic(prog(u, 67.9, 68.4)), sx = Math.abs(Math.cos(rot * Math.PI));
    const fw = lerp(640, 900, pk), fh = fw * lerp(2.16, 1.45, pk), cy = lerp(1060, 1010, pk);
    ctx.save(); ctx.translate(W / 2, cy); ctx.scale(Math.max(0.02, sx), 1);
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 60; rrect(ctx, -fw / 2 - 12, -fh / 2 - 12, fw + 24, fh + 24, 30); ctx.fillStyle = C.gold; ctx.fill(); ctx.shadowColor = 'transparent';
    if (IMG.irl) cover(ctx, IMG.irl, -fw / 2, -fh / 2, fw, fh, { radius: 22, zoom: 1.04 * (1.16 / 1.04) ** prog(u, 68, 72), fy: 0.62 });
    ctx.restore();
    if (pk >= 1) { ctx.save(); ctx.globalAlpha = 0.85; text(ctx, 'Photo d’illustration', W / 2 + fw / 2 - 10, cy + fh / 2 + 48, font(22, 700, UI), C.muted, 'right', 1); ctx.restore(); }
  }
  if (rot < 0.5) faceCloud(ctx, u, IMG, 58.6, 67.4, 2);
  shade(ctx, 0.85, 0.45);
  tik(ctx, 'Et le meilleur ? 👀', 340, 76, '#fff', u, 58.1, { out: 59.4 });
  tik(ctx, 'Tu peux aussi organiser', 310, 64, '#fff', u, 59.6, { out: 62.0 });
  tik(ctx, 'une partie dans la vraie vie.', 392, 64, IRLY.steel, u, 60.1, { out: 62.0 });
  tik(ctx, 'Avec des gens que t’as', 310, 64, '#fff', u, 62.2, { out: 67.2 });
  tik(ctx, 'rencontrés sur IRLY.', 392, 64, C.goldL, u, 62.7, { out: 67.2 });
  const cap = u < 59.1 ? '' : u < 60.6 ? 'Social · des gens comme toi' : u < 62.6 ? 'Activités · inscris-toi en un clic' : u < 65.4 ? 'Lancer une activité' : 'Loup-Garou · table en présentiel (QR code)';
  const ca = prog(u, 59.2, 59.5) * (1 - prog(u, 67.2, 67.5));
  if (false && cap && ca > 0) { ctx.save(); ctx.globalAlpha = ca; pill(ctx, cap, W / 2, 1745, 30, '#fff', 'rgba(255,255,255,0.12)', 1, 'rgba(255,255,255,0.3)'); ctx.restore(); }
  if (u >= 68.2) { tik(ctx, 'Même jeu. Même suspense.', 330, 64, '#fff', u, 68.4); tik(ctx, 'Encore plus de rencontres.', 412, 64, C.goldL, u, 69.2); }
  vignette(ctx, 0.45);
}

// ---------------------------------------------------------------- G  conclusion (u 72..80)
function sEnd(ctx, u, IMG) {
  if (u < 75) {
    blurBg(ctx, IMG.f6, { blur: 30, dark: 0.55, zoom: 1.25 });
    const screens = ['a_discover', 's1', 'modes', 'a_social', 'H1'];
    const pos = lerp(0.2, 3.4, E.inOutCubic(prog(u, 71.6, 75)));
    screens.map((k, i) => [k, i - pos]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).forEach(([k, d]) => {
      const x = W / 2 + d * 330, sc = 1 - Math.min(0.35, Math.abs(d) * 0.18);
      phone2(ctx, x, 1060, 470 * sc, (s) => shot(s, IMG[k]), { rotY: clamp(d * 0.5, -1.2, 1.2) * 0.6, alpha: 1 - Math.min(0.6, Math.abs(d) * 0.25) });
    });
    shade(ctx, 0.85, 0.3);
    tik(ctx, 'Marre de scroller sans rien faire ?', 330, 64, '#fff', u, 72.2, { out: 74.8 });
    tik(ctx, 'Trouve ton prochain groupe sur IRLY.', 1600, 52, IRLY.steel, u, 73.4, { out: 74.8 });
    vignette(ctx, 0.45);
    return;
  }
  bgImg(ctx, IMG.d_bg_victory, { zoom: 1.18 * (1.04 / 1.18) ** E.outCubic(prog(u, 75, 80)), fy: 0.45, dark: 0.4 });
  dust(ctx, u, 70, C.goldL, 0.8, 41);
  shade(ctx, 0.6, 0.85);
  const lk = springU(u, 75, SPRING.bouncy);
  if (IMG.logo && lk > 0) { const lw = 560, lh = lw * IMG.logo.height / IMG.logo.width; ctx.save(); ctx.translate(W / 2, 560); ctx.scale(0.6 + 0.4 * lk, 0.6 + 0.4 * lk); ctx.globalAlpha = clamp(lk * 1.4); ctx.shadowColor = hexA(C.gold, 0.5 + 0.3 * bump(u, 75.5, 0.6)); ctx.shadowBlur = 60; ctx.drawImage(IMG.logo, -lw / 2, -lh / 2, lw, lh); ctx.restore(); }
  words(ctx, 'MAKE FRIENDS IRL', W / 2, 745, 40, C.goldL, u, 75.5, { step: 0.1, weight: 800, family: UI, track: 0.18 });
  tik(ctx, 'IRLY ARRIVE TRÈS BIENTÔT', 900, 64, '#fff', u, 75.6, { step: 0.12 });
  words(ctx, 'À DUBAÏ 🇦🇪', W / 2, 1010, 104, C.gold, u, 76.1, { step: 0.12 });
  const ck = springU(u, 75, SPRING.gentle);
  card(ctx, IMG.c_werewolf, lerp(-200, 210, ck), 1360, 300, { rot: -0.14, glow: 0.4, alpha: 0.95 });
  card(ctx, IMG.d_escroc, lerp(W + 200, W - 210, ck), 1360, 300, { rot: 0.14, glow: 0.4, alpha: 0.95 });
  const cp = E.outBack(prog(u, 77, 77.5));
  if (cp > 0) { ctx.save(); ctx.translate(W / 2, 1300); ctx.scale(cp, cp); pill(ctx, 'Suis-nous pour le lancement 👀', 0, 0, 40, C.black, C.gold, 1, null, UI, 800); ctx.restore(); }
  vignette(ctx, 0.45);
}

M.film({
  fonts: [font(100, 900, D), font(100, 700, D), font(40, 800, UI), font(40, 700, UI)],
  images: {
    ...Object.fromEntries(['bg_night', 'bg_day', 'bg_chaos', 'bg_nightmare', 'bg_powers', 'bg_victory', 'werewolf', 'seer'].map((k) => ['c_' + k, `assets/art/c_${k}.webp`])),
    ...Object.fromEntries(['bg_day', 'bg_victory', 'expat', 'escroc', 'influencer', 'ceo', 'millionaire', 'charo'].map((k) => ['d_' + k, `assets/art/d_${k}.webp`])),
    ...Object.fromEntries(['m_classique', 'm_chaos', 'm_manipulation', 'm_apocalypse', 'm_dubai'].map((k) => [k, `assets/v3/${k}.png`])), modes: 'assets/v3/modes_00.png',
    ...Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => ['f' + i, `assets/feed/${i}.webp`])),
    ...Object.fromEntries(FACES.map((n, i) => ['face' + i, `assets/faces/${n}.jpg`])),
    ...Object.fromEntries(PLAYERS.map((_, i) => ['p' + (i + 1), `assets/players/p${i + 1}.jpg`])),
    a_social: 'assets/real/social_00.png', a_discover: 'assets/real/discover.png',
    H0: 'assets/real/home_00.png', H1: 'assets/real/home_01.png', H2: 'assets/real/home_02.png', H3: 'assets/real/home_03.png', ct: 'assets/games_path/create_table.png',
    s1: 'assets/real/social_01.png', cr: 'assets/real/create.png',
    irl: 'assets/irl/photo.jpg', irlFallback: 'assets/irl/photo_illustration.webp',
    logo: 'assets/irly_wordmark_ivory.png', logoW: 'assets/irly_wordmark.png',
  },
  hits: HITS,
  samples: 4,
  init(ctx, IMG) { if (!IMG.irl) IMG.irl = IMG.irlFallback; },
  draw(ctx, u, t, IMG) {
    if (u < 14) sBored(ctx, u, IMG);
    else if (u < 23) sIrly(ctx, u, IMG);
    else if (u < 34) sAccess(ctx, u, IMG);
    else if (u < 50) sGame(ctx, u, IMG);
    else if (u < 58) sModes(ctx, u, IMG);
    else if (u < 72) sIrl(ctx, u, IMG);
    else sEnd(ctx, u, IMG);
  },
  post(ctx, u) {
    ctx.save(); ctx.globalAlpha = 0.04;
    for (let i = 0; i < 220; i++) { const x = hash01(i + Math.floor(u * 96) * 997, 3) * W, y = hash01(i + Math.floor(u * 96) * 991, 7) * H; ctx.fillStyle = i % 2 ? '#fff' : '#000'; ctx.fillRect(x, y, 3, 3); }
    ctx.restore();
  },
});
