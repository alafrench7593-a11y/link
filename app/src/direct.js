// §2 « composition » et « remplacements, décisions pendant le match », dans l'app
// téléphone. Jusqu'ici, l'app jouait toujours le onze automatique, et pendant le match
// le directeur sportif ne pouvait que regarder la minute défiler.
//
// Comme les autres écrans, ceux-ci ne décident rien. Le onze passe par assignSlot,
// candidatsPoste et compositionAuto (src/tactics.js) ; le match en direct par remplacer,
// crier, carte, vitesse et pause (src/direct.js). L'écran Mon Club applique les mêmes
// règles : cinq changements, pas d'expulsé remplacé, un blessé ne joue pas.
//
// Le tableau du score et le fil du match suivent la maquette Figma « Football-app » : la
// pastille rouge du direct, les deux blasons, le score en grand, et le fil en frise, ton
// équipe à gauche, l'adversaire à droite, les buts en citron.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C, S, T, F } from './theme';
import { Card, Row, Btn, Bar, Empty, Blason, Fond, Pastille, Icone } from './ui';

// ---------- le onze, poste par poste ----------
export function Composition({ club, state, act }) {
  const [poste, setPoste] = useState(null);
  const [msg, setMsg] = useState('');
  const xi = club.pickXI(state.formation);
  const banc = club.benchOf(xi);
  const auto = !Object.keys(state.lineup || {}).length;
  const cur = poste ? xi.find((p) => p.slot === poste) : null;

  if (cur) {
    return (
      <Card tint={C.accentLine}>
        <Row>
          <Text style={[T.surtitre, { flex: 1, color: C.accent }]}>QUI JOUE À LA PLACE DE {cur.name.toUpperCase()} ?</Text>
          <Btn small tone="ghost" label="Annuler" onPress={() => { setPoste(null); setMsg(''); }} />
        </Row>
        {club.candidatsPoste(poste).map(({ p, pen, eff, titulaire, can, why }) => (
          <Pressable key={p.id} disabled={!can} style={[st.ligne, !can && { opacity: 0.45 }]}
            onPress={() => {
              let r = null;
              act((c) => { r = c.assignSlot(poste, p.id); });
              if (r && !r.ok) setMsg(r.why); else { setMsg(''); setPoste(null); }
            }}>
            <Text style={st.pos}>{p.pos}</Text>
            <View style={{ flex: 1 }}>
              <Text style={T.corps} numberOfLines={1}>{p.name}</Text>
              <Text style={[T.aide, (!can || pen >= 13) && { color: C.red }]}>
                {!can ? why : (pen ? 'hors poste −' + pen : 'poste naturel') + (titulaire ? ' · titulaire, ils échangent' : ' · remplaçant')}
              </Text>
            </View>
            <Text style={st.note}>{eff}</Text>
          </Pressable>
        ))}
        {msg ? <Text style={st.why}>{msg}</Text> : null}
      </Card>
    );
  }

  return (
    <Card>
      <Row>
        <Text style={[T.surtitre, { flex: 1 }]}>LE ONZE · {state.formation} · {auto ? 'AUTOMATIQUE' : 'CHOISI PAR TOI'}</Text>
        {!auto ? <Btn small tone="ghost" label="XI automatique" onPress={() => act((c) => c.compositionAuto())} /> : null}
      </Row>
      {xi.map((p) => (
        <Pressable key={p.slot} onPress={() => setPoste(p.slot)} style={st.ligne}>
          <Text style={st.pos}>{p.line}</Text>
          <Text style={[T.corps, { flex: 1 }]} numberOfLines={1}>{p.name}</Text>
          {p.pen ? <Text style={[T.aide, { color: C.red }]}>hors poste −{p.pen}</Text> : null}
          <Text style={st.note}>{p.ovr}</Text>
        </Pressable>
      ))}
      <Text style={T.aide}>Banc : {banc.length ? banc.map((p) => p.name).join(', ') : 'personne'}.</Text>
      <Text style={T.aide}>Touche un poste pour choisir qui le joue. Hors de son poste, un joueur perd des points de note.</Text>
    </Card>
  );
}

// ---------- le tableau du score ----------
// Rythmes en minutes de match par seconde : ×2 fait un match de trente secondes.
const RYTHMES = [['×1', 1.5], ['×2', 3], ['×4', 6], ['Résultat direct', Infinity]];

export function TableauDirect({ club, d, vue }) {
  const s = club.state, kit = s.kit || {};
  const moi = s.clubName || 'FC TonPseudo';
  return (
    <View style={st.tableau}>
      <Fond type="stade" />
      <View style={{ alignItems: 'center' }}>
        <Pastille ton="direct" point>{(vue.amical ? 'AMICAL' : 'CHAMPIONNAT') + ' · EN DIRECT · ' + vue.clock}</Pastille>
      </View>
      <View style={st.clubs}>
        <View style={st.club}>
          <Blason nom={moi} c1={kit.c1} c2={kit.c2} taille={50} />
          <Text style={st.equipe} numberOfLines={2}>{moi}</Text>
        </View>
        <View style={{ alignItems: 'center', width: 112 }}>
          <Text style={st.score}>{vue.score[0]} - {vue.score[1]}</Text>
          <Text style={st.minute}>{vue.pause ? 'EN PAUSE' : vue.clock}</Text>
        </View>
        <View style={st.club}>
          <Blason nom={vue.opp.club} c1={vue.opp.color} taille={50} />
          <Text style={st.equipe} numberOfLines={2}>{vue.opp.club}</Text>
        </View>
      </View>
      <Bar pct={(vue.minute / 90) * 100} />
      <Text style={[T.aide, { textAlign: 'center' }]}>Possession {vue.poss} % · tirs {vue.tirs[0]} - {vue.tirs[1]}</Text>
      <Row style={{ flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
        <Btn small tone="ghost" label={vue.pause ? 'Reprendre' : 'Pause'} onPress={() => d.pause(!vue.pause)} />
        {RYTHMES.map(([l, v]) => (
          <Btn key={l} small tone={vue.vitesse === v ? undefined : 'ghost'} label={l} onPress={() => d.vitesse(v)} />
        ))}
      </Row>
    </View>
  );
}

// ---------- le match en direct, vu du banc ----------
export function EnDirect({ club, d, vue }) {
  const [choix, setChoix] = useState(null);
  const [msg, setMsg] = useState('');
  const faire = (r) => setMsg(r && !r.ok ? r.why : '');
  const cri = club.CRIS().find((c) => c.id === vue.cri);
  const sortant = choix ? vue.xi.find((p) => p.slot === choix) : null;
  const cartes = vue.cartes.filter((c) => c.n > 0);
  const plein = vue.faits >= vue.max;
  return (
    <View style={{ gap: S.gap }}>
      <Coaching club={club} d={d} vue={vue} faire={faire} />
      <TactiqueDirect club={club} d={d} vue={vue} faire={faire} />

      <Card>
        <Text style={T.surtitre}>CONSIGNE DE LA VOIX</Text>
        <Row style={{ flexWrap: 'wrap', gap: 6 }}>
          {club.CRIS().map((c) => (
            <Btn key={c.id} small tone={vue.cri === c.id ? undefined : 'ghost'} label={c.label} onPress={() => faire(d.crier(c.id))} />
          ))}
        </Row>
        <Text style={T.aide}>{cri ? cri.label + ' : ' + cri.effet + '.' : 'Aucune consigne : l’équipe joue la tactique préparée.'}</Text>
      </Card>

      <Card>
        <Row>
          <Text style={[T.surtitre, { flex: 1 }]}>CHANGEMENTS · {vue.faits} / {vue.max}</Text>
          {choix ? <Btn small tone="ghost" label="Annuler" onPress={() => setChoix(null)} /> : null}
        </Row>
        {!sortant ? (
          <View style={{ gap: 2 }}>
            <Text style={T.aide}>{plein ? 'Les ' + vue.max + ' changements sont faits.' : 'Qui sort ? L’énergie est celle de cette minute.'}</Text>
            {vue.xi.map((p) => (
              <Pressable key={p.slot} disabled={p.red || plein} onPress={() => { setMsg(''); setChoix(p.slot); }}
                style={[st.ligne, (p.red || plein) && { opacity: 0.45 }]}>
                <Text style={st.pos}>{p.line}</Text>
                <Text style={[T.corps, { flex: 1 }]} numberOfLines={1}>{p.name}{p.red ? ' · expulsé' : p.yc ? ' · averti' : ''}</Text>
                <View style={{ width: 64 }}><Bar pct={p.energy} color={p.energy < 55 ? C.red : C.accent} /></View>
                <Text style={[T.aide, { width: 38, textAlign: 'right' }]}>{Math.round(p.energy)} %</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={{ gap: 2 }}>
            <Text style={T.aide}>Qui remplace {sortant.name} ?</Text>
            {vue.banc.length ? vue.banc.slice()
              // le meilleur d'abord, pénalité hors poste comprise : à son poste, il passe devant
              .sort((a, b) => (b.ovr - club.penalty(b.pos, sortant.line)) - (a.ovr - club.penalty(a.pos, sortant.line)))
              .map((p) => {
              const pen = club.penalty(p.pos, sortant.line);
              return (
                <Pressable key={p.id} style={st.ligne}
                  onPress={() => { const r = d.remplacer(choix, p.id); faire(r); if (r.ok) setChoix(null); }}>
                  <Text style={st.pos}>{p.pos}</Text>
                  <Text style={[T.corps, { flex: 1 }]} numberOfLines={1}>{p.name}{pen ? ' · hors poste −' + pen : ''}</Text>
                  <Text style={st.note}>{Math.max(30, p.ovr - pen)}</Text>
                  <Text style={[T.aide, { width: 38, textAlign: 'right' }]}>{Math.round(p.energy)} %</Text>
                </Pressable>
              );
            }) : <Empty>Plus personne sur le banc.</Empty>}
          </View>
        )}
        {msg ? <Text style={st.why}>{msg}</Text> : null}
      </Card>

      <Card>
        <Text style={T.surtitre}>CARTES DE MATCH</Text>
        {cartes.length ? cartes.map((c) => (
          <Row key={c.id}>
            <View style={{ flex: 1 }}>
              <Text style={T.corps}>{c.label} · x{c.n}</Text>
              <Text style={T.aide}>{c.desc}</Text>
            </View>
            <Btn small label="Jouer" onPress={() => faire(d.carte(c.id))} />
          </Row>
        )) : <Text style={T.aide}>Aucune carte de match en réserve. Chaque victoire rapporte une carte tirée au hasard : carte de match ou carte +2.</Text>}
      </Card>

      <Card>
        <Text style={T.surtitre}>FIL DU MATCH</Text>
        {vue.decisions.slice(-3).reverse().map((x, i) => (
          <Text key={'d' + i} style={[T.aide, { color: C.blue }]}>{x.minute}' {x.auto ? '' : 'Toi : '}{x.texte}</Text>
        ))}
        <Frise fil={vue.fil} />
      </Card>
    </View>
  );
}

// Le fil en frise, comme la « Timeline » de la maquette : ton équipe à gauche, l'adversaire à
// droite, ce qui n'est à personne (mi-temps, coup de sifflet) au milieu. Le texte reste celui du
// moteur, minute comprise.
const ICONE_FIL = { G: 'match', C: 'corner', sub: 'swap', F: 'whistle', P: 'whistle', save: 'match', miss: 'match', skill: 'bolt' };
function Frise({ fil }) {
  if (!fil.length) return <Text style={T.aide}>Le match commence.</Text>;
  return (
    <View style={st.frise}>
      <View style={st.axe} />
      {fil.slice().reverse().map((l, i) => {
        const m = /^(\d+(?:\+\d+)?')\s*(.*)$/.exec(l.text || '');
        const minute = m ? m[1] : '', texte = m ? m[2] : l.text;
        const but = l.k === 'G';
        if (l.s !== 'H' && l.s !== 'A') {
          return <View key={i} style={st.neutre}><Text style={st.neutreTxt}>{l.text}</Text></View>;
        }
        const gauche = l.s === 'H';
        const carton = l.k === 'Y' || l.k === 'R';
        return (
          <View key={i} style={[st.evt, gauche ? st.evtG : st.evtD]}>
            <Text style={st.evtMin}>{minute}</Text>
            <Text style={[st.evtTxt, gauche && { textAlign: 'right' }, but && { color: gauche ? C.accent : C.red, fontWeight: '700' }]}>{texte}</Text>
            <View style={[st.bulle, gauche ? { right: -13 } : { left: -13 }, but && { borderColor: gauche ? C.accentLine : 'rgba(255,69,89,0.45)' }]}>
              {carton
                ? <View style={[st.carton, { backgroundColor: l.k === 'R' ? C.red : '#F5D431' }]} />
                : <Icone nom={ICONE_FIL[l.k] || 'match'} taille={13} couleur={but ? (gauche ? C.accent : C.red) : '#9A9A9A'} />}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// §7 du cahier du match : qui décide sur le banc. Manuel, Assisté (l'IA propose, tu
// valides) ou Auto (l'IA remplace, change la tactique et dit pourquoi). Les règles sont
// celles de conseilsCoach (src/direct.js), les mêmes que dans l'écran Mon Club.
const MODES = [['manuel', 'Manuel'], ['assiste', 'Assisté'], ['auto', 'Auto coach']];
const EXPLI = {
  manuel: 'Tu décides de tout : changements, tactique, consignes.',
  assiste: 'Le coach IA te propose un changement ou un réglage, avec sa raison ; tu valides ou non.',
  auto: 'Le coach IA décide seul : qui remplacer, quand, pourquoi, et quelle tactique changer. Chaque décision est écrite avec sa raison.'
};
function Coaching({ d, vue, faire }) {
  const c = vue.coach || { mode: 'manuel' };
  return (
    <Card>
      <Text style={T.surtitre}>COACHING</Text>
      <Row style={{ flexWrap: 'wrap', gap: 6 }}>
        {MODES.map(([id, l]) => <Btn key={id} small tone={c.mode === id ? undefined : 'ghost'} label={l} onPress={() => faire(d.coach(id))} />)}
      </Row>
      <Text style={T.aide}>{EXPLI[c.mode] || EXPLI.manuel}</Text>
      {c.mode === 'assiste' && c.conseil ? (
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={T.corps}>{c.conseil.texte}</Text>
            <Text style={T.aide}>{c.conseil.pourquoi}</Text>
          </View>
          <Btn small label="Appliquer" onPress={() => faire(d.appliquerConseil())} />
        </Row>
      ) : null}
    </Card>
  );
}

// §6 du cahier du match : la tactique change pendant le match, et le moteur l'applique aux
// onze joueurs à la seconde où on la touche. Le manager ne contrôle jamais un joueur.
function TactiqueDirect({ club, d, vue, faire }) {
  const t = vue.tactique;
  if (!t) return null;
  return (
    <Card>
      <Text style={T.surtitre}>TACTIQUE EN DIRECT · {t.formation}</Text>
      {club.TACTIQUE_DIRECT().map((x) => (
        <View key={x.k} style={{ gap: 6 }}>
          <Text style={[T.aide, { color: C.dim }]}>{x.label}</Text>
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            {x.options.map((o, i) => (
              <Btn key={o} small tone={t.valeurs[x.k] === i ? undefined : 'ghost'} label={o} onPress={() => faire(d.tactique(x.k, i))} />
            ))}
          </Row>
        </View>
      ))}
      <Text style={T.aide}>Un réglage touché s’applique tout de suite : les joueurs changent de place, de hauteur ou d’intensité, et la décision entre dans le fil du match.</Text>
    </Card>
  );
}

const st = StyleSheet.create({
  why: { fontFamily: F.texte, color: C.amber, fontSize: 11, fontWeight: '700' },
  pos: { fontFamily: F.texte, color: C.faint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, width: 32 },
  note: { fontFamily: F.titre, color: C.text, fontSize: 14, fontWeight: '800', width: 30, textAlign: 'right' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.lineSoft },
  tableau: { borderRadius: 20, overflow: 'hidden', paddingHorizontal: 14, paddingTop: 16, paddingBottom: 14, gap: 12, borderWidth: 1, borderColor: C.line },
  clubs: { flexDirection: 'row', alignItems: 'center' },
  club: { flex: 1, alignItems: 'center', gap: 8 },
  equipe: { fontFamily: F.texte, color: C.text, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  score: { fontFamily: F.titre, color: C.text, fontSize: 40, fontWeight: '800', letterSpacing: -1.5, lineHeight: 44 },
  minute: { fontFamily: F.texte, color: C.red, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8 },
  frise: { paddingVertical: 6 },
  axe: { position: 'absolute', top: 6, bottom: 6, left: '50%', width: 1, backgroundColor: '#2A2A2A' },
  evt: { width: '50%', minHeight: 50, flexDirection: 'row', gap: 7, paddingBottom: 12 },
  evtG: { marginRight: '50%', paddingRight: 22, flexDirection: 'row-reverse' },
  evtD: { marginLeft: '50%', paddingLeft: 22 },
  evtMin: { fontFamily: F.texte, color: '#777777', fontSize: 10.5, fontWeight: '700' },
  evtTxt: { flex: 1, fontFamily: F.texte, color: '#BDBDBD', fontSize: 11, lineHeight: 15 },
  bulle: { position: 'absolute', top: -3, width: 26, height: 26, borderRadius: 13, backgroundColor: '#171717', borderWidth: 1, borderColor: '#333333', alignItems: 'center', justifyContent: 'center' },
  carton: { width: 8, height: 11, borderRadius: 1.5 },
  neutre: { alignSelf: 'center', marginBottom: 12, backgroundColor: '#131313', borderWidth: 1, borderColor: '#292929', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '86%' },
  neutreTxt: { fontFamily: F.texte, color: '#9A9A9A', fontSize: 10.5, textAlign: 'center' }
});
