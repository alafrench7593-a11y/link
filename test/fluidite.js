// §29 : simuler un match sans geler l'écran, et sans changer le match.
//
// Un match fait 54 000 pas de calcul. En une seule boucle, c'est deux secondes d'écran
// mort sur un ordinateur et dix à trente sur un téléphone : le joueur croit à un
// plantage. Le moteur sait maintenant s'arrêter au bout d'un temps donné et reprendre.
//
// LA SEULE CHOSE QUI COMPTE ICI : que ça ne change RIEN au match. Le découpage ne doit
// pas valoir une graine différente, sinon tout l'édifice tombe : le serveur rejoue les
// matchs pour valider les résultats (§29), et deux découpages différents donneraient
// deux vérités différentes.
//
// Le test compare donc, pour plusieurs graines, un match joué d'un bloc et le même
// match joué en paquets, champ par champ. Il vérifie aussi que le découpage respecte
// bien le temps demandé : un paquet qui dure une seconde ne sert à rien.
import { Club } from '../src/club.js';

let ok = 0, ko = 0;
const t = (nom, cond, detail) => {
  console.log((cond ? '  ok   ' : '  ÉCHEC') + ' ' + nom + (detail ? '  (' + detail + ')' : ''));
  cond ? ok++ : ko++;
};
const ADV = { club: 'Référence', ovr: 66, style: 'blocmed' };
const GRAINES = [7001, 7042, 7103, 4242];

console.log('Le match découpé est-il le même match ?');
console.log(GRAINES.length + ' graines, chacune jouée deux fois : d’un bloc, puis en paquets de 25 ms\n');

for (const graine of GRAINES) {
  const bloc = new Club().playMatch(ADV, { seed: graine });

  const minutes = [];
  const t0 = Date.now();
  const paquets = await new Club().playMatchAsync(ADV, { seed: graine, tranche: 25 }, (m) => minutes.push(m));
  const duree = Date.now() - t0;

  const champs = [
    ['le score', () => bloc.score.join('-') === paquets.score.join('-'), bloc.score.join('-')],
    ['les statistiques complètes', () => JSON.stringify(bloc.stats) === JSON.stringify(paquets.stats)],
    ['la possession', () => bloc.poss === paquets.poss, bloc.poss + ' %'],
    ['tous les compteurs de décision', () => JSON.stringify(bloc.cnt) === JSON.stringify(paquets.cnt),
      Object.keys(bloc.cnt).length + ' compteurs'],
    ['le fil du match, ligne par ligne', () => JSON.stringify(bloc.log) === JSON.stringify(paquets.log),
      bloc.log.length + ' lignes'],
    ['le rapport d’impact', () => JSON.stringify(bloc.impact) === JSON.stringify(paquets.impact)]
  ];
  console.log('graine ' + graine + ' · ' + bloc.score.join('-') + ' · ' + minutes.length
    + ' paquets · ' + duree + ' ms');
  let tout = true;
  for (const [nom, test, det] of champs) { const r = test(); if (!r) tout = false; t('  ' + nom, r, det); }
  if (tout) {
    t('  la minute avance et s’affiche', minutes.length > 5 && minutes[minutes.length - 1] >= 85,
      'de ' + minutes[0] + "' à " + minutes[minutes.length - 1] + "'");
    t('  aucune minute ne recule', minutes.every((m, i) => i === 0 || m >= minutes[i - 1]));
  }
  console.log('');
}

// Le découpage doit tenir le temps demandé : c'est tout l'intérêt. Un paquet de
// 25 ms qui en prend 300 bloquerait l'écran autant qu'avant.
console.log('Le découpage respecte-t-il le temps demandé ?');
{
  const c = new Club();
  const ctx = c.ouvrirMatch(ADV, { seed: 7007 });
  const durees = [];
  let r;
  do { const d = Date.now(); r = ctx.E.runFor(25); durees.push(Date.now() - d); } while (!r.done);
  durees.sort((a, b) => a - b);
  const median = durees[Math.floor(durees.length / 2)];
  const pire = durees[durees.length - 1];
  t('la moitié des paquets tient en 40 ms', median <= 40, 'médiane ' + median + ' ms');
  t('aucun paquet ne dépasse 120 ms', pire <= 120, 'le pire ' + pire + ' ms sur ' + durees.length + ' paquets');
  t('le match est bien découpé en nombreux paquets', durees.length > 20, durees.length + ' paquets');
}

// Le chemin synchrone reste intact : le serveur et les tests en dépendent.
console.log('\nLe chemin d’un bloc reste disponible');
{
  const a = new Club().playMatch(ADV, { seed: 7001 });
  const b = new Club().playMatch(ADV, { seed: 7001 });
  t('deux appels synchrones donnent le même match', JSON.stringify(a.stats) === JSON.stringify(b.stats));
}

console.log('\n' + (ko ? 'ÉCHECS : ' + ko + ' sur ' + (ok + ko) : 'OK : ' + ok + ' vérifications, découper ne change pas le match'));
process.exit(ko ? 1 : 0);
