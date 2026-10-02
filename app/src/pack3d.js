// §11 du cahier design : « pack 3D / visuel central, glow, animation d'ouverture, rareté ».
//
// Le pack de l'écran Packs, en 3D : le même rendu que l'écran Mon Club (src/stade3d.js,
// pack3d), dans un GLView. Il flotte, tremble quand on l'ouvre, éclate dans la couleur de
// la meilleure rareté tirée (la rareté se voit avant le résultat), puis un pack neuf prend
// sa place. Il ne tire rien : le tirage vient de club.openPack, avant l'animation.
// Sans WebGL, il disparaît et le bouton OUVRIR LE PACK marche comme avant.
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { GLView } from 'expo-gl';
import * as THREE from 'three';
import { C } from './theme';

export const Pack3D = forwardRef(function Pack3D({ club, def, hauteur }, ref) {
  const vue = useRef(null), vivant = useRef(true);
  const [panne, setPanne] = useState(false);
  useEffect(() => () => { vivant.current = false; }, []);
  useImperativeHandle(ref, () => ({
    pret: () => !!vue.current,
    secouer: (f) => { if (vue.current) vue.current.secouer(f); },
    ouvrir: (c) => { if (vue.current) vue.current.ouvrir(c); },
    nouveau: () => { if (vue.current) vue.current.nouveau(); }
  }), []);
  if (panne) return null;
  const onContextCreate = (gl) => {
    let renderer, v;
    try {
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      // dans un navigateur, GLView a un vrai <canvas> ; sur téléphone, three.js reçoit un faux
      const canvas = gl.canvas || { width: w, height: h, style: {}, addEventListener: () => {}, removeEventListener: () => {}, clientHeight: h };
      renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      renderer.setClearColor(C.card, 1);
      v = club.pack3d(THREE, { renderer, largeur: w, hauteur: h, couleur: def.color, nom: def.name, tirages: def.n, distance: 8.6, halo: true });
    } catch (e) { setPanne(true); return; }
    vue.current = v;
    let avant = Date.now();
    const boucle = () => {
      // le GLView peut avoir déjà rendu son contexte : libérer sans faire tomber l'écran
      if (!vivant.current) { vue.current = null; try { v.detruire(); renderer.dispose(); } catch (e) { /* contexte déjà perdu */ } return; }
      const now = Date.now();
      v.image((now - avant) / 1000); avant = now;
      if (gl.endFrameEXP) gl.endFrameEXP();
      requestAnimationFrame(boucle);
    };
    boucle();
  };
  return (
    <View style={[st.cadre, { height: hauteur || 200 }]} accessibilityLabel={'Le ' + def.name + ' en 3D'}>
      <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
    </View>
  );
});

const st = StyleSheet.create({
  cadre: { borderRadius: 10, overflow: 'hidden', backgroundColor: C.card }
});
