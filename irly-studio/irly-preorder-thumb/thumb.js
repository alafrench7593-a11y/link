// Miniature TikTok / Reels (1080x1920), image fixe. Rendue avec render.mjs --poster.
import * as M from './lib/motion.js';
const { W, H, font, layout, text, cover, rrect } = M;
function fit(ctx, s, size, w, weight = 900, fam = 'Display') { let f = font(size, weight, fam); const L = layout(ctx, s, f).width; if (L > w) size *= w / L; return font(size, weight, fam); }
M.film({
  fonts: [font(100, 900, 'Display'), font(40, 800, 'UI')],
  images: { u11: 'assets/photos/u11.jpg', logo: 'assets/irly_wordmark_ivory.png', ...Object.fromEntries(['p-samuel', 'p-layla', 'g-zara', 'p-omar', 'p-chloe', 'w-adaeze'].map((n, i) => ['f' + i, `assets/faces/${n}.jpg`])) },
  draw(ctx, u, t, IMG) {
    cover(ctx, IMG.u11, 0, 0, W, H, { fy: 0.42, zoom: 1.08 });
    let g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(5,5,6,0.88)'); g.addColorStop(0.42, 'rgba(5,5,6,0.25)'); g.addColorStop(0.62, 'rgba(5,5,6,0.35)'); g.addColorStop(1, 'rgba(5,5,6,0.92)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const lw = 300, lh = lw * IMG.logo.height / IMG.logo.width; ctx.drawImage(IMG.logo, W / 2 - lw / 2, 150, lw, lh);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 30;
    [['SE FAIRE DES AMIS', '#fff'], ['NE DEVRAIT JAMAIS', '#fff'], ['ÊTRE UN LUXE.', '#F2C14E']].forEach(([s, c], i) => text(ctx, s, W / 2, 420 + i * 125, fit(ctx, s, i === 2 ? 130 : 110, 960), c, 'center'));
    ctx.restore();
    // tampon
    ctx.save(); ctx.translate(W / 2, 1300); ctx.rotate(-0.06);
    const f = fit(ctx, '100 % GRATUIT', 120, 820), L = layout(ctx, '100 % GRATUIT', f).width;
    ctx.shadowColor = 'rgba(52,199,89,0.7)'; ctx.shadowBlur = 60; rrect(ctx, -L / 2 - 55, -95, L + 110, 190, 34); ctx.fillStyle = '#34C759'; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.lineWidth = 7; ctx.strokeStyle = '#fff'; rrect(ctx, -L / 2 - 40, -80, L + 80, 160, 26); ctx.stroke();
    text(ctx, '100 % GRATUIT', 0, 42, f, '#fff', 'center'); ctx.restore();
    // visages
    for (let i = 0; i < 6; i++) { const x = W / 2 + (i - 2.5) * 105, y = 1520, r = 52; ctx.save(); ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip(); cover(ctx, IMG['f' + i], x - r, y - r, 2 * r, 2 * r, { fy: 0.35 }); ctx.restore(); }
    text(ctx, 'Objectif : 100 premiers membres', W / 2, 1650, font(50, 800, 'UI'), '#fff', 'center');
    text(ctx, 'Précommandes dans 24 h · App Store', W / 2, 1720, font(40, 800, 'UI'), 'rgba(201,214,228,0.95)', 'center');
  },
});
