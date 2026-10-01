// Les écrans du directeur sportif, en React Native.
//
// Aucun d'eux ne décide quoi que ce soit : ils lisent le moteur et appellent ses
// méthodes. Un refus vient toujours du moteur, avec sa raison, et l'écran se contente
// de l'afficher. C'est ce qui garantit que l'app native et l'app web racontent
// exactement la même chose.
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { C, S } from './theme';
import { Card, Title, Row, Btn, Bar, Tag, Stat, Empty } from './ui';

// ---------- accueil ----------
export function HomeScreen({ club, state, act, go }) {
  const xi = club.pickXI(state.formation);
  const ovr = Math.round(club.metrics(xi).ovr);
  const need = club.levelNeed(state.level);
  const ti = club.trainInfo();
  const quests = club.activeQuests().filter((q) => q.prog >= q.goal && !q.claimed).length;
  const inv = club.skillInventory();
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

      <NavRow go={go} items={[
        ['squad', 'Effectif', xi.length + ' titulaires · ' + state.squad.length + ' joueurs'],
        ['match', 'Jouer un match', 'Le moteur joue, tu as préparé'],
        ['train', 'Entraînement', ti.line],
        ['packs', 'Packs', '4 packs · ' + state.balance + ' jetons'],
        ['skills', 'Compétences et quêtes', inv.length + ' en réserve' + (quests ? ' · ' + quests + ' quête(s) à récupérer' : '')],
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
      <Title sub="Note, niveau et compétences portées">Effectif</Title>
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
          ? <Empty>Aucune compétence. Ouvre un Pack Compétence et équipe-la ici.</Empty>
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
    </ScrollView>
  );
}

// ---------- match ----------
export function MatchScreen({ club, state, act }) {
  const [res, setRes] = useState(null);
  // Un match fait 54 000 pas de calcul : dix à trente secondes sur un téléphone.
  // En une seule boucle, l'écran serait mort pendant tout ce temps. playMatchAsync
  // rend la main entre deux paquets : le match est le même au chiffre près, mais la
  // minute s'affiche et l'application reste vivante.
  const [enCours, setEnCours] = useState(null);     // le libellé d'horloge du moteur, ou null
  const opps = [
    { club: 'Auteuil United', ovr: 67, style: 'tiki' },
    { club: 'Kop Bleu FC', ovr: 62, style: 'contre' },
    { club: 'Olympique Vieux-Port', ovr: 70, style: 'gegen' }
  ].map((o) => Object.assign({}, o, { ovr: o.ovr - 5 + (4 - state.division) * 3 }));
  const pronos = club.PRONO_DEFS(opps[0], club.pickXI(state.formation));
  const taken = state.pronos || [];
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Title sub="Les 22 joueurs sont pilotés par l’IA. Tu as préparé, tu regardes.">Match</Title>

      {res ? (
        <Card tint={C.green}>
          <Text style={st.score}>{res.score[0]} - {res.score[1]}</Text>
          <Text style={st.hint}>{res.log.filter((l) => l.k === 'G').length} but(s) · {res.stats.H.sh} tirs · {res.poss} % de possession</Text>
          {res.log.slice(-6).reverse().map((l, i) => (
            <Text key={i} style={st.hint}>{l.text}</Text>
          ))}
          <Btn label="Fermer" tone="ghost" small onPress={() => setRes(null)} />
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

      {opps.map((o) => (
        <Card key={o.club}>
          <Row>
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{o.club}</Text>
              <Text style={st.hint}>{club.styles()[o.style].name} · note {o.ovr}</Text>
            </View>
            <Btn label={enCours != null ? enCours : 'Jouer'} small
              why={enCours != null ? 'Match en cours' : ''}
              onPress={() => { if (enCours != null) return; setRes(null); setEnCours("1'");
                club.playMatchAsync(o, { seed: Math.floor(Math.random() * 1e6) }, (m, horloge) => setEnCours(horloge))
                  .then((r) => { setEnCours(null); setRes(r); }); }} />
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
  const tp = club.TRAIN_PACK(), cp = club.COACH_PACK();
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

      {/* L'achat est passé dans le kiosque : ici on se sert de ce qu'on a. */}
      <Card tint="rgba(92,200,255,0.35)">
        <Text style={st.body}>{tp.name} {tp.cost} · {cp.name} {cp.cost} jetons</Text>
        <Text style={st.hint}>Les deux sont dans le kiosque, avec les deux autres packs. Tu les ouvres là-bas, tu t’en sers ici.</Text>
        <Btn label="Le kiosque" small onPress={() => go('packs')} />
      </Card>

      {state.trainLog ? <Card><Text style={st.body}>{state.trainLog}</Text></Card> : null}
    </ScrollView>
  );
}

// ---------- le kiosque ----------
// Les quatre packs au même endroit. L'écran ne connaît aucun pack par son nom : il
// affiche ce que club.kiosque() lui donne, donc un pack ajouté dans le moteur apparaît
// ici sans qu'on touche à ce fichier.
const OUVRIR = {
  linkfoot: (c) => c.commitPack(c.openPack({})),
  skill: (c) => c.commitSkillPack(c.openSkillPack({})),
  train: (c) => c.commitTrainPack(c.openTrainPack({})),
  coach: (c) => c.commitCoachPack(c.openCoachPack({}))
};
const TEINTE = { linkfoot: '#2ECC71', skill: '#C39BFF', train: '#5CC8FF', coach: '#F2C66B' };

export function PacksScreen({ club, state, act, go }) {
  const col = club.collection();
  const q = club.kiosqueSummary();
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Title sub="Chacun ne donne qu’une seule famille de choses, donc tu sais toujours lequel ouvrir.">Le kiosque</Title>
      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={st.body}>Collection de cartes</Text>
            <Text style={st.hint}>{state.shards || 0} fragments · {q.n} packs, {q.open} ouvrable(s)</Text>
          </View>
          <Text style={[st.ovr, { color: C.green }]}>{col.have} / {col.total}</Text>
        </Row>
      </Card>
      {club.kiosque().map((k) => (
        <PackCard key={k.key} k={k} act={act} go={go} />
      ))}
    </ScrollView>
  );
}

function PackCard({ k, act, go }) {
  return (
    <Card tint={TEINTE[k.key] + '59'}>
      <Row>
        <View style={{ flex: 1 }}>
          <Tag color={TEINTE[k.key]}>{k.family}</Tag>
          <Text style={st.name}>{k.name}</Text>
          <Text style={st.hint}>{k.desc}</Text>
          <Text style={st.hint}>{k.question}</Text>
        </View>
      </Row>
      <Text style={st.lbl}>PROBABILITÉS PAR TIRAGE</Text>
      {k.odds.map((o, i) => (
        <View key={i}>
          <Row>
            <Text style={[st.hint, { flex: 1 }]}>{o.label}</Text>
            {o.rarLabel ? <Tag color={o.color}>{o.rarLabel}</Tag> : null}
            <Text style={st.body}>{o.pct >= 10 ? o.pct.toFixed(0) : o.pct.toFixed(1).replace('.', ',')} %</Text>
          </Row>
          {o.desc ? <Text style={st.hint}>{o.desc}</Text> : null}
        </View>
      ))}
      {k.got ? <Text style={[st.hint, { color: C.green }]}>Dernier tirage : {k.got}</Text> : null}
      <Btn label={'OUVRIR · ' + k.cost + ' jetons'} why={k.why} onPress={() => act(OUVRIR[k.key])} />
      <Row>
        <Text style={[st.hint, { flex: 1 }]}>{k.useLabel}</Text>
        <Btn label="Y aller" small onPress={() => go(k.useView === 'squad' ? 'squad' : k.useView)} />
      </Row>
    </Card>
  );
}

// ---------- compétences et quêtes ----------
export function SkillsScreen({ club, state, act, go }) {
  const inv = club.skillInventory();
  const quests = club.activeQuests();
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Title sub={club.skillCount().toLocaleString('fr-FR') + ' combinaisons possibles'}>Compétences</Title>
      <Card tint="rgba(195,155,255,0.35)">
        <Text style={st.body}>{club.SKILL_PACK().name} · {club.SKILL_PACK().cost} jetons</Text>
        <Text style={st.hint}>Tous les packs sont regroupés dans le kiosque. Ici on équipe, là-bas on ouvre.</Text>
        <Btn label="Le kiosque" small onPress={() => go('packs')} />
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
            <Btn label={k.onName ? 'Retirer' : 'Équiper'} small
              why={k.onName || k.fitCount ? '' : 'Personne ne peut la porter'}
              onPress={() => act((c) => (k.onName ? c.unequipSkill(k.uid) : c.equipSkill(k.uid, k.fits[0].id)))} />
          </Row>
        </Card>
      ))}

      <Title sub={'Plafond du jour : ' + ((state.caps || {}).total || 0) + ' / ' + club.CAPS().total + ' jetons'}>Quêtes</Title>
      {quests.map((q) => {
        const done = q.prog >= q.goal;
        return (
          <Card key={q.id}>
            <Row>
              <Text style={[st.body, { flex: 1 }]}>{q.label}</Text>
              <Text style={st.hint}>{q.prog} / {q.goal}</Text>
            </Row>
            <Bar pct={(q.prog / q.goal) * 100} />
            <Row>
              <Text style={[st.hint, { flex: 1 }]}>+{q.reward} jetons · +{q.xp} XP</Text>
              <Btn label={done ? 'Récupérer' : 'En cours'} small why={done ? '' : 'Objectif non atteint'}
                onPress={() => act((c) => c.claimQuest(q.id))} />
            </Row>
          </Card>
        );
      })}
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
  tabTxt: { color: C.faint, fontSize: 12, fontWeight: '700' }
});
