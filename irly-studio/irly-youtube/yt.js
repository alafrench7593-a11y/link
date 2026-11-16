// Visuels de la chaîne YouTube IRLY : bannière (format 16x9 -> 2560x1440) et photo de profil (format 1x1 -> 800x800).
// La zone sûre de la bannière (visible sur tous les écrans) fait 1546x423 au centre de 2560x1440,
// soit 1160x317 au centre du canevas 1920x1080 : tout le texte est dedans.
import * as M from './lib/motion.js';
const { W, H, FORMAT, font, layout, text, cover, rrect, hash01 } = M;
M.film({
  fonts: [font(100, 900, 'Display'), font(40, 800, 'UI'), font(40, 700, 'UI')],
  images: { bg: 'assets/places/dubaiNight.webp', logo: 'assets/irly_wordmark_ivory.png', icon: 'assets/app_icon.png' },
  draw(ctx, u, t, IMG) {
    if (FORMAT.square) { // photo de profil : l'icône réelle de l'app, plein cadre (YouTube la recadre en cercle)
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.drawImage(IMG.icon, 0, 0, W, H); return;
    }
    cover(ctx, IMG.bg, 0, 0, W, H, { fy: 0.5, zoom: 1.05 });
    const g = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7); g.addColorStop(0, 'rgba(5,5,6,0.55)'); g.addColorStop(1, 'rgba(5,5,6,0.9)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // points lumineux discrets
    for (let i = 0; i < 60; i++) { ctx.globalAlpha = 0.15 + 0.25 * hash01(i, 3); ctx.fillStyle = i % 4 ? '#fff' : '#34C759'; ctx.beginPath(); ctx.arc(hash01(i, 1) * W, hash01(i, 2) * H, 2 + 3 * hash01(i, 4), 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1;
    const lw = 420, lh = lw * IMG.logo.height / IMG.logo.width;
    ctx.save(); ctx.shadowColor = 'rgba(201,214,228,0.6)'; ctx.shadowBlur = 40; ctx.drawImage(IMG.logo, W / 2 - lw / 2 - 300, H / 2 - lh / 2 - 20, lw, lh); ctx.restore();
    text(ctx, 'MAKE FRIENDS IRL', W / 2 + 230, H / 2 - 40, font(56, 900, 'Display'), '#fff', 'center');
    text(ctx, 'Rencontre du monde à Dubaï · 100 % gratuit', W / 2 + 230, H / 2 + 20, font(28, 800, 'UI'), 'rgba(201,214,228,0.95)', 'center');
    const p = 'Disponible sur l’App Store', f = font(26, 800, 'UI'), pw = layout(ctx, p, f).width + 50;
    rrect(ctx, W / 2 + 230 - pw / 2, H / 2 + 50, pw, 52, 26); ctx.fillStyle = '#34C759'; ctx.fill(); text(ctx, p, W / 2 + 230, H / 2 + 85, f, '#fff', 'center');
  },
});
