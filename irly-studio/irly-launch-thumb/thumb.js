// Miniature TikTok / Reels de la vidéo de lancement (image fixe, rendue en 2160x3840 avec DSF=2).
import * as M from './lib/motion.js';
const { W, H, font, layout, text, cover, rrect } = M;
const EN = location.search.includes('en=1');
function fit(ctx, s, size, w, weight = 900, fam = 'Display') { let f = font(size, weight, fam); const L = layout(ctx, s, f).width; if (L > w) size *= w / L; return font(size, weight, fam); }
M.film({
  fonts: [font(100, 900, 'Display'), font(40, 800, 'UI')],
  images: { bg: 'assets/places/dubaiNight.webp', logo: 'assets/irly_wordmark_ivory.png', icon: 'assets/app_icon.png', H0: 'assets/real_fr/home_00.png' },
  draw(ctx, u, t, IMG) {
    cover(ctx, IMG.bg, 0, 0, W, H, { fy: 0.45, zoom: 1.1 });
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(5,5,6,0.9)'); g.addColorStop(0.45, 'rgba(5,5,6,0.35)'); g.addColorStop(1, 'rgba(5,5,6,0.95)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const lw = 360, lh = lw * IMG.logo.height / IMG.logo.width; ctx.drawImage(IMG.logo, W / 2 - lw / 2, 160, lw, lh);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 30;
    text(ctx, 'DISPONIBLE', W / 2, 470, fit(ctx, 'DISPONIBLE', 150, 940), '#fff', 'center');
    text(ctx, 'SUR L’APP STORE', W / 2, 590, fit(ctx, 'SUR L’APP STORE', 110, 940), '#34C759', 'center');
    ctx.restore();
    // téléphone avec l'accueil réel
    const pw = 520, ph = pw * 2532 / 1170, cx = W / 2, cy = 1230;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.06); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 80; rrect(ctx, -pw / 2 - 14, -ph / 2 - 14, pw + 28, ph + 28, 80); ctx.fillStyle = '#111'; ctx.fill(); ctx.shadowColor = 'transparent';
    rrect(ctx, -pw / 2, -ph / 2, pw, ph, 68); ctx.clip(); ctx.drawImage(IMG.H0, -pw / 2, -ph / 2, pw, ph); ctx.restore();
    { const g2 = ctx.createLinearGradient(0, 1380, 0, 1700); g2.addColorStop(0, 'rgba(5,5,6,0)'); g2.addColorStop(1, 'rgba(5,5,6,1)'); ctx.fillStyle = g2; ctx.fillRect(0, 1380, W, H - 1380); }
    // tampon gratuit + 100 premiers
    ctx.save(); ctx.translate(W / 2, 1560); ctx.rotate(-0.05); const f = fit(ctx, '100 % GRATUIT', 96, 700), L = layout(ctx, '100 % GRATUIT', f).width;
    ctx.shadowColor = 'rgba(52,199,89,0.7)'; ctx.shadowBlur = 50; rrect(ctx, -L / 2 - 50, -80, L + 100, 160, 30); ctx.fillStyle = '#34C759'; ctx.fill(); ctx.shadowColor = 'transparent';
    text(ctx, '100 % GRATUIT', 0, 34, f, '#fff', 'center'); ctx.restore();
    text(ctx, 'Rejoins les 100 premiers membres', W / 2, 1760, font(52, 800, 'UI'), '#fff', 'center');
  },
});
