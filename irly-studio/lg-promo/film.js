// IRLY Loup-Garou : publicité 45 s, 9:16. Fonction pure du temps : window.seek(t) peint l'image t.
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

// ---------------------------------------------------------------- accents (son + image)
const HITS = [
  [4, 'loup', 'impact'],
  [5, 'griffure 1', 'whoosh', { len: 0.25, from: 5000, to: 1500 }],
  [5.35, 'griffure 2', 'whoosh', { len: 0.25, from: 5000, to: 1500, pan: -0.4 }],
  [5.7, 'griffure 3', 'whoosh', { len: 0.25, from: 5000, to: 1500, pan: 0.4 }],
  [8, 'arrive', 'impact'],
  [14, 'bouton jouer', 'tick'],
  [15.5, 'plongée', 'whoosh', { len: 0.5, from: 500, to: 3000 }],
  [16, 'salon', 'thud'],
  ...PLAYERS.slice(0, 7).map((_, i) => [16.1 + i * 0.22, 'joueur ' + (i + 1), 'pop', { pitch: ['D5', 'F5', 'A5', 'C6', 'D6', 'E6', 'F6'][i] }]),
  [18.2, 'chat 1', 'blip', { pitch: 'A5' }],
  [19.2, 'chat 2', 'blip', { pitch: 'C6' }],
  [20.2, 'chat 3', 'blip', { pitch: 'E6' }],
  [21, 'carte secrète', 'whoosh', { len: 0.35, from: 800, to: 2400 }],
  [22, 'vote 1', 'tick'], [22.4, 'vote 2', 'tick'], [22.8, 'vote 3', 'tick'], [23.1, 'vote 4', 'tick'],
  [23.4, 'éliminé', 'thud'],
  [24, 'modes', 'impact'],
  [26, 'classique', 'whoosh', { len: 0.4, from: 2400, to: 600 }],
  [28, 'chaos', 'whoosh', { len: 0.4, from: 600, to: 2400 }],
  [30, 'cauchemar', 'sub', { len: 0.8 }],
  [32, 'tous pouvoirs', 'whoosh', { len: 0.4, from: 2400, to: 600 }],
  [34, 'chaque partie', 'click'],
  [36, 'dubai', 'impact'],
  [40, 'expats vs escrocs', 'thud'],
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => [40.5 + i * 0.6, 'carte ' + (i + 1), 'click']),
  [44, 'influence', 'tok', { pitch: 'D5' }], [45, 'business', 'tok', { pitch: 'F5' }], [46, 'manipulation', 'tok', { pitch: 'A5' }], [47, 'trahison', 'thud'],
  [48, 'mystère', 'sub', { len: 1.2 }],
  [52, 'sur irly', 'thud'],
  [55, 'bouton', 'tick'],
  [56, 'téléphone tourne', 'whoosh', { len: 0.6, from: 400, to: 3200 }],
  [57, 'vraie vie', 'bell', { pitch: 'A5' }],
  [60, 'même jeu', 'pop', { pitch: 'D6' }],
  [64, 'logo', 'impact'],
  [64.5, 'logo brille', 'bell', { pitch: 'D6' }],
  [66.5, 'joue rencontre partage', 'click'],
  [68.5, 'appel', 'pop', { pitch: 'A5' }],
];

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

// ---------------------------------------------------------------- S1 nuit (u 0..8)
function sNight(ctx, u, IMG) {
  fill(ctx, '#000');
  const rev = E.inOutCubic(prog(u, 0.2, 3.6));
  const z = 1.25 * (1.06 / 1.25) ** prog(u, 0, 8);
  ctx.save(); shake(ctx, u, 4, 26, 3, 0.25);
  bgImg(ctx, IMG.c_bg_night, { zoom: z, fy: 0.55, alpha: rev, dark: 0.05 });
  moon(ctx, W * 0.62, H * 0.2, 120, E.outCubic(prog(u, 0.1, 1.4)), '#F3EBD6', 0.9);
  fog(ctx, u, 0.45 * rev, 1, 0.5);
  // le loup surgit devant la lune (illustration officielle de la carte Loup-Garou)
  const k = springU(u, 3.75, SPRING.gentle);
  if (k > 0) {
    const w = 720, h = 960, y = lerp(H * 0.95, H * 0.47, k);
    ctx.save(); ctx.globalAlpha = clamp(k * 1.4);
    const g = ctx.createRadialGradient(W / 2, y, 100, W / 2, y, 560);
    ctx.drawImage(IMG.wolfSoft, W / 2 - w * 0.65, y - h * 0.65, w * 1.3, h * 1.3);
    void g; ctx.restore();
  }
  ctx.restore();
  shade(ctx, 0.75, 0.55);
  words(ctx, 'ET SI TON PROCHAIN', W / 2, 395, 76, C.ivory, u, 0.6, { step: 0.28 });
  words(ctx, 'LOUP-GAROU', W / 2, 500, 118, C.gold, u, 1.8, { step: 0.2 });
  words(ctx, 'SE JOUAIT À DUBAÏ ?', W / 2, 1380, 84, C.ivory, u, 2.6, { step: 0.28 });
  claw(ctx, u, 5.0, W * 0.12, H * 0.30, W * 0.78, H * 0.62, 26);
  claw(ctx, u, 5.35, W * 0.24, H * 0.27, W * 0.9, H * 0.58, 30);
  claw(ctx, u, 5.7, W * 0.06, H * 0.36, W * 0.66, H * 0.68, 22);
  vignette(ctx, 0.65);
  // sortie : la lumière se ferme vers le centre
  const o = prog(u, 7.4, 8);
  if (o > 0) { ctx.fillStyle = `rgba(0,0,0,${E.inCubic(o)})`; ctx.fillRect(0, 0, W, H); }
}

// ---------------------------------------------------------------- S2 l'app (u 8..16)
function sApp(ctx, u, IMG) {
  const z = 1.12 * (1.0 / 1.12) ** prog(u, 8, 16);
  bgImg(ctx, IMG.c_bg_night, { zoom: z * 1.15, fy: 0.4, dark: 0.4 });
  moon(ctx, W * 0.78, H * 0.13, 70, 0.8);
  dust(ctx, u, 30, C.goldL, 0.5);
  const k = springU(u, 8, SPRING.gentle);
  // plongée finale dans le bouton « Jouer en ligne » : zoom log vers le bouton
  const dive = E.inCubic(prog(u, 15.2, 16));
  const pw = 560 * (1 + 0.0 * dive);
  const tilt = lerp(-0.06, 0.0, E.outCubic(prog(u, 8, 11)));
  const cy = lerp(H * 1.1, 1060, k);
  ctx.save();
  if (dive > 0) { const s = 1 * (6 / 1) ** dive; const bx = W / 2 - pw / 2 + pw * (328 / 1170), by = cy - pw * 2.164 / 2 + pw * 2.164 * (2354 / 2532); ctx.translate(bx, by); ctx.scale(s, s); ctx.translate(-bx, -by); }
  phone(ctx, IMG.mode_classique, W / 2, cy, pw, { rotY: lerp(0.5, 0, k), tilt, glow: bump(u, 14.2, 0.8) });
  // le bouton réel s'active : halo doré qui pulse sur le bouton de l'écran
  const a = prog(u, 13.6, 14) * (1 - prog(u, 15.6, 16));
  if (a > 0) {
    const bx = W / 2 - pw / 2 + pw * (48 / 1170), by = cy - pw * 2.164 / 2 + pw * 2.164 * (2272 / 2532), bw = pw * (560 / 1170), bh = pw * 2.164 * (164 / 2532);
    const pulse = 1 + 0.08 * Math.sin((u - 14) * TAU * 1.2);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(bx + bw / 2, by + bh / 2); ctx.scale(pulse, pulse);
    ctx.shadowColor = C.gold; ctx.shadowBlur = 40; ctx.lineWidth = 5; ctx.strokeStyle = C.goldL; rrect(ctx, -bw / 2 - 6, -bh / 2 - 6, bw + 12, bh + 12, bh / 2); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  shade(ctx, 0.85, 0.3);
  words(ctx, 'IRLY LOUP-GAROU', W / 2, 360, 92, C.gold, u, 8.1, { step: 0.15, out: 10.8 });
  words(ctx, 'ARRIVE !', W / 2, 470, 92, C.ivory, u, 8.5, { step: 0.15, out: 10.8 });
  words(ctx, 'Le jeu de stratégie,', W / 2, 365, 66, C.ivory, u, 11.1, { step: 0.12, weight: 700 });
  words(ctx, 'de bluff et de trahison…', W / 2, 450, 66, C.gold, u, 11.7, { step: 0.12, weight: 700 });
  vignette(ctx, 0.55);
}

// ---------------------------------------------------------------- S3 la partie, mise en scène (u 16..24)
const SEATS = PLAYERS.map((_, i) => { const a = -Math.PI / 2 + (i / PLAYERS.length) * TAU; return [W / 2 + Math.cos(a) * 300, 840 + Math.sin(a) * 250]; });
function sGame(ctx, u, IMG) {
  const enter = 1 - E.outCubic(prog(u, 16, 16.6));
  bgImg(ctx, IMG.c_bg_day, { zoom: 1.1 + 0.06 * prog(u, 16, 24) + enter * 0.6, fy: 0.5, dark: 0.62 });
  dust(ctx, u, 20, C.goldL, 0.4, 8);
  // table
  ctx.save(); ctx.globalAlpha = E.outCubic(prog(u, 16, 16.6));
  const g = ctx.createRadialGradient(W / 2, 840, 40, W / 2, 840, 360); g.addColorStop(0, 'rgba(226,182,83,0.18)'); g.addColorStop(1, 'rgba(226,182,83,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 400, W, 900);
  ctx.lineWidth = 2; ctx.strokeStyle = hexA(C.gold, 0.35); ctx.beginPath(); ctx.ellipse(W / 2, 840, 300, 250, 0, 0, TAU); ctx.stroke();
  ctx.restore();
  // phase + chronomètre (au centre de la table)
  const phase = u < 21.8 ? 'JOUR · DÉBAT' : 'VOTE';
  const tAll = u < 21.8 ? 150 : 60, t0 = u < 21.8 ? 16.5 : 21.8;
  const left = Math.max(0, Math.round(tAll - (u - t0) * 0.625 * (u < 21.8 ? 6 : 8)));
  const ca = E.outCubic(prog(u, 16.4, 16.9));
  if (ca > 0) {
    ctx.save(); ctx.globalAlpha = ca;
    ctx.lineWidth = 8; ctx.strokeStyle = hexA(C.gold, 0.25); ctx.beginPath(); ctx.arc(W / 2, 840, 92, 0, TAU); ctx.stroke();
    ctx.strokeStyle = phase === 'VOTE' ? C.redL : C.gold; ctx.beginPath(); ctx.arc(W / 2, 840, 92, -Math.PI / 2, -Math.PI / 2 + TAU * (left / tAll)); ctx.stroke();
    text(ctx, `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, W / 2, 858, font(50, 800, UI), C.ivory, 'center');
    text(ctx, phase, W / 2, 790 - 40, font(24, 900, D), phase === 'VOTE' ? C.redL : C.gold, 'center', 3);
    ctx.restore();
  }
  // joueurs qui rejoignent la table
  const victim = 3;
  PLAYERS.forEach((name, i) => {
    const u0 = i === 7 ? 15.9 : 16.1 + i * 0.22;
    const k = springU(u, u0, SPRING.bouncy);
    if (k <= 0) return;
    const [x, y] = SEATS[i];
    const dead = i === victim ? E.outCubic(prog(u, 23.4, 23.7)) : 0;
    avatar(ctx, IMG, i, x, y, 58 * k, { a: clamp(k * 2), dead, you: i === 7 });
    text(ctx, name, x, y + 98, font(28, 800, UI), i === 7 ? C.goldL : C.ivory, 'center');
    // votes publics : flèches vers le joueur visé
  });
  [[0, 22], [2, 22.4], [5, 22.8], [7, 23.1]].forEach(([from, u0]) => {
    const p = E.outCubic(prog(u, u0, u0 + 0.3)), f = 1 - prog(u, 23.6, 24);
    if (p <= 0 || f <= 0) return;
    const [x0, y0] = SEATS[from], [x1, y1] = SEATS[victim];
    const ang = Math.atan2(y1 - y0, x1 - x0), d = Math.hypot(x1 - x0, y1 - y0) - 80;
    const sx = x0 + Math.cos(ang) * 70, sy = y0 + Math.sin(ang) * 70;
    const ex = sx + Math.cos(ang) * (d - 70) * p, ey = sy + Math.sin(ang) * (d - 70) * p;
    ctx.save(); ctx.globalAlpha = f; ctx.strokeStyle = C.redL; ctx.fillStyle = C.redL; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.translate(ex, ey); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-18, -14); ctx.lineTo(-18, 14); ctx.closePath(); ctx.fill();
    ctx.restore();
  });
  // compteur de votes sur la cible
  const nv = [22, 22.4, 22.8, 23.1].filter((b) => u >= b + 0.3).length;
  if (nv > 0 && u < 24) { const [x, y] = SEATS[victim]; pill(ctx, `${nv} vote${nv > 1 ? 's' : ''}`, x + 70, y - 70, 24, '#FFF', C.redL, 1 - prog(u, 23.6, 24)); }
  // chat de la table (jour : seuls les vivants, visible de tous)
  bubble(ctx, 'Sami', 'Pourquoi tu votes toujours contre moi ?', 90, 1150, 840, E.outBack(prog(u, 18.2, 18.6)) * (1 - prog(u, 20.8, 21.1)));
  bubble(ctx, 'Inès', 'Je suis sûre que c’est toi le loup !', 150, 1270, 780, E.outBack(prog(u, 19.2, 19.6)) * (1 - prog(u, 20.8, 21.1)), true);
  bubble(ctx, 'Karim', 'On va voir ça ce soir…', 90, 1390, 620, E.outBack(prog(u, 20.2, 20.6)) * (1 - prog(u, 20.8, 21.1)));
  // ta carte secrète : seulement sur ton écran
  const sc = prog(u, 21, 21.3) * (1 - prog(u, 23.3, 23.7));
  if (sc > 0) {
    const flip = E.outCubic(prog(u, 21, 21.6));
    card(ctx, IMG.c_seer, W - 230, 1300, 250, { flip, alpha: sc, glow: 0.6, label: 'VOYANTE', sub: 'TA CARTE', subColor: C.blue, rot: 0.05 });
    if (flip > 0.9) text(ctx, 'Toi seul la vois', W - 230, 1510, font(26, 800, UI), C.goldL, 'center');
  }
  if (u >= 23.4) { const [x, y] = SEATS[victim]; pill(ctx, 'Yanis est éliminé', W / 2, 1210, 34, C.ivory, 'rgba(142,27,34,0.95)', E.outBack(prog(u, 23.4, 23.7)) * (1 - prog(u, 23.85, 24)), C.gold); void x; void y; }
  shade(ctx, 0.85, 0.2);
  words(ctx, 'Crée ton salon. Invite tes amis.', W / 2, 345, 60, C.ivory, u, 16.2, { step: 0.12, weight: 700, maxW: 900 });
  words(ctx, 'Trouve les imposteurs.', W / 2, 425, 60, C.gold, u, 17.4, { step: 0.12, weight: 900 });
  stagedTag(ctx, E.outCubic(prog(u, 16.2, 16.6)));
  vignette(ctx, 0.5);
}

// ---------------------------------------------------------------- S4 les modes (u 24..36)
const MODES = [
  { u: 26, bg: 'c_bg_night', shot: 'mode_classique', name: 'CLASSIQUE', line: 'Le village contre les loups-garous.' },
  { u: 28, bg: 'c_bg_chaos', shot: 'mode_chaos', name: 'CHAOS', line: 'Personne ne sait quelles cartes sont en jeu.' },
  { u: 30, bg: 'c_bg_nightmare', shot: 'mode_cauchemar', name: 'CAUCHEMAR', line: 'Un loup de plus. Pas de Voyante.' },
  { u: 32, bg: 'c_bg_powers', shot: 'mode_pouvoirs', name: 'TOUS POUVOIRS', line: 'Tout le monde a un pouvoir.' },
];
function sModes(ctx, u, IMG) {
  if (u < 26) {
    // titre plein cadre sur les cartes qui défilent
    bgImg(ctx, IMG.c_bg_victory, { zoom: 1.2, dark: 0.7 });
    const deck = ['c_werewolf', 'c_seer', 'c_witch', 'c_hunter', 'c_cupid', 'c_thief', 'c_elder', 'c_little_girl', 'c_salvateur', 'c_villager'];
    deck.forEach((k, i) => {
      const p = springU(u, 24 + i * 0.08, SPRING.snappy);
      const a = (i - 4.5) * 0.11, R = 1400;
      const x = W / 2 + Math.sin(a) * R * p * 0.55, y = 1320 + R - Math.cos(a) * R * (0.6 + 0.4 * p);
      card(ctx, IMG[k], x, y, 230, { rot: a * p, flip: 1, alpha: clamp(p * 2) });
    });
    shade(ctx, 0.6, 0);
    words(ctx, '5 MODES.', W / 2, 520, 130, C.gold, u, 24.05, { step: 0.12 });
    words(ctx, '30 PERSONNAGES.', W / 2, 650, 96, C.ivory, u, 24.5, { step: 0.12 });
    vignette(ctx, 0.5);
    return;
  }
  const i = Math.min(3, Math.floor((u - 26) / 2)), m = MODES[i];
  const lu = u - m.u;
  // fond du mode (illustration officielle), poussée lente
  bgImg(ctx, IMG[m.bg], { zoom: 1.08 * (1.18 / 1.08) ** clamp(lu / 2), dark: 0.1 });
  if (m.name === 'CAUCHEMAR') { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(160,20,30,${0.5 * E.outCubic(prog(lu, 0, 0.6))})`; ctx.fillRect(0, 0, W, H); ctx.restore(); moon(ctx, W * 0.72, H * 0.16, 90, E.outCubic(prog(lu, 0, 0.8)), '#D2424A', 1); }
  if (m.name === 'CLASSIQUE') { moon(ctx, W * 0.7, H * 0.15, 90, 1); fog(ctx, u, 0.4, 3, 0.6); }
  if (m.name === 'TOUS POUVOIRS') dust(ctx, u, 60, '#C9A2FF', 0.7, 12);
  shade(ctx, 0.75, 0.55);
  // l'écran réel du mode dans le téléphone, qui glisse depuis le côté (whip)
  const dir = i % 2 ? -1 : 1;
  const k = springU(u, m.u - 0.4, SPRING.snappy), kout = E.inCubic(prog(lu, 1.75, 2));
  const px = W / 2 + 120 * dir + (1 - k) * W * dir - kout * W * dir * (i < 3 ? 1 : 0);
  phone(ctx, IMG[m.shot], px, 1090, 440, { tilt: 0.06 * dir, rotY: (1 - k) * 0.6 });
  // effets propres aux modes
  if (m.name === 'CHAOS') {
    ['c_thief', 'c_werewolf', 'c_elder'].forEach((kk, j) => {
      const a = lu * 2.4 + j * TAU / 3, r = 230;
      card(ctx, IMG[kk], W / 2 - 200 * dir + Math.cos(a) * r * 0.5, 1100 + Math.sin(a) * r * 0.35, 190, { flip: 0.5 + 0.5 * Math.cos(lu * 5 + j * 2), rot: Math.sin(a) * 0.25, alpha: E.outCubic(prog(lu, 0, 0.4)) });
    });
  } else if (m.name === 'TOUS POUVOIRS') {
    ['c_seer', 'c_witch', 'c_hunter', 'c_cupid'].forEach((kk, j) => {
      const p = springU(lu, 0.15 + j * 0.12, SPRING.bouncy);
      card(ctx, IMG[kk], W / 2 + 200 + (j - 1.5) * 70, 1180 - j * 18, 200, { rot: (j - 1.5) * 0.14 * p, alpha: clamp(p * 2), lift: p * 40 });
    });
  } else if (m.name === 'CLASSIQUE') {
    card(ctx, IMG.c_werewolf, W / 2 - 230, 1180, 250, { flip: E.outCubic(prog(lu, -0.2, 0.4)), rot: -0.08, glow: 0.4 });
  } else {
    card(ctx, IMG.c_hunter, W / 2 + 230, 1180, 250, { flip: E.outCubic(prog(lu, -0.2, 0.4)), rot: 0.08, glow: 0.4 });
  }
  // nom du mode
  ctx.save();
  const nk = springU(u, m.u - 0.3, SPRING.snappy);
  text(ctx, 'MODE', W / 2, 330, font(34, 900, D), C.goldL, 'center', 10);
  const size = m.name.length > 10 ? 104 : 128;
  ctx.globalAlpha = clamp(nk * 1.5); ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 40;
  text(ctx, m.name, W / 2 + (1 - nk) * 160 * dir, 460, font(size, 900, D), m.name === 'CAUCHEMAR' ? '#E25A60' : C.gold, 'center', 2);
  ctx.restore();
  words(ctx, m.line, W / 2, 545, 44, C.ivory, u, m.u - 0.1, { step: 0.06, weight: 700, family: UI });
  if (u >= 34) {
    // « Chaque partie est différente. »
    ctx.fillStyle = `rgba(5,4,3,${0.55 * prog(u, 34, 34.4)})`; ctx.fillRect(0, 0, W, H);
    words(ctx, 'Chaque partie', W / 2, 900, 100, C.ivory, u, 34, { step: 0.15 });
    words(ctx, 'est différente.', W / 2, 1010, 100, C.gold, u, 34.4, { step: 0.15 });
  }
  vignette(ctx, 0.55);
}

// ---------------------------------------------------------------- S5 Dubaï (u 36..52)
const DCARDS = [['d_expat', "L'EXPAT", 'Expats', '#8FB2FF'], ['d_escroc', "L'ESCROC", 'Escrocs', '#C9343C'], ['d_influencer', "L'INFLUENCEUSE", 'Expats', '#8FB2FF'], ['d_ceo', 'LE CEO', 'Expats', '#8FB2FF'], ['d_millionaire', 'LE MILLIONNAIRE', 'Expats', '#8FB2FF'], ['d_emirati', "L'ÉMIRATI", 'Expats', '#8FB2FF'], ['d_golden_visa', 'GOLDEN VISA', 'Expats', '#8FB2FF'], ['d_charo', 'LE CHARO', 'Indépendants', '#B77BE6']];
function sDubai(ctx, u, IMG) {
  // la lune devient soleil couchant, le village devient la skyline
  const tr = E.inOutCubic(prog(u, 35.4, 37.2));
  if (tr < 1) bgImg(ctx, IMG.c_bg_night, { zoom: 1.15, dark: 0.35 });
  bgImg(ctx, IMG.d_bg_day, { zoom: 1.22 * (1.05 / 1.22) ** prog(u, 36, 44), fy: 0.45, alpha: tr });
  const mx = lerp(W * 0.7, W * 0.5, tr), my = lerp(H * 0.15, H * 0.36, tr);
  if (u < 40) moon(ctx, mx, my, lerp(90, 150, tr), (1 - prog(u, 38, 40)) * (u < 37.2 ? 1 : 0.9), mix('#F3EBD6', '#FFB25A', tr), 1 + tr);
  const flashD = bump(u, 36, 0.35); if (flashD > 0) { ctx.fillStyle = `rgba(255,214,150,${0.35 * flashD})`; ctx.fillRect(0, 0, W, H); }
  if (u < 40) {
    shade(ctx, 0.7, 0.6);
    words(ctx, 'ET UN MODE', W / 2, 420, 92, C.ivory, u, 36.3, { step: 0.15, out: 39.6 });
    words(ctx, 'EXCLUSIF DUBAÏ', W / 2, 530, 104, C.gold, u, 36.8, { step: 0.15, out: 39.6 });
    // l'écran réel du mode Dubaï
    const k = springU(u, 37.4, SPRING.gentle), ko = E.inCubic(prog(u, 39.4, 40));
    phone(ctx, IMG.mode_dubai, W / 2, lerp(H * 1.3, 1180, k) + ko * 900, 470, { tilt: -0.04, rotY: (1 - k) * -0.4 });
    vignette(ctx, 0.5);
    return;
  }
  // nuit sur Dubaï pour les cartes
  const night = E.inOutCubic(prog(u, 40, 41));
  bgImg(ctx, IMG.d_bg_night, { zoom: 1.12, alpha: night, dark: 0.25 });
  dust(ctx, u, 50, C.goldL, 0.7, 21);
  shade(ctx, 0.75, 0.7);
  // « EXPATS VS ESCROCS »
  if (u < 48) {
    const k = springU(u, 40, SPRING.snappy), out = prog(u, 47.6, 48);
    ctx.save(); ctx.globalAlpha = clamp(k * 1.5) * (1 - out); ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 30;
    text(ctx, 'EXPATS', W / 2 - 40 - (1 - k) * 400, 400, font(78, 900, D), C.blue, 'right', 2);
    text(ctx, 'VS', W / 2, 392, font(44, 900, D), C.goldL, 'center');
    text(ctx, 'ESCROCS', W / 2 + 40 + (1 - k) * 400, 400, font(78, 900, D), '#E25A60', 'left', 2);
    ctx.restore();
  }
  // 8 cartes, retournées une à une (illustrations officielles du mode Dubaï)
  const cw = 228, gx = [W / 2 - 375, W / 2 - 125, W / 2 + 125, W / 2 + 375], gy = [790, 1150];
  const fade = 1 - E.inCubic(prog(u, 47.6, 48.4));
  DCARDS.forEach(([key, name, camp, col], i) => {
    const u0 = 40.5 + i * 0.6;
    const k = springU(u, u0 - 0.35, SPRING.snappy);
    if (k <= 0) return;
    const x = gx[i % 4], y = gy[Math.floor(i / 4)] + (1 - k) * 260;
    const flip = E.outBack(prog(u, u0, u0 + 0.45), 1.2);
    const focus = key === 'd_escroc' && u > 48 ? 1 : 0;
    card(ctx, IMG[key], x, y, cw, { flip, alpha: clamp(k * 2) * (focus ? 1 : fade), label: name, sub: camp.toUpperCase(), subColor: col, glow: bump(u, u0 + 0.2, 0.5) * 0.8, rot: (i % 2 ? 0.02 : -0.02) });
  });
  // mots au rythme
  if (u >= 44 && u < 48) {
    const ws = ['Influence.', 'Business.', 'Manipulation.', 'Trahison.'];
    ws.forEach((w, j) => {
      const q = prog(u, 44 + j, 44.25 + j), p = E.outBack(q), o = j < 3 ? 1 - prog(u, 44.6 + j, 44.85 + j) : 1 - prog(u, 47.6, 48);
      if (q <= 0 || o <= 0) return;
      ctx.save(); ctx.globalAlpha = o; ctx.translate(W / 2, 1430); ctx.scale(0.7 + 0.3 * p, 0.7 + 0.3 * p);
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 30;
      const fs = Math.min(88, M.fitSize(ctx, w, 900, D, 860, 88)); text(ctx, w, 0, 0, font(fs, 900, D), j === 3 ? '#E25A60' : C.goldL, 'center', 2); ctx.restore();
    });
  }
  // un personnage mystérieux s'avance : l'Escroc, dans l'ombre
  if (u >= 47.6) {
    const k = springU(u, 47.8, SPRING.gentle);
    ctx.fillStyle = `rgba(5,2,2,${0.6 * k})`; ctx.fillRect(0, 0, W, H);
    const red = ctx.createRadialGradient(W / 2, 900, 50, W / 2, 900, 700); red.addColorStop(0, `rgba(142,27,34,${0.55 * k})`); red.addColorStop(1, 'rgba(142,27,34,0)');
    ctx.fillStyle = red; ctx.fillRect(0, 0, W, H);
    card(ctx, IMG.d_escroc, W / 2, lerp(1150, 900, k), lerp(228, 470, k), { flip: 1, glow: 0.5 * k, alpha: clamp(k * 2) });
    words(ctx, 'À Dubaï, tout le monde', W / 2, 1390, 62, C.ivory, u, 48.6, { step: 0.12, weight: 700 });
    words(ctx, 'a quelque chose à cacher…', W / 2, 1468, 62, C.gold, u, 49.3, { step: 0.12, weight: 700 });
  }
  vignette(ctx, 0.55);
}

// ---------------------------------------------------------------- S6 en ligne ou dans la vraie vie (u 52..64)
function sIrl(ctx, u, IMG) {
  bgImg(ctx, IMG.d_bg_home, { zoom: 1.1 + 0.05 * prog(u, 52, 64), dark: 0.55 });
  dust(ctx, u, 30, C.goldL, 0.5, 30);
  // 52-56 : en ligne, sur IRLY. Rotation du téléphone à 56 : l'écran devient la vraie vie.
  const rot = E.inOutCubic(prog(u, 55.6, 56.6));
  const k = springU(u, 52, SPRING.gentle);
  if (rot < 0.5) {
    phone(ctx, IMG.mode_dubai, W / 2, lerp(H * 1.2, 1060, k), 520, { rotY: rot * Math.PI, tilt: -0.03, scroll: 0, glow: bump(u, 55, 0.6) });
    // le bouton réel « Créer une table (en ligne ou en vrai) », mis en avant
    const p = E.outBack(prog(u, 54.6, 55.1)) * (1 - prog(u, 55.5, 55.7));
    if (p > 0) {
      const w = 900, h = w * (154 / 1072);
      ctx.save(); ctx.globalAlpha = clamp(p); ctx.translate(W / 2, 1480); ctx.scale(p, p);
      ctx.shadowColor = hexA(C.gold, 0.6); ctx.shadowBlur = 50;
      crop(ctx, IMG.mode_dubai, [48, 1686, 1072, 154], -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  } else {
    // la photo dans un cadre doré élégant, zoom lent et légère dérive de caméra
    const pk = E.outCubic(prog(u, 56.1, 56.6));
    const sx = Math.abs(Math.cos(rot * Math.PI));
    const fw = lerp(520 * 1.05, 900, pk), fh = fw * (pk < 1 ? lerp(2.16, 1.45, pk) : 1.45);
    const cy = lerp(1060, 1010, pk);
    ctx.save(); ctx.translate(W / 2, cy); ctx.scale(Math.max(0.02, sx), 1);
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 60;
    rrect(ctx, -fw / 2 - 12, -fh / 2 - 12, fw + 24, fh + 24, 30); ctx.fillStyle = C.gold; ctx.fill(); ctx.shadowColor = 'transparent';
    const z = 1.04 * (1.16 / 1.04) ** prog(u, 56, 64);
    if (IMG.irl) cover(ctx, IMG.irl, -fw / 2, -fh / 2, fw, fh, { radius: 22, zoom: z, fx: 0.5 + 0.05 * Math.sin((u - 56) * 0.4), fy: 0.62 });
    ctx.restore();
    if (pk >= 1) {
      ctx.save(); ctx.globalAlpha = 0.85; text(ctx, 'Photo d’illustration', W / 2 + fw / 2 - 10, cy + fh / 2 + 48, font(22, 700, UI), C.muted, 'right', 1); ctx.restore();
    }
  }
  shade(ctx, 0.85, 0.45);
  if (u < 56.2) {
    words(ctx, 'JOUE DIRECTEMENT', W / 2, 350, 84, C.ivory, u, 52.1, { step: 0.15, out: 55.8 });
    words(ctx, 'SUR IRLY', W / 2, 455, 96, C.gold, u, 52.6, { step: 0.15, out: 55.8 });
  } else {
    words(ctx, 'OU RÉUNIS TES AMIS', W / 2, 340, 78, C.ivory, u, 57, { step: 0.13 });
    words(ctx, 'DANS LA VRAIE VIE !', W / 2, 432, 78, C.gold, u, 57.6, { step: 0.13 });
    words(ctx, 'Même jeu. Même suspense.', W / 2, 1640 - 150, 52, C.ivory, u, 60, { step: 0.1, weight: 800, family: UI });
    words(ctx, 'Encore plus de rencontres.', W / 2, 1640 - 85, 52, C.goldL, u, 61, { step: 0.1, weight: 800, family: UI });
  }
  vignette(ctx, 0.5);
}

// ---------------------------------------------------------------- S7 final (u 64..72)
function sEnd(ctx, u, IMG) {
  bgImg(ctx, IMG.d_bg_victory, { zoom: 1.18 * (1.04 / 1.18) ** E.outCubic(prog(u, 64, 72)), fy: 0.45, dark: 0.35 });
  dust(ctx, u, 70, C.goldL, 0.8, 41);
  // les deux univers se rejoignent : le Loup-Garou classique et l'Escroc de Dubaï
  const k = springU(u, 64, SPRING.gentle);
  card(ctx, IMG.c_werewolf, lerp(-200, 210, k), 1250, 300, { rot: -0.14, glow: 0.4, alpha: 0.95 });
  card(ctx, IMG.d_escroc, lerp(W + 200, W - 210, k), 1250, 300, { rot: 0.14, glow: 0.4, alpha: 0.95 });
  shade(ctx, 0.6, 0.85);
  // logo IRLY (logotype en points de l'app)
  const lk = springU(u, 64, SPRING.bouncy);
  if (IMG.logo && lk > 0) {
    const lw = 520, lh = lw * IMG.logo.height / IMG.logo.width;
    ctx.save(); ctx.translate(W / 2, 560); ctx.scale(0.6 + 0.4 * lk, 0.6 + 0.4 * lk); ctx.globalAlpha = clamp(lk * 1.4);
    ctx.shadowColor = hexA(C.gold, 0.5 + 0.3 * bump(u, 64.5, 0.6)); ctx.shadowBlur = 60;
    ctx.drawImage(IMG.logo, -lw / 2, -lh / 2, lw, lh); ctx.restore();
  }
  words(ctx, 'MAKE FRIENDS IRL', W / 2, 740, 40, C.goldL, u, 64.6, { step: 0.1, weight: 800, family: UI, track: 0.18 });
  words(ctx, 'IRLY ARRIVE TRÈS BIENTÔT', W / 2, 890, 66, C.ivory, u, 65, { step: 0.12 });
  words(ctx, 'À DUBAÏ', W / 2, 990, 104, C.gold, u, 65.6, { step: 0.12 });
  words(ctx, 'JOUE. RENCONTRE. PARTAGE.', W / 2, 1100, 46, C.ivory, u, 66.5, { step: 0.25, weight: 900 });
  const cp = E.outBack(prog(u, 68.5, 69));
  if (cp > 0) {
    ctx.save(); ctx.translate(W / 2, 1420); ctx.scale(cp, cp);
    pill(ctx, 'SUIS-NOUS POUR NE PAS', 0, -38, 36, C.black, C.gold, 1, null, UI, 800);
    pill(ctx, 'MANQUER LE LANCEMENT !', 0, 38, 36, C.black, C.gold, 1, null, UI, 800);
    ctx.restore();
  }
  vignette(ctx, 0.45);
}

M.film({
  fonts: [font(100, 900, D), font(100, 700, D), font(40, 800, UI), font(40, 700, UI)],
  images: {
    ...Object.fromEntries(['bg_night', 'bg_day', 'bg_chaos', 'bg_nightmare', 'bg_powers', 'bg_victory', 'werewolf', 'seer', 'witch', 'hunter', 'cupid', 'thief', 'elder', 'little_girl', 'salvateur', 'villager'].map((k) => ['c_' + k, `assets/art/c_${k}.webp`])),
    ...Object.fromEntries(['bg_day', 'bg_night', 'bg_home', 'bg_victory', 'expat', 'escroc', 'influencer', 'ceo', 'millionaire', 'emirati', 'golden_visa', 'charo'].map((k) => ['d_' + k, `assets/art/d_${k}.webp`])),
    ...Object.fromEntries(['mode_classique', 'mode_chaos', 'mode_cauchemar', 'mode_pouvoirs', 'mode_dubai'].map((k) => [k, `assets/app/${k}.png`])),
    ...Object.fromEntries(PLAYERS.map((_, i) => ['p' + (i + 1), `assets/players/p${i + 1}.jpg`])),
    irl: 'assets/irl/photo.jpg',
    irlFallback: 'assets/irl/photo_illustration.webp',
    logo: 'assets/irly_wordmark_ivory.png',
  },
  hits: HITS,
  samples: 6,
  init(ctx, IMG) {
    if (!IMG.irl) IMG.irl = IMG.irlFallback;
    const src = IMG.c_werewolf, cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
    const c = cv.getContext('2d'); c.drawImage(src, 0, 0);
    const g = c.createRadialGradient(cv.width / 2, cv.height * 0.42, cv.width * 0.18, cv.width / 2, cv.height * 0.45, cv.width * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalCompositeOperation = 'destination-in'; c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
    IMG.wolfSoft = cv;
  },
  draw(ctx, u, t, IMG) {
    if (u < 8) sNight(ctx, u, IMG);
    else if (u < 16) sApp(ctx, u, IMG);
    else if (u < 24) sGame(ctx, u, IMG);
    else if (u < 36) sModes(ctx, u, IMG);
    else if (u < 52) sDubai(ctx, u, IMG);
    else if (u < 64) sIrl(ctx, u, IMG);
    else sEnd(ctx, u, IMG);
  },
  post(ctx, u) { // grain léger, fixe par image
    ctx.save(); ctx.globalAlpha = 0.05;
    for (let i = 0; i < 260; i++) { const x = hash01(i + Math.floor(u * 96) * 997, 3) * W, y = hash01(i + Math.floor(u * 96) * 991, 7) * H; ctx.fillStyle = i % 2 ? '#fff' : '#000'; ctx.fillRect(x, y, 3, 3); }
    ctx.restore();
  },
});
