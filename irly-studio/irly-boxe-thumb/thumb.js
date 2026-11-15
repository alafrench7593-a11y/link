// Miniature TikTok du concours (image fixe). Affiche officielle recadrée sans la bande des sponsors.
import * as M from './lib/motion.js';
const { W, H, font, layout, text, cover, rrect } = M;
function fit(ctx, s, size, w, weight = 900, fam = 'Display') { let f = font(size, weight, fam); const L = layout(ctx, s, f).width; if (L > w) size *= w / L; return font(size, weight, fam); }
M.film({
  fonts: [font(100, 900, 'Display'), font(40, 800, 'UI')],
  images: { p: 'assets/posters/poster_official.jpg', logo: 'assets/irly_wordmark_ivory.png' },
  draw(ctx, u, t, IMG) {
    ctx.fillStyle = '#060504'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.filter = 'blur(30px)'; ctx.drawImage(IMG.p, 0, 0, 647, 440, -100, -60, W + 200, H * 0.75); ctx.restore();
    ctx.fillStyle = 'rgba(6,5,4,0.55)'; ctx.fillRect(0, 0, W, H);
    const pw = 760, ph = pw * 752 / 647; ctx.save(); ctx.translate(W / 2, 980); ctx.rotate(-0.03); ctx.shadowColor = 'rgba(232,195,106,0.6)'; ctx.shadowBlur = 80; rrect(ctx, -pw / 2, -ph / 2, pw, ph, 28); ctx.fillStyle = '#000'; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.clip(); ctx.drawImage(IMG.p, 0, 0, 647, 752, -pw / 2, -ph / 2, pw, ph); ctx.restore();
    const g = ctx.createLinearGradient(0, 0, 0, 520); g.addColorStop(0, 'rgba(6,5,4,0.95)'); g.addColorStop(1, 'rgba(6,5,4,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 520);
    ctx.save(); ctx.shadowColor = 'rgba(232,195,106,0.8)'; ctx.shadowBlur = 40;
    text(ctx, 'GAGNE TES PLACES', W / 2, 250, fit(ctx, 'GAGNE TES PLACES', 140, 980), '#fff', 'center');
    text(ctx, 'POUR LE COMBAT !', W / 2, 380, fit(ctx, 'POUR LE COMBAT !', 120, 980), '#E8C36A', 'center'); ctx.restore();
    const g2 = ctx.createLinearGradient(0, 1400, 0, 1800); g2.addColorStop(0, 'rgba(6,5,4,0)'); g2.addColorStop(1, 'rgba(6,5,4,1)'); ctx.fillStyle = g2; ctx.fillRect(0, 1400, W, H - 1400);
    const lw = 300, lh = lw * IMG.logo.height / IMG.logo.width; ctx.drawImage(IMG.logo, W / 2 - lw / 2, 1560, lw, lh);
    text(ctx, 'Sur IRLY · l’appli 100 % gratuite', W / 2, 1760, font(44, 800, 'UI'), '#fff', 'center');
  },
});
