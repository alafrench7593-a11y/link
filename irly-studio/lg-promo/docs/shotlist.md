# IRLY Loup-Garou — storyboard (45 s, 9:16, 96 BPM, 1 temps = 0,625 s)

Sources : écrans réels de la version démo de l'app (`assets/app/`, capturés depuis `/games/dubai`),
illustrations officielles du jeu (`assets/art/`, depuis `assets/games/` de l'app), logo IRLY en points.
Musique et sons : synthétisés (`audio/score.py`, `sfx.mjs`), donc libres pour la publicité.

| # | Temps (s) | Image | Texte | Animation / transition | Son |
|---|---|---|---|---|---|
| 1 Accroche | 0–5 | Village de nuit (bg_night), lune, Loup-Garou (carte officielle) | ET SI TON PROCHAIN / LOUP-GAROU / SE JOUAIT À DUBAÏ ? | Révélation depuis le noir, zoom lent, loup qui monte, 3 griffures rouges, secousse | Vent, hurlement synthétisé, impact, griffures |
| 2 Le jeu | 5–10 | Écran réel « Loup-Garou · Classique » dans un téléphone | IRLY LOUP-GAROU ARRIVE ! / Le jeu de stratégie, de bluff et de trahison… | Téléphone qui pivote et monte, halo sur le vrai bouton « Jouer en ligne », plongée dans le bouton | Percussions graves, impact |
| 3 La partie | 10–15 | **Mise en scène** (étiquetée) : table de 8 joueurs, chrono, chat, carte secrète, vote | Crée ton salon. Invite tes amis. / Trouve les imposteurs. | Joueurs qui arrivent, 3 messages, « Ta carte : Voyante, toi seul la vois », 4 votes publics, « Yanis est éliminé » (sans révéler son rôle) | Pops, blips, ticks, coup sourd |
| 4 Les modes | 15–22,5 | Fonds officiels + écran réel de chaque mode | 5 MODES. 30 PERSONNAGES. / MODE CLASSIQUE, CHAOS, CAUCHEMAR, TOUS POUVOIRS (phrases de l'app) / Chaque partie est différente. | Éventail de 10 cartes ; téléphone en balayage ; Chaos : cartes qui tournent ; Cauchemar : lune rouge ; Tous pouvoirs : cartes en éventail | Batterie complète, whooshs |
| 5 Dubaï | 22,5–32,5 | Lune → soleil couchant, skyline (bg_day), écran réel du mode Dubaï, 8 cartes officielles | ET UN MODE EXCLUSIF DUBAÏ / EXPATS VS ESCROCS / Influence. Business. Manipulation. Trahison. / À Dubaï, tout le monde a quelque chose à cacher… | Fondu jour/nuit, retournements 3D des cartes, l'Escroc s'avance dans l'ombre rouge | Ré « hijaz », darbouka synthétique |
| 6 En ligne ou en vrai | 32,5–40 | Écran réel + vrai bouton « Créer une table (en ligne ou en vrai) » ; puis **photo** dans un cadre doré | JOUE DIRECTEMENT SUR IRLY / OU RÉUNIS TES AMIS DANS LA VRAIE VIE ! / Même jeu. Même suspense. Encore plus de rencontres. | Le téléphone tourne et devient la photo ; zoom lent, dérive de caméra | Accords majeurs, chaleureux |
| 7 Final | 40–45 | Dubaï de nuit (bg_victory), Loup-Garou + Escroc, logo IRLY | MAKE FRIENDS IRL / IRLY ARRIVE TRÈS BIENTÔT À DUBAÏ / JOUE. RENCONTRE. PARTAGE. / SUIS-NOUS POUR NE PAS MANQUER LE LANCEMENT ! | Les deux univers se rejoignent, logo qui rebondit | Montée, impact du logo, cloche |

## Écarts volontaires avec le brief

- **5 modes, pas 8.** L'app joue Classique, Dubaï, Chaos, Cauchemar et Tous pouvoirs (`cards.ts`,
  `docs/LOUP-GAROU.md`). Manipulation, les fusions et Apocalypse « attendent des décisions » : les
  montrer serait inventer.
- **Pas d'emoji** dans les textes (🐺 🇦🇪 📱) : les polices du jeu ne les ont pas.
- **Pas de réseaux sociaux** : aucun compte officiel confirmé dans le projet.

## Emplacements à remplir

- `assets/players/p1.jpg` … `p8.jpg` : vraies photos de profil, avec l'accord des personnes.
  Elles remplacent les initiales automatiquement (ordre : Léa, Sami, Inès, Yanis, Maya, Karim, Nora, Toi).
- `assets/irl/photo.jpg` : la photo d'une vraie partie. En attendant, la photo de rooftop envoyée
  est utilisée, avec la mention « Photo d'illustration ».

Relancer : `node <skill>/scripts/render.mjs --film lg-promo --format 9x16 --video-only`, puis `mix.mjs`.
