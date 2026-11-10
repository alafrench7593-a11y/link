# IRLY Loup-Garou v2 — l'histoire IRLY (50 s, 9:16, 96 BPM, 1 temps = 0,625 s)

Voix off : ElevenLabs, voix « Rebecca » (demandée ; chaleureuse, parle français via le modèle v4), texte écrit « Irli » pour la prononciation.
Une prise unique, découpée en 7 phrases posées chacune sur sa scène (`audio/vo/take_rebecca.mp3` → `audio/vo.wav` ; la prise « Agathe » reste dans `audio/vo/take.mp3`).

| # | Temps | Part | Écrans / images | Voix off et textes |
|---|---|---|---|---|
| A L'ennui | 0–8,75 s | 17 % | Téléphone dans une pièce sombre (skyline floue), défilement de tes photos de Dubaï, heure 23:47, notification générique « Temps d'écran » | « T'es à Dubaï… t'es posé chez toi… tu sais pas quoi faire… ça fait une heure que tu scrolles. Et t'as personne avec qui sortir ? » |
| B IRLY | 8,75–14,4 s | 11 % | Bug de l'écran → logo IRLY → **vrai accueil** (défilement réel) → onglet Social : profils et activités → Découvrir « Trouve ta bande » | « Attends… tu connais Irli ? L'appli pour rencontrer du monde à Dubaï. » |
| C Accès au jeu | 14,4–21,25 s | 14 % | Retour à l'accueil, défilement jusqu'à la **vraie carte « IRLY Games · Loup-Garou »**, toucher « Jouer » → plongée dans l'écran → village, pleine lune, titre réel → **accueil réel du Loup-Garou**, touchers sur Chaos, Cauchemar, Dubaï, Classique | « Et maintenant, tu peux même jouer au Loup-Garou… directement depuis Irli ! » |
| D La partie | 21,25–31,25 s | 20 % | **Vraie fenêtre « Nouvelle table de Loup-Garou »** (En ligne, 10, Créer la table), puis **mise en scène étiquetée** : joueurs qui rejoignent, mode, distribution, ta carte (Voyante, toi seul la vois), nuit, pouvoir (résultat visible par toi seul), chat (4 messages), vote public, élimination sans révéler le rôle | « Tu crées ton salon… d'autres joueurs te rejoignent… et là, faut trouver qui ment. » |
| E Les modes | 31,25–36,25 s | 10 % | **Nouvelle version de l'app** : vrai écran des 9 modes, toucher Dubaï → skyline, 6 cartes Dubaï, Expats vs Escrocs ; puis **les 8 autres modes en rafale** (tuiles réelles en plein cadre, 2/9 à 9/9) | « Un mode spécial Dubaï : Expats contre Escrocs… et huit autres modes de jeu. » |
| F La vraie vie | 36,25–45 s | 17 % | Accueil → Social (suggestions, Chloé…) → **activités réelles**, « Je suis partant·e » → **« Lancer une activité »** (Demain, 19:30, Publier) → **table de Loup-Garou « En présentiel (QR code) »** → la photo dans un cadre doré | « Et le meilleur ? Tu peux aussi jouer en vrai… avec des gens que t'as rencontrés sur Irli. » |
| G Final | 45–50 s | 10 % | Carrousel de vrais écrans → logo IRLY, Loup-Garou + Escroc | « Marre de scroller sans rien faire ? Irli arrive très bientôt à Dubaï. » + « Suis-nous pour le lancement 👀 » |

≈ 55 % du film montre directement une interface réelle d'IRLY ou du Loup-Garou.

## Ce qui est réel, ce qui est mis en scène

- **Réel** : l'accueil, Social, Découvrir, les activités, « Lancer une activité », la carte « IRLY Games »,
  l'accueil du Loup-Garou et ses modes, la fenêtre « Nouvelle table » (en ligne ou en présentiel avec QR code).
  Captures de la version démo de l'app (aucun serveur, aucun compte).
- **Une exception** : dans la démo, la carte « IRLY Games » est masquée. Elle a été filmée sur une copie
  locale de l'app (jamais commitée) où seule cette condition est levée ; elle n'affiche aucun chiffre
  (« Pas encore de partie : lance-toi »), comme dans l'app.
- **Mis en scène** (étiqueté « Mise en scène promotionnelle ») : la table de jeu, les joueurs, le chat et le vote.
  La salle de jeu réelle exige un serveur et des comptes : elle ne peut pas être filmée sans toucher à Supabase.
- **Pas de type d'activité « Loup-Garou »** dans « Lancer une activité » : la partie en vrai passe par la table
  de Loup-Garou « En présentiel (QR code) », qui existe. La vidéo montre donc les deux, sans inventer de bouton.
- **Les 9 modes sont dans la nouvelle version de l'app** (moteur V3) : captures de cette version, sans mention « bientôt ».
