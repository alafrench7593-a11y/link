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

| Écran | Ce qu'on y fait |
| --- | --- |
| Club | le résumé : note, niveau, séances, solde, et l'accès au reste |
| Effectif | la liste, puis la fiche d'un joueur : niveau, XP, compétences, rapport du recruteur |
| Match | choisir un adversaire, miser trois pronostics, jouer, lire le rapport |
| Entraînement | les séances disponibles, la réunion d'équipe, le Pack Entraînement et le Pack Entraîneur |
| Packs | le LinkFoot Pack et le Pack Compétence, avec leurs probabilités |
| En ligne | le journal, le classement, les meilleures équipes, les meilleurs joueurs |

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
node ../test/progression.js   # les règles du jeu, sans interface
```
