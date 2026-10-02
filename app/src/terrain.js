// §22 « je regarde les 22 joueurs jouer automatiquement » : le terrain du direct.
//
// En 3D (expo-gl et three.js, avec le rendu partagé src/stade3d.js, le même que l'écran
// Mon Club) ou en 2D vue de dessus. Les deux lisent le match en direct (d.vue() : les
// images du moteur autour de chaque action) et ne décident rien. Si l'appareil n'a pas de
// WebGL, la vue 2D prend le relais sans erreur.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { GLView } from 'expo-gl';
import * as THREE from 'three';
import { C } from './theme';

export function Terrain({ club, d, hauteur }) {
  const [vue3d, setVue3d] = useState(true);
  const [panne, setPanne] = useState(false);
  const [info, setInfo] = useState({ saut: false, label: '', nom: '', x: 0, y: 0 });
  const H = hauteur || 300;
  const en3d = vue3d && !panne;
  return (
    <View style={[st.cadre, { height: H }]}>
      {en3d
        ? <Vue3D club={club} d={d} onPanne={() => setPanne(true)} onInfo={setInfo} />
        : <Vue2D club={club} d={d} onInfo={setInfo} />}
      {info.nom && !info.saut ? <Text style={[st.nom, { left: info.x, top: info.y }]} numberOfLines={1}>{info.nom}</Text> : null}
      {info.saut ? <View style={st.saut}><Text style={st.sautTxt}>⏩ {info.label}</Text></View> : null}
      <Pressable accessibilityRole="button" onPress={() => { setVue3d(!en3d); setPanne(false); }} style={st.bascule}>
        <Text style={st.basculeTxt}>{en3d ? 'VUE 2D' : 'VUE 3D'}</Text>
      </Pressable>
    </View>
  );
}

// ce que l'écran écrit par-dessus : le saut entre deux actions, le nom du porteur
const infoDe = (d, f, pos) => ({
  saut: !!f.saut, label: f.A ? 'jusqu’à la prochaine action' : '',
  nom: f.A && f.A.o >= 0 && pos ? d.nomJoueur(f.A.o) : '', x: pos ? pos.x : 0, y: pos ? pos.y : 0
});

function Vue3D({ club, d, onPanne, onInfo }) {
  const vivant = useRef(true);
  const taille = useRef({ w: 1, h: 1 });
  useEffect(() => () => { vivant.current = false; }, []);
  const onContextCreate = (gl) => {
    let renderer, v;
    try {
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      // dans un navigateur, GLView a un vrai <canvas> ; sur téléphone, three.js reçoit un faux
      const canvas = gl.canvas || { width: w, height: h, style: {}, addEventListener: () => {}, removeEventListener: () => {}, clientHeight: h };
      renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      v = club.stade3d(THREE, { renderer, largeur: w, hauteur: h, maillot: club.state.kit, adverse: (d.opp && d.opp.color) || '#2F8FE0', meteo: d.meteo, ombres: false });
    } catch (e) { onPanne(); return; }
    let n = 0;
    const boucle = () => {
      // le GLView peut avoir déjà rendu son contexte : libérer sans faire tomber l'écran
      if (!vivant.current) { try { v.detruire(); renderer.dispose(); } catch (e) { /* contexte déjà perdu */ } return; }
      const f = d.vue();
      v.image(f.A, f.B, f.fr, f.evs);
      if (gl.endFrameEXP) gl.endFrameEXP();
      if ((n++ % 5) === 0) {
        // la position du nom, ramenée des pixels du rendu à ceux de l'écran
        const p = f.A && f.A.o >= 0 ? v.projeter(f.A.o) : null, k = taille.current.w / Math.max(1, gl.drawingBufferWidth);
        onInfo(infoDe(d, f, p ? { x: p.x * k, y: p.y * k } : null));
      }
      requestAnimationFrame(boucle);
    };
    boucle();
  };
  return (
    <GLView style={{ flex: 1 }} onContextCreate={onContextCreate}
      onLayout={(e) => { taille.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; }} />
  );
}

// la vue de dessus : 22 pastilles et le ballon, à quinze images par seconde
function Vue2D({ club, d, onInfo }) {
  const [f, setF] = useState(null);
  const [lh, setLh] = useState({ w: 1, h: 1 });
  useEffect(() => {
    let vivant = true;
    const tic = () => { if (!vivant) return; setF(d.vue()); setTimeout(tic, 66); };
    tic();
    return () => { vivant = false; };
  }, [d]);
  const k = Math.min(lh.w / 68, lh.h / 105), ox = (lh.w - 68 * k) / 2, oy = (lh.h - 105 * k) / 2;
  const A = f && f.A, B = f && (f.B || f.A), fr = f ? f.fr || 0 : 0;
  const pos = (c) => {
    const ax = A.P[c * 2], ay = A.P[c * 2 + 1], bx = B.P[c * 2], by = B.P[c * 2 + 1];
    if (ax < -5) return null;
    return bx < -5 ? [ax, ay] : [ax + (bx - ax) * fr, ay + (by - ay) * fr];
  };
  useEffect(() => { if (f) onInfo(infoDe(d, f, null)); }, [f && f.saut]);
  const kit = club.state.kit || { c1: C.green }, adv = (d.opp && d.opp.color) || '#2F8FE0';
  return (
    <View style={st.pelouse} onLayout={(e) => setLh({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <View style={[st.lignes, { left: ox, top: oy, width: 68 * k, height: 105 * k }]}>
        <View style={[st.mediane, { top: 52.5 * k }]} />
        <View style={[st.rond, { left: 34 * k - 9.15 * k, top: 52.5 * k - 9.15 * k, width: 18.3 * k, height: 18.3 * k, borderRadius: 9.15 * k }]} />
        <View style={[st.surface, { left: 13.84 * k, top: 0, width: 40.32 * k, height: 16.5 * k }]} />
        <View style={[st.surface, { left: 13.84 * k, top: 88.5 * k, width: 40.32 * k, height: 16.5 * k }]} />
      </View>
      {A ? Array.from({ length: 22 }, (_, c) => {
        const p = pos(c); if (!p) return null;
        const H = c < 11, gk = c === 0 || c === 11;
        return <View key={c} style={[st.pion, { left: ox + p[0] * k - 6, top: oy + p[1] * k - 6,
          backgroundColor: gk ? (H ? '#F2C66B' : '#2B2F36') : H ? kit.c1 : adv, borderColor: A.o === c ? '#FFE14D' : 'rgba(0,0,0,0.6)' }]} />;
      }) : null}
      {A ? <View style={[st.ballon, { left: ox + (A.b[0] + (B.b[0] - A.b[0]) * fr) * k - 4, top: oy + (A.b[1] + (B.b[1] - A.b[1]) * fr) * k - 4 - Math.max(0, A.b[2]) * 0.6 }]} /> : null}
    </View>
  );
}

const st = StyleSheet.create({
  cadre: { borderRadius: 10, overflow: 'hidden', backgroundColor: '#0B1210', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  bascule: { position: 'absolute', top: 8, left: 8, height: 26, paddingHorizontal: 11, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(11,15,12,0.72)', justifyContent: 'center' },
  basculeTxt: { color: C.text, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 },
  nom: { position: 'absolute', transform: [{ translateX: -40 }, { translateY: -22 }], width: 80, textAlign: 'center', color: C.text, fontSize: 10, fontWeight: '700', backgroundColor: 'rgba(12,18,16,0.82)', borderRadius: 9, paddingVertical: 2, overflow: 'hidden' },
  saut: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,10,8,0.55)' },
  sautTxt: { color: C.text, fontSize: 13, fontWeight: '800', backgroundColor: 'rgba(12,18,16,0.85)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14, overflow: 'hidden' },
  pelouse: { flex: 1, backgroundColor: '#2F7A36' },
  lignes: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)' },
  mediane: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255,255,255,0.8)' },
  rond: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)' },
  surface: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)' },
  pion: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  ballon: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#111' }
});
