// Les écrans du directeur sportif, en React Native.
//
// Aucun d'eux ne décide quoi que ce soit : ils lisent le moteur et appellent ses
// méthodes. Un refus vient toujours du moteur, avec sa raison, et l'écran se contente
// de l'afficher. C'est ce qui garantit que l'app native et l'app web racontent
// exactement la même chose.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Animated } from 'react-native';
import { C, S, rarityTint } from './theme';
import { Card, Title, Row, Btn, Bar, Tag, Stat, Empty } from './ui';
import { Composition, EnDirect } from './direct';
import { Terrain } from './terrain';
import { Pack3D } from './pack3d';

// ---------- accueil ----------
export function HomeScreen({ club, state, act, go }) {
  const xi = club.pickXI(state.formation);
  const ovr = Math.round(club.metrics(xi).ovr);
  const need = club.levelNeed(state.level);
  const ti = club.trainInfo();
  const quests = club.activeQuests().filter((q) => q.prog >= q.goal && !q.claimed).length;
  const inv = club.skillInventory();
  const main = club.packPrincipal();
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={st.club}>{state.clubName || 'FC TonPseudo'}</Text>
            <Text style={st.clubSub}>Note {ovr} · {state.formation} · Division {state.division}</Text>
          </View>
          <View style={st.coin}><Text style={st.coinTxt}>{state.balance}</Text></View>
        </Row>
        <Row style={{ marginTop: 6 }}>
          <Stat label="niveau" value={state.level} />
          <Stat label="série" value={state.winStreak} />
          <Stat label="séances" value={ti.sessions} color={ti.sessions ? C.green : C.amber} />
          <Stat label="fragments" value={state.shards || 0} />
        </Row>
        <Bar pct={(state.xp / need) * 100} />
        <Text style={st.hint}>{state.xp} / {need} XP avant le niveau {state.level + 1}</Text>
      </Card>

      {/* §17 DIRECTEUR SPORTIF : les neuf entrées, dans l'ordre du cahier des charges. */}
      <Text style={st.lbl}>DIRECTEUR SPORTIF</Text>
      <Text style={st.hint}>Tu ne touches jamais au ballon : tu construis l’équipe qui le joue.</Text>
      <NavRow go={go} items={[
        ['squad', 'Mon effectif', xi.length + ' titulaires · ' + state.squad.length + ' joueurs'],
        ['skills', 'Compétences', inv.length ? inv.filter((k) => k.onName).length + ' équipée(s) · ' + inv.filter((k) => !k.onName).length + ' en réserve' : 'Aucune compétence en réserve'],
        ['packs', 'Pack', main.name + ' · ' + main.cost + ' jetons · ' + (main.can ? 'ouvrable' : main.why.toLowerCase())],
        ['train', 'Entraînement', ti.line],
        ['transfers', 'Transferts', state.balance + ' jetons · ' + club.marketList().length + ' joueurs à vendre'],
        ['quests', 'Quêtes', club.activeQuests().length + ' en cours' + (quests ? ' · ' + quests + ' à récupérer' : '')],
        ['finances', 'Finances', state.balance + ' jetons · journal et plafonds du jour'],
        ['tactic', 'Tactique', state.formation + ' · ' + (state.preset === 'perso' ? 'tactique perso' : club.styles()[state.preset].name)],
        ['club', 'Club', 'Niveau ' + state.level + ' · staff, stade, centre de formation']
      ]} />
      <Text style={st.lbl}>COMPÉTITIONS</Text>
      <NavRow go={go} items={[
        ['match', 'Jouer un match', 'Journée ' + club.prochainMatch().day + '/' + club.prochainMatch().total + ' contre ' + club.prochainMatch().opp.club],
        ['division', 'Division ' + state.division, (() => { const r = club.table().find((x) => x.me); return (r.rank === 1 ? '1er' : r.rank + 'e') + ' sur ' + club.DIVISION_RULES().clubs + ' · ' + r.pts + ' point' + (r.pts > 1 ? 's' : ''); })()],
        ['online', 'En ligne', club.onlineSummary().state]
      ]} />

      {state.lastGain ? <Card><Text style={st.body}>{state.lastGain}</Text></Card> : null}
    </ScrollView>
  );
}

function NavRow({ items, go }) {
  return (
    <View style={{ gap: 10 }}>
      {items.map(([id, label, sub]) => (
        <Pressable key={id} onPress={() => go(id)} style={({ pressed }) => [st.navRow, pressed && { opacity: 0.75 }]}>
          <View style={{ flex: 1 }}>
            <Text style={st.navLabel}>{label}</Text>
            <Text style={st.navSub} numberOfLines={1}>{sub}</Text>
          </View>
          <Text style={st.chev}>›</Text>
        </Pressable>
      ))}
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
      <Title sub="Le onze, puis tout l’effectif : note, niveau et compétences portées">Effectif</Title>
      <Composition club={club} state={state} act={act} />
      {squad.map((p) => {
        const g = club.playerProgress(p);
        return (
          <Pressable key={p.id} onPress={() => setOpen(p.id)}>
            <Card>
              <Row>
                <Text style={st.ovr}>{p.ovr}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.name}>{p.name}</Text>
                  <Text style={st.hint}>{p.pos} · niveau {g.lvl} · {g.worn}/{g.slots} compétence(s)</Text>
                </View>
                <Tag color={club.rarityFor(p).tint}>{club.rarityFor(p).label}</Tag>
              </Row>
              <Bar pct={g.pct} />
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function PlayerScreen({ club, p, act, back }) {
  const pr = club.profile(p);
  const g = club.playerProgress(p);
  const t = club.shardTrainInfo(p);
  const h = club.hiddenOf(p);
  const lab = (v) => (v >= 80 ? 'excellent' : v >= 62 ? 'bon' : v >= 45 ? 'correct' : 'faible');
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Btn label="‹ Retour" tone="ghost" small onPress={back} style={{ alignSelf: 'flex-start' }} />
      <Card>
        <Row>
          <Text style={st.ovr}>{p.ovr}</Text>
          <View style={{ flex: 1 }}>
            <Text style={st.name}>{p.name}</Text>
            <Text style={st.hint}>{pr.age} ans · {pr.nat} · potentiel {pr.pot}</Text>
          </View>
        </Row>
        <Row>
          <Stat label="forme" value={pr.form + ' %'} />
          <Stat label="énergie" value={pr.fit + ' %'} />
          <Stat label="moral" value={pr.morale + ' %'} />
          <Stat label="valeur" value={pr.value} />
        </Row>
      </Card>

      <Card>
        <Text style={st.lbl}>STATISTIQUES</Text>
        <Text style={st.body}>{club.carriereLigne(p)}</Text>
      </Card>

      <Card>
        <Text style={st.lbl}>NIVEAU</Text>
        <Text style={st.body}>Niveau {g.lvl} · {g.xp} / {g.need} XP</Text>
        <Bar pct={g.pct} />
        <Text style={st.hint}>{g.worn} / {g.slots} emplacements de compétence</Text>
        <Btn label={'Entraîner · ' + t.cost + ' fragments'} why={t.why}
          onPress={() => act((c) => c.shardTrain(p.id))} />
      </Card>

      <Card>
        <Text style={st.lbl}>COMPÉTENCES</Text>
        {club.skillsOf(p).length === 0
          ? <Empty>Aucune compétence. Ouvre le {club.packPrincipal().name} et équipe-la depuis Compétences.</Empty>
          : club.skillsOf(p).map((k, i) => (
            <View key={i} style={{ gap: 3 }}>
              <Row>
                <Text style={[st.body, { flex: 1 }]}>{k.name}</Text>
                <Tag color={k.color}>{k.rarLabel}</Tag>
              </Row>
              <Text style={st.hint}>{k.desc}</Text>
            </View>
          ))}
      </Card>

      <Card>
        <Text style={st.lbl}>RAPPORT DU RECRUTEUR</Text>
        {[['Régularité', h.regularite], ['Grands matchs', h.grandsMatchs], ['Sang-froid', h.pression],
          ['Progression', h.progression], ['Résistance aux blessures', 100 - h.blessure], ['Adaptation tactique', h.adaptation]
        ].map(([k, v]) => (
          <Row key={k}>
            <Text style={[st.hint, { flex: 1 }]}>{k}</Text>
            <Text style={st.body}>{lab(v)}</Text>
          </Row>
        ))}
        <Text style={st.hint}>Ces qualités ne s’affichent pas comme des statistiques : elles agissent pendant le match.</Text>
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
    ecoute.current = d.ecouter((e) => { if (e.fini) { setVue(null); setRes(e.resultat); } else setVue(e); });
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
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Title sub="Les 22 joueurs sont pilotés par l’IA. Tu décides depuis le banc : changements, consignes, cartes.">Match</Title>

      {direct && vue && !vue.fini ? <Terrain club={club} d={direct} hauteur={300} /> : null}
      {direct && vue && !vue.fini ? <EnDirect club={club} d={direct} vue={vue} /> : null}

      {res ? (
        <Card tint={C.green}>
          <Text style={st.lbl}>{res.amical ? 'MATCH AMICAL' : 'CHAMPIONNAT'}</Text>
          <Text style={st.score}>{res.score[0]} - {res.score[1]}</Text>
          {res.pso ? <Text style={[st.body, { textAlign: 'center' }]}>Tirs au but : {res.pso.H} - {res.pso.A}</Text> : null}
          <Text style={st.hint}>Tirs {res.stats.H.sh} - {res.stats.A.sh} · {res.poss} % de possession · +{res.reward} jetons</Text>
          {(res.decisions || []).length ? (
            <View style={{ gap: 2 }}>
              <Text style={st.lbl}>TES DÉCISIONS</Text>
              {res.decisions.map((x, i) => <Text key={i} style={[st.hint, { color: C.blue }]}>{x.minute}' {x.texte}</Text>)}
            </View>
          ) : null}
          {res.log.slice(-6).reverse().map((l, i) => (
            <Text key={i} style={st.hint}>{l.text}</Text>
          ))}
          <Row>
            <Btn label="Fermer" tone="ghost" small onPress={() => setRes(null)} />
            {!res.amical ? <Btn label="Le classement" small onPress={() => go('division')} /> : null}
          </Row>
        </Card>
      ) : null}

      {/* §47 : ce que chaque décision a produit. Une ligne seulement pour les réglages
          vraiment changés, et le chiffre vient de ce match, pas d'une estimation. */}
      {res && res.impact && res.impact.length ? (
        <Card tint="rgba(46,204,113,0.35)">
          <Text style={st.lbl}>CE QUE TES DÉCISIONS ONT FAIT</Text>
          {res.impact.map((im) => (
            <View key={im.id}>
              <Text style={st.body}>{im.titre}</Text>
              <Text style={st.hint}>{im.valeur}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      {res && res.impact && !res.impact.length ? (
        <Card tint="rgba(245,200,76,0.35)">
          <Text style={st.hint}>Tu n’as changé aucun réglage avant ce match : l’équipe a joué par défaut. Formation, mentalité, consignes, compétences, réunion : chacun change vraiment le jeu.</Text>
        </Card>
      ) : null}

      {direct ? null : (<>
      <Card tint="rgba(46,204,113,0.45)">
        <Text style={st.lbl}>DIVISION {state.division} · JOURNÉE {pm.day}/{pm.total} · {pm.domicile ? 'À DOMICILE' : 'À L’EXTÉRIEUR'}</Text>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={st.name}>{pm.opp.club}</Text>
            <Text style={st.hint}>{pm.opp.styleName} · note {pm.opp.ovr}</Text>
          </View>
          <Btn label="Jouer" small why={occupe} onPress={() => lancer(pm.opp)} />
        </Row>
        <Text style={st.hint}>Le seul match qui compte au classement. Les deux autres matchs de la journée se jouent en même temps.</Text>
      </Card>

      <Text style={st.lbl}>AMICAUX · MOITIÉ DE LA PRIME, RIEN AU CLASSEMENT</Text>
      {amicaux.map((o) => (
        <Card key={o.id}>
          <Row>
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{o.club}</Text>
              <Text style={st.hint}>{o.styleName} · note {o.ovr}</Text>
            </View>
            <Btn label="Amical" small tone="ghost" why={occupe} onPress={() => lancer(o, { friendly: true })} />
          </Row>
        </Card>
      ))}

      <Card>
        <Text style={st.lbl}>PRONOSTICS · {taken.length} / 3</Text>
        <Text style={st.hint}>Sur le match que tu vas jouer, dans le jeu. Les gains passent par le plafond du jour.</Text>
        {pronos.slice(0, 5).map((d) => {
          const on = taken.some((t) => t.id === d.id);
          return (
            <Row key={d.id}>
              <Text style={[st.body, { flex: 1 }]}>{d.label}</Text>
              <Text style={st.hint}>x{d.odd}</Text>
              <Btn label={on ? 'Pris' : 'Miser 40'} small
                why={on ? 'Déjà pris' : taken.length >= 3 ? 'Trois au maximum' : state.balance < 40 ? 'Pas assez de jetons' : ''}
                onPress={() => act((c) => c.placeProno(d.id, 40))} />
            </Row>
          );
        })}
      </Card>
      </>)}
    </ScrollView>
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
        <Card tint="rgba(245,200,76,0.4)">
          <Text style={st.body}>Choisis le joueur qui reçoit la carte {pickStat} (+2)</Text>
          <Btn label="Annuler" tone="ghost" small onPress={() => setPickStat(null)} />
        </Card>
        {state.squad.slice().sort((a, b) => b.ovr - a.ovr).map((p) => (
          <Pressable key={p.id} onPress={() => { act((c) => c.useUpgrade(p.id, pickStat)); setPickStat(null); }}>
            <Card>
              <Row>
                <Text style={st.ovr}>{p.ovr}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.name}>{p.name}</Text>
                  <Text style={st.hint}>{p.pos} · niveau {club.playerLevel(p)}</Text>
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
      <Title sub="Chaque séance consomme une séance en stock. Deux offertes par jour.">Entraînement</Title>

      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={st.body}>Séances disponibles</Text>
            <Text style={st.hint}>{ti.freePerDay} offertes par jour · {ti.max} au maximum</Text>
          </View>
          <Text style={[st.ovr, { color: ti.sessions ? C.green : C.amber }]}>{ti.sessions}</Text>
        </Row>
      </Card>

      {opts.map((o) => (
        <Card key={o.id}>
          <Row>
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{o.label}</Text>
              <Text style={st.hint}>{o.desc}</Text>
            </View>
            <Btn label={o.kind === 'card' ? 'Utiliser' : 'Lancer'} small why={o.why}
              onPress={() => { if (o.kind === 'card') setPickStat(o.stat); else act((c) => c.train(o.id)); }} />
          </Row>
          <Text style={st.hint}>Coûte {o.cost}</Text>
        </Card>
      ))}

      <Card>
        <Text style={st.lbl}>RÉUNION D’ÉQUIPE</Text>
        <Text style={st.hint}>{club.plansLeft()} plan(s) tactique(s) en réserve</Text>
        {meets.map((m) => (
          <Row key={m.id}>
            <View style={{ flex: 1 }}>
              <Text style={st.body}>{m.label}</Text>
              <Text style={st.hint}>{m.can ? m.desc + ' · x' + m.n : m.why}</Text>
            </View>
            <Btn label="Tenir" small why={m.can ? '' : 'Aucune en réserve'} onPress={() => act((c) => c.holdMeeting(m.id))} />
          </Row>
        ))}
      </Card>

      {/* L'achat se fait dans l'onglet Packs : ici on se sert de ce qu'on a. */}
      <Card tint="rgba(92,200,255,0.35)">
        <Text style={st.body}>{club.packPrincipal().name} · {club.packPrincipal().cost} jetons · {Math.round(club.packFamilies().find((f) => f.kind === 'objet').pct)} % d’objets à chaque tirage</Text>
        <Text style={st.hint}>Séances, cartes, causeries et plans sortent du pack, dans l’onglet Packs. Tu l’ouvres là-bas, tu t’en sers ici.</Text>
        <Btn label="Le pack" small onPress={() => go('packs')} />
      </Card>

      {state.trainLog ? <Card><Text style={st.body}>{state.trainLog}</Text></Card> : null}
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
      p.ouvrir(best ? best.tint : C.green);
      res.got.forEach((_, i) => plusTard(() => setTirage((t) => (t ? { got: t.got, vus: i + 1 } : t)), 700 + i * 300));
      plusTard(() => setOuvre(false), 700 + res.got.length * 300);
      plusTard(() => { if (pack3d.current) pack3d.current.nouveau(); }, 1800);
    });
  };
  return (
    <ScrollView ref={defil} contentContainerStyle={st.page}>
      <Title sub="Un seul pack dans tout le jeu, et il peut tout donner. Les probabilités sont affichées avant l’ouverture et ne changent jamais.">Le pack</Title>
      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={st.body}>Collection de cartes</Text>
            <Text style={st.hint}>{state.shards || 0} fragments · solde {state.balance} jetons</Text>
          </View>
          <Text style={[st.ovr, { color: C.green }]}>{col.have} / {col.total}</Text>
        </Row>
      </Card>
      <Card tint={C.green + '99'}>
        <Pack3D ref={pack3d} club={club} def={k} hauteur={190} />
        {tirage ? (
          <View style={st.lots} testID="revelation">
            {tirage.got.slice(0, tirage.vus).map((g, i) => <CarteLot key={i} club={club} g={g} />)}
          </View>
        ) : null}
        <View style={{ alignSelf: 'flex-start' }}><Tag color={C.green}>PACK UNIQUE</Tag></View>
        <Text style={st.name}>{k.name}</Text>
        <Text style={st.hint}>{k.desc}</Text>
        <Text style={st.lbl}>CE QUE PEUT DONNER CHAQUE TIRAGE</Text>
        {k.familles.map((f) => (
          <View key={f.kind}>
            <Row>
              <Text style={[st.hint, { flex: 1 }]}>{f.label}</Text>
              <Text style={st.body}>{POURCENT(f.pct)}</Text>
            </Row>
            <Text style={st.hint}>{SOUS_FAMILLE[f.kind]}</Text>
          </View>
        ))}
        <Text style={st.lbl}>RARETÉ DE CHAQUE TIRAGE</Text>
        {k.odds.map((o, i) => (
          <Row key={i}>
            <Text style={[st.hint, { flex: 1 }]}>{o.label}</Text>
            <Text style={st.body}>{POURCENT(o.pct)}</Text>
          </Row>
        ))}
        <Text style={st.hint}>La rareté vaut pour les trois familles : un objet Gold est aussi rare qu’un joueur Gold.</Text>
        {k.got && !ouvre ? <Text style={[st.hint, { color: C.green }]}>Dernier tirage : {k.got}</Text> : null}
        <Btn label={ouvre ? 'Ouverture…' : 'OUVRIR LE PACK · ' + k.cost + ' jetons'} why={ouvre ? '' : k.why} onPress={ouvrir} />
        <Row>
          <Text style={[st.hint, { flex: 1 }]}>{k.useLabel}</Text>
          <Btn label="Y aller" small onPress={() => go(k.useView)} />
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
      <Title sub={club.skillCount().toLocaleString('fr-FR') + ' combinaisons possibles'}>Compétences</Title>
      <Card tint="rgba(195,155,255,0.35)">
        <Text style={st.body}>{club.packPrincipal().name} · {club.packPrincipal().cost} jetons · {Math.round(club.packFamilies().find((f) => f.kind === 'skill').pct)} % de compétences à chaque tirage</Text>
        <Text style={st.hint}>Les compétences sortent du pack, dans l’onglet Packs. Ici on équipe, là-bas on ouvre.</Text>
        <Btn label="Le pack" small onPress={() => go('packs')} />
      </Card>
      {inv.length === 0 ? <Empty>Aucune compétence en réserve pour l’instant.</Empty> : null}
      {inv.map((k) => (
        <Card key={k.uid}>
          <Row>
            <Text style={[st.name, { flex: 1 }]}>{k.name}</Text>
            <Tag color={k.color}>{k.rarLabel}</Tag>
          </Row>
          <Text style={st.hint}>{k.desc}</Text>
          <Text style={st.hint}>{k.reqLine} · puissance {k.power}</Text>
          <Row>
            <Text style={[st.hint, { flex: 1, color: k.onName ? C.green : k.fitCount ? C.dim : C.amber }]}>
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
              <Text style={[st.hint, { flex: 1 }]}>{f.name} · {f.pos} {f.ovr}</Text>
              <Btn label="Équiper" small onPress={() => { act((c) => c.equipSkill(k.uid, f.id)); setChoix(null); }} />
            </Row>
          )) : null}
        </Card>
      ))}

      <Card>
        <Text style={st.hint}>Les quêtes ont maintenant leur propre écran, depuis l’accueil du club.</Text>
        <Btn label="Les quêtes" small onPress={() => go('quests')} />
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
        {slides.map((x) => (
          <Pressable key={x.id} onPress={() => setTab(x.id)} style={[st.tab, tab === x.id && st.tabOn]}>
            <Text style={[st.tabTxt, tab === x.id && { color: C.text }]}>{x.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Row>
        <View style={{ flex: 1 }}><Title sub={cur.sub}>{cur.label}</Title></View>
        <Text style={{ color: sum.connected ? C.green : C.amber, fontSize: 11, fontWeight: '700' }}>
          {demo ? 'Exemple hors ligne' : sum.state}
        </Text>
      </Row>

      {tab === 'journal' ? news.map((sec) => (
        <View key={sec.id} style={{ gap: 8 }}>
          {sec.items.slice(0, sec.id === 'une' ? 1 : 4).map((a, i) => (
            <Card key={i} tint={sec.id === 'une' ? 'rgba(46,204,113,0.35)' : null}>
              <Text style={[st.name, sec.id === 'une' && { fontSize: 15 }]}>{a.title}</Text>
              {a.sub ? <Text style={st.hint}>{a.sub}</Text> : null}
              {a.body ? <Text style={[st.hint, { fontStyle: 'italic' }]}>{a.body}</Text> : null}
              <Text style={[st.hint, { color: C.ghost }]}>{a.ago}</Text>
            </Card>
          ))}
        </View>
      )) : null}

      {tab === 'classement' || tab === 'equipes' ? lad.slice(0, 10).map((r) => (
        <Card key={r.id || r.name}>
          <Row>
            <Text style={[st.body, { width: 22, color: r.rank <= 3 ? C.amber : C.faint }]}>{r.rank}</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.body}>{r.name || r.id}</Text>
              <Text style={st.hint}>{r.p} matchs · {r.w}V {r.d}N {r.l}D</Text>
            </View>
            <Text style={[st.body, { color: r.rank <= 3 ? C.amber : C.dim }]}>{r.elo}</Text>
          </Row>
        </Card>
      )) : null}

      {tab === 'joueurs' ? players.slice(0, 10).map((p, i) => (
        <Card key={i}>
          <Row>
            <Text style={[st.body, { width: 22, color: i < 3 ? C.amber : C.faint }]}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.body}>{p.name}</Text>
              <Text style={st.hint}>{p.club}{p.goals ? ' · ' + p.goals + ' but(s)' : ''}</Text>
            </View>
            <Text style={[st.body, { color: i < 3 ? C.green : C.dim }]}>{(p.rating || 0).toFixed(1)}</Text>
          </Row>
        </Card>
      )) : null}

      {(tab === 'ligue' || tab === 'tournoi') ? <Empty>{cur.emptyWhy}</Empty> : null}

      <Text style={[st.hint, { textAlign: 'center', color: C.ghost }]}>
        {demo
          ? 'Exemple construit sur ton club solo. Branche le mode en ligne pour de vrais adversaires.'
          : 'Chaque article vient d’un match, d’un classement ou d’un transfert qui a réellement eu lieu.'}
      </Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: S.pad, gap: S.gap, paddingBottom: 40 },
  club: { color: C.text, fontSize: 18, fontWeight: '800' },
  clubSub: { color: C.faint, fontSize: 12, marginTop: 2 },
  coin: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)' },
  coinTxt: { color: C.text, fontSize: 14, fontWeight: '800' },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: S.radius, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  navLabel: { color: C.text, fontSize: 15, fontWeight: '700' },
  navSub: { color: C.faint, fontSize: 11, marginTop: 2 },
  chev: { color: C.faint, fontSize: 20 },
  name: { color: C.text, fontSize: 14, fontWeight: '700' },
  body: { color: C.text, fontSize: 12.5 },
  hint: { color: C.faint, fontSize: 11, lineHeight: 16 },
  lbl: { color: C.faint, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  ovr: { color: C.text, fontSize: 26, fontWeight: '800', width: 46 },
  score: { color: C.text, fontSize: 34, fontWeight: '800', textAlign: 'center' },
  tab: { paddingHorizontal: 13, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  tabOn: { backgroundColor: '#2A313B', borderColor: 'rgba(255,255,255,0.16)' },
  tabTxt: { color: C.faint, fontSize: 12, fontWeight: '700' },
  lots: { flexDirection: 'row', gap: 8 },
  lot: { flex: 1, minHeight: 118, borderRadius: 10, borderWidth: 1.5, padding: 8, gap: 2 },
  lotRar: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  lotNote: { color: C.text, fontSize: 26, fontWeight: '900', lineHeight: 30 },
  lotSous: { color: C.dim, fontSize: 10.5, fontWeight: '700' },
  lotNom: { color: C.text, fontSize: 12, fontWeight: '700', marginTop: 'auto' },
  lotFam: { color: C.faint, fontSize: 10 }
});
