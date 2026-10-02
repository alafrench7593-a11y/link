// §2 « composition » et « remplacements, décisions pendant le match », dans l'app
// téléphone. Jusqu'ici, l'app jouait toujours le onze automatique, et pendant le match
// le directeur sportif ne pouvait que regarder la minute défiler.
//
// Comme les autres écrans, ceux-ci ne décident rien. Le onze passe par assignSlot,
// candidatsPoste et compositionAuto (src/tactics.js) ; le match en direct par remplacer,
// crier, carte, vitesse et pause (src/direct.js). L'écran Mon Club applique les mêmes
// règles : cinq changements, pas d'expulsé remplacé, un blessé ne joue pas.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C, S } from './theme';
import { Card, Row, Btn, Bar, Empty } from './ui';

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
      <Card tint="rgba(46,204,113,0.45)">
        <Row>
          <Text style={[st.lbl, { flex: 1 }]}>QUI JOUE À LA PLACE DE {cur.name.toUpperCase()} ?</Text>
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
              <Text style={st.body} numberOfLines={1}>{p.name}</Text>
              <Text style={[st.hint, (!can || pen >= 13) && { color: C.red }]}>
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
        <Text style={[st.lbl, { flex: 1 }]}>LE ONZE · {state.formation} · {auto ? 'AUTOMATIQUE' : 'CHOISI PAR TOI'}</Text>
        {!auto ? <Btn small tone="ghost" label="XI automatique" onPress={() => act((c) => c.compositionAuto())} /> : null}
      </Row>
      {xi.map((p) => (
        <Pressable key={p.slot} onPress={() => setPoste(p.slot)} style={st.ligne}>
          <Text style={st.pos}>{p.line}</Text>
          <Text style={[st.body, { flex: 1 }]} numberOfLines={1}>{p.name}</Text>
          {p.pen ? <Text style={[st.hint, { color: C.red }]}>hors poste −{p.pen}</Text> : null}
          <Text style={st.note}>{p.ovr}</Text>
        </Pressable>
      ))}
      <Text style={st.hint}>Banc : {banc.length ? banc.map((p) => p.name).join(', ') : 'personne'}.</Text>
      <Text style={st.hint}>Touche un poste pour choisir qui le joue. Hors de son poste, un joueur perd des points de note.</Text>
    </Card>
  );
}

// ---------- le match en direct, vu du banc ----------
// Rythmes en minutes de match par seconde : ×2 fait un match de trente secondes.
const RYTHMES = [['×1', 1.5], ['×2', 3], ['×4', 6], ['Résultat direct', Infinity]];

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
      <Card tint={C.green}>
        <Text style={st.lbl}>{vue.amical ? 'AMICAL' : 'CHAMPIONNAT'} · EN DIRECT · {vue.clock}</Text>
        <Row>
          <Text style={[st.equipe, { textAlign: 'right' }]} numberOfLines={1}>{club.state.clubName || 'FC TonPseudo'}</Text>
          <Text style={st.score}>{vue.score[0]} - {vue.score[1]}</Text>
          <Text style={st.equipe} numberOfLines={1}>{vue.opp.club}</Text>
        </Row>
        <Bar pct={(vue.minute / 90) * 100} />
        <Text style={st.hint}>Possession {vue.poss} % · tirs {vue.tirs[0]} - {vue.tirs[1]}</Text>
        <Row style={{ flexWrap: 'wrap' }}>
          <Btn small tone="ghost" label={vue.pause ? 'Reprendre' : 'Pause'} onPress={() => d.pause(!vue.pause)} />
          {RYTHMES.map(([l, v]) => (
            <Btn key={l} small tone={vue.vitesse === v ? undefined : 'ghost'} label={l} onPress={() => d.vitesse(v)} />
          ))}
        </Row>
      </Card>

      <Coaching club={club} d={d} vue={vue} faire={faire} />
      <TactiqueDirect club={club} d={d} vue={vue} faire={faire} />

      <Card>
        <Text style={st.lbl}>CONSIGNE DE LA VOIX</Text>
        <Row style={{ flexWrap: 'wrap' }}>
          {club.CRIS().map((c) => (
            <Btn key={c.id} small tone={vue.cri === c.id ? undefined : 'ghost'} label={c.label} onPress={() => faire(d.crier(c.id))} />
          ))}
        </Row>
        <Text style={st.hint}>{cri ? cri.label + ' : ' + cri.effet + '.' : 'Aucune consigne : l’équipe joue la tactique préparée.'}</Text>
      </Card>

      <Card>
        <Row>
          <Text style={[st.lbl, { flex: 1 }]}>CHANGEMENTS · {vue.faits} / {vue.max}</Text>
          {choix ? <Btn small tone="ghost" label="Annuler" onPress={() => setChoix(null)} /> : null}
        </Row>
        {!sortant ? (
          <View style={{ gap: 2 }}>
            <Text style={st.hint}>{plein ? 'Les ' + vue.max + ' changements sont faits.' : 'Qui sort ? L’énergie est celle de cette minute.'}</Text>
            {vue.xi.map((p) => (
              <Pressable key={p.slot} disabled={p.red || plein} onPress={() => { setMsg(''); setChoix(p.slot); }}
                style={[st.ligne, (p.red || plein) && { opacity: 0.45 }]}>
                <Text style={st.pos}>{p.line}</Text>
                <Text style={[st.body, { flex: 1 }]} numberOfLines={1}>{p.name}{p.red ? ' · expulsé' : p.yc ? ' · averti' : ''}</Text>
                <View style={{ width: 64 }}><Bar pct={p.energy} color={p.energy < 55 ? C.red : C.green} /></View>
                <Text style={[st.hint, { width: 38, textAlign: 'right' }]}>{Math.round(p.energy)} %</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={{ gap: 2 }}>
            <Text style={st.hint}>Qui remplace {sortant.name} ?</Text>
            {vue.banc.length ? vue.banc.slice()
              // le meilleur d'abord, pénalité hors poste comprise : à son poste, il passe devant
              .sort((a, b) => (b.ovr - club.penalty(b.pos, sortant.line)) - (a.ovr - club.penalty(a.pos, sortant.line)))
              .map((p) => {
              const pen = club.penalty(p.pos, sortant.line);
              return (
                <Pressable key={p.id} style={st.ligne}
                  onPress={() => { const r = d.remplacer(choix, p.id); faire(r); if (r.ok) setChoix(null); }}>
                  <Text style={st.pos}>{p.pos}</Text>
                  <Text style={[st.body, { flex: 1 }]} numberOfLines={1}>{p.name}{pen ? ' · hors poste −' + pen : ''}</Text>
                  <Text style={st.note}>{Math.max(30, p.ovr - pen)}</Text>
                  <Text style={[st.hint, { width: 38, textAlign: 'right' }]}>{Math.round(p.energy)} %</Text>
                </Pressable>
              );
            }) : <Empty>Plus personne sur le banc.</Empty>}
          </View>
        )}
        {msg ? <Text style={st.why}>{msg}</Text> : null}
      </Card>

      <Card>
        <Text style={st.lbl}>CARTES DE MATCH</Text>
        {cartes.length ? cartes.map((c) => (
          <Row key={c.id}>
            <View style={{ flex: 1 }}>
              <Text style={st.body}>{c.label} · x{c.n}</Text>
              <Text style={st.hint}>{c.desc}</Text>
            </View>
            <Btn small label="Jouer" onPress={() => faire(d.carte(c.id))} />
          </Row>
        )) : <Text style={st.hint}>Aucune carte de match en réserve. Chaque victoire rapporte une carte tirée au hasard : carte de match ou carte +2.</Text>}
      </Card>

      <Card>
        <Text style={st.lbl}>FIL DU MATCH</Text>
        {vue.decisions.slice(-3).reverse().map((x, i) => (
          <Text key={'d' + i} style={[st.hint, { color: C.blue }]}>{x.minute}' {x.auto ? '' : 'Toi : '}{x.texte}</Text>
        ))}
        {vue.fil.slice().reverse().map((l, i) => (
          <Text key={i} style={[st.hint, l.k === 'G' && { color: l.s === 'H' ? C.green : C.red, fontWeight: '700' }]}>{l.text}</Text>
        ))}
      </Card>
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
      <Text style={st.lbl}>COACHING</Text>
      <Row style={{ flexWrap: 'wrap' }}>
        {MODES.map(([id, l]) => <Btn key={id} small tone={c.mode === id ? undefined : 'ghost'} label={l} onPress={() => faire(d.coach(id))} />)}
      </Row>
      <Text style={st.hint}>{EXPLI[c.mode] || EXPLI.manuel}</Text>
      {c.mode === 'assiste' && c.conseil ? (
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={st.body}>{c.conseil.texte}</Text>
            <Text style={st.hint}>{c.conseil.pourquoi}</Text>
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
      <Text style={st.lbl}>TACTIQUE EN DIRECT · {t.formation}</Text>
      {club.TACTIQUE_DIRECT().map((x) => (
        <View key={x.k} style={{ gap: 4 }}>
          <Text style={st.hint}>{x.label}</Text>
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            {x.options.map((o, i) => (
              <Btn key={o} small tone={t.valeurs[x.k] === i ? undefined : 'ghost'} label={o} onPress={() => faire(d.tactique(x.k, i))} />
            ))}
          </Row>
        </View>
      ))}
      <Text style={st.hint}>Un réglage touché s’applique tout de suite : les joueurs changent de place, de hauteur ou d’intensité, et la décision entre dans le fil du match.</Text>
    </Card>
  );
}

const st = StyleSheet.create({
  lbl: { color: C.faint, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  body: { color: C.text, fontSize: 12.5 },
  hint: { color: C.faint, fontSize: 11, lineHeight: 16 },
  why: { color: C.amber, fontSize: 11, fontWeight: '700' },
  pos: { color: C.faint, fontSize: 10, fontWeight: '800', width: 30 },
  note: { color: C.text, fontSize: 13, fontWeight: '800', width: 30, textAlign: 'right' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.line },
  equipe: { color: C.text, fontSize: 13, fontWeight: '700', flex: 1 },
  score: { color: C.text, fontSize: 30, fontWeight: '800', minWidth: 86, textAlign: 'center' }
});
