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

Six onglets en bas : Accueil, Effectif, Match, Entraînement, Packs, En ligne. Sur
l'accueil, la section **DIRECTEUR SPORTIF** mène aux neuf écrans du cahier des charges.

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
joueur ferait : premier lancement, les six onglets, les neuf entrées du directeur
sportif, le pack ouvert en 3D, le match en direct en 3D et en 2D, second lancement.
Quarante-trois vérifications. C'est ce parcours qui a trouvé, au premier vrai
lancement de l'app, qu'elle ne se construisait pas (il manquait `expo-asset`) et
qu'elle ne créait jamais le club : tout nouveau joueur commençait sur le club de
démonstration, niveau 7, 1 000 jetons.
