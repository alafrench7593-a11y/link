// Les écrans du directeur sportif, en React Native.
//
// Aucun d'eux ne décide quoi que ce soit : ils lisent le moteur et appellent ses
// méthodes. Un refus vient toujours du moteur, avec sa raison, et l'écran se contente
// de l'afficher. C'est ce qui garantit que l'app native et l'app web racontent
// exactement la même chose.
//
// Le dessin suit la maquette Figma « Football-app » : l'accueil en héros, sa carte du match à
// venir, les chiffres du club comme ceux du profil, le match avec son tableau de score et ses
// statistiques en barres. Rien de la maquette n'est inventé en données : chaque chiffre affiché
// vient du moteur.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Animated, Image } from 'react-native';
import { C, S, T, F, rarityTint } from './theme';
import { Card, Title, Row, Btn, Bar, Tag, Stat, Empty, EnTete, Groupe, Ligne, Blason, Fond, Pastille, Icone } from './ui';
import { Composition, EnDirect, TableauDirect } from './direct';
import { Terrain } from './terrain';
import { Pack3D } from './pack3d';
import { image } from './fichiers';

// l'image du héros de l'accueil : un footballeur du jeu, rendu par le moteur 3D de LinkFoot
// (rendu/labo, footballeur de Gameplay Football), pas une photo
const HEROS = image(require('../assets/heros.jpg'));

// ---------- accueil ----------
export function HomeScreen({ club, state, act, go }) {
  const xi = club.pickXI(state.formation);
  const ovr = Math.round(club.metrics(xi).ovr);
  const need = club.levelNeed(state.level);
  const ti = club.trainInfo();
  const quests = club.activeQuests().filter((q) => q.prog >= q.goal && !q.claimed).length;
  const inv = club.skillInventory();
  const main = club.packPrincipal();
  const pm = club.prochainMatch();
  const lg = club.divisionCourante();
  const rang = club.table().find((x) => x.me);
  const nom = state.clubName || 'FC TonPseudo';
  const kit = state.kit || {};
  const style = state.preset === 'perso' ? 'tactique perso' : (club.styles()[state.preset] || {}).name;
  return (
    <ScrollView contentContainerStyle={st.accueil}>
      <Heros nom={nom} division={state.division} pm={pm} go={go} />

      <View style={st.section}>
        <EnTete surtitre={'DIVISION ' + state.division + ' · JOURNÉE ' + pm.day + '/' + pm.total} titre="Prochain match"
          action="Classement" onAction={() => go('division')} />
        <AfficheMatch club={club} state={state} pm={pm} note={ovr} onPress={() => go('match')} />
      </View>

      <View style={st.section}>
        <EnTete surtitre="TON CLUB" titre={nom} action="Détails" onAction={() => go('club')} />
        <Card>
          <Row>
            <Blason nom={nom} c1={kit.c1} c2={kit.c2} taille={42} />
            <View style={{ flex: 1 }}>
              <Text style={T.nom}>{state.formation} · {style}</Text>
              <Text style={T.aide}>Division {state.division} · {rang.rank === 1 ? '1er' : rang.rank + 'e'} · {rang.pts} point{rang.pts > 1 ? 's' : ''}</Text>
            </View>
            <View style={st.solde}>
              <Icone nom="coin" taille={15} couleur={C.accent} />
              <Text style={st.soldeTxt}>{state.balance}</Text>
            </View>
          </Row>
          <View style={st.stats}>
            <Stat label="niveau" value={state.level} sep />
            <Stat label="série" value={state.winStreak} sep />
            <Stat label="séances" value={ti.sessions} color={ti.sessions ? C.accent : C.amber} sep />
            <Stat label="fragments" value={state.shards || 0} />
          </View>
          <View style={st.niveau}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={[T.surtitre, { color: C.accent }]}>PROGRESSION DU NIVEAU</Text>
              <Bar pct={(state.xp / need) * 100} />
              <Text style={T.aide}>{state.xp} / {need} XP avant le niveau {state.level + 1}</Text>
            </View>
            <View style={st.noteBloc}>
              <Text style={st.noteGrand}>{ovr}</Text>
              <Text style={st.noteL}>NOTE</Text>
            </View>
          </View>
        </Card>
      </View>

      {/* §17 DIRECTEUR SPORTIF : les neuf entrées, dans l'ordre du cahier des charges. */}
      <View style={st.section}>
        <EnTete surtitre="DIRECTEUR SPORTIF" titre="Ton bureau" />
        <Text style={[T.aide, { marginTop: -4 }]}>Tu ne touches jamais au ballon : tu construis l’équipe qui le joue.</Text>
        <Liste go={go} items={[
          ['squad', 'Mon effectif', xi.length + ' titulaires · ' + state.squad.length + ' joueurs', 'users'],
          ['skills', 'Compétences', inv.length ? inv.filter((k) => k.onName).length + ' équipée(s) · ' + inv.filter((k) => !k.onName).length + ' en réserve' : 'Aucune compétence en réserve', 'bolt'],
          ['packs', 'Pack', main.name + ' · ' + main.cost + ' jetons · ' + (main.can ? 'ouvrable' : main.why.toLowerCase()), 'pack'],
          ['train', 'Entraînement', ti.line, 'chrono'],
          ['transfers', 'Transferts', state.balance + ' jetons · ' + club.marketList().length + ' joueurs à vendre', 'swap'],
          ['quests', 'Quêtes', club.activeQuests().length + ' en cours' + (quests ? ' · ' + quests + ' à récupérer' : ''), 'flag'],
          ['finances', 'Finances', state.balance + ' jetons · journal et plafonds du jour', 'wallet'],
          ['tactic', 'Tactique', state.formation + ' · ' + style, 'board'],
          ['club', 'Club', 'Niveau ' + state.level + ' · staff, stade, centre de formation', 'shield']
        ]} />
      </View>

      <View style={st.section}>
        <EnTete surtitre="COMPÉTITIONS" titre={'Saison ' + lg.saison} />
        <Liste go={go} items={[
          ['match', 'Jouer un match', 'Journée ' + pm.day + '/' + pm.total + ' contre ' + pm.opp.club, 'match'],
          ['division', 'Division ' + state.division, (rang.rank === 1 ? '1er' : rang.rank + 'e') + ' sur ' + club.DIVISION_RULES().clubs + ' · ' + rang.pts + ' point' + (rang.pts > 1 ? 's' : ''), 'trophy'],
          ['online', 'En ligne', club.onlineSummary().state, 'globe']
        ]} />
      </View>

      {state.lastGain ? <View style={st.section}><Card vedette><Text style={T.corps}>{state.lastGain}</Text></Card></View> : null}
    </ScrollView>
  );
}

function Liste({ items, go }) {
  return (
    <Groupe>
      {items.map(([id, label, sub, icone], i) => (
        <Ligne key={id} icone={icone} label={label} sub={sub} fin={i === items.length - 1} onPress={() => go(id)} />
      ))}
    </Groupe>
  );
}

// Le héros de la maquette (« CONNECT THROUGH FOOTBALL. ») : ici la phrase du jeu, sur une image
// du jeu.
function Heros({ nom, division, pm, go }) {
  return (
    <View style={st.heros}>
      <Image source={HEROS} style={st.herosImage} resizeMode="cover" accessibilityIgnoresInvertColors />
      <Fond type="voile" />
      <View style={st.herosTexte}>
        <Text style={st.herosKicker} numberOfLines={1}>{nom.toUpperCase()} · DIVISION {division}</Text>
        <Text style={st.herosTitre}>CONSTRUIS{'\n'}L’ÉQUIPE{'\n'}<Text style={{ color: C.accent }}>QUI JOUE.</Text></Text>
        <Btn label="Préparer le match" icone="arrow" onPress={() => go('match')} style={{ alignSelf: 'flex-start' }} />
      </View>
      <Text style={st.herosIndex}>J{pm.day} — {pm.total}</Text>
    </View>
  );
}

// La carte « Live now » de la maquette : les deux clubs, où l'on joue, et le rapport de force
// (la note de chaque équipe), que le moteur calcule.
function AfficheMatch({ club, state, pm, note, onPress }) {
  const kit = state.kit || {};
  const nous = { nom: state.clubName || 'FC TonPseudo', c1: kit.c1, c2: kit.c2, note };
  const eux = { nom: pm.opp.club, c1: pm.opp.color, note: pm.opp.ovr };
  const [g, d] = pm.domicile ? [nous, eux] : [eux, nous];
  const stade = club.STADES()[state.stade || 0];
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [st.affiche, pressed && { opacity: 0.92 }]}>
      <Fond type="carte" />
      <View style={st.afficheHaut}>
        {club.enDirect
          ? <Pastille ton="direct" point>MATCH EN COURS</Pastille>
          : <Pastille ton="accent">{pm.domicile ? 'À DOMICILE' : 'À L’EXTÉRIEUR'}</Pastille>}
        <Text style={st.afficheLieu} numberOfLines={1}>{(pm.domicile ? stade.name : 'chez ' + pm.opp.club).toUpperCase()}</Text>
      </View>
      <View style={st.affLigne}>
        <Equipe e={g} />
        <View style={st.affCentre}>
          <Text style={st.affVs}>VS</Text>
          <Text style={st.affStyle} numberOfLines={1}>{pm.opp.styleName}</Text>
        </View>
        <Equipe e={d} />
      </View>
      <View style={st.affBas}>
        <Text style={st.affNote}>Note <Text style={st.affNoteB}>{g.note}</Text></Text>
        <View style={st.ratio}><View style={[st.ratioFg, { width: Math.round((100 * g.note) / Math.max(1, g.note + d.note)) + '%' }]} /></View>
        <Text style={[st.affNote, { textAlign: 'right' }]}><Text style={st.affNoteB}>{d.note}</Text> Note</Text>
      </View>
    </Pressable>
  );
}

function Equipe({ e, grand, sous }) {
  return (
    <View style={st.equipe}>
      <Blason nom={e.nom} c1={e.c1} c2={e.c2} taille={grand ? 54 : 42} />
      <Text style={[st.equipeNom, grand && { fontSize: 13.5 }]} numberOfLines={2}>{e.nom}</Text>
      {sous ? <Text style={st.equipeSous}>{sous}</Text> : null}
    </View>
  );
}

// ---------- effectif ----------
export function SquadScreen({ club, state, act }) {
  const [open, setOpen] = useState(null);
  const squad = state.squad.slice().sort((a, b) => b.ovr - a.ovr);
  if (open != null) {
    const p = state.squad.find((x) => x.id === open);
    if (p) return <PlayerScreen club={club} p={p} act={act} back={() => setOpen(null)} />;
  }
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Title surtitre={state.squad.length + ' JOUEURS · ' + state.formation} sub="Le onze, puis tout l’effectif : note, niveau et compétences portées">Effectif</Title>
      <Composition club={club} state={state} act={act} />
      <Text style={[T.surtitre, { marginTop: 6 }]}>TOUT L’EFFECTIF</Text>
      {squad.map((p) => {
        const g = club.playerProgress(p);
        const r = club.rarityFor(p);
        return (
          <Pressable key={p.id} onPress={() => setOpen(p.id)}>
            <Card>
              <Row>
                <View style={[st.noteCase, { borderColor: r.tint + '66' }]}><Text style={st.noteCaseTxt}>{p.ovr}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={T.nom}>{p.name}</Text>
                  <Text style={T.aide}>{p.pos} · niveau {g.lvl} · {g.worn}/{g.slots} compétence(s)</Text>
                </View>
                <Tag color={r.tint}>{r.label}</Tag>
              </Row>
              <Bar pct={g.pct} />
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// La fiche d'un joueur, comme le profil de la maquette : le nom en grand, ses chiffres en ligne,
// sa note dans le bloc citron.
function PlayerScreen({ club, p, act, back }) {
  const pr = club.profile(p);
  const g = club.playerProgress(p);
  const t = club.shardTrainInfo(p);
  const h = club.hiddenOf(p);
  const r = club.rarityFor(p);
  const lab = (v) => (v >= 80 ? 'excellent' : v >= 62 ? 'bon' : v >= 45 ? 'correct' : 'faible');
  // le nom sur deux lignes, comme le profil de la maquette (« Jules / Martin »), sauf une initiale
  const [prenom, ...reste] = String(p.name).split(' ');
  const deuxLignes = reste.length && prenom.length > 2 && !prenom.endsWith('.');
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Btn label="‹ Retour" tone="ghost" small onPress={back} style={{ alignSelf: 'flex-start' }} />
      <View style={st.profil}>
        <Fond type="stade" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Tag color={r.tint}>{r.label}</Tag>
          <Text style={T.surtitre}>{p.pos} · {pr.age} ANS · {String(pr.nat).toUpperCase()}</Text>
        </View>
        <Text style={st.profilNom}>{deuxLignes ? prenom + '\n' + reste.join(' ') : p.name}</Text>
        <Text style={T.aide}>Potentiel {pr.pot} · {club.carriereLigne(p)}</Text>
      </View>
      <View style={st.statsLigne}>
        <Stat label="forme" value={pr.form + ' %'} sep />
        <Stat label="énergie" value={pr.fit + ' %'} sep />
        <Stat label="moral" value={pr.morale + ' %'} sep />
        <Stat label="valeur" value={pr.value} />
      </View>
      <View style={st.niveau}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[T.surtitre, { color: C.accent }]}>NIVEAU {g.lvl}</Text>
          <Text style={T.nom}>{g.xp} / {g.need} XP</Text>
        </View>
        <View style={st.noteBloc}>
          <Text style={st.noteGrand}>{p.ovr}</Text>
          <Text style={st.noteL}>NOTE</Text>
        </View>
      </View>

      <Card>
        <Text style={T.surtitre}>STATISTIQUES</Text>
        <Text style={T.corps}>{club.carriereLigne(p)}</Text>
      </Card>

      <Card>
        <Text style={T.surtitre}>NIVEAU</Text>
        <Text style={T.corps}>Niveau {g.lvl} · {g.xp} / {g.need} XP</Text>
        <Bar pct={g.pct} />
        <Text style={T.aide}>{g.worn} / {g.slots} emplacements de compétence</Text>
        <Btn label={'Entraîner · ' + t.cost + ' fragments'} why={t.why}
          onPress={() => act((c) => c.shardTrain(p.id))} />
      </Card>

      <Card>
        <Text style={T.surtitre}>COMPÉTENCES</Text>
        {club.skillsOf(p).length === 0
          ? <Empty>Aucune compétence. Ouvre le {club.packPrincipal().name} et équipe-la depuis Compétences.</Empty>
          : club.skillsOf(p).map((k, i) => (
            <View key={i} style={{ gap: 3 }}>
              <Row>
                <Text style={[T.corps, { flex: 1, fontWeight: '700' }]}>{k.name}</Text>
                <Tag color={k.color}>{k.rarLabel}</Tag>
              </Row>
              <Text style={T.aide}>{k.desc}</Text>
            </View>
          ))}
      </Card>

      <Card>
        <Text style={T.surtitre}>RAPPORT DU RECRUTEUR</Text>
        {[['Régularité', h.regularite], ['Grands matchs', h.grandsMatchs], ['Sang-froid', h.pression],
          ['Progression', h.progression], ['Résistance aux blessures', 100 - h.blessure], ['Adaptation tactique', h.adaptation]
        ].map(([k, v]) => (
          <Row key={k}>
            <Text style={[T.aide, { flex: 1 }]}>{k}</Text>
            <Text style={[T.corps, { color: v >= 62 ? C.accent : v >= 45 ? C.text : C.amber }]}>{lab(v)}</Text>
          </Row>
        ))}
        <Text style={T.aide}>Ces qualités ne s’affichent pas comme des statistiques : elles agissent pendant le match.</Text>
      </Card>

      <Btn label={'Vendre · ' + club.sellInfo(p).price + ' jetons'} tone="ghost"
        why={club.sellInfo(p).why}
        onPress={() => { act((c) => c.sellPlayer(p.id)); back(); }} />
    </ScrollView>
  );
}

// ---------- match ----------
export function MatchScreen({ club, state, act, go }) {
  const [res, setRes] = useState(null);
  // §2 le match se suit en direct, et le directeur sportif décide depuis le banc :
  // remplacements, consigne de la voix, cartes de match (src/direct.js). Le match en
  // direct appartient au club, pas à l'écran : en revenant sur cet onglet, on le
  // retrouve là où il en est, au lieu d'en lancer un second.
  const [vue, setVue] = useState(() => (club.enDirect ? club.enDirect.etat() : null));
  const ecoute = useRef(null);
  const suivre = (d) => {
    if (ecoute.current) ecoute.current();
    ecoute.current = d.ecouter((e) => { if (e.fini) { setVue(null); setRes(Object.assign({ opp: e.opp }, e.resultat)); } else setVue(e); });
  };
  useEffect(() => {
    if (club.enDirect) suivre(club.enDirect);
    return () => { if (ecoute.current) ecoute.current(); };
  }, []);
  const direct = club.enDirect;
  // §22 le match qui compte est celui du calendrier ; les autres clubs de la division
  // se jouent en amical (moitié de la prime, rien au classement).
  const pm = club.prochainMatch();
  const lg = club.divisionCourante();
  const amicaux = lg.clubs.filter((c) => c.id !== pm.opp.id)
    .map((c) => Object.assign({}, c, { styleName: (club.styles()[c.style] || {}).name || c.style, friendly: true }));
  const pronos = club.PRONO_DEFS(pm.opp, club.pickXI(state.formation));
  const taken = state.pronos || [];
  const lancer = (opp, opts) => {
    if (club.enDirect) return;
    setRes(null);
    const d = club.matchEnDirect(opp, Object.assign({ seed: Math.floor(Math.random() * 1e6) }, opts || {}));
    // §22 on regarde le match : les actions en temps réel, en 3D (ou en 2D), le reste sauté
    d.spectacle(true);
    suivre(d); setVue(d.etat()); d.lancer();
  };
  const occupe = direct ? 'Un match est en cours' : '';
  const enDirect = direct && vue && !vue.fini;
  const kit = state.kit || {};
  const nous = { nom: state.clubName || 'FC TonPseudo', c1: kit.c1, c2: kit.c2 };
  return (
    <ScrollView contentContainerStyle={st.page}>
      {enDirect ? null : <Title surtitre={'DIVISION ' + state.division + ' · SAISON ' + lg.saison} sub="Les 22 joueurs sont pilotés par l’IA. Tu décides depuis le banc : changements, consignes, cartes.">Match</Title>}

      {enDirect ? <TableauDirect club={club} d={direct} vue={vue} /> : null}
      {enDirect ? <Terrain club={club} d={direct} hauteur={300} /> : null}
      {enDirect ? <EnDirect club={club} d={direct} vue={vue} /> : null}

      {res ? (
        <View style={st.resultat}>
          <Fond type="stade" />
          <View style={st.resHaut}>
            <Pastille ton="neutre">TERMINÉ</Pastille>
            <Text style={T.surtitre}>{res.amical ? 'MATCH AMICAL' : 'CHAMPIONNAT'}</Text>
          </View>
          <View style={st.affLigne}>
            <Equipe e={nous} />
            <Text style={st.score}>{res.score[0]} - {res.score[1]}</Text>
            <Equipe e={{ nom: (res.opp && res.opp.club) || 'Adversaire', c1: res.opp && res.opp.color }} />
          </View>
          {res.pso ? <Text style={[T.corps, { textAlign: 'center' }]}>Tirs au but : {res.pso.H} - {res.pso.A}</Text> : null}
          <StatsMatch res={res} />
          <Text style={T.aide}>Tirs {res.stats.H.sh} - {res.stats.A.sh} · {res.poss} % de possession · +{res.reward} jetons</Text>
          {(res.decisions || []).length ? (
            <View style={{ gap: 3 }}>
              <Text style={T.surtitre}>TES DÉCISIONS</Text>
              {res.decisions.map((x, i) => <Text key={i} style={[T.aide, { color: C.blue }]}>{x.minute}' {x.texte}</Text>)}
            </View>
          ) : null}
          {res.log.slice(-6).reverse().map((l, i) => (
            <Text key={i} style={T.aide}>{l.text}</Text>
          ))}
          <Row>
            <Btn label="Fermer" tone="ghost" small onPress={() => setRes(null)} />
            {!res.amical ? <Btn label="Le classement" small onPress={() => go('division')} /> : null}
          </Row>
        </View>
      ) : null}

      {/* §47 : ce que chaque décision a produit. Une ligne seulement pour les réglages
          vraiment changés, et le chiffre vient de ce match, pas d'une estimation. */}
      {res && res.impact && res.impact.length ? (
        <Card tint={C.accentLine}>
          <Text style={T.surtitre}>CE QUE TES DÉCISIONS ONT FAIT</Text>
          {res.impact.map((im) => (
            <View key={im.id}>
              <Text style={T.corps}>{im.titre}</Text>
              <Text style={T.aide}>{im.valeur}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      {res && res.impact && !res.impact.length ? (
        <Card tint={C.amberLine}>
          <Text style={T.aide}>Tu n’as changé aucun réglage avant ce match : l’équipe a joué par défaut. Formation, mentalité, consignes, compétences, réunion : chacun change vraiment le jeu.</Text>
        </Card>
      ) : null}

      {direct ? null : (<>
        <AvantMatch club={club} state={state} pm={pm} nous={nous} occupe={occupe} lancer={lancer} />

        <View style={{ gap: 12, marginTop: 8 }}>
          <EnTete surtitre="MOITIÉ DE LA PRIME, RIEN AU CLASSEMENT" titre="Amicaux" />
          <Groupe>
            {amicaux.map((o, i) => (
              <View key={o.id} style={[st.amical, i < amicaux.length - 1 && st.sep]}>
                <Blason nom={o.club} c1={o.color} taille={38} />
                <View style={{ flex: 1 }}>
                  <Text style={T.nom}>{o.club}</Text>
                  <Text style={T.aide}>{o.styleName} · note {o.ovr}</Text>
                </View>
                <Btn label="Amical" small tone="ghost" why={occupe} onPress={() => lancer(o, { friendly: true })} />
              </View>
            ))}
          </Groupe>
        </View>

        <View style={{ gap: 12, marginTop: 8 }}>
          <EnTete surtitre={'PRONOSTICS · ' + taken.length + ' / 3'} titre="Sur ton match" />
          <Card>
            <Text style={T.aide}>Sur le match que tu vas jouer, dans le jeu. Les gains passent par le plafond du jour.</Text>
            {pronos.slice(0, 5).map((d) => {
              const on = taken.some((t) => t.id === d.id);
              return (
                <View key={d.id} style={st.prono}>
                  <Text style={[T.corps, { flex: 1 }]}>{d.label}</Text>
                  <Text style={st.cote}>x{d.odd}</Text>
                  <Btn label={on ? 'Pris' : 'Miser 40'} small
                    why={on ? 'Déjà pris' : taken.length >= 3 ? 'Trois au maximum' : state.balance < 40 ? 'Pas assez de jetons' : ''}
                    onPress={() => act((c) => c.placeProno(d.id, 40))} />
                </View>
              );
            })}
          </Card>
        </View>
      </>)}
    </ScrollView>
  );
}

// le match du calendrier, avant le coup d'envoi : le bloc de score de la maquette, sans score
function AvantMatch({ club, state, pm, nous, occupe, lancer }) {
  const note = Math.round(club.metrics(club.pickXI(state.formation)).ovr);
  const moi = Object.assign({}, nous, { sous: 'NOTE ' + note });
  const eux = { nom: pm.opp.club, c1: pm.opp.color, sous: 'NOTE ' + pm.opp.ovr };
  const [g, d] = pm.domicile ? [moi, eux] : [eux, moi];
  const stade = club.STADES()[state.stade || 0];
  return (
    <View style={st.avant}>
      <Fond type="stade" />
      <Text style={st.avantLieu}>DIVISION {state.division} · JOURNÉE {pm.day}/{pm.total} · {pm.domicile ? 'À DOMICILE' : 'À L’EXTÉRIEUR'}</Text>
      <View style={st.affLigne}>
        <Equipe e={g} grand sous={g.sous} />
        <View style={st.affCentre}>
          <Text style={st.avantJ}>J{pm.day}</Text>
          <Text style={st.affStyle} numberOfLines={2}>{pm.domicile ? stade.name : 'chez ' + pm.opp.club}</Text>
        </View>
        <Equipe e={d} grand sous={d.sous} />
      </View>
      <Text style={[T.aide, { textAlign: 'center' }]}>{pm.opp.club} joue en {pm.opp.styleName}</Text>
      <Btn label="Jouer" icone="play" why={occupe} onPress={() => lancer(pm.opp)} />
      <Text style={[T.aide, { textAlign: 'center' }]}>Le seul match qui compte au classement. Les deux autres matchs de la journée se jouent en même temps.</Text>
    </View>
  );
}

// les chiffres du match, en barres comme dans la maquette (part de ton équipe en citron)
function StatsMatch({ res }) {
  const H = res.stats.H || {}, A = res.stats.A || {};
  const virgule = (v) => (Number(v) || 0).toFixed(1).replace('.', ',');
  const lignes = [
    ['Possession', res.poss, 100 - res.poss, (v) => v + ' %'],
    ['Tirs', H.sh, A.sh], ['Tirs cadrés', H.on, A.on], ['Buts attendus (xG)', H.xg, A.xg, virgule],
    ['Corners', H.cor, A.cor], ['Fautes', H.fou, A.fou]
  ];
  return (
    <View style={{ gap: 13, paddingVertical: 4 }}>
      {lignes.map(([nom, h, a, f]) => {
        const fm = f || ((v) => String(v || 0));
        const tot = (Number(h) || 0) + (Number(a) || 0);
        return (
          <View key={nom} style={st.statLigne}>
            <Text style={st.statG}>{fm(h)}</Text>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={st.statNom}>{nom}</Text>
              <View style={st.statBarre}><View style={[st.statBarreFg, { width: (tot ? (100 * (Number(h) || 0)) / tot : 50) + '%' }]} /></View>
            </View>
            <Text style={st.statD}>{fm(a)}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ---------- entraînement ----------
export function TrainScreen({ club, state, act, go }) {
  // Une séance ciblée demande sur QUI l'appliquer : on ne choisit pas à la place
  // du directeur sportif. Tant qu'il n'a pas répondu, l'écran montre l'effectif.
  const [pickStat, setPickStat] = useState(null);
  const ti = club.trainInfo();
  const opts = club.trainingOptions();
  const meets = club.meetings();

  if (pickStat) {
    return (
      <ScrollView contentContainerStyle={st.page}>
        <Card tint={C.amberLine}>
          <Text style={T.corps}>Choisis le joueur qui reçoit la carte {pickStat} (+2)</Text>
          <Btn label="Annuler" tone="ghost" small onPress={() => setPickStat(null)} />
        </Card>
        {state.squad.slice().sort((a, b) => b.ovr - a.ovr).map((p) => (
          <Pressable key={p.id} onPress={() => { act((c) => c.useUpgrade(p.id, pickStat)); setPickStat(null); }}>
            <Card>
              <Row>
                <View style={st.noteCase}><Text style={st.noteCaseTxt}>{p.ovr}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={T.nom}>{p.name}</Text>
                  <Text style={T.aide}>{p.pos} · niveau {club.playerLevel(p)}</Text>
                </View>
              </Row>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={st.page}>
      <Title surtitre="CENTRE D’ENTRAÎNEMENT" sub="Chaque séance consomme une séance en stock. Deux offertes par jour.">Entraînement</Title>

      <Card vedette>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={T.nom}>Séances disponibles</Text>
            <Text style={T.aide}>{ti.freePerDay} offertes par jour · {ti.max} au maximum</Text>
          </View>
          <Text style={[st.grosChiffre, { color: ti.sessions ? C.accent : C.amber }]}>{ti.sessions}</Text>
        </Row>
      </Card>

      {opts.map((o) => (
        <Card key={o.id}>
          <Row>
            <View style={{ flex: 1 }}>
              <Text style={T.nom}>{o.label}</Text>
              <Text style={T.aide}>{o.desc}</Text>
            </View>
            <Btn label={o.kind === 'card' ? 'Utiliser' : 'Lancer'} small why={o.why}
              onPress={() => { if (o.kind === 'card') setPickStat(o.stat); else act((c) => c.train(o.id)); }} />
          </Row>
          <Text style={T.aide}>Coûte {o.cost}</Text>
        </Card>
      ))}

      <Card>
        <Text style={T.surtitre}>RÉUNION D’ÉQUIPE</Text>
        <Text style={T.aide}>{club.plansLeft()} plan(s) tactique(s) en réserve</Text>
        {meets.map((m) => (
          <Row key={m.id}>
            <View style={{ flex: 1 }}>
              <Text style={T.corps}>{m.label}</Text>
              <Text style={T.aide}>{m.can ? m.desc + ' · x' + m.n : m.why}</Text>
            </View>
            <Btn label="Tenir" small why={m.can ? '' : 'Aucune en réserve'} onPress={() => act((c) => c.holdMeeting(m.id))} />
          </Row>
        ))}
      </Card>

      {/* L'achat se fait dans l'onglet Packs : ici on se sert de ce qu'on a. */}
      <Card tint={C.blueLine}>
        <Text style={T.corps}>{club.packPrincipal().name} · {club.packPrincipal().cost} jetons · {Math.round(club.packFamilies().find((f) => f.kind === 'objet').pct)} % d’objets à chaque tirage</Text>
        <Text style={T.aide}>Séances, cartes, causeries et plans sortent du pack, dans l’onglet Packs. Tu l’ouvres là-bas, tu t’en sers ici.</Text>
        <Btn label="Le pack" small onPress={() => go('packs')} style={{ alignSelf: 'flex-start' }} />
      </Card>

      {state.trainLog ? <Card><Text style={T.corps}>{state.trainLog}</Text></Card> : null}
    </ScrollView>
  );
}

// ---------- le pack ----------
// §8 UN SEUL PACK. L'écran ne recopie aucune probabilité : il affiche ce que
// club.packPrincipal() lui donne, les deux tables mêmes du tirage (§9, §29).
const POURCENT = (v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1).replace('.', ',')) + ' %';
const SOUS_FAMILLE = {
  player: 'une carte du catalogue ; un joueur déjà au club devient des fragments',
  skill: 'une compétence à équiper sur un joueur compatible',
  objet: 'séance, carte d’amélioration, causerie, plan tactique'
};

export function PacksScreen({ club, state, act, go, save }) {
  const col = club.collection();
  const k = club.packPrincipal();
  const defil = useRef(null), pack3d = useRef(null);
  const [ouvre, setOuvre] = useState(false);
  const [tirage, setTirage] = useState(null);   // { got, vus } : la révélation sous le pack
  const minuteurs = useRef([]);
  useEffect(() => () => minuteurs.current.forEach(clearTimeout), []);
  const plusTard = (fn, ms) => { minuteurs.current.push(setTimeout(fn, ms)); };
  // Le tirage (openPack), l'encaissement (commitPack) et la sauvegarde d'abord, l'animation
  // ensuite : fermer l'app pendant l'éclat ne rejoue pas le tirage, même si sa couleur a déjà
  // trahi la rareté. Puis les lots se montrent un par un, le meilleur en dernier.
  const ouvrir = () => {
    if (ouvre) return;
    const res = club.openPack({});
    if (!res.ok) return;
    act((c) => c.commitPack(res));
    const fini = Promise.resolve(save ? save() : null).catch(() => {});
    const p = pack3d.current;
    if (!p || !p.pret()) return;
    const best = club.RARITY().find((x) => x.id === res.got[0].rar);
    setOuvre(true); setTirage({ got: res.got.slice().reverse(), vus: 0 });
    if (defil.current) defil.current.scrollTo({ y: 0, animated: true });
    fini.then(() => {
      p.secouer(1);
      p.ouvrir(best ? best.tint : C.accent);
      res.got.forEach((_, i) => plusTard(() => setTirage((t) => (t ? { got: t.got, vus: i + 1 } : t)), 700 + i * 300));
      plusTard(() => setOuvre(false), 700 + res.got.length * 300);
      plusTard(() => { if (pack3d.current) pack3d.current.nouveau(); }, 1800);
    });
  };
  return (
    <ScrollView ref={defil} contentContainerStyle={st.page}>
      <Title surtitre="PACK UNIQUE" sub="Un seul pack dans tout le jeu, et il peut tout donner. Les probabilités sont affichées avant l’ouverture et ne changent jamais.">Le pack</Title>
      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={T.nom}>Collection de cartes</Text>
            <Text style={T.aide}>{state.shards || 0} fragments · solde {state.balance} jetons</Text>
          </View>
          <Text style={[st.grosChiffre, { color: C.accent }]}>{col.have} / {col.total}</Text>
        </Row>
      </Card>
      <Card vedette tint={C.accentLine}>
        <Pack3D ref={pack3d} club={club} def={k} hauteur={190} />
        {tirage ? (
          <View style={st.lots} testID="revelation">
            {tirage.got.slice(0, tirage.vus).map((g, i) => <CarteLot key={i} club={club} g={g} />)}
          </View>
        ) : null}
        <View style={{ alignSelf: 'flex-start' }}><Tag color={C.accent}>PACK UNIQUE</Tag></View>
        <Text style={st.packNom}>{k.name}</Text>
        <Text style={T.aide}>{k.desc}</Text>
        <Text style={[T.surtitre, { marginTop: 6 }]}>CE QUE PEUT DONNER CHAQUE TIRAGE</Text>
        {k.familles.map((f) => (
          <View key={f.kind}>
            <Row>
              <Text style={[T.aide, { flex: 1, color: C.dim }]}>{f.label}</Text>
              <Text style={st.pct}>{POURCENT(f.pct)}</Text>
            </Row>
            <Text style={T.aide}>{SOUS_FAMILLE[f.kind]}</Text>
          </View>
        ))}
        <Text style={[T.surtitre, { marginTop: 6 }]}>RARETÉ DE CHAQUE TIRAGE</Text>
        {k.odds.map((o, i) => (
          <Row key={i}>
            <Text style={[T.aide, { flex: 1, color: C.dim }]}>{o.label}</Text>
            <Text style={st.pct}>{POURCENT(o.pct)}</Text>
          </Row>
        ))}
        <Text style={T.aide}>La rareté vaut pour les trois familles : un objet Gold est aussi rare qu’un joueur Gold.</Text>
        {k.got && !ouvre ? <Text style={[T.aide, { color: C.accent }]}>Dernier tirage : {k.got}</Text> : null}
        <Btn label={ouvre ? 'Ouverture…' : 'OUVRIR LE PACK · ' + k.cost + ' jetons'} why={ouvre ? '' : k.why} onPress={ouvrir} />
        <Row>
          <Text style={[T.aide, { flex: 1 }]}>{k.useLabel}</Text>
          <Btn label="Y aller" small tone="ghost" onPress={() => go(k.useView)} />
        </Row>
      </Card>
    </ScrollView>
  );
}

// Un lot révélé, en carte (§11 « révélation progressive, carte joueur ») : la rareté en
// haut et dans la couleur du cadre, la note d'un joueur ou la puissance d'une compétence,
// le poste ou la famille, le nom. Elle apparaît en glissant, une après l'autre.
const FAMILLE_LOT = { player: 'Joueur', skill: 'Compétence', objet: 'Objet', shards: 'Doublon' };
function CarteLot({ club, g }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 260, useNativeDriver: false }).start(); }, []);
  const tint = rarityTint(club, g.rar);
  const grand = g.kind === 'shards' ? '+' + g.shards : g.ovr != null ? String(g.ovr) : '';
  const sous = g.kind === 'player' ? g.pos : g.kind === 'shards' ? 'fragments' : g.kind === 'skill' ? 'puissance' : '';
  return (
    <Animated.View style={[st.lot, { borderColor: tint, backgroundColor: tint + '22', opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      <Text style={[st.lotRar, { color: tint }]}>{g.label}</Text>
      {grand ? <Text style={st.lotNote}>{grand}</Text> : null}
      {sous ? <Text style={st.lotSous}>{sous}</Text> : null}
      <Text style={st.lotNom} numberOfLines={2}>{g.name}</Text>
      <Text style={st.lotFam}>{FAMILLE_LOT[g.kind] || ''}</Text>
    </Animated.View>
  );
}

// ---------- compétences et quêtes ----------
export function SkillsScreen({ club, state, act, go }) {
  const inv = club.skillInventory();
  // §22 « je les attribue aux joueurs compatibles » : c'est le directeur sportif qui
  // choisit le porteur, parmi ceux que le moteur déclare compatibles.
  const [choix, setChoix] = useState(null);
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Title surtitre="COMPÉTENCES" sub={club.skillCount().toLocaleString('fr-FR') + ' combinaisons possibles'}>Compétences</Title>
      <Card tint={C.violetLine}>
        <Text style={T.corps}>{club.packPrincipal().name} · {club.packPrincipal().cost} jetons · {Math.round(club.packFamilies().find((f) => f.kind === 'skill').pct)} % de compétences à chaque tirage</Text>
        <Text style={T.aide}>Les compétences sortent du pack, dans l’onglet Packs. Ici on équipe, là-bas on ouvre.</Text>
        <Btn label="Le pack" small onPress={() => go('packs')} style={{ alignSelf: 'flex-start' }} />
      </Card>
      {inv.length === 0 ? <Empty>Aucune compétence en réserve pour l’instant.</Empty> : null}
      {inv.map((k) => (
        <Card key={k.uid}>
          <Row>
            <Text style={[T.nom, { flex: 1 }]}>{k.name}</Text>
            <Tag color={k.color}>{k.rarLabel}</Tag>
          </Row>
          <Text style={T.aide}>{k.desc}</Text>
          <Text style={T.aide}>{k.reqLine} · puissance {k.power}</Text>
          <Row>
            <Text style={[T.aide, { flex: 1, color: k.onName ? C.accent : k.fitCount ? C.dim : C.amber }]}>
              {k.onName ? 'Portée par ' + k.onName : k.fitCount ? k.fitCount + ' joueur(s) compatible(s)' : (k.miss || 'Aucun joueur compatible')}
            </Text>
            <Btn label={k.onName ? 'Retirer' : choix === k.uid ? 'Fermer' : 'Équiper'} small
              why={k.onName || k.fitCount ? '' : 'Personne ne peut la porter'}
              onPress={() => {
                if (k.onName) act((c) => c.unequipSkill(k.uid));
                else if (k.fitCount === 1) act((c) => c.equipSkill(k.uid, k.fits[0].id));
                else setChoix(choix === k.uid ? null : k.uid);
              }} />
          </Row>
          {choix === k.uid ? k.fits.map((f) => (
            <Row key={f.id}>
              <Text style={[T.aide, { flex: 1 }]}>{f.name} · {f.pos} {f.ovr}</Text>
              <Btn label="Équiper" small onPress={() => { act((c) => c.equipSkill(k.uid, f.id)); setChoix(null); }} />
            </Row>
          )) : null}
        </Card>
      ))}

      <Card>
        <Text style={T.aide}>Les quêtes ont maintenant leur propre écran, depuis l’accueil du club et la cloche en haut.</Text>
        <Btn label="Les quêtes" small tone="ghost" onPress={() => go('quests')} style={{ alignSelf: 'flex-start' }} />
      </Card>
    </ScrollView>
  );
}

// ---------- en ligne ----------
export function OnlineScreen({ club, state, act }) {
  const [tab, setTab] = useState('journal');
  const sum = club.onlineSummary();
  const feed = sum.feed || (sum.connected ? {} : club.demoFeed());
  const demo = !sum.connected && !sum.feed;
  const slides = club.onlineSlides(feed);
  const cur = slides.find((x) => x.id === tab) || slides[0];
  const news = club.newsBySection(feed);
  const lad = feed.ladder || [];
  const players = (feed.players || []).slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
  return (
    <ScrollView contentContainerStyle={st.page}>
      {/* les filtres de la maquette (« For you, People, Clubs… ») : blanc quand on y est */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        {slides.map((x) => (
          <Pressable key={x.id} onPress={() => setTab(x.id)} style={[st.filtre, tab === x.id && st.filtreOn]}>
            <Text style={[st.filtreTxt, tab === x.id && st.filtreTxtOn]}>{x.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Title sub={cur.sub}>{cur.label}</Title></View>
        <Pastille ton={sum.connected ? 'accent' : 'alerte'} point>{demo ? 'EXEMPLE HORS LIGNE' : String(sum.state).toUpperCase()}</Pastille>
      </Row>

      {tab === 'journal' ? news.map((sec) => (
        <View key={sec.id} style={{ gap: 8 }}>
          {sec.items.slice(0, sec.id === 'une' ? 1 : 4).map((a, i) => (
            <Card key={i} vedette={sec.id === 'une'} tint={sec.id === 'une' ? C.accentLine : null}>
              {sec.id === 'une' ? <Text style={[T.surtitre, { color: C.accent }]}>À LA UNE</Text> : null}
              <Text style={[T.nom, sec.id === 'une' && st.une]}>{a.title}</Text>
              {a.sub ? <Text style={T.aide}>{a.sub}</Text> : null}
              {a.body ? <Text style={[T.aide, { fontStyle: 'italic' }]}>{a.body}</Text> : null}
              <Text style={[T.aide, { color: C.ghost }]}>{a.ago}</Text>
            </Card>
          ))}
        </View>
      )) : null}

      {tab === 'classement' || tab === 'equipes' ? (
        <Groupe>
          {lad.slice(0, 10).map((r, i, a) => (
            <View key={r.id || r.name} style={[st.classe, i < a.length - 1 && st.sep]}>
              <Text style={[st.rang, { color: r.rank <= 3 ? C.accent : C.faint }]}>{r.rank}</Text>
              <View style={{ flex: 1 }}>
                <Text style={T.nom}>{r.name || r.id}</Text>
                <Text style={T.aide}>{r.p} matchs · {r.w}V {r.d}N {r.l}D</Text>
              </View>
              <Text style={[st.pct, { color: r.rank <= 3 ? C.accent : C.dim }]}>{r.elo}</Text>
            </View>
          ))}
        </Groupe>
      ) : null}

      {tab === 'joueurs' ? (
        <Groupe>
          {players.slice(0, 10).map((p, i, a) => (
            <View key={i} style={[st.classe, i < a.length - 1 && st.sep]}>
              <Text style={[st.rang, { color: i < 3 ? C.accent : C.faint }]}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={T.nom}>{p.name}</Text>
                <Text style={T.aide}>{p.club}{p.goals ? ' · ' + p.goals + ' but(s)' : ''}</Text>
              </View>
              <Text style={[st.pct, { color: i < 3 ? C.accent : C.dim }]}>{(p.rating || 0).toFixed(1)}</Text>
            </View>
          ))}
        </Groupe>
      ) : null}

      {(tab === 'ligue' || tab === 'tournoi') ? <Empty>{cur.emptyWhy}</Empty> : null}

      <Text style={[T.aide, { textAlign: 'center', color: C.ghost }]}>
        {demo
          ? 'Exemple construit sur ton club solo. Branche le mode en ligne pour de vrais adversaires.'
          : 'Chaque article vient d’un match, d’un classement ou d’un transfert qui a réellement eu lieu.'}
      </Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: S.pad, gap: S.gap, paddingBottom: 56 },
  accueil: { paddingBottom: 56 },
  section: { paddingHorizontal: S.pad, paddingTop: 30, gap: 14 },
  // le héros
  heros: { height: 420, marginHorizontal: 12, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden', backgroundColor: '#111111' },
  herosImage: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  herosTexte: { position: 'absolute', left: 22, right: 22, bottom: 26, gap: 0 },
  herosKicker: { fontFamily: F.texte, color: C.accent, fontSize: 9.5, fontWeight: '700', letterSpacing: 1.8 },
  herosTitre: { fontFamily: F.titre, color: C.text, fontSize: 41, fontWeight: '800', lineHeight: 38, letterSpacing: -2.6, marginTop: 12, marginBottom: 22 },
  herosIndex: { position: 'absolute', right: 20, bottom: 36, fontFamily: F.texte, color: '#8D968E', fontSize: 9.5, letterSpacing: 1.4 },
  // la carte du prochain match
  affiche: { borderRadius: S.radius, borderWidth: 1, borderColor: C.line, overflow: 'hidden', padding: 15, gap: 4 },
  afficheHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  afficheLieu: { flex: 1, textAlign: 'right', fontFamily: F.texte, color: '#686E69', fontSize: 9.5, letterSpacing: 1.1 },
  affLigne: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 12 },
  affCentre: { width: 96, alignItems: 'center', gap: 4 },
  affVs: { fontFamily: F.titre, color: C.text, fontSize: 26, fontWeight: '800', letterSpacing: -1 },
  affStyle: { fontFamily: F.texte, color: '#6E746F', fontSize: 10, textAlign: 'center' },
  affBas: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: C.lineSoft, paddingTop: 11 },
  affNote: { flex: 1, fontFamily: F.texte, color: '#6E736F', fontSize: 10.5 },
  affNoteB: { color: '#C4CAC5', fontWeight: '700' },
  ratio: { width: 70, height: 2, backgroundColor: '#313631' },
  ratioFg: { height: 2, backgroundColor: C.accent },
  equipe: { flex: 1, alignItems: 'center', gap: 8 },
  equipeNom: { fontFamily: F.texte, color: C.text, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  equipeSous: { fontFamily: F.texte, color: '#5F645F', fontSize: 9, letterSpacing: 1, marginTop: -3 },
  // le club
  solde: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: C.accentLine, backgroundColor: C.accentFill },
  soldeTxt: { fontFamily: F.titre, color: C.text, fontSize: 14, fontWeight: '800' },
  stats: { flexDirection: 'row', paddingVertical: 14, marginVertical: 2, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.lineSoft },
  statsLigne: { flexDirection: 'row', paddingVertical: 6 },
  niveau: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, backgroundColor: '#121512' },
  noteBloc: { alignItems: 'center', minWidth: 56 },
  noteGrand: { fontFamily: F.titre, color: C.accent, fontSize: 32, fontWeight: '800', letterSpacing: -1.2, lineHeight: 34 },
  noteL: { fontFamily: F.texte, color: '#666666', fontSize: 8.5, letterSpacing: 1.2 },
  // effectif et fiche
  noteCase: { width: 46, height: 46, borderRadius: 12, backgroundColor: C.cardAlt, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  noteCaseTxt: { fontFamily: F.titre, color: C.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.5 },
  profil: { borderRadius: 20, overflow: 'hidden', padding: 18, paddingTop: 22, gap: 10, borderWidth: 1, borderColor: C.line },
  profilNom: { fontFamily: F.titre, color: C.text, fontSize: 38, fontWeight: '800', lineHeight: 35, letterSpacing: -2.4, marginTop: 4 },
  grosChiffre: { fontFamily: F.titre, color: C.text, fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  // match
  avant: { borderRadius: 20, overflow: 'hidden', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 18, gap: 12, borderWidth: 1, borderColor: C.line },
  avantLieu: { fontFamily: F.texte, color: '#7A817B', fontSize: 9.5, letterSpacing: 1.3, textAlign: 'center' },
  avantJ: { fontFamily: F.titre, color: C.text, fontSize: 34, fontWeight: '800', letterSpacing: -1.4 },
  resultat: { borderRadius: 20, overflow: 'hidden', padding: 16, gap: 10, borderWidth: 1, borderColor: C.accentLine },
  resHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  score: { width: 112, textAlign: 'center', fontFamily: F.titre, color: C.text, fontSize: 38, fontWeight: '800', letterSpacing: -1.5 },
  statLigne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statG: { width: 46, fontFamily: F.titre, color: C.text, fontSize: 14, fontWeight: '800', textAlign: 'left' },
  statD: { width: 46, fontFamily: F.titre, color: C.dim, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  statNom: { fontFamily: F.texte, color: '#7A7A7A', fontSize: 10.5, textAlign: 'center' },
  statBarre: { height: 3, backgroundColor: '#2A2A2A', borderRadius: 2, overflow: 'hidden' },
  statBarreFg: { height: 3, backgroundColor: C.accent },
  amical: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  sep: { borderBottomWidth: 1, borderBottomColor: C.line },
  prono: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.lineSoft },
  cote: { fontFamily: F.titre, color: C.accent, fontSize: 13, fontWeight: '800' },
  // pack
  packNom: { fontFamily: F.titre, color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.8 },
  pct: { fontFamily: F.titre, color: C.text, fontSize: 13.5, fontWeight: '800' },
  lots: { flexDirection: 'row', gap: 8 },
  lot: { flex: 1, minHeight: 118, borderRadius: 12, borderWidth: 1.5, padding: 8, gap: 2 },
  lotRar: { fontFamily: F.texte, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  lotNote: { fontFamily: F.titre, color: C.text, fontSize: 26, fontWeight: '800', lineHeight: 30 },
  lotSous: { fontFamily: F.texte, color: C.dim, fontSize: 10.5, fontWeight: '700' },
  lotNom: { fontFamily: F.texte, color: C.text, fontSize: 12, fontWeight: '700', marginTop: 'auto' },
  lotFam: { fontFamily: F.texte, color: C.faint, fontSize: 10 },
  // en ligne
  filtre: { paddingHorizontal: 14, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  filtreOn: { backgroundColor: C.text, borderColor: C.text },
  filtreTxt: { fontFamily: F.texte, color: '#8A8A8A', fontSize: 12, fontWeight: '600' },
  filtreTxtOn: { color: '#050505', fontWeight: '700' },
  une: { fontFamily: F.titre, fontSize: 19, fontWeight: '800', letterSpacing: -0.6, lineHeight: 23 },
  classe: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rang: { width: 22, fontFamily: F.titre, fontSize: 15, fontWeight: '800' }
});
