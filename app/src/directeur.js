// §17 DIRECTEUR SPORTIF : les écrans qui manquaient à l'app téléphone.
//
// Transferts, Quêtes, Finances, Tactique et Club existaient dans l'écran Mon Club du
// canvas, pas ici. Comme les autres écrans, ceux-ci ne décident rien : ils lisent le
// moteur et appellent ses méthodes (buyPlayer, sellPlayer, setConsigne, applyStyle,
// hireStaff…). Un refus vient toujours du moteur, avec sa raison.
//
// Le dessin suit la maquette Figma « Football-app » : surtitres espacés, chiffres en Manrope,
// citron pour ce qui compte, sélecteurs blancs quand ils sont choisis.
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { C, S, T, F } from './theme';
import { Card, Title, Row, Btn, Bar, Tag, Empty, Pastille, Blason, Groupe } from './ui';

const jetons = (n) => Math.round(n).toLocaleString('fr-FR') + ' jetons';

// ---------- Transferts ----------
export function TransfersScreen({ club, state, act }) {
  const market = club.marketList();
  const R = club.MARKET_RULES();
  const squad = state.squad.slice().sort((a, b) => b.ovr - a.ovr);
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Title surtitre="MARCHÉ DES TRANSFERTS" sub={'Le prix dépend de la note, de l’âge, du potentiel et de la forme. Nouvelles offres à chaque journée. Effectif : ' + state.squad.length + ' / ' + R.maxSquad + '.'}>Transferts</Title>
      {state.trainLog ? <Card><Text style={T.corps}>{state.trainLog}</Text></Card> : null}

      <Text style={T.surtitre}>ACHETER · {market.length} JOUEUR(S) DISPONIBLE(S)</Text>
      {market.length === 0 ? <Empty>Plus personne sur le marché cette journée.</Empty> : null}
      {market.map((m) => {
        const pr = club.profile(m), bi = club.buyInfo(m);
        return (
          <Card key={m.id}>
            <Row>
              <View style={st.noteCase}><Text style={st.noteCaseTxt}>{m.ovr}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={T.nom}>{m.name} · {m.pos}</Text>
                <Text style={T.aide}>{pr.age} ans · {pr.nat} · potentiel {pr.pot}{pr.skills.length ? ' · ' + pr.skills.map((k) => k.name).join(', ') : ''}</Text>
              </View>
            </Row>
            <Btn label={'Acheter · ' + jetons(m.price)} why={bi.why} onPress={() => act((c) => c.buyPlayer(m.id))} />
          </Card>
        );
      })}

      <Text style={T.surtitre}>VENDRE · 60 % DE LA VALEUR</Text>
      {squad.map((p) => {
        const v = club.sellInfo(p);
        return (
          <Card key={p.id}>
            <Row>
              <View style={st.noteCase}><Text style={st.noteCaseTxt}>{p.ovr}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={T.nom}>{p.name}</Text>
                <Text style={T.aide}>{p.pos} · niveau {club.playerLevel(p)} · {club.carriereLigne(p)}</Text>
              </View>
              <Btn label={'Vendre · ' + v.price} small why={v.why} onPress={() => act((c) => c.sellPlayer(p.id))} />
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
      <Title surtitre="OBJECTIFS" sub={'Plafond du jour : ' + (today ? caps.total || 0 : 0) + ' / ' + C2.total + ' jetons, toutes sources confondues. Quêtes : ' + (today ? caps.quest || 0 : 0) + ' / ' + C2.quest + '.'}>Quêtes</Title>
      {quests.length === 0 ? <Empty>Aucune quête en cours.</Empty> : null}
      {quests.map((q) => {
        const done = q.prog >= q.goal;
        return (
          <Card key={q.id}>
            <Row>
              <Text style={[T.corps, { flex: 1 }]}>{q.label}</Text>
              <Text style={T.aide}>{q.prog} / {q.goal}</Text>
            </Row>
            <Bar pct={(q.prog / q.goal) * 100} />
            <Row>
              <Text style={[T.aide, { flex: 1 }]}>+{q.reward} jetons · +{q.xp} XP</Text>
              <Btn label={q.claimed ? 'Récupérée' : done ? 'Récupérer' : 'En cours'} small
                why={q.claimed ? 'Déjà récupérée' : done ? '' : 'Objectif non atteint'}
                onPress={() => act((c) => c.claimQuest(q.id))} />
            </Row>
          </Card>
        );
      })}
      <Text style={T.aide}>Les quêtes sont la principale source de jetons. Chaque récompense passe par le même plafond quotidien que les autres gains.</Text>
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
      <Title surtitre="ARGENT DU CLUB" sub="L’argent du club : ce qui entre, ce qui sort, et le plafond du jour qui empêche une source de tourner sans fin.">Finances</Title>
      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={T.corps}>Solde du club</Text>
            <Text style={T.aide}>Aucun paiement en argent réel : tout se gagne en jouant.</Text>
          </View>
          <Text style={[st.big, { color: C.accent }]}>{state.balance}</Text>
        </Row>
      </Card>
      <Card>
        <Text style={T.surtitre}>CE QUE TU AS GAGNÉ AUJOURD’HUI</Text>
        {Object.keys(NOMS).filter((k) => C2[k] != null).map((k) => {
          const u = today ? caps[k] || 0 : 0;
          return (
            <View key={k} style={{ gap: 4 }}>
              <Row>
                <Text style={[T.corps, { flex: 1 }]}>{NOMS[k]}</Text>
                <Text style={T.corps}>{u} / {C2[k]}</Text>
              </Row>
              <Bar pct={(u / C2[k]) * 100} color={u >= C2[k] ? C.amber : C.green} />
            </View>
          );
        })}
        <Text style={T.aide}>Les matchs ne sont pas plafonnés : un match prend du temps réel. Les ventes de joueurs n’ont pas de plafond propre mais comptent dans le total du jour.</Text>
      </Card>
      <Card>
        <Text style={T.surtitre}>À CHAQUE MATCH</Text>
        <Text style={T.corps}>{state.lastFin || 'Aucun match joué cette semaine.'}</Text>
        <Text style={T.aide}>Prochaine recette estimée {F.gate} · salaires {F.wages} · net {F.net >= 0 ? '+' : ''}{F.net}</Text>
      </Card>
      <Card>
        <Text style={T.surtitre}>JOURNAL DES TRANSACTIONS</Text>
        {ledger.length === 0 ? <Text style={T.aide}>Aucune transaction pour l’instant.</Text> : null}
        {ledger.slice(0, 15).map((l, i) => (
          <Row key={i}>
            <Text style={[T.aide, { flex: 1 }]} numberOfLines={1}>{l.l}</Text>
            <Text style={[T.corps, { color: l.a >= 0 ? C.accent : C.red, fontWeight: '700' }]}>{(l.a >= 0 ? '+' : '') + l.a}</Text>
          </Row>
        ))}
      </Card>
    </ScrollView>
  );
}

// ---------- Tactique ----------
function Seg({ options, value, onPick }) {
  // beaucoup de choix aux noms longs (les formations) : deux rangées plutôt que des noms coupés
  const large = options.length > 6 && options.some((o) => String(o).length > 3);
  return (
    <View style={[st.seg, large && { flexWrap: 'wrap' }]}>
      {options.map((o, i) => (
        <Pressable key={i} onPress={() => onPick(i)} style={[st.segBtn, large && st.segLarge, value === i && st.segOn]}>
          <Text style={[st.segTxt, value === i && st.segTxtOn]} numberOfLines={1}>{o}</Text>
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
      <Title surtitre="PLAN DE JEU" sub="Tout ce qui se règle ici est lu par le moteur pendant le match.">Tactique</Title>
      <Card>
        <Text style={T.surtitre}>FORMATION</Text>
        <Seg options={club.FORMATIONS()} value={club.FORMATIONS().indexOf(state.formation)} onPick={(i) => act((c) => c.setFormation(c.FORMATIONS()[i]))} />
        <Text style={T.surtitre}>MENTALITÉ · {MENT[state.mentality].toUpperCase()}</Text>
        <Seg options={MENT.map((m, i) => String(i - 3 > 0 ? '+' + (i - 3) : i - 3))} value={state.mentality} onPick={(i) => act((c) => c.setMentality(i))} />
      </Card>
      <Card tint={cur ? C.accentLine : C.amberLine}>
        <Text style={T.surtitre}>STYLE DE JEU</Text>
        <Text style={T.nom}>{cur ? cur.name : 'Tactique perso'}</Text>
        <Text style={T.aide}>{cur ? cur.desc : 'Tu as modifié des consignes : aucun bonus ou malus de style ne s’applique. Choisis un style pour profiter des avantages contre certains adversaires.'}</Text>
      </Card>
      {styles.map((x) => (
        <Card key={x.k}>
          <Row>
            <View style={{ flex: 1 }}>
              <Text style={T.nom}>{x.name}</Text>
              <Text style={T.aide}>{x.fam} · {x.form} · {x.desc}</Text>
            </View>
            {state.preset === x.k
              ? <Tag color={C.green}>ACTIF</Tag>
              : <Btn label="Appliquer" small onPress={() => act((c) => c.applyStyle(x.k))} />}
          </Row>
        </Card>
      ))}
      {club.TAC_GROUPS().map((g) => (
        <Card key={g.title}>
          <Text style={[T.surtitre, { color: g.color }]}>{g.title.toUpperCase()}</Text>
          {g.items.map(([k, label, opts]) => (
            <View key={k} style={{ gap: 5 }}>
              <Text style={T.corps}>{label}</Text>
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
      <Title surtitre="INFRASTRUCTURES ET STAFF" sub="Le niveau de club commande tout : staff, stade et centre de formation s’ouvrent aux paliers indiqués.">Club</Title>
      {state.staffLog ? <Card><Text style={T.corps}>{state.staffLog}</Text></Card> : null}
      <Card>
        <Text style={T.surtitre}>PROGRESSION DU CLUB</Text>
        {board.map((t) => (
          <View key={t.key} style={{ gap: 4 }}>
            <Row>
              <Text style={[T.corps, { flex: 1, fontWeight: '700' }]}>{t.label}</Text>
              <Text style={[T.aide, { color: t.locked ? C.amber : C.text }]}>
                {t.currency === 'xp' ? 'niveau ' + t.lvl : t.currency === 'rang' ? 'D' + t.division : t.lvl + ' / ' + t.max}
              </Text>
            </Row>
            <Bar pct={t.pct} color={t.locked ? C.amber : C.green} />
            <Text style={[T.aide, t.locked ? { color: C.amber } : null]}>{club.trackLine(t)}</Text>
          </View>
        ))}
      </Card>
      <Card>
        <Text style={T.surtitre}>STAFF TECHNIQUE · SALAIRES {club.staffWages()} PAR MATCH</Text>
        {club.STAFF_DEFS().map((d) => {
          const t = TR['staff:' + d.id], max = t.lvl >= t.max;
          return (
            <Row key={d.id}>
              <View style={{ flex: 1 }}>
                <Text style={T.corps}>{d.label} · {max ? 'niveau max' : 'niveau ' + t.lvl + ' / ' + t.max}</Text>
                <Text style={T.aide}>{d.eff[t.lvl]}{max ? '' : ' → ' + d.eff[t.lvl + 1]}</Text>
              </View>
              <Btn label={max ? 'Max' : t.cost + ' j'} small why={max ? '' : t.why} onPress={() => act((c) => c.hireStaff(d.id))} />
            </Row>
          );
        })}
      </Card>
      <Card>
        <Text style={T.surtitre}>STADE</Text>
        <Text style={T.corps}>{stade.name} · {stade.cap.toLocaleString('fr-FR')} places · recette x{stade.mult.toFixed(1).replace('.', ',')}</Text>
        <Btn label={TR.stade.lvl >= TR.stade.max ? 'Niveau max' : 'Agrandir · ' + TR.stade.cost + ' jetons'} why={TR.stade.lvl >= TR.stade.max ? 'Niveau maximum' : TR.stade.why}
          onPress={() => act((c) => c.upgradeStade())} />
      </Card>
      <Card>
        <Text style={T.surtitre}>CENTRE DE FORMATION</Text>
        <Text style={T.corps}>{aca.name}</Text>
        <Text style={T.aide}>{aca.note}</Text>
        <Btn label={TR.academy.lvl >= TR.academy.max ? 'Niveau max' : 'Améliorer · ' + TR.academy.cost + ' jetons'} why={TR.academy.lvl >= TR.academy.max ? 'Niveau maximum' : TR.academy.why}
          onPress={() => act((c) => c.upgradeAcademy())} />
      </Card>
    </ScrollView>
  );
}

// ---------- Division (§22 « je progresse dans les divisions ») ----------
export function DivisionScreen({ club, state, go }) {
  const lg = club.divisionCourante();
  const tbl = club.table(lg);
  const pm = club.prochainMatch();
  const R = club.DIVISION_RULES();
  const dernier = lg.day ? club.resultatsDeJournee(lg.day, lg) : [];
  const ls = state.lastSeason;
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Title surtitre="CLASSEMENT" sub={'Saison ' + lg.saison + ' · journée ' + pm.day + ' sur ' + pm.total + '. Les ' + R.up + ' premiers montent, le dernier descend.'}>{'Division ' + state.division}</Title>
      <Card style={{ borderColor: C.accentLine, backgroundColor: C.accentFill }}>
        <Text style={T.corps}>{club.situationDivision(lg)}</Text>
      </Card>
      <Card>
        <Row>
          <Text style={[T.surtitre, { width: 22 }]}>#</Text>
          <Text style={[T.surtitre, { flex: 1 }]}>CLUB</Text>
          <Text style={[T.surtitre, { width: 24, textAlign: 'center' }]}>J</Text>
          <Text style={[T.surtitre, { width: 54, textAlign: 'center' }]}>V-N-D</Text>
          <Text style={[T.surtitre, { width: 34, textAlign: 'center' }]}>DIFF</Text>
          <Text style={[T.surtitre, { width: 30, textAlign: 'right' }]}>PTS</Text>
        </Row>
        {tbl.map((r) => (
          <Row key={r.id} style={r.me ? { backgroundColor: C.accentFill, borderRadius: 8, marginHorizontal: -6, paddingHorizontal: 6 } : null}>
            <Text style={[T.corps, { width: 22, fontWeight: '800', color: r.rank <= R.up ? C.green : r.rank > tbl.length - R.down ? C.amber : C.faint }]}>{r.rank}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[T.corps, { fontWeight: r.me ? '800' : '600' }]} numberOfLines={1}>{r.club}</Text>
              <Text style={T.aide} numberOfLines={1}>{r.user}</Text>
            </View>
            <Text style={[T.aide, { width: 24, textAlign: 'center' }]}>{r.p}</Text>
            <Text style={[T.aide, { width: 54, textAlign: 'center' }]}>{r.w}-{r.d}-{r.l}</Text>
            <Text style={[T.aide, { width: 34, textAlign: 'center' }]}>{r.gd > 0 ? '+' : ''}{r.gd}</Text>
            <Text style={[T.corps, { width: 30, textAlign: 'right', fontWeight: '800' }]}>{r.pts}</Text>
          </Row>
        ))}
      </Card>
      {dernier.length ? (
        <Card>
          <Text style={T.surtitre}>JOURNÉE {lg.day} · RÉSULTATS</Text>
          {dernier.map((x, i) => (
            <Row key={i}>
              <Text style={[T.corps, { flex: 1, textAlign: 'right', fontWeight: x.moi ? '800' : '400' }]} numberOfLines={1}>{x.home}</Text>
              <Text style={[T.corps, { width: 48, textAlign: 'center', fontWeight: '800' }]}>{x.hs} - {x.as}</Text>
              <Text style={[T.corps, { flex: 1, fontWeight: x.moi ? '800' : '400' }]} numberOfLines={1}>{x.away}</Text>
            </Row>
          ))}
        </Card>
      ) : null}
      <Card>
        <Text style={T.surtitre}>PROCHAIN MATCH</Text>
        <Text style={T.corps}>Journée {pm.day} · {pm.domicile ? 'à domicile' : 'à l’extérieur'} contre {pm.opp.club} ({pm.opp.styleName}, note {pm.opp.ovr})</Text>
        <Btn label="Préparer et jouer" small onPress={() => go('match')} />
      </Card>
      {ls ? (
        <Card>
          <Text style={T.surtitre}>SAISON {ls.saison} · DIVISION {ls.division}</Text>
          <Text style={T.corps}>Terminée {ls.rank === 1 ? '1er' : ls.rank + 'e'} sur {ls.clubs}.</Text>
        </Card>
      ) : null}
      <Text style={T.aide}>Ton match est joué par le moteur ; les deux autres matchs de la journée sont simulés d’après la note et le style des clubs. Promotion : +500 jetons et un LinkFoot Pack.</Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: S.pad, gap: S.gap, paddingBottom: 56 },
  noteCase: { width: 46, height: 46, borderRadius: 12, backgroundColor: C.cardAlt, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  noteCaseTxt: { fontFamily: F.titre, color: C.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.5 },
  big: { fontFamily: F.titre, fontSize: 30, fontWeight: '800', letterSpacing: -1.2 },
  // les sélecteurs : blanc quand ils sont choisis, comme les filtres de la maquette
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: C.cardAlt, borderWidth: 1, borderColor: C.line },
  segBtn: { flex: 1, minHeight: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segLarge: { flexGrow: 0, flexBasis: '23.5%' },
  segOn: { backgroundColor: C.text },
  segTxt: { fontFamily: F.texte, color: C.faint, fontSize: 11.5, fontWeight: '600' },
  segTxtOn: { color: '#050505', fontWeight: '700' }
});
