// IRLY product demo, 72 s, 16:9 (1920×1080), English. Pure function of time: window.seek(t).
// Real IRLY screens (demo build, English, sample content) + licensed Dubai footage and IRLY's own photos.
// Everything staged is labelled: "Illustrative demo · Sample profiles and activities".
import * as M from './lib/motion.js';

const { W, H, E, TAU, prog, lerp, clamp, springU, SPRING, font, layout, text, fill, cover, rrect, bump, hash01 } = M;
const C = { bg: '#0E1014', ink: '#F3F2EE', soft: '#B9C2CC', steel: '#8EA5BF', deep: '#3E5A78', green: '#34C759', panel: 'rgba(14,16,20,0.78)' };
const F = 'UI';
const SW = 1170, SH = 2532;
const sp = (t, t0) => springU(t / 0.46154, t0 / 0.46154, SPRING.gentle); // springs measured in seconds
const sn = (t, t0) => springU(t / 0.46154, t0 / 0.46154, SPRING.snappy);

// ---------------------------------------------------------------- subtitles (voice-over)
const SUBS = [
  [1.0, 2.84, 'Dubai has plenty to do.'], [3.32, 6.16, 'Finding someone to do it with… can be the hard part.'],
  [11.0, 12.21, 'Maybe you’ve just moved here.'], [12.54, 16.35, 'You’d love to play padel, join a run, or grab coffee this weekend.'], [16.8, 18.27, 'You just don’t know who to ask.'],
  [22.5, 27.75, 'With IRLY, you can discover local communities, join an activity, and meet the people who are going.'],
  [30.0, 34.23, 'And if you organise a run or a meetup, you can give more people a way to find it…'], [34.23, 35.24, '…and join in.'],
  [46.0, 48.21, 'It starts with something you already enjoy.'], [48.55, 50.1, 'Then you have someone to do it with.'],
  [59.5, 62.2, 'IRLY. Make Friends IRL.'],
];
function subtitles(ctx, t) {
  const s = SUBS.find(([a, b]) => t >= a && t < b + 0.2);
  if (!s) return;
  const a = clamp((t - s[0]) / 0.12) * clamp((s[1] + 0.2 - t) / 0.12);
  const f = font(40, 700, F); ctx.font = f;
  const w = layout(ctx, s[2], f).width + 48;
  ctx.save(); ctx.globalAlpha = a;
  rrect(ctx, W / 2 - w / 2, 958, w, 64, 14); ctx.fillStyle = 'rgba(0,0,0,0.66)'; ctx.fill();
  text(ctx, s[2], W / 2, 1003, f, '#FFFFFF', 'center');
  ctx.restore();
}

// ---------------------------------------------------------------- helpers
function hexA(hex, a) { const [r, g, b] = M.hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function scrim(ctx, a = 0.45) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(8,9,12,${a})`); g.addColorStop(0.5, `rgba(8,9,12,${a * 0.4})`); g.addColorStop(1, `rgba(8,9,12,${a * 1.3})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function clip(ctx, IMG, name, t, t0, { zoom = 1.05, fx = 0.5, fy = 0.5, alpha = 1 } = {}) {
  const i = Math.min(63, Math.max(0, Math.floor((t - t0) * 8)));
  let img = null; for (let j = 0; j < 64 && !img; j++) img = IMG[`${name}_${Math.max(0, i - j)}`] || IMG[`${name}_${Math.min(63, i + j)}`]; if (!img) return;
  ctx.save(); ctx.globalAlpha = alpha; cover(ctx, img, 0, 0, W, H, { zoom, fx, fy }); ctx.restore();
}
function photo(ctx, img, t, t0, t1, { z0 = 1.04, z1 = 1.16, fx = 0.5, fy = 0.5, alpha = 1 } = {}) {
  const p = prog(t, t0, t1), z = z0 * (z1 / z0) ** p;
  ctx.save(); ctx.globalAlpha = alpha; cover(ctx, img, 0, 0, W, H, { zoom: z, fx, fy }); ctx.restore();
}
function phone(ctx, cx, cy, h, drawScreen, { alpha = 1, tilt = 0, scale = 1, glow = 0 } = {}) {
  const w = h * SW / SH, r = w * 0.13;
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.rotate(tilt); ctx.scale(scale, scale);
  ctx.shadowColor = glow ? hexA(C.steel, 0.55 * glow) : 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = glow ? 0 : 24;
  rrect(ctx, -w / 2 - 10, -h / 2 - 10, w + 20, h + 20, r + 10); ctx.fillStyle = '#0B0C0F'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke();
  ctx.save(); rrect(ctx, -w / 2, -h / 2, w, h, r); ctx.clip(); ctx.translate(-w / 2, -h / 2); ctx.scale(w / SW, w / SW);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH); drawScreen(ctx); ctx.restore();
  ctx.restore();
}
const shot = (s, img, dy = 0, a = 1) => { if (!img || a <= 0) return; s.save(); s.globalAlpha *= a; s.drawImage(img, 0, dy, SW, SH); s.restore(); };
function scrollPair(s, A, B, p, d = 1260) {
  p = clamp(p); const T = 170, Bt = 2200, band = Bt - T;
  const band_ = (img, off) => { if (img) s.drawImage(img, 0, T, SW, band, 0, T + off, SW, band); };
  s.fillStyle = '#000'; s.fillRect(0, 0, SW, SH);
  s.save(); s.beginPath(); s.rect(0, T, SW, band); s.clip(); band_(A, -d * p);
  s.save(); s.beginPath(); s.rect(0, Bt - d * p, SW, d * p + 1); s.clip(); band_(B, d * (1 - p)); s.restore(); s.restore();
  const C2 = p > 0.5 ? B : A; if (C2) { s.drawImage(C2, 0, 0, SW, T, 0, 0, SW, T); s.drawImage(C2, 0, Bt, SW, SH - Bt, 0, Bt, SW, SH - Bt); }
}
function fade(s, A, B, p) { shot(s, A); shot(s, B, 0, E.inOutCubic(clamp(p))); }
function sheet(s, A, B, p) { p = E.outCubic(clamp(p)); shot(s, A); s.fillStyle = `rgba(0,0,0,${0.4 * p})`; s.fillRect(0, 0, SW, SH); s.save(); s.translate(0, SH * (1 - p)); shot(s, B); s.restore(); }
function tap(s, t, t0, x, y) {
  const a = prog(t, t0 - 0.25, t0 - 0.05) * (1 - prog(t, t0 + 0.3, t0 + 0.5)); if (a <= 0) return;
  const press = bump(t, t0, 0.12), rp = prog(t, t0, t0 + 0.45);
  s.save(); s.globalAlpha = a; s.fillStyle = 'rgba(255,255,255,0.28)'; s.strokeStyle = 'rgba(255,255,255,0.95)'; s.lineWidth = 7;
  s.beginPath(); s.arc(x, y, 72 - 14 * press, 0, TAU); s.fill(); s.stroke();
  if (rp > 0 && rp < 1) { s.globalAlpha = a * (1 - rp); s.beginPath(); s.arc(x, y, 72 + 170 * rp, 0, TAU); s.stroke(); }
  s.restore();
}
function headline(ctx, str, x, y, size, t, t0, { color = C.ink, align = 'left', out = null, weight = 800 } = {}) {
  const k = sn(t, t0); if (k <= 0) return;
  const o = out == null ? 1 : 1 - E.inCubic(prog(t, out, out + 0.4)); if (o <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp(k * 1.5) * o; ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 24;
  text(ctx, str, x, y + (1 - k) * 30, font(size, weight, F), color, align, -size * 0.01); ctx.restore();
}
function tag(ctx, str, x, y, t, t0, t1, { bg = 'rgba(14,16,20,0.78)', fg = C.ink, border = 'rgba(255,255,255,0.25)', size = 26 } = {}) {
  const a = prog(t, t0, t0 + 0.3) * (1 - prog(t, t1 - 0.3, t1)); if (a <= 0) return;
  const f = font(size, 700, F); ctx.font = f; const w = layout(ctx, str, f).width + size * 1.4, h = size * 2;
  ctx.save(); ctx.globalAlpha = a; rrect(ctx, x, y, w, h, h / 2); ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = border; ctx.stroke();
  text(ctx, str, x + size * 0.7, y + size * 1.36, f, fg); ctx.restore();
}
function bubble(ctx, who, msg, x, y, t, t0, right = false) {
  const p = E.outBack(prog(t, t0, t0 + 0.35)); if (p <= 0) return;
  const f = font(30, 600, F), fn = font(24, 800, F); ctx.font = f; const w = Math.max(layout(ctx, msg, f).width, 160) + 52, h = 104;
  const bx = right ? x - w : x;
  ctx.save(); ctx.globalAlpha = clamp(p * 1.4); ctx.translate(0, (1 - p) * 24);
  rrect(ctx, bx, y, w, h, 26); ctx.fillStyle = right ? '#F3F2EE' : 'rgba(23,26,32,0.92)'; ctx.fill();
  text(ctx, who, bx + 26, y + 36, fn, right ? C.deep : C.steel); text(ctx, msg, bx + 26, y + 80, f, right ? '#14161B' : C.ink);
  ctx.restore();
}
const DEMO_TAG = (ctx, t, t0, t1) => tag(ctx, 'Illustrative demo · Sample profiles and activities', W - 64 - 690, 40, t, t0, t1, { size: 24 });

// ---------------------------------------------------------------- 0–10 s: the hook
function hook(ctx, t, IMG) {
  // a running video on her phone (real Dubai beach footage), then full frame
  const full = E.inOutCubic(prog(t, 4.6, 6.0));
  clip(ctx, IMG, 'run', t, 0, { zoom: 1.08, alpha: full });
  if (full < 1) {
    ctx.fillStyle = '#0B0C0F'; ctx.globalAlpha = 1 - full; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    photo(ctx, IMG.girlCoffee, t, 0, 6, { z0: 1.05, z1: 1.12, alpha: (1 - full) * 0.35 });
    phone(ctx, W / 2 + 360, 540, 820, (s) => { const img = IMG[`run_${Math.min(63, Math.floor(t * 8))}`]; if (img) cover(s, img, 0, 0, SW, SH, { fx: 0.42 }); s.fillStyle = 'rgba(0,0,0,0.25)'; s.fillRect(0, SH - 420, SW, 420); text(s, 'Kite Beach, sunset run', 80, SH - 250, font(64, 800, F), '#fff'); text(s, 'Dubai', 80, SH - 160, font(52, 600, F), 'rgba(255,255,255,0.8)'); }, { alpha: 1 - full, scale: 1 + 0.6 * full, tilt: -0.03 });
  }
  // she hesitates: Kite Beach, alone
  const ks = prog(t, 6.6, 7.2);
  if (ks > 0) photo(ctx, IMG.kiteBeach, t, 6.6, 10.2, { alpha: ks, fy: 0.55, z0: 1.0, z1: 1.1 });
  scrim(ctx, 0.5);
  headline(ctx, 'Dubai has plenty to do.', 128, 420, 88, t, 0.6, { out: 6.3 });
  headline(ctx, 'Who do you go with?', 128, 530, 88, t, 1.6, { color: C.steel, out: 6.3 });
  headline(ctx, 'Just moved here. Going alone feels like a lot.', 128, 470, 60, t, 7.0, { out: 9.8, weight: 700 });
}

// ---------------------------------------------------------------- 10–22 s: three people, same moment
function parallel(ctx, t, IMG) {
  fill(ctx, C.bg);
  const g = ctx.createRadialGradient(W / 2, H * 0.3, 100, W / 2, H * 0.5, W * 0.8); g.addColorStop(0, '#1C2330'); g.addColorStop(1, C.bg); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const cols = [
    { x: 400, img: 'padel_00', next: 'padel_01', label: 'Nadia looks for a padel partner', t0: 10.2, sc: 14.2 },
    { x: 960, img: 'running_00', next: 'running_01', label: 'Omar joins the Sunrise run', t0: 10.5, sc: 15.4 },
    { x: 1520, img: 'social_00', next: 'social_01', label: 'Three friends plan a weekend coffee', t0: 10.8, sc: 16.6 },
  ];
  cols.forEach((c, i) => {
    const k = sp(t, c.t0); if (k <= 0) return;
    phone(ctx, c.x, 470 + (1 - k) * 600, 760, (s) => {
      scrollPair(s, IMG[c.img], IMG[c.next], E.inOutCubic(prog(t, c.sc, c.sc + 1.1)));
      if (i === 0) tap(s, t, 19.6, 585, 900);
    }, { alpha: clamp(k * 1.6), tilt: (i - 1) * 0.02 });
    tag(ctx, c.label, c.x - 250, 880, t, c.t0 + 0.5, 21.8, { size: 24 });
  });
  DEMO_TAG(ctx, t, 10.2, 72);
}

// ---------------------------------------------------------------- 22–38 s: one full journey + an organiser
function journey(ctx, t, IMG) {
  fill(ctx, C.bg);
  const g = ctx.createRadialGradient(W * 0.3, H * 0.4, 100, W * 0.3, H * 0.5, W * 0.7); g.addColorStop(0, '#1C2330'); g.addColorStop(1, C.bg); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // participant (left): Running page → the plan in Social → "Count me in"
  const k = sp(t, 22.0);
  phone(ctx, 560, 480 + (1 - k) * 500, 800, (s) => {
    shot(s, IMG.running_00);
    const ha = prog(t, 23.4, 23.7) * (1 - prog(t, 30.6, 31)); if (ha > 0) { s.save(); s.globalAlpha = ha; s.lineWidth = 10; s.strokeStyle = C.steel; s.shadowColor = C.steel; s.shadowBlur = 30; rrect(s, 40, 1040, 1090, 480, 40); s.stroke(); s.restore(); }
    tap(s, t, 29.4, 585, 1250);
    const ok = prog(t, 29.5, 29.7); if (ok > 0) { s.save(); s.globalAlpha = ok; rrect(s, 740, 1392, 400, 116, 58); s.fillStyle = '#2E7D4F'; s.fill(); text(s, 'You’re in ✓', 940, 1470, font(48, 800, F), '#fff', 'center'); s.restore(); }
  }, { alpha: clamp(k * 1.6), tilt: -0.02 });
  tag(ctx, 'Participant · Maya', 360, 900, t, 22.4, 37.8, { size: 24 });
  // organiser (right): a coach posts the next session with the real "Start a plan" sheet
  const k2 = sp(t, 30.0);
  phone(ctx, 1360, 480 + (1 - k2) * 600, 800, (s) => {
    sheet(s, IMG.social_00, IMG.create, prog(t, 30.4, 30.9));
    tap(s, t, 31.4, 210, 1062); tap(s, t, 32.1, 423, 1422); tap(s, t, 32.8, 162, 1554); tap(s, t, 33.6, 585, 2367);
    const sel = (x, y, w, h, t0) => { const a = prog(t, t0 + 0.05, t0 + 0.2); if (a > 0) { s.save(); s.globalAlpha = a * 0.9; rrect(s, x, y, w, h, h / 2); s.lineWidth = 8; s.strokeStyle = C.green; s.stroke(); s.restore(); } };
    sel(72, 1018, 290, 90, 31.4); sel(72, 1510, 200, 90, 32.8);
    const ok = prog(t, 33.8, 34.0); if (ok > 0) { s.save(); s.globalAlpha = ok; rrect(s, 66, 2290, 1040, 150, 75); s.fillStyle = '#2E7D4F'; s.fill(); text(s, 'Plan posted ✓', 585, 2390, font(56, 800, F), '#fff', 'center'); s.restore(); }
  }, { alpha: clamp(k2 * 1.6), tilt: 0.02 });
  tag(ctx, 'Organiser · Coach Karim posts tomorrow’s run', 1090, 900, t, 30.2, 37.8, { size: 24 });
  // sample messages between people going (group chat: sign-in required, not shown as a screen)
  bubble(ctx, 'Karim · coach', 'Meet at lifeguard tower 2, 06:50 🏃', 820, 140, t, 34.8);
  bubble(ctx, 'Maya', 'Perfect, see you there!', 1100, 260, t, 35.8, true);
  tag(ctx, 'Sample messages', 820, 60, t, 34.8, 37.8, { size: 22 });
  DEMO_TAG(ctx, t, 0, 72);
}

// ---------------------------------------------------------------- 38–58 s: off the phone, into real life
function real(ctx, t, IMG) {
  // from the phone to the beach: the phone screen grows into the place
  if (t < 41.2) photo(ctx, IMG.kiteBeach, t, 38, 41.4, { z0: 1.0, z1: 1.12, fy: 0.55 });
  if (t >= 40.8 && t < 45.2) photo(ctx, IMG.runGirl, t, 40.8, 45.4, { alpha: prog(t, 40.8, 41.3), fy: 0.45 });
  if (t >= 44.8 && t < 49.4) clip(ctx, IMG, 'run', t, 44.8, { alpha: prog(t, 44.8, 45.3), zoom: 1.06 });
  if (t >= 49.0 && t < 52.6) photo(ctx, IMG.padelMix, t, 49.0, 52.8, { alpha: prog(t, 49.0, 49.5), z0: 1.0, z1: 1.14 });
  if (t >= 52.2 && t < 55.4) photo(ctx, IMG.brunch, t, 52.2, 55.6, { alpha: prog(t, 52.2, 52.7) });
  if (t >= 55.0) clip(ctx, IMG, 'volley', t, 55.0, { alpha: prog(t, 55.0, 55.5), zoom: 1.04 });
  const intro = 1 - E.inOutCubic(prog(t, 38.0, 39.0));
  if (intro > 0) { ctx.fillStyle = `rgba(14,16,20,${intro})`; ctx.fillRect(0, 0, W, H); phone(ctx, 560, 480, 800, (s) => shot(s, IMG.social_02), { alpha: intro, scale: 1 + (1 - intro) * 1.5 }); }
  scrim(ctx, 0.42);
  tag(ctx, '06:00 · Kite Beach, lifeguard tower 2', 128, 160, t, 38.8, 44.6, { size: 30 });
  tag(ctx, 'Maya meets the group', 128, 160, t, 44.9, 48.8, { size: 30 });
  tag(ctx, 'Tonight · padel doubles', 128, 160, t, 49.2, 52.4, { size: 30 });
  tag(ctx, 'Saturday · coffee with the new crew', 128, 160, t, 52.4, 55.2, { size: 30 });
  tag(ctx, 'Same faces, next week', 128, 160, t, 55.4, 57.9, { size: 30 });
  tag(ctx, 'Footage and photos: Dubai stock (Pixabay/Pexels) and IRLY · people are not IRLY users', 128, 64, t, 38.6, 57.9, { size: 20, bg: 'rgba(0,0,0,0.45)' });
}

// ---------------------------------------------------------------- 58–72 s: end card
function end(ctx, t, IMG) {
  clip(ctx, IMG, 'volley', t, 55.0, { zoom: 1.04 });
  const d = E.inOutCubic(prog(t, 58, 59.2)); ctx.fillStyle = `rgba(14,16,20,${0.55 + 0.35 * d})`; ctx.fillRect(0, 0, W, H);
  const lk = sn(t, 58.6);
  if (lk > 0 && IMG.logo) { const lw = 420, lh = lw * IMG.logo.height / IMG.logo.width; ctx.save(); ctx.globalAlpha = clamp(lk * 1.4); ctx.drawImage(IMG.logo, W / 2 - lw / 2, 250 + (1 - lk) * 30, lw, lh); ctx.restore(); }
  headline(ctx, 'IRLY – Make Friends IRL', W / 2, 520, 84, t, 59.4, { align: 'center' });
  headline(ctx, 'A local social network built around real-world activities.', W / 2, 610, 44, t, 60.2, { align: 'center', color: C.soft, weight: 600 });
  const s = prog(t, 61.5, 62.0);
  if (s > 0) {
    ctx.save(); ctx.globalAlpha = s;
    const items = [['Pre-launch', 'Dubai first'], ['Demo build', 'web, sample content'], ['Coming soon', 'public launch · matching']];
    items.forEach(([a, b], i) => { const x = W / 2 - 570 + i * 390; rrect(ctx, x, 700, 360, 130, 22); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke(); text(ctx, a, x + 180, 752, font(34, 800, F), C.ink, 'center'); text(ctx, b, x + 180, 800, font(26, 600, F), C.soft, 'center'); });
    ctx.restore();
  }
  headline(ctx, 'Demo: [link to confirm]', W / 2, 920, 34, t, 62.6, { align: 'center', color: C.steel, weight: 700 });
}

const CLIPS = { run: 'k-beachSunset', volley: 'k-volleyball' };
M.film({
  fonts: [font(80, 800, F), font(40, 700, F), font(30, 600, F)],
  images: {
    ...Object.fromEntries(['home', 'social_00', 'social_01', 'social_02', 'activities', 'running_00', 'running_01', 'padel_00', 'padel_01', 'discover', 'create'].map((k) => [k, `assets/shots/${k}.png`])),
    ...Object.fromEntries(['kiteBeach', 'runGirl', 'runMix', 'padelMix', 'padelGirl', 'brunch', 'girlCoffee', 'running', 'padel', 'coffeeBar'].map((k) => [k, `assets/photos/${k}-1200.jpg`])),
    ...Object.fromEntries(Object.entries(CLIPS).flatMap(([k, dir]) => [...Array(64)].map((_, i) => [`${k}_${i}`, `assets/clips/${dir}/f${String(i + 1).padStart(3, '0')}.jpg`]))),
    logo: 'assets/irly_wordmark.png',
  },
  hits: [[0, 'start', 'swell', { len: 1.2 }], [10.2 / 0.46154, 'phones', 'whoosh', { len: 0.5 }], [29.4 / 0.46154, 'count me in', 'pop', { pitch: 'A5' }], [33.6 / 0.46154, 'plan posted', 'pop', { pitch: 'D6' }], [38 / 0.46154, 'real life', 'whoosh', { len: 0.6 }], [58.6 / 0.46154, 'logo', 'bell', { pitch: 'D6' }]],
  samples: 3,
  draw(ctx, u, t, IMG) {
    if (t < 10) hook(ctx, t, IMG);
    else if (t < 22) parallel(ctx, t, IMG);
    else if (t < 38) journey(ctx, t, IMG);
    else if (t < 58) real(ctx, t, IMG);
    else end(ctx, t, IMG);
    subtitles(ctx, t);
  },
});
