# Mettre LinkFoot en ligne

Tant que le serveur n'est hébergé nulle part, deux personnes ne peuvent pas s'affronter :
tout tourne sur l'appareil de chacun, et l'écran En ligne affiche un exemple étiqueté
comme tel. Ce fichier dit comment y remédier.

Le code du serveur est déjà écrit et testé (`npm run test:serveur`, 37 vérifications par
HTTP). Il ne manque que deux choses : une machine qui réponde, et un endroit où ranger
les parties.

## Ce qu'il faut

**Un compte Vercel** (gratuit suffit pour commencer) et **un magasin clé-valeur**. Le
reste est dans le dépôt : `api/online.js` expose les routes, `vercel.json` les route,
`server/kv-storage.js` range.

## En cinq commandes

```bash
npm i -g vercel
vercel login
vercel link              # choisir ou créer le projet
vercel --prod
```

Le serveur répond alors sur `https://<ton-projet>.vercel.app/api/online`.

Vérifie tout de suite :

```bash
curl https://<ton-projet>.vercel.app/api/online/
```

La réponse dit sur quoi les parties sont rangées :

```json
{ "ok": true, "stockage": "memory",
  "avertissement": "Stockage en mémoire : tout est perdu au redémarrage. …" }
```

**Tant que `stockage` vaut `memory`, ne fais jouer personne pour de vrai.** Les classements,
les ligues et les transferts disparaîtront au premier redémarrage, et une fonction sans
serveur redémarre souvent.

## Le stockage

Le serveur ne demande que trois choses : lire une clé, en écrire une, en effacer une.
Trois possibilités, par ordre de préférence.

**Upstash Redis.** Le bon choix pour un jeu : la lecture voit immédiatement l'écriture,
ce qui compte quand deux joueurs consultent un classement à la seconde près. Dans le
tableau de bord Vercel, onglet Storage, ajoute une base Upstash au projet : elle pose
elle-même `KV_REST_API_URL` et `KV_REST_API_TOKEN`. Le serveur les trouve tout seul.

**Vercel Blob.** Acceptable pour commencer. Pose `BLOB_READ_WRITE_TOKEN`. Réserve à
connaître : une écriture n'est pas visible partout immédiatement, donc deux joueurs très
rapides peuvent lire un classement vieux de quelques secondes. Suffisant pour jouer entre
amis, pas pour un tournoi serré.

**Rien.** Le serveur tombe en mémoire, le dit dans sa réponse de santé, et perd tout au
redémarrage. C'est fait pour essayer, pas pour jouer.

Après avoir ajouté les variables, redéploie (`vercel --prod`) et revérifie : `stockage`
doit dire `redis` ou `blob`, et `avertissement` doit valoir `null`.

## Brancher le jeu dessus

Dans `app/App.js`, deux lignes :

```js
import { OnlineClient, connectOnline } from '../src/online.js';
connectOnline(club, new OnlineClient({
  url: 'https://<ton-projet>.vercel.app/api/online',
  headers: { 'x-club-id': monIdentifiant }
}));
```

L'écran En ligne cesse alors d'afficher l'exemple et montre les vraies données.

## L'identité, et pourquoi ce n'est pas encore de l'authentification

Le serveur reconnaît un joueur à l'en-tête `x-club-id`. **Ce n'est pas une
authentification** : n'importe qui peut envoyer l'identifiant d'un autre et jouer à sa
place. C'est assez pour une partie entre amis qui se font confiance, et pas assez pour
ouvrir à des inconnus.

Pour ouvrir, il faut remplacer une seule fonction, `auth` dans `api/online.js`, par la
vérification d'un vrai jeton. Le reste du serveur ne bouge pas : toutes les routes
reçoivent déjà un identifiant vérifié par elle et ne font confiance à rien d'autre.

## Ce que le serveur refuse déjà

Ce n'est pas de la décoration : chaque ligne est vérifiée par `npm run test:serveur`.

- Une requête sans identité : 401.
- Une équipe de dix joueurs, sans gardien, avec une note de 500, ou dans une formation
  inventée : 400, avec la raison.
- Un joueur qui s'affronte lui-même : 400.
- Un score annoncé par le client : le serveur rejoue le match et dément (§29).
- Plus de 40 matchs classés ou 30 packs par jour, moins de 20 secondes entre deux
  matchs : 429.
- Les probabilités des packs et les plafonds de gains sont calculés ici, jamais lus
  depuis le client.
- **L'argent réel est désactivé** (§76), et le serveur le déclare dans sa réponse de
  santé. Ce n'est pas masqué dans l'écran, c'est refusé côté serveur.

## Le coût

Un match coûte environ deux secondes de calcul au serveur, parce qu'il le rejoue
réellement pour en vérifier le score. La fonction est configurée pour 30 secondes et
1 Go. À quelques dizaines de matchs par jour, le palier gratuit suffit. À quelques
milliers, il faudra sortir la simulation de la requête : la mettre dans une file et
renvoyer le résultat quand il est prêt.
