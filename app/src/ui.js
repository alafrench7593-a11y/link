// Les briques d'interface réutilisées par tous les écrans.
// Rien de malin ici : des cartes, des boutons, des barres de progression.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C, S } from './theme';

export function Card({ children, style, tint }) {
  return (
    <View style={[st.card, tint ? { borderColor: tint } : null, style]}>{children}</View>
  );
}

export function Title({ children, sub }) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={st.h1}>{children}</Text>
      {sub ? <Text style={st.sub}>{sub}</Text> : null}
    </View>
  );
}

export function Row({ children, style }) {
  return <View style={[st.row, style]}>{children}</View>;
}

// Un bouton qui sait refuser : quand `why` est rempli, il est grisé et la raison
// s'affiche sous lui. C'est la règle du §81 appliquée au natif.
export function Btn({ label, onPress, why, tone, small, style }) {
  const off = !!why;
  const bg = off ? '#242A33' : tone === 'ghost' ? 'transparent' : C.green;
  const fg = off ? '#5E6672' : tone === 'ghost' ? C.text : C.onGreen;
  return (
    <View style={style}>
      <Pressable
        onPress={off ? undefined : onPress}
        style={({ pressed }) => [
          st.btn,
          small && st.btnSmall,
          { backgroundColor: bg, opacity: pressed && !off ? 0.8 : 1 },
          tone === 'ghost' ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' } : null
        ]}
      >
        <Text style={[st.btnTxt, small && { fontSize: 12 }, { color: fg }]}>{label}</Text>
      </Pressable>
      {off ? <Text style={st.why}>{why}</Text> : null}
    </View>
  );
}

export function Bar({ pct, color }) {
  return (
    <View style={st.barBg}>
      <View style={[st.barFg, { width: Math.max(2, Math.min(100, pct)) + '%', backgroundColor: color || C.green }]} />
    </View>
  );
}

export function Tag({ children, color }) {
  return (
    <View style={[st.tag, color ? { backgroundColor: color } : null]}>
      <Text style={[st.tagTxt, color ? { color: '#0B1210' } : null]}>{children}</Text>
    </View>
  );
}

export function Stat({ label, value, color }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[st.statV, color ? { color } : null]}>{value}</Text>
      <Text style={st.statL}>{label}</Text>
    </View>
  );
}

export function Empty({ children }) {
  return (
    <View style={st.empty}>
      <Text style={st.emptyTxt}>{children}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: S.radius, borderWidth: 1, borderColor: C.line, padding: 14, gap: 8 },
  h1: { color: C.text, fontSize: 16, fontWeight: '800' },
  sub: { color: C.faint, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: { minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnSmall: { minHeight: 34, borderRadius: 17, paddingHorizontal: 13 },
  btnTxt: { fontSize: 13.5, fontWeight: '800' },
  why: { color: C.amber, fontSize: 10.5, marginTop: 5, lineHeight: 14 },
  barBg: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  barFg: { height: 5, borderRadius: 3 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.08)' },
  tagTxt: { color: C.dim, fontSize: 10, fontWeight: '800' },
  statV: { color: C.text, fontSize: 18, fontWeight: '800' },
  statL: { color: C.faint, fontSize: 10, marginTop: 2 },
  empty: { padding: 20, borderRadius: S.radius, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.12)' },
  emptyTxt: { color: C.faint, fontSize: 12, textAlign: 'center', lineHeight: 18 }
});
