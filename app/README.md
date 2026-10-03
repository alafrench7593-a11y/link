# LinkFoot sur téléphone

L'application Expo. Elle ne contient **aucune règle du jeu** : elle importe le moteur
depuis `../src` et se contente de l'afficher. Le même code décide des matchs ici, dans
l'écran Mon Club du canvas, et sur le serveur. Une règle changée dans le moteur change
les trois d'un coup.

## Démarrer

```bash
cd app
npm install
npx expo start
```

Puis scanner le QR code avec **Expo Go** (App Store ou Play Store). Le téléphone et
l'ordinateur doivent être sur le même réseau Wi-Fi. Si ça ne passe pas :

```bash
npx expo start --tunnel
```

## Ce qu'il y a dedans

Cinq onglets en bas : Accueil, Effectif, **Match** (le bouton central citron), Entraînement,
Packs. En haut, deux boutons ronds : **En ligne** et les **Quêtes** (une pastille citron quand
une récompense attend). Sur l'accueil, la section **DIRECTEUR SPORTIF** mène aux neuf écrans
du cahier des charges ; ces écrans ont un bouton retour en haut à gauche.

| Écran | Ce qu'on y fait |
| --- | --- |
| Accueil | le résumé (note, niveau, séances, solde) et la section DIRECTEUR SPORTIF |
| Mon effectif | le onze poste par poste (un blessé est refusé), la liste, puis la fiche d'un joueur : statistiques, niveau, XP, compétences, rapport du recruteur, vente |
| Compétences | l'inventaire, et le choix du joueur qui porte chaque compétence |
| Pack | le pack unique en 3D (il tremble, éclate dans la couleur de la meilleure rareté, puis les lots se révèlent un par un) et ses deux tables de probabilités (familles, raretés) |
| Entraînement | les séances disponibles, les cartes d'amélioration, la réunion d'équipe |
| Transferts | acheter sur le marché, vendre son effectif |
| Quêtes | les objectifs en cours et leurs récompenses, sous le plafond du jour |
| Finances | le solde, ce qui a été gagné aujourd'hui par source, le journal des transactions |
| Tactique | formation, mentalité, style de jeu et toutes les consignes lues par le moteur |
| Club | la progression du club, le staff, le stade, le centre de formation |
| Match | le match du calendrier ou un amical, trois pronostics ; en direct : le match en 3D (chaque action en temps réel, le reste sauté ; la vue 2D en bascule), changements, consignes de la voix, cartes de match, rythme et pause |
| Division | le classement de la division, les résultats de la dernière journée, où en est le club et le prochain match |
| En ligne | le journal, le classement, les meilleures équipes, les meilleurs joueurs |

La 3D (le match, le pack) passe par `expo-gl` et `three`, installés avec le reste, et par
le même rendu que l'écran Mon Club (`src/stade3d.js`). Sur un appareil sans WebGL, le match
repasse en 2D et le pack 3D s'efface, sans erreur : le bouton OUVRIR LE PACK marche pareil.

Sur le web, les joueurs du match en 3D sont de vrais corps (le footballeur de Gameplay
Football, animé par de vraies captures : `rendu/labo/reel.js`). La base de mouvements (12 Mo)
et le personnage (400 Ko) partent avec l'app comme des fichiers à part (`metro.config.js`) et se
chargent à la première vue 3D ; en attendant, ou si l'appareil ne suit pas, les footballeurs en
géométrie restent. Sur téléphone, ce n'est pas encore vérifié sur un appareil : `src/reel.js`
est vide (le web prend `src/reel.web.js`) ; y mettre le contenu de `reel.web.js` pour l'essayer.

## Le dessin

Il suit la maquette Figma « Football-app » (Figma Make, prototype LINKCONNECT), adaptée à un
jeu de directeur sportif : rien n'y est inventé en données, chaque chiffre affiché vient du
moteur. Ce qui en est repris :

- les couleurs (`src/theme.js`) : noir `#050505`, surfaces `#101010` à `#202020` bordées d'un
  filet blanc à 10 %, citron `#C7FF32` pour ce qui agit et ce qui compte, rouge `#FF4559` pour
  le direct ; rayons 10, 16 et 24 ;
- les polices : Manrope (titres, chiffres) et DM Sans (texte), livrées avec l'app dans
  `assets/polices` (licence SIL OFL 1.1, jointe), sans service de polices en ligne. Sur le web
  elles se chargent au démarrage (`src/polices.web.js`) ; sur téléphone, la police du système en
  attendant de les embarquer avec expo-font ;
- les briques (`src/ui.js`) : icônes au trait de la maquette (et quelques-unes dessinées au même
  trait), marque, surtitres, en-têtes de section, pastilles, blasons de club, boutons ronds ;
- la barre du haut et la barre du bas à bouton central, le héros de l'accueil, la carte du
  match à venir, les chiffres du club, le bloc de score, les statistiques en barres, le fil du
  match en frise.

Le nom reste LinkFoot (la maquette dit LINKCONNECT, un réseau social de football : ses écrans
de fil d'actualité, de communautés et d'événements n'ont pas d'équivalent dans le jeu et ne sont
pas repris). L'image du héros n'est pas une photo : c'est le footballeur du jeu, rendu par le
moteur 3D de LinkFoot (`rendu/outils/cliche.mjs`, scène 16, caméra serrée), retouché comme les
photos de la maquette (moins saturé, plus sombre).

Les icônes et les dégradés passent par `react-native-svg` (la version d'Expo SDK 52).

## La sauvegarde

`src/store.js` range la partie dans AsyncStorage, c'est-à-dire sur le téléphone. Le
`SaveManager` écrit automatiquement après chaque changement, avec un délai pour ne pas
écrire à chaque image.

Pour que la partie suive le joueur d'un appareil à l'autre, il suffit de remplacer
`PhoneStore` par `HttpStore` : le reste de l'app ne change pas.

```js
import { HttpStore } from '../src/save.js';
const store = new HttpStore({ url: 'https://ton-serveur/clubs/' + userId + '/save' });
```

## Brancher le mode en ligne

Les matchs classés, les ligues entre amis, le classement et le marché des transferts
demandent le serveur (`../server/online-routes.js`). Deux lignes dans `App.js` :

```js
import { OnlineClient, connectOnline } from '../src/online.js';
connectOnline(club, new OnlineClient({
  url: 'https://ton-serveur/online',
  headers: { 'x-club-id': monIdentifiant }
}));
```

Sans elles, l'app tourne entièrement sur le téléphone, et l'écran En ligne montre un
exemple étiqueté comme tel.

## Pourquoi metro.config.js

Par défaut, Metro ne regarde pas en dehors du dossier `app/`. Le fichier lui ouvre la
porte du dossier parent, pour qu'il trouve le moteur dans `../src`. C'est tout ce qu'il
fait.

## Vérifier sans téléphone

```bash
npx expo start --web      # l'app dans un navigateur
npm run verifier          # l'app construite, puis parcourue comme un joueur
npm test --prefix ..      # les règles du jeu, sans interface
```

`npm run verifier` construit l'app pour le navigateur, la sert, et fait ce qu'un
joueur ferait : premier lancement, les six onglets (cinq en bas, En ligne en haut), les
neuf entrées du directeur sportif, le pack ouvert en 3D, le match en direct en 3D et en
2D, second lancement.
Quarante-six vérifications. C'est ce parcours qui a trouvé, au premier vrai
lancement de l'app, qu'elle ne se construisait pas (il manquait `expo-asset`) et
qu'elle ne créait jamais le club : tout nouveau joueur commençait sur le club de
démonstration, niveau 7, 1 000 jetons.
