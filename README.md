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
                dribbles, tacles, hors-jeu, coups de pied arrêtés, cartons, remplacements.
                ~1 700 lignes, zéro dépendance.
src/club.js     classe Club : le noyau, qui mélange les modules de domaine ci-dessous.
src/players.js  fiches joueurs : statistiques, note globale, profil.
src/skills.js   compétences procédurales (§32 à §36).
src/cards.js    raretés, catalogue de 500 cartes, packs, collection, fragments, niveaux (§56 à §65).
src/staff.js    staff, stade, centre de formation, synergies, finances.
src/training.js entraînement, forme, énergie, blessures (§68, §69).
src/transfer.js valeur, marché, vente (§71).
src/progression.js niveaux, missions, suites de match, saison, vieillissement (§70, §72).
src/tactics.js  tactiques, formations, rôles, composition, passerelle vers le moteur (§40 à §43).
src/tracks.js   la colonne vertébrale de la progression du club : un seul axe, le niveau,
                commande les paliers du staff, du stade, du centre et du pack.
src/playerxp.js niveau et XP d'un joueur, courbe exponentielle, attributs cachés (§5, §6).
src/quests.js   quêtes et économie encadrée : plafonds par source, journal (§7, §8, §29).
src/creation.js création du club, effectif normal de départ et joueur rare offert (§2, §3).
src/trainpack.js les séances et le matériel d'entraînement : l'entraînement est limité (§6).
src/packs.js    le pack unique, tel que l'écran l'affiche, et le matériel de l'entraîneur.
src/news.js     le journal : transforme de vrais résultats en articles (§26).
src/versus.js   match entre deux vrais clubs, rejouable à l'identique depuis une graine.
src/online.js   le client en ligne : il parle au serveur et rejoue, il ne décide rien.
src/onlineui.js ce que l'écran affiche du multijoueur, y compris quand il n'y a pas de serveur.
src/state.js    état de départ d'un club.
src/save.js     sérialisation versionnée et stockages (mémoire, navigateur, HTTP).
src/league.js   classements, calendriers, montées et descentes (§72, §75).
src/division.js la division du directeur sportif : six clubs, cinq journées, les autres matchs simulés (§22).
src/direct.js   le match en direct : remplacements, consignes de la voix, cartes de match (§2).
src/tournament.js tournois 8 à 64, élimination directe ou groupes, récompenses (§73, §74, §76).
src/index.js    point d'entrée ES module.
src/react.js    hooks useClub et useLiveMatch pour React et React Native.
server/         routes de sauvegarde prêtes à monter dans Express, plus un serveur de démo.
tools/          synchronisation de l'artboard du canvas depuis src/.
canvas/         l'écran Mon Club, regénéré depuis src/ par npm run sync.
types/          déclarations TypeScript.
dist/linkfoot.js  même chose en un seul fichier, expose window.LinkFoot.
app/            l'application Expo pour téléphone (voir app/README.md)
src/passerelle.js le match exporté pour un autre rendu (format linkfoot-match, docs/passerelle-ue5.md).
unreal/         le rendu Unreal Engine 5.8 : projet, cœur C++ testé hors d'Unreal (voir unreal/README.md).
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

Pour le temps réel, utilise `E.step()` image par image et `E.frame()` pour l'état à
afficher. Le moteur joue le match tout seul : il n'y a pas de contrôle direct.

## Sur téléphone, avec Expo Go

L'application native est dans `app/`. Elle ne contient aucune règle du jeu : elle
importe le moteur depuis `../src` et se contente de l'afficher.

```bash
cd app
npm install
npx expo start        # puis scanner le QR code avec Expo Go
```

Six onglets (Accueil, Effectif, Match, Entraînement, Packs, En ligne) et, sur l'accueil,
la section **DIRECTEUR SPORTIF** et ses neuf entrées : Mon effectif, Compétences, Pack,
Entraînement, Transferts, Quêtes, Finances, Tactique, Club. La partie est
sauvegardée sur le téléphone (AsyncStorage) ; remplacer `PhoneStore` par `HttpStore`
la fait suivre d'un appareil à l'autre. Détails dans `app/README.md`.

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

Les taux de rareté sont centralisés dans `Club.RARITY()` : Normal 70 %, Rare 20 %,
Épique 7 %, Élite 2 %, Gold 0,9 %, Legendary 0,1 %. Changer une valeur change le jeu
partout, y compris les probabilités affichées au joueur.

`Club.CARD_POOL()` est un catalogue fixe de 500 cartes, identifiants stables. Les packs
tirent dedans, donc les doublons sont réels : un doublon se convertit en fragments
selon sa rareté (1 pour une Normale, 200 pour une Légendaire). La collection se compte
sur 500.

Un seul pack dans tout le jeu (`Club.THE_PACK()`), et
`Club.packOdds(def)` calcule les probabilités réelles affichées sur l'écran Packs.
Une carte Or n'est pas automatiquement meilleure : sa rareté fixe une fourchette de
note, ce sont les statistiques et les compétences qui décident ensuite.

## Météo, âge, amicaux

`§54` La météo est tirée une fois par match (soleil 52 %, nocturne 26 %, pluie 16 %,
neige 6 %) et agit vraiment : la pluie fait glisser le ballon et salit les contrôles,
la neige le freine et dégrade fortement les passes. Elle s'affiche sur la ligne de
coup d'envoi, pas ailleurs.

`§70` À chaque fin de saison, tout le monde prend un an. Au-delà de 31 ans un joueur
peut perdre un point de vitesse, de physique ou de dribble, et cela s'accélère après
34 ans. Avant 24 ans il progresse vers son potentiel.

`§73` et `§51` Un bouton « Amical » sur chaque adversaire lance un match hors
championnat : il ne compte pas au classement, rapporte la moitié, et se termine
par une séance de tirs au but en cas de nul. La séance suit les règles réelles,
cinq tireurs puis mort subite, et chaque frappe compare le tir et le sang-froid du
tireur aux réflexes du gardien, avec la pression qui monte à partir du quatrième.

## Tournois et ligues

```js
import { createTournament, pendingMatches, reportResult, finalRanking, rewards } from 'linkfoot-engine';

const T = createTournament({ size: 16, entrants, format: 'groups', entry: 100 });
for (const m of pendingMatches(T)) {
  const r = jouer(m.home, m.away);               // ton moteur, ou makeEngine
  reportResult(T, m, r.hs, r.as, r.pso);         // pso obligatoire si match nul en élimination
}
finalRanking(T);   // podium
rewards(T);        // jetons par rang
```

`node test/tournament.js 16` joue deux tournois complets avec le vrai moteur, puis une
ligue aller-retour avec classement, montées et descentes.

**Récompenses en argent réel : l'architecture existe, les paiements sont désactivés.**
`PAYOUTS.enabled` vaut false, `rewards()` ne renvoie jamais de montant, et la route
serveur refuse par 409 tout tournoi qui tenterait de les activer. Rien ne se débloque
sans décision explicite côté serveur, une fois le cadre juridique, l'âge, la
géolocalisation et les règles des plateformes validés.

## Niveaux de carte

Un doublon donne des fragments, les fragments font monter une carte du niveau 1 au
niveau 5 : 25, 60, 140 puis 320 fragments. Chaque niveau donne +2 sur les deux
statistiques les plus importantes du poste, donc un gain réel de note.

## Découpage (§80)

Quinze modules : `engine`, `players`, `skills`, `cards`, `staff`, `training`, `transfer`,
`progression`, `tactics`, `club`, `state`, `save`, `league`, `tournament`, `react`,
plus `server/`. Chaque domaine expose un objet de méthodes que `club.js` mélange dans
`Club.prototype`, donc l'appelant ne voit qu'une seule classe.

`engine.js` reste d'un seul tenant : c'est une fermeture unique où les décisions, la
physique et le rendu des images partagent le même état `W`. Le découper demanderait de
faire transiter cet état entre modules, ce qui coûterait en performance et ferait
courir un risque de régression sur un moteur calibré. Le script de synchronisation lit
maintenant les neuf fichiers de règles, pas seulement `club.js`.

## Versions de sauvegarde

`SAVE_VERSION` vaut 2. Une sauvegarde plus ancienne est migrée au chargement par
les fonctions de `MIGRATIONS` dans `save.js`. Quand tu ajoutes un champ persistant :

1. ajoute sa clé dans `PERSIST` ;
2. incrémente `SAVE_VERSION` ;
3. ajoute une entrée dans `MIGRATIONS` pour la version précédente.

Les anciennes parties continuent de se charger.

## Directeur sportif

Le joueur n'incarne pas un footballeur : il dirige un club. Pendant le match il ne touche
à rien, les 22 joueurs sont pilotés par l'IA. Il agit avant et autour : composition,
formation, tactique, compétences équipées, entraînement, fatigue, remplacements, recrutement.

```
LinkFoot Pack → inventaire → joueur compatible → IA → décision → action → statistique → progression
```

Chaque flèche existe dans le code, et `test/progression.js` échoue si l'une d'elles se casse.

### Le pack (§8, §9)

**Un seul pack dans tout le jeu**, le **LinkFoot Pack** : 250 jetons, 3 tirages, un bouton
« OUVRIR LE PACK ». Chaque tirage choisit d'abord une **famille**, puis une **rareté**.
Les deux tables sont affichées avant l'ouverture, calculées côté système et jamais
modifiables par le client (§29). Elles se règlent dans `PACK_SLOTS()` et `RARITY()` :
changer une part change le tirage *et* l'affichage, jamais l'un sans l'autre.

| Famille | Part | Ce qu'elle donne |
| --- | --- | --- |
| Joueur | 40 % | une carte du catalogue ; un joueur déjà au club devient des fragments |
| Compétence | 45 % | une compétence, à équiper sur un joueur compatible |
| Objet | 15 % | séance, carte d'amélioration, stage, causerie, plan tactique |

| Rareté | Taux | Puissance d'une compétence | Combinaisons |
| --- | --- | --- | --- |
| Normal | 70 % | 0 à 19 | 9 769 |
| Rare | 20 % | 20 à 39 | 1 970 |
| Épique | 7 % | 40 à 59 | 386 |
| Élite | 2 % | 60 à 74 | 97 |
| Gold | 0,9 % | 75 à 89 | 51 |
| Legendary | 0,1 % | 90 à 100 | 47 |

La rareté vaut pour les trois familles : un objet Gold est aussi rare qu'un joueur Gold.
Celle d'une compétence n'est jamais écrite à la main : elle **découle** de sa puissance
calculée (§12). Une compétence très forte est donc rare dans le catalogue *et* au tirage.

Il y a eu jusqu'à quatre packs. Les trois packs ciblés (Compétence, Entraînement,
Entraîneur) ont été retirés : le §8 n'en veut qu'un, et deux d'entre eux vendaient des
objets Gold à 1,8 % et 2,6 % par lot, au-dessus du « 1 % ou moins » du §12. Tout ce
qu'ils donnaient sort du pack unique, à la rareté commune : un objet Gold sort désormais
à 0,135 % par tirage. Chaque objet est rangé par les mêmes fonctions
(`appliquerObjetsEntrainement`, `rangerObjetsCoach`), et `test/kiosque.js` vérifie objet
par objet qu'il fait ce que sa carte annonce.

### Les compétences (§10 à §13)

12 320 combinaisons (22 effets x 14 conditions x 5 niveaux x 8 grades), générées à la
demande, en dix-sept catégories : attaque, défense, dribble, passe, tir, finition, vitesse,
physique, mental, tactique, gardien, pressing, transition, leadership, coups de pied
arrêtés, situationnel, collectif. Chacune porte un effet lu par le moteur de match :
aucune n'est décorative (§13). Les deux dernières arrivées, Perforateur (appels dans le
dos de la défense) et Contre éclair (jouer vers l'avant dès la récupération), changent
ce que les joueurs font, pas seulement un chiffre.

Chaque compétence a des prérequis (poste, statistiques, niveau du joueur) et un joueur ne
peut en porter qu'un nombre limité, qui augmente avec son niveau : 1 emplacement, 2 au
niveau 6, 3 au niveau 15, 4 au niveau 25. Un refus nomme toujours ce qui manque (§11).
Le directeur sportif choisit qui la porte, parmi les joueurs compatibles.

### Le niveau d'un joueur

Un seul niveau par joueur, monté par l'XP des matchs. L'entraînement en fragments accélère
mais reste plafonné à 6 séances par jour : **l'argent n'achète pas une superstar** (§6).

| Palier | XP | Environ |
| --- | --- | --- |
| 1 → 2 | 60 | 1 match |
| 5 → 6 | 112 | 2 matchs |
| 10 → 11 | 247 | 5 matchs |
| 20 → 21 | 1 185 | 24 matchs |
| 30 → 31 | 5 696 | 115 matchs |

Chaque joueur porte aussi sept caractéristiques cachées (potentiel réel, régularité, grands
matchs, sang-froid, progression, risque de blessure, adaptation tactique). Elles ne
s'affichent pas comme des statistiques, mais `hiddenMods()` les traduit en effets réels
pendant le match, et la fiche du joueur les résume en mots dans le rapport du recruteur (§5).

### Les compétences se voient sur le terrain (§14, §23)

Une compétence équipée alimente un *trait*, et le trait ouvre des variantes de gestes
et change la prise de décision. Mesuré sur 12 matchs identiques, même effectif, mêmes graines :

| Compétence équipée | Effet mesuré |
| --- | --- |
| Funambule | dribbles tentés 8,5 → 15,1 pour mille décisions · gestes de palier 3 et plus : 8 → 160 |
| Passe laser | passes entre les lignes 62,5 → 86,7 pour mille décisions |
| Tueur | frappes 4,2 → 4,4 pour mille · frappes spectaculaires 5 → 36 |

Les gestes rares restent minoritaires : avec un Funambule, 392 gestes simples pour 160 rares.
Le trait ouvre la porte, il ne la force pas. Aucune série ne gagne tous ses matchs (§21).

Les huit gestes techniques (crochet, protection, feinte, double contact, passement, roulette,
petit pont, sombrero) sont rangés en cinq paliers. Le palier atteignable dépend du dribble,
de l'agilité et du trait ; un geste de palier 4 ou plus prend sa ligne dans le rapport du match.

```bash
node test/traits.js 12       # échoue si une compétence redevient un simple chiffre
```

### Les pronostics (§9)

Avant chaque match, trois pronostics au maximum, mise plafonnée, cotes calculées depuis
l'écart de niveau. Ils portent sur le match du jeu, jamais sur un match réel, et les gains
passent par `earn('prono')`, donc par le plafond quotidien.

### L'entraînement est limité (§6)

Chaque séance consomme **une séance en stock**. On en reçoit deux par jour, vingt au
maximum en réserve, et le pack en donne à sa part « Objet ». Entraîner devient une
décision : avec trois séances en poche, on choisit qui on fait progresser.

Le matériel sort du pack unique : un objet par rareté, à la rareté tirée.

| Objet | Rareté | Effet |
| --- | --- | --- |
| Séance d'entraînement | Normal | +1 séance |
| Carte d'amélioration | Rare | +2 sur une statistique, au joueur de ton choix |
| Double séance | Épique | +2 séances |
| Séance spécialisée | Élite | +3 séances et une carte |
| Stage de pré-saison | Gold | +60 XP à tout l'effectif |
| Masterclass | Legendary | +150 XP à tout l'effectif et trois cartes |

### La réunion d'équipe (§24)

Le pack donne aussi le matériel que le directeur sportif utilise entre deux matchs, et
chaque objet a un effet réel, pas un chiffre affiché :

| Objet | Rareté | Effet |
| --- | --- | --- |
| Causerie d'avant-match | Normal | moral +8 pour tout l'effectif, à la réunion |
| Séance vidéo | Rare | +1 d'avantage tactique au prochain match, à la réunion |
| Atelier tactique | Épique | cohésion +4 %, durable, à la réunion |
| Plan tactique | Élite | applique un style et donne +2 d'avantage au prochain match |
| Réunion de groupe | Gold | moral +15, cohésion +6 %, +40 XP à tout l'effectif, à la réunion |
| Plan de campagne | Legendary | trois plans, moral +20 et cohésion +8 % dès réception |

L'avantage préparé ne vaut que pour **un** match : il retombe à zéro au coup de sifflet
final. C'est ce qui donne du poids à la préparation sans la rendre permanente.

L'écran d'entraînement ne propose que ce qui est faisable avec ce qu'on a en réserve :
les séances collectives quand il reste des séances, les séances ciblées quand on a la
carte correspondante. Chaque ligne dit ce qu'elle coûte, ou ce qui manque.

### L'économie

Tout gain passe par `earn(montant, source)`, qui applique un plafond quotidien par source
et un plafond global, puis écrit une ligne dans le journal des transactions. Aucune source
ne peut produire une quantité infinie d'argent (§7, §29).

| Source | Plafond par jour |
| --- | --- |
| Quêtes | 900 |
| Missions | 600 |
| Pronostics | 400 |
| Matchs | non plafonnés : un match prend du temps réel |
| Ventes, connexion quotidienne | pas de plafond propre, comptent dans le total |
| Toutes sources | 2 600 |

Les dépenses passent par `spend()` (packs, achats, staff, stade, centre, pronostics), les
gains par `earn()`, et chaque mouvement écrit sa ligne. Le journal explique donc le solde
**au jeton près** : `test/directeur.js` joue packs, match, pronostics, quête, achat, vente
et recrutement, puis vérifie que la somme du journal égale le solde. C'est ce contrôle qui
a trouvé que les pronostics gagnés étaient annoncés mais jamais versés.

### La section DIRECTEUR SPORTIF (§17)

Sur l'accueil de Mon Club, et sur celui de l'app téléphone, neuf entrées dans l'ordre du
cahier des charges. Chacune mène à un vrai écran, et chaque règle qu'il applique vit dans
`src/`, une seule fois, pour tous les écrans :

| Entrée | Ce qu'on y fait | Règles |
| --- | --- | --- |
| Mon effectif | le onze poste par poste, fiches, vente | `assignSlot`, `candidatsPoste`, `compositionAuto`, `sellPlayer` |
| Compétences | équiper sur le joueur choisi | `canEquip`, `equipSkill` |
| Pack | ouvrir le pack unique | `openPack`, `commitPack` |
| Entraînement | séances, cartes, réunions | `train`, `useUpgrade`, `holdMeeting` |
| Transferts | acheter, vendre | `buyInfo`, `buyPlayer`, `sellPlayer` |
| Quêtes | objectifs et récompenses | `claimQuest` |
| Finances | solde, plafonds du jour, journal | `CAPS`, `earn`, `spend` |
| Tactique | formation, style, mentalité, consignes | `setFormation`, `applyStyle`, `setConsigne` |
| Club | progression, staff, stade, centre | `progressBoard`, `hireStaff`, `upgradeStade` |

```bash
node test/directeur.js     # le parcours du §22, de la création du club au match
```

### La division (§22)

Six clubs, un calendrier toutes rondes de cinq journées : chaque club rencontre chacun des
autres une fois. Ton match est joué par le moteur ; les deux autres matchs de la journée
sont simulés d'après la note et le style des clubs (loi de Poisson, pente de 0,14 but par
point de note, mesurée sur le moteur), avec une graine, donc reproductibles. Le classement
se calcule avec les règles de `league.js`, les mêmes que les ligues en ligne. Les deux
premiers montent (+500 jetons et un LinkFoot Pack), le dernier descend, et la saison
suivante repart d'un nouveau calendrier.

Seul le match prévu au calendrier compte. Tout autre adversaire est un amical : moitié de
la prime, rien au classement, et tirs au but en cas de nul (§51), dans l'app comme dans
l'écran Mon Club. `situationDivision()` dit où en est le club en une phrase qui lit le
calendrier et les points encore en jeu (« La montée est à 2 pts : Sporting Yoyo (2e). Tu
l'as déjà joué : il faut qu'il perde des points ailleurs. »).

### Le match en direct (§2)

Le directeur sportif ne touche jamais un joueur : il décide depuis le banc. `matchEnDirect`
ouvre un match qui avance par tranches ; entre deux tranches, l'écran peut agir.

```js
const d = club.matchEnDirect(club.prochainMatch().opp);
d.ecouter((e) => afficher(e));     // à chaque minute, à chaque décision, et à la fin
d.vitesse(3);                      // minutes de match par seconde ; Infinity : résultat direct
d.lancer();                        // le match se déroule seul, au rythme choisi
d.remplacer('ATT0', 14);           // { ok } ou { ok: false, why }
d.crier('exiger');                 // une consigne de la voix (CRIS)
d.carte('energie');                // une carte de match de la réserve
```

Les règles sont les mêmes pour les deux écrans : cinq changements ; un joueur expulsé ne
se remplace pas (l'équipe repasserait à onze) ; le remplaçant entre avec ses compétences,
sa forme et son moral (`joueurMoteur`, le même descripteur qu'au coup d'envoi) ; le
remplacé garde ses minutes, son XP et ses buts. Sans décision, le match en direct est celui
de `playMatch`, au chiffre près. Un seul match à la fois : un second, ouvert pendant le
direct, est refusé, pour qu'une journée ne compte jamais deux fois.

Le match est **engagé** dès le coup d'envoi : la sauvegarde garde le moteur tel qu'il était,
la graine, et chaque décision datée en pas de moteur (`state.matchEngage`, une quinzaine de
Ko). Si l'app se ferme pendant le direct, `reprendreMatch()` le rejoue au retour, à
l'identique, jusqu'au bout. Fermer l'app ne permet donc pas de fuir une défaite.

Un but porte son buteur et son passeur en champs (`by`, `as`) dans le fil du moteur : les
lire dans la phrase en manquait un sur quatre (« centre de », « lancé par »…). Et deux
joueurs d'un même club n'ont jamais le même nom (`nomUnique`) : un club neuf sur cinq en
avait deux, et l'un volait les buts de l'autre.

### Le match et le pack en 3D

`src/stade3d.js` dessine le match en 3D pour les deux écrans : l'écran Mon Club (three.js
chargé depuis cdn.jsdelivr.net) et l'app téléphone (three.js de npm, dans un `GLView`
d'expo-gl). Le rendu ne décide rien : il lit les images que le moteur enregistre dix fois
par seconde de jeu (positions, ballon et sa hauteur, porteur, trajectoire, joueurs au sol,
plongeon du gardien, coup de pied arrêté, but, carton). Ce qu'on voit est ce que le moteur
a joué. La caméra suit le ballon et part en plan serré sur le buteur (§49), le camp qui
marque célèbre (§50), le public se lève sur un but (§53), la météo du match change la
lumière et fait tomber la pluie ou la neige (§54).

```js
const v = club.stade3d(THREE, { renderer, largeur, hauteur, maillot, adverse, meteo });
const d = club.matchEnDirect(club.prochainMatch().opp);
d.spectacle(true);                 // regarder : chaque action en temps réel, le reste sauté
d.lancer();
// à chaque image d'écran (f porte aussi les images gardées et l'instant montré, pour les vrais corps)
const f = d.vue(); v.image(f.A, f.B, f.fr, f.evs, f);
```

Dans l'app (sur le web), les joueurs du match sont de vrais corps : le footballeur de Gameplay
Football (domaine public), animé par de vraies captures (Motion Matching sur la base CMU, gestes
de Google Research Football), le même code que le laboratoire du rendu (`rendu/labo/reel.js`).
L'écran charge la base de mouvements (12 Mo) et le personnage, puis les branche :

```js
const R = await preparerReel({ mouvements: { json, bin }, squelette: corpsJson, personnage: glb });
v.brancherReel(creerReel(R, v.scene, { feuille: d.feuille(), couleurs: v.couleurs }));
```

Ils lisent les mêmes images du moteur, qui garde un peu plus d'une seconde d'avance sur l'image
montrée : de quoi savoir où va chaque joueur et caler une frappe, une tête ou un plongeon sur
l'instant du moteur. Tant qu'ils ne sont pas chargés, ou si l'appareil ne suit pas (plus de 25 ms
de calcul par image), la vue garde les footballeurs en géométrie. Sur téléphone (Expo Go, build
natif), ce n'est pas encore vérifié sur un appareil : les vrais corps n'y sont pas branchés
(`app/src/reel.js`, le web prend `reel.web.js`). L'écran Mon Club garde aussi les footballeurs
en géométrie (il ne charge rien d'autre que three.js).

En spectacle, le moteur calcule toujours en rapide et garde ses images (`capture`) ; l'écran
les montre en temps réel autour de chaque frappe, penalty, corner, coup franc direct, carton
et but, et saute le reste (« jusqu'à la prochaine action »). Un match se regarde en cinq
minutes environ à ×1. Le match joué reste celui de `playMatch`, au chiffre près, décisions
comprises. La vue 2D reste à un geste (VUE 2D / VUE 3D), et prend le relais si l'appareil
n'a pas WebGL.

Le pack de l'écran Packs est en 3D lui aussi (`pack3d`, cahier design §11) : il flotte,
tremble quand on l'ouvre, éclate dans la couleur de la meilleure rareté tirée (la rareté se
voit avant le résultat), puis les lots se révèlent un par un. Le tirage est encaissé et
sauvegardé avant l'animation : fermer l'app pendant l'éclat ne rejoue pas le tirage.

L'app native n'a pas de `<canvas>` pour écrire du texte dans une texture. La face du pack
et les panneaux du stade sont donc peints en JavaScript pur (`peintre` : formes lissées et
un alphabet en traits), la même image dans un navigateur et sur téléphone. Le stade, le
public, le pack et les footballeurs en géométrie sont construits ici. Les vrais corps viennent
de sources libres, sous leurs licences (`rendu/README.md`, « Licences ») : le footballeur de
Gameplay Football et les gestes de Google Research Football (domaine public), les captures CMU
(incluses dans le produit, jamais revendues comme base de mouvements). Aucun modèle, visage,
animation, texture, son ni code d'EA Sports FC, de FIFA ou d'un autre studio.

### La passerelle vers Unreal Engine 5

Le moteur LinkFoot reste la seule autorité : un rendu externe (Unreal Engine 5) lit ce qu'il a
décidé et le transforme en mouvements humains, sans rien décider. `docs/passerelle-ue5.md` en fait
l'analyse et décrit le contrat (format `linkfoot-match`, version 1) ; `src/passerelle.js` le
produit.

```js
const { resultat, document } = club.matchPont(adversaire, { seed });   // le vrai match, enregistré
document.joueurs;              // carte → joueur → personnage : stats, attributs du moteur, compétences, corps, visage
document.images;               // dix images par seconde : positions, orientation, énergie, états, intention
document.actions;              // passe, tir, contrôle, dribble, tacle, duel, plongeon, arrêt... à l'instant du geste
club.verifierPont(document);   // §55 : vitesses, téléportations, ballon, gardien, ligne défensive
club.versUnreal(x, y, z);      // le repère d'Unreal, en centimètres
```

Enregistrer pour la passerelle ne change pas le match, au chiffre près. `tools/visionneuse-pont.html`
rejoue un document avec le rendu 3D de LinkFoot (ce qu'Unreal recevra, rien de plus), et
`test/passerelle.js` vérifie le format, l'empreinte et la chaîne carte → moteur → mouvement →
action.

Le côté Unreal est dans `unreal/` : le projet `unreal/LinkFoot` (Unreal Engine 5.8, cinq modules
C++), son cœur portable compilé et testé hors d'Unreal (`unreal/tests-coeur`, sur de vrais matchs
du moteur), et une vérification de syntaxe de la couche Unreal (`unreal/verif-syntaxe`). La couche
Unreal n'a encore été compilée par aucun Unreal, et aucun asset n'existe : `unreal/README.md` dit
ce qui est fait et ce qu'il reste à faire dans l'éditeur. L'audit, le projet et l'animation sont
décrits dans `docs/ue5/`.

### La création du club

L'effectif de départ fait 14 joueurs **normaux**, note moyenne 51, potentiel moyen 69, plus
**un joueur rare offert** (note 66 à 70, potentiel supérieur, une compétence spéciale) qui
aide sans gagner les matchs tout seul (§2, §3, §4).

## Jouer contre de vraies personnes (§26, §29)

Le moteur est **déterministe** : à graine égale, le match est identique partout. Le serveur
ne stocke donc pas un film de match, seulement `(club A, club B, graine)`. Il rejoue la
rencontre pour en connaître le score, et les deux joueurs la rejouent chez eux à l'identique,
avec les mêmes buts aux mêmes minutes.

```js
const r = await online.versus('bob');          // le serveur joue et rend la graine
const match = playVersus(monEquipe, sonEquipe, r.replay.seed);   // je rejoue le même match
// match.score est forcément égal à r.score
```

C'est aussi ce qui rend la triche inutile : `verifyResult(a, b, graine, scoreAnnoncé)`
rejoue la rencontre et dément un client qui prétendrait avoir gagné 9-0.

| Route | Ce qu'elle fait |
| --- | --- |
| `PUT /team` | publie son équipe pour qu'on puisse jouer contre elle, même hors ligne |
| `POST /versus/:id` | un match classé : le serveur joue, met l'Elo à jour et verse les jetons |
| `POST /verify` | rejoue une rencontre pour vérifier un score annoncé |
| `GET /ladder` | le classement général, trié par Elo |
| `POST /leagues` · `/join` · `/:id/start` · `/:id/play` | les ligues entre amis, avec un code à six caractères |
| `POST /challenges` · `/:id/accept` | les défis entre amis |
| `POST /tournaments` · `/:id/play` | les tournois, joués entre de vrais clubs, tirs au but compris |
| `POST /pack` | l'ouverture d'un pack, tirée par le serveur |
| `GET /feed` | le fil du journal : matchs, meilleures notes, transferts, classement |
| `POST /market/list` · `/market/:id/buy` | le marché des transferts entre vrais clubs |
| `GET /wallet` · `GET /balance` | ce qui a été versé, ce qu'il reste pour la journée |

### L'écran En ligne et le journal

Un écran dédié (`ClubEnLigne`) avec six diapositives : le journal, les ligues entre amis,
les tournois, le classement général, les meilleures équipes, les meilleurs joueurs.

Le journal n'invente rien. Chaque article cite un match, un classement ou un transfert
qui a réellement eu lieu : la une est le résultat le plus marquant de la semaine, le
joueur de la semaine est la meilleure note relevée, le mercato liste les vrais transferts.
S'il n'y a pas de résultat, il n'y a pas d'article.

Hors ligne, l'écran montre un **exemple étiqueté comme tel**, construit sur le club solo :
assez pour juger la mise en page, sans mentir sur son contenu.

### Le marché des transferts en ligne (§25)

Un joueur se met en vente, les autres clubs l'achètent, le serveur encaisse et paie.
Cinq annonces par club au maximum, prix entre 50 et 200 000 jetons, et le solde reconnu
par le serveur fait foi : un prix changé côté client ne vaut rien. Chaque transfert
passe dans le journal.

### Ce que le serveur refuse (§29)

Rien de tout cela n'est une vérification côté client : ce sont des refus du serveur,
avec leur raison.

| Garde-fou | Valeur |
| --- | --- |
| Matchs classés par jour | 40 |
| Délai minimum entre deux matchs | 20 s |
| Packs par jour | 30 |
| Plafond de gains par source | quêtes 900 · pronostics 400 · missions 600 · classés 1 200 · tournois 1 500 |
| Plafond toutes sources | 3 600 par jour |
| Récompenses en argent réel | refusées par le serveur, pas seulement masquées (§76) |

Les probabilités du pack sont appliquées côté serveur et renvoyées avec le résultat :
un client modifié ne peut ni les changer, ni rejouer un tirage jusqu'à obtenir ce qu'il veut.

```js
import { onlineRoutes, FileStorage } from 'linkfoot-engine/server';
app.use('/online', onlineRoutes({
  storage: new FileStorage('./saves'),
  auth: async (req) => (await session(req)).userId     // ton système de comptes, et lui seul
}));
```

```bash
node test/online.js       # le serveur monté en mémoire, aucun port ouvert
node test/e2e-online.mjs  # le circuit complet : vrai serveur HTTP, vrai client fetch
npm run demo              # le serveur de démonstration sert aussi /online
```

Hors ligne, l'écran Ligue le dit en une phrase et les boutons refusent avec leur raison,
au lieu de rester muets. Le reste du jeu continue de fonctionner sans serveur.

## Une seule échelle

Tout ce qui monte dans le jeu parle le même langage, et `src/tracks.js` en est la seule source.

| Piste | Niveaux | Ouverte par |
| --- | --- | --- |
| Niveau de club | 1 → ∞ | XP des matchs, des missions et des quêtes |
| Division | D5 → D1 | classement de fin de saison |
| Niveau d'un joueur | 1 → 40+ | XP de match, entraînement plafonné |
| Compétences portées | 1 → 4 emplacements | niveau du joueur : 1, 6, 15, 25 |
| Staff (x4) | 0 → 3 | club 2, 6, 11 · jetons |
| Stade | 0 → 4 | club 3, 7, 12, 18 · jetons |
| Centre de formation | 0 → 3 | club 4, 9, 15 · jetons |

Les six raretés servent aux cartes, aux compétences et aux probabilités du pack :
une seule table, dans `cards.js`.

`club.progressBoard()` rend ces pistes sous une forme unique
(`{ key, label, lvl, max, pct, nextLabel, cost, locked, can, why }`), ce qui permet à
l'interface de les afficher de la même façon, et `club.unlocksAt(niveau)` dit ce qu'un
niveau ouvre. Toute action qui refuse renvoie `{ ok, why }` et dit pourquoi à l'écran :
plus aucun bouton muet (§81).

```bash
node test/progression.js      # le garde-fou : échoue si une partie repart sur sa propre échelle
```

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

- `playMatch` joue un match entier d'un coup. Pour suivre un match et décider pendant,
  `matchEnDirect` (voir plus haut). L'écran Mon Club a son propre direct, animé, avec les
  mêmes règles ; il ne garde rien d'une session à l'autre, donc rien n'y est engagé.
- Les ligues entre amis, les défis, le classement et les tournois entre vraies personnes
  demandent le serveur (`server/online-routes.js`). Sans lui, le jeu reste jouable en solo,
  mais ces écrans n'ont personne en face.
- Un match prend environ 1,5 seconde en simulation complète sur un poste de bureau.
  Pour simuler une saison entière côté serveur, mets les matchs en file plutôt que
  de bloquer une requête.
- À note égale, un effectif athlétique crée 1,7 à 2,1 fois le danger d'un effectif technique,
  et l'écart de points saute d'une série de douze matchs à l'autre (de +6 % à +44 % ;
  `test/coherence.js`). Resserrer la vitesse de pointe a été essayé à trois réglages
  (pente 0,024, 0,030 et 0,032 par point au lieu de 0,045) : aux deux plus serrés, le
  rapport tombe vers 1 à 1,3, et quatre ou cinq leviers de `test/leviers.js` tombent sur
  douze matchs. Ce n'est pas une preuve : un changement neutre du tirage (les correctifs de
  la passerelle, qui ne visent ni la vitesse ni les leviers) en fait tomber trois sur douze
  matchs. La vitesse est restée telle quelle faute d'une mesure assez longue pour trancher ;
  la correction (la pente, ou la note des cartes qui sous-pèse la vitesse) se mesure sur
  cinquante matchs par série au moins.
