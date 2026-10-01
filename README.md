# linkfoot-engine

Le moteur de match et les règles manager de LinkFoot, sortis de l'écran Mon Club.
Aucune dépendance, aucun DOM, aucun framework. Le même code tourne dans ton app,
dans Node, ou sur un serveur.

## Pourquoi ce module existe

Tant que le jeu vivait dans la page du canvas, tout l'état disparaissait au rechargement :
les artefacts n'ont pas accès au stockage du navigateur. Ici l'état du club est un objet
JavaScript ordinaire, donc sérialisable, donc persistable où tu veux.

## Contenu

```
src/engine.js   moteur de match : 11 contre 11, physique du ballon, décisions des joueurs,
                dribbles, tacles, hors-jeu, coups de pied arrêtés, cartons, remplacements,
                contrôle direct au joystick. ~1 300 lignes, zéro dépendance.
src/club.js     classe Club : effectif, compétences, entraînement, forme, blessures, marché,
                staff, stade, centre de formation, synergies, finances, saison, divisions.
src/state.js    état de départ d'un club.
src/save.js     sérialisation versionnée et stockages (mémoire, navigateur, HTTP).
src/index.js    point d'entrée ES module.
src/react.js    hooks useClub et useLiveMatch pour React et React Native.
server/         routes de sauvegarde prêtes à monter dans Express, plus un serveur de démo.
tools/          synchronisation de l'artboard du canvas depuis src/.
canvas/         l'écran Mon Club, regénéré depuis src/ par npm run sync.
types/          déclarations TypeScript.
dist/linkfoot.js  même chose en un seul fichier, expose window.LinkFoot.
demo/demo.html  page de démonstration : joue des matchs, recharge, le club est toujours là.
test/sim.js     simulateur d'équilibrage et test d'aller-retour de sauvegarde.
```

## Installer

```bash
npm install ./linkfoot-engine-1.0.0.tgz
```

Ou, depuis un dépôt :

```bash
npm install git+ssh://git@github.com/JaggyINK/linkfoot-engine.git
```

Trois points d'entrée :

```js
import { Club, SaveManager, HttpStore } from 'linkfoot-engine';         // le jeu
import { createClubHooks } from 'linkfoot-engine/react';                 // React et React Native
import { saveRoutes, FileStorage } from 'linkfoot-engine/server';        // les routes de sauvegarde
```

Pour une page ouverte depuis le disque ou une WebView, `dist/linkfoot.js` expose
`window.LinkFoot` et ne demande aucun bundler.

Les types TypeScript sont fournis (`types/index.d.ts`), rien à installer en plus.

## Démarrer

```bash
node test/sim.js 200      # simule 200 matchs et vérifie l'équilibrage
node build.mjs            # régénère dist/linkfoot.js
open demo/demo.html       # la démo, ouvrable directement depuis le disque
```

## Utilisation

```js
import { Club, LocalStore, SaveManager } from 'linkfoot-engine';

const club = new Club();
const mgr = new SaveManager(club, new LocalStore('linkfoot.save')).start();
await mgr.load();                 // reprend la partie si elle existe

const r = club.playMatch({ club: 'Auteuil United', ovr: 67, style: 'tiki' });
console.log(r.score, r.res);      // [2, 1] 'w'
console.log(club.state.balance);  // le solde a déjà été mis à jour
```

`SaveManager.start()` enregistre automatiquement après chaque changement d'état,
avec un délai pour éviter d'écrire à chaque image.

### Brancher ton backend

```js
import { HttpStore, SaveManager } from 'linkfoot-engine';

const store = new HttpStore({
  url: `https://api.linkfoot.app/clubs/${userId}/save`,
  headers: { Authorization: `Bearer ${token}` }
});
const mgr = new SaveManager(club, store, { delay: 1500, onError: console.warn }).start();
await mgr.load();
```

Le contrat attendu côté serveur est minimal :

| Méthode | Chemin | Comportement |
| --- | --- | --- |
| GET | `/clubs/:id/save` | renvoie le payload JSON, ou 404 si aucune sauvegarde |
| PUT | `/clubs/:id/save` | enregistre le corps de la requête tel quel |
| DELETE | `/clubs/:id/save` | efface la sauvegarde |

Le payload fait environ 8 ko par club. Tu peux le stocker en JSON brut dans une colonne,
sans schéma : la montée de version est gérée côté client.

### Faire tourner le moteur sans le manager

```js
import { makeEngine } from 'linkfoot-engine';

const E = makeEngine(cfg);   // cfg vient de club.engineCfg(...)
E.finish();                  // joue les 90 minutes d'un coup
const f = E.state();         // score, statistiques, notes, énergie, cartons
```

Pour le temps réel, utilise `E.step()` image par image, `E.frame()` pour l'état à
afficher, `E.setHuman(i)` pour prendre le contrôle d'un joueur, et passe les entrées
par `cfg.input()`.

## Dans une app React ou React Native

React est passé en paramètre, donc aucune version n'est imposée et le même code
marche en web et en natif.

```jsx
import React from 'react';
import { createClubHooks } from 'linkfoot-engine/react';
import { HttpStore } from 'linkfoot-engine';

const { useClub, useLiveMatch } = createClubHooks(React);
const store = new HttpStore({ url: `/api/clubs/${userId}/save` });

function MonClub() {
  const { state, ready, playMatch, act } = useClub({ store });
  if (!ready) return <Chargement />;
  return (
    <>
      <Entete division={state.division} solde={state.balance} />
      <button onClick={() => playMatch({ club: 'Auteuil United', ovr: 67, style: 'tiki' })}>Jouer</button>
      <button onClick={() => act((c) => c.hireStaff('physique'))}>Recruter un préparateur</button>
    </>
  );
}
```

`useLiveMatch` pilote un match en temps réel et te rend une image à chaque rafraîchissement,
à toi de la dessiner comme tu veux.

## Côté serveur

```js
import express from 'express';
import { saveRoutes, FileStorage } from 'linkfoot-engine/server';

const app = express();
app.use(express.json({ limit: '512kb' }));
app.use('/clubs', saveRoutes({
  storage: new FileStorage('./saves'),
  auth: async (req, id) => (await session(req)).userId === id
}));
```

`SqlStorage` est fourni si tu as déjà une base : il attend une fonction `query(sql, params)`
et range la sauvegarde dans une colonne `jsonb` ou `text`. Une seule table :

```sql
create table club_saves (
  club_id    text primary key,
  payload    jsonb not null,
  updated_at timestamptz not null default now()
);
```

Pour voir tourner l'ensemble sans rien installer : `npm run demo`, puis
<http://localhost:8787>. Le serveur de démonstration sert la page et les routes,
sans aucune dépendance.

## Une seule source de vérité

L'écran Mon Club du canvas (`canvas/Club.dc.html`) contenait sa propre copie du moteur.
Deux copies, c'est deux équilibrages qui divergent dès la première correction faite d'un
seul côté. Le moteur et les règles vivent donc dans `src/`, et l'artboard est regénéré :

```bash
npm run sync      # réinjecte src/engine.js et les méthodes de src/club.js dans l'artboard
npm run check     # ne réécrit rien : échoue si l'artboard a divergé, puis simule 100 matchs
```

Après un `npm run sync`, republie `canvas/Club.dc.html` dans le canvas. L'ordre de travail
est toujours le même : corriger dans `src/`, mesurer avec `npm test`, synchroniser, republier.
Ne corrige jamais directement dans l'artboard : le prochain `sync` écraserait ta correction.

## Cartes et collection

Les taux de rareté sont centralisés dans `Club.RARITY()` : Normal 55 %, Commun 25 %,
Rare 12 %, Épique 5 %, Élite 2 %, Or 0,9 %, Légendaire 0,1 %. Changer une valeur
change le jeu partout, y compris les probabilités affichées au joueur.

`Club.CARD_POOL()` est un catalogue fixe de 500 cartes, identifiants stables. Les packs
tirent dedans, donc les doublons sont réels : un doublon se convertit en fragments
selon sa rareté (1 pour une Normale, 200 pour une Légendaire). La collection se compte
sur 500.

Cinq packs (`Club.PACK_DEFS()`) avec des tables de poids différentes, et
`Club.packOdds(def)` calcule les probabilités réelles affichées sur l'écran Packs.
Une carte Or n'est pas automatiquement meilleure : sa rareté fixe une fourchette de
note, ce sont les statistiques et les compétences qui décident ensuite.

## Versions de sauvegarde

`SAVE_VERSION` vaut 2. Une sauvegarde plus ancienne est migrée au chargement par
les fonctions de `MIGRATIONS` dans `save.js`. Quand tu ajoutes un champ persistant :

1. ajoute sa clé dans `PERSIST` ;
2. incrémente `SAVE_VERSION` ;
3. ajoute une entrée dans `MIGRATIONS` pour la version précédente.

Les anciennes parties continuent de se charger.

## Équilibrage

`node test/sim.js 200` sort les chiffres de référence. Fourchette visée, calée sur
des moyennes de championnat réelles :

| Mesure | Cible | Mesuré |
| --- | --- | --- |
| Buts par match (total) | 2,5 à 3,0 | 2,4 à 2,9 |
| Tirs par match (total) | 24 à 30 | 25 à 28 |
| Tirs cadrés | 9 à 12 | 10 à 11 |
| xG par match | 2,4 à 3,0 | 2,4 à 2,9 |
| Fautes par match | 20 à 24 | 20 |
| Cartons jaunes | 3,5 à 4,5 | 3,7 |
| Cartons rouges | 0,05 à 0,10 | 0,13 |
| Penalties par match | 0,2 à 0,4 | 0,3 |

Un joueur déjà averti lève le pied : sa probabilité de faute tombe à 14 % et il
tacle moins, et l'entraîneur adverse le sort en priorité. C'est ce qui a divisé les
expulsions par deux et fait disparaître la plupart des scores aberrants.
Il reste environ deux fois trop de rouges par rapport au football réel : la cause
est le second carton jaune, que seule une substitution automatique côté joueur
réglerait complètement.

Compte au moins 100 matchs : en dessous, deux matchs à 7 buts suffisent à fausser la moyenne.
Le test échoue si le total sort de la fourchette, ce qui en fait un garde-fou utile
en intégration continue avant de toucher au moteur.

## Limites connues

- `playMatch` joue un match entier d'un coup. Pour le mode « Je joue », il faut piloter
  `E.step()` depuis une boucle d'animation, comme le fait l'écran Mon Club.
- Les tournois, les ligues entre amis et le classement général ne sont pas ici :
  ils supposent un serveur et un appariement entre joueurs.
- Un match prend environ 1,5 seconde en simulation complète sur un poste de bureau.
  Pour simuler une saison entière côté serveur, mets les matchs en file plutôt que
  de bloquer une requête.
