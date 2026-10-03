// Toutes les vérifications, une commande, un verdict.
//
// Chaque fichier de test/ vérifie une promesse du jeu. Les lancer un par un, c'est
// en oublier un, et c'est exactement celui-là qui casse. Ce fichier les enchaîne et
// rend un tableau : ce qui tient, ce qui cède, et combien de temps ça a pris.
//
//   node test/tout.js            les vérifications rapides, quelques minutes
//   node test/tout.js --long     plus les trois longues (leviers, cohérence, styles),
//                                qui jouent des centaines de matchs : compter une
//                                demi-heure sur deux cœurs
//
// Sortie en erreur dès qu'une seule vérification cède : c'est ce que regarde
// l'intégration continue.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

// [nom, commande, ce que ça protège]
const RAPIDES = [
  ['canvas', ['tools/sync-canvas.mjs', '--check'], 'l’écran Mon Club et le moteur disent la même chose'],
  ['paquet', ['build.mjs', '--check'], 'le fichier unique dist/linkfoot.js se charge, joue, suit src/'],
  ['progression', ['test/progression.js'], 'les systèmes du club sont reliés entre eux'],
  ['impact', ['test/impact.js'], 'le rapport de match ne dit que des choses vraies'],
  ['directeur', ['test/directeur.js'], 'le parcours du directeur sportif, de la création au match'],
  ['match', ['test/match.js'], 'le manager regarde et décide : coaching en direct, AUTO COACH, comportements'],
  ['passerelle', ['test/passerelle.js'], 'Unreal (ou tout rendu) lit le match que le moteur a joué, rien d’autre'],
  ['corps', ['test/corps.js'], 'le corps regarde le jeu : pas chassés et recul, axe tenu en sprint (règle de Gameplay Football)'],
  ['kiosque', ['test/kiosque.js'], 'un pack principal qui donne tout, ses probabilités affichées'],
  ['fluidité', ['test/fluidite.js'], 'découper un match ne le change pas'],
  ['traits', ['test/traits.js', '12'], 'une compétence change le jeu, pas un chiffre'],
  ['serveur', ['test/serveur-http.js'], 'le serveur tient par HTTP et refuse la triche'],
  ['en ligne', ['test/online.js'], 'le multijoueur, le classement, le marché'],
  ['tournoi', ['test/tournament.js', '16'], 'ligues, coupes et récompenses']
];
const LONGUES = [
  ['leviers', ['test/leviers.js', '12'], 'chaque décision tactique se joue vraiment'],
  ['cohérence', ['test/coherence.js', '12'], 'la note de la carte dit ce que vaut le joueur'],
  ['styles', ['test/styles.js', '10'], 'chaque style tient la promesse de sa description']
];

const long = process.argv.includes('--long');
const liste = long ? RAPIDES.concat(LONGUES) : RAPIDES;

function lance([nom, args]) {
  return new Promise((res) => {
    const t0 = Date.now();
    const ch = spawn(process.execPath, args, { cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
    let sortie = '';
    ch.stdout.on('data', (d) => { sortie += d; });
    ch.stderr.on('data', (d) => { sortie += d; });
    ch.on('exit', (code) => res({ nom, code, duree: Date.now() - t0, sortie }));
  });
}

console.log('LinkFoot · ' + liste.length + ' vérifications' + (long ? ' (avec les longues)' : '') + '\n');
const resultats = [];
for (const t of liste) {
  process.stdout.write('  ' + t[0].padEnd(12) + '… ');
  const r = await lance(t);
  resultats.push(Object.assign(r, { promesse: t[2] }));
  const derniere = r.sortie.trim().split('\n').filter((l) => /^(OK|ÉCHEC|canvas)/.test(l.trim())).pop() || '';
  console.log((r.code === 0 ? 'ok   ' : 'ÉCHEC') + '  ' + String(Math.round(r.duree / 1000)).padStart(4) + ' s  ' + derniere.trim().slice(0, 70));
}

const rates = resultats.filter((r) => r.code !== 0);
console.log('\n' + (rates.length
  ? rates.length + ' sur ' + resultats.length + ' ont cédé :'
  : 'Tout tient : ' + resultats.length + ' sur ' + resultats.length + ', en '
    + Math.round(resultats.reduce((a, r) => a + r.duree, 0) / 1000) + ' s.'));
for (const r of rates) {
  console.log('\n── ' + r.nom + ' : ' + r.promesse);
  // les lignes qui ont cédé, pas tout le journal
  const lignes = r.sortie.split('\n').filter((l) => /ÉCHEC|ALERTE|Error|error/.test(l)).slice(0, 12);
  const extrait = lignes.length ? lignes.join('\n') : r.sortie.trim().split('\n').slice(-12).join('\n');
  console.log(extrait);
  // Dans l'intégration continue, chaque échec devient aussi une ANNOTATION : elle
  // s'affiche en tête de la page du run, et l'API de GitHub la rend directement,
  // alors que le journal complet passe par un stockage que tout le monde ne peut pas
  // lire.
  if (process.env.GITHUB_ACTIONS) {
    const net = (x) => x.replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
    console.log('::error title=' + net(r.nom + ' : ' + r.promesse) + '::' + net(extrait.slice(0, 1800)));
  }
}
if (!long && !rates.length) console.log('Les trois vérifications longues ne sont pas lancées : node test/tout.js --long');
process.exit(rates.length ? 1 : 0);
