// §17 DIRECTEUR SPORTIF : les écrans qui manquaient à l'app téléphone.
//
// Transferts, Quêtes, Finances, Tactique et Club existaient dans l'écran Mon Club du
// canvas, pas ici. Comme les autres écrans, ceux-ci ne décident rien : ils lisent le
// moteur et appellent ses méthodes (buyPlayer, sellPlayer, setConsigne, applyStyle,
// hireStaff…). Un refus vient toujours du moteur, avec sa raison.
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { C, S } from './theme';
import { Card, Title, Row, Btn, Bar, Tag, Empty } from './ui';

const jetons = (n) => Math.round(n).toLocaleString('fr-FR') + ' jetons';

// ---------- Transferts ----------
export function TransfersScreen({ club, state, act }) {
  const market = club.marketList();
  const R = club.MARKET_RULES();
  const squad = state.squad.slice().sort((a, b) => b.ovr - a.ovr);
  const sellWhy = state.squad.length <= 12 ? 'Il te faut au moins 12 joueurs' : '';
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Title sub={'Le prix dépend de la note, de l’âge, du potentiel et de la forme. Nouvelles offres à chaque journée. Effectif : ' + state.squad.length + ' / ' + R.maxSquad + '.'}>Transferts</Title>
      {state.trainLog ? <Card><Text style={st.body}>{state.trainLog}</Text></Card> : null}

      <Text style={st.lbl}>ACHETER · {market.length} JOUEUR(S) DISPONIBLE(S)</Text>
      {market.length === 0 ? <Empty>Plus personne sur le marché cette journée.</Empty> : null}
      {market.map((m) => {
        const pr = club.profile(m), bi = club.buyInfo(m);
        return (
          <Card key={m.id}>
            <Row>
              <Text style={st.ovr}>{m.ovr}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.name}>{m.name} · {m.pos}</Text>
                <Text style={st.hint}>{pr.age} ans · {pr.nat} · potentiel {pr.pot}{pr.skills.length ? ' · ' + pr.skills.map((k) => k.name).join(', ') : ''}</Text>
              </View>
            </Row>
            <Btn label={'Acheter · ' + jetons(m.price)} why={bi.why} onPress={() => act((c) => c.buyPlayer(m.id))} />
          </Card>
        );
      })}

      <Text style={st.lbl}>VENDRE · 60 % DE LA VALEUR</Text>
      {squad.map((p) => {
        const price = Math.round(club.profile(p).value * 0.6);
        return (
          <Card key={p.id}>
            <Row>
              <Text style={st.ovr}>{p.ovr}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.name}>{p.name}</Text>
                <Text style={st.hint}>{p.pos} · niveau {club.playerLevel(p)}</Text>
              </View>
              <Btn label={'Vendre · ' + price} small why={sellWhy} onPress={() => act((c) => c.sellPlayer(p.id))} />
            </Row>
          </Card>
        );
      })}
    </ScrollView>
  );
}

// ---------- Quêtes ----------
export function QuestsScreen({ club, state, act }) {
  const quests = club.activeQuests();
  const C2 = club.CAPS(), caps = state.caps || {}, today = caps.day === club.dayKey();
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Title sub={'Plafond du jour : ' + (today ? caps.total || 0 : 0) + ' / ' + C2.total + ' jetons, toutes sources confondues. Quêtes : ' + (today ? caps.quest || 0 : 0) + ' / ' + C2.quest + '.'}>Quêtes</Title>
      {quests.length === 0 ? <Empty>Aucune quête en cours.</Empty> : null}
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
              <Btn label={q.claimed ? 'Récupérée' : done ? 'Récupérer' : 'En cours'} small
                why={q.claimed ? 'Déjà récupérée' : done ? '' : 'Objectif non atteint'}
                onPress={() => act((c) => c.claimQuest(q.id))} />
            </Row>
          </Card>
        );
      })}
      <Text style={st.hint}>Les quêtes sont la principale source de jetons. Chaque récompense passe par le même plafond quotidien que les autres gains.</Text>
    </ScrollView>
  );
}

// ---------- Finances ----------
export function FinancesScreen({ club, state }) {
  const C2 = club.CAPS(), caps = state.caps || {}, today = caps.day === club.dayKey();
  const NOMS = { quest: 'Quêtes', mission: 'Missions', prono: 'Pronostics', total: 'Toutes sources' };
  const F = club.finances(state, 'w');
  const ledger = state.ledger || [];
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Title sub="L’argent du club : ce qui entre, ce qui sort, et le plafond du jour qui empêche une source de tourner sans fin.">Finances</Title>
      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={st.body}>Solde du club</Text>
            <Text style={st.hint}>Aucun paiement en argent réel : tout se gagne en jouant.</Text>
          </View>
          <Text style={[st.big, { color: C.green }]}>{state.balance}</Text>
        </Row>
      </Card>
      <Card>
        <Text style={st.lbl}>CE QUE TU AS GAGNÉ AUJOURD’HUI</Text>
        {Object.keys(NOMS).filter((k) => C2[k] != null).map((k) => {
          const u = today ? caps[k] || 0 : 0;
          return (
            <View key={k} style={{ gap: 4 }}>
              <Row>
                <Text style={[st.body, { flex: 1 }]}>{NOMS[k]}</Text>
                <Text style={st.body}>{u} / {C2[k]}</Text>
              </Row>
              <Bar pct={(u / C2[k]) * 100} color={u >= C2[k] ? C.amber : C.green} />
            </View>
          );
        })}
        <Text style={st.hint}>Les matchs ne sont pas plafonnés : un match prend du temps réel. Les ventes de joueurs n’ont pas de plafond propre mais comptent dans le total du jour.</Text>
      </Card>
      <Card>
        <Text style={st.lbl}>À CHAQUE MATCH</Text>
        <Text style={st.body}>{state.lastFin || 'Aucun match joué cette semaine.'}</Text>
        <Text style={st.hint}>Prochaine recette estimée {F.gate} · salaires {F.wages} · net {F.net >= 0 ? '+' : ''}{F.net}</Text>
      </Card>
      <Card>
        <Text style={st.lbl}>JOURNAL DES TRANSACTIONS</Text>
        {ledger.length === 0 ? <Text style={st.hint}>Aucune transaction pour l’instant.</Text> : null}
        {ledger.slice(0, 15).map((l, i) => (
          <Row key={i}>
            <Text style={[st.hint, { flex: 1 }]} numberOfLines={1}>{l.l}</Text>
            <Text style={[st.body, { color: l.a >= 0 ? C.green : '#FF8A65', fontWeight: '700' }]}>{(l.a >= 0 ? '+' : '') + l.a}</Text>
          </Row>
        ))}
      </Card>
    </ScrollView>
  );
}

// ---------- Tactique ----------
function Seg({ options, value, onPick }) {
  return (
    <View style={st.seg}>
      {options.map((o, i) => (
        <Pressable key={i} onPress={() => onPick(i)} style={[st.segBtn, value === i && st.segOn]}>
          <Text style={[st.segTxt, value === i && { color: C.text }]} numberOfLines={1}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function TacticScreen({ club, state, act }) {
  const styles = club.styleList();
  const cur = state.preset === 'perso' ? null : club.styles()[state.preset];
  const MENT = club.MENTALITES();
  const tac = state.tac || {};
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Title sub="Tout ce qui se règle ici est lu par le moteur pendant le match.">Tactique</Title>
      <Card>
        <Text style={st.lbl}>FORMATION</Text>
        <Seg options={club.FORMATIONS()} value={club.FORMATIONS().indexOf(state.formation)} onPick={(i) => act((c) => c.setFormation(c.FORMATIONS()[i]))} />
        <Text style={st.lbl}>MENTALITÉ · {MENT[state.mentality].toUpperCase()}</Text>
        <Seg options={MENT.map((m, i) => String(i - 3 > 0 ? '+' + (i - 3) : i - 3))} value={state.mentality} onPick={(i) => act((c) => c.setMentality(i))} />
      </Card>
      <Card tint={cur ? 'rgba(46,204,113,0.45)' : 'rgba(245,200,76,0.45)'}>
        <Text style={st.lbl}>STYLE DE JEU</Text>
        <Text style={st.name}>{cur ? cur.name : 'Tactique perso'}</Text>
        <Text style={st.hint}>{cur ? cur.desc : 'Tu as modifié des consignes : aucun bonus ou malus de style ne s’applique. Choisis un style pour profiter des avantages contre certains adversaires.'}</Text>
      </Card>
      {styles.map((x) => (
        <Card key={x.k}>
          <Row>
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{x.name}</Text>
              <Text style={st.hint}>{x.fam} · {x.form} · {x.desc}</Text>
            </View>
            {state.preset === x.k
              ? <Tag color={C.green}>ACTIF</Tag>
              : <Btn label="Appliquer" small onPress={() => act((c) => c.applyStyle(x.k))} />}
          </Row>
        </Card>
      ))}
      {club.TAC_GROUPS().map((g) => (
        <Card key={g.title}>
          <Text style={[st.lbl, { color: g.color }]}>{g.title.toUpperCase()}</Text>
          {g.items.map(([k, label, opts]) => (
            <View key={k} style={{ gap: 5 }}>
              <Text style={st.body}>{label}</Text>
              <Seg options={opts} value={tac[k]} onPick={(i) => act((c) => c.setConsigne(k, i))} />
            </View>
          ))}
        </Card>
      ))}
    </ScrollView>
  );
}

// ---------- Club ----------
export function ClubScreen({ club, state, act }) {
  const board = club.progressBoard();
  const TR = {}; board.forEach((t) => { TR[t.key] = t; });
  const stade = club.STADES()[state.stade || 0], aca = club.ACADEMIES()[state.academy || 0];
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Title sub="Le niveau de club commande tout : staff, stade et centre de formation s’ouvrent aux paliers indiqués.">Club</Title>
      {state.staffLog ? <Card><Text style={st.body}>{state.staffLog}</Text></Card> : null}
      <Card>
        <Text style={st.lbl}>PROGRESSION DU CLUB</Text>
        {board.map((t) => (
          <View key={t.key} style={{ gap: 4 }}>
            <Row>
              <Text style={[st.body, { flex: 1, fontWeight: '700' }]}>{t.label}</Text>
              <Text style={[st.hint, { color: t.locked ? C.amber : C.text }]}>
                {t.currency === 'xp' ? 'niveau ' + t.lvl : t.currency === 'rang' ? 'D' + t.division : t.lvl + ' / ' + t.max}
              </Text>
            </Row>
            <Bar pct={t.pct} color={t.locked ? C.amber : C.green} />
            <Text style={[st.hint, t.locked ? { color: C.amber } : null]}>{club.trackLine(t)}</Text>
          </View>
        ))}
      </Card>
      <Card>
        <Text style={st.lbl}>STAFF TECHNIQUE · SALAIRES {club.staffWages()} PAR MATCH</Text>
        {club.STAFF_DEFS().map((d) => {
          const t = TR['staff:' + d.id], max = t.lvl >= t.max;
          return (
            <Row key={d.id}>
              <View style={{ flex: 1 }}>
                <Text style={st.body}>{d.label} · {max ? 'niveau max' : 'niveau ' + t.lvl + ' / ' + t.max}</Text>
                <Text style={st.hint}>{d.eff[t.lvl]}{max ? '' : ' → ' + d.eff[t.lvl + 1]}</Text>
              </View>
              <Btn label={max ? 'Max' : t.cost + ' j'} small why={max ? '' : t.why} onPress={() => act((c) => c.hireStaff(d.id))} />
            </Row>
          );
        })}
      </Card>
      <Card>
        <Text style={st.lbl}>STADE</Text>
        <Text style={st.body}>{stade.name} · {stade.cap.toLocaleString('fr-FR')} places · recette x{stade.mult.toFixed(1).replace('.', ',')}</Text>
        <Btn label={TR.stade.lvl >= TR.stade.max ? 'Niveau max' : 'Agrandir · ' + TR.stade.cost + ' jetons'} why={TR.stade.lvl >= TR.stade.max ? 'Niveau maximum' : TR.stade.why}
          onPress={() => act((c) => c.upgradeStade())} />
      </Card>
      <Card>
        <Text style={st.lbl}>CENTRE DE FORMATION</Text>
        <Text style={st.body}>{aca.name}</Text>
        <Text style={st.hint}>{aca.note}</Text>
        <Btn label={TR.academy.lvl >= TR.academy.max ? 'Niveau max' : 'Améliorer · ' + TR.academy.cost + ' jetons'} why={TR.academy.lvl >= TR.academy.max ? 'Niveau maximum' : TR.academy.why}
          onPress={() => act((c) => c.upgradeAcademy())} />
      </Card>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: S.pad, gap: S.gap, paddingBottom: 40 },
  name: { color: C.text, fontSize: 14, fontWeight: '700' },
  body: { color: C.text, fontSize: 12.5 },
  hint: { color: C.faint, fontSize: 11, lineHeight: 16 },
  lbl: { color: C.faint, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  ovr: { color: C.text, fontSize: 26, fontWeight: '800', width: 46 },
  big: { fontSize: 26, fontWeight: '800' },
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: S.radius, backgroundColor: C.cardAlt, borderWidth: 1, borderColor: C.line },
  segBtn: { flex: 1, minHeight: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1, borderColor: 'transparent' },
  segOn: { backgroundColor: '#2A313B', borderColor: 'rgba(255,255,255,0.16)' },
  segTxt: { color: C.faint, fontSize: 11, fontWeight: '600' }
});
