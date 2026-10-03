// Les briques d'interface réutilisées par tous les écrans, au dessin de la maquette Figma
// (Figma Make « Football-app ») : cartes sombres à filet clair, boutons citron arrondis,
// surtitres espacés, pastilles, blasons de club, icônes au trait.
// Rien de malin ici : elles affichent, le moteur décide.
import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, Linking, Platform } from 'react-native';
import Svg, { G, Path, Circle, Rect, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import { C, S, T, F } from './theme';

let compteur = 0;
const useIdSvg = (prefixe) => useRef(prefixe + (++compteur)).current;

// ---------- icônes ----------
// Celles de la maquette (trait de 1,7, bouts ronds), et quelques-unes dessinées au même trait
// pour ce que la maquette n'avait pas (compétences, pack, entraînement, finances…).
// p: un tracé ; c: un cercle (cx cy r) ; r: un rectangle (x y l h rayon).
const ICONES = {
  home: ['p:m3 11 9-7 9 7', 'p:M5.5 9.5V20h13V9.5M9.5 20v-6h5v6'],
  match: ['c:12 12 8.5', 'p:m9 10 3-2 3 2-1.1 3.5h-3.8L9 10Zm3-2V3.5m3 6.5 4.2-1.3m-5.3 4.8 2.6 3.8m-6.4-3.8-2.6 3.8M9 10 4.8 8.7'],
  connect: ['c:8 8 3', 'c:17 9 2.5', 'p:M2.5 20c.3-4.1 2.2-6.1 5.5-6.1s5.2 2 5.5 6.1M14 14.5c3.9-.6 6.3 1.2 6.7 4.7'],
  profile: ['c:12 8 3.5', 'p:M4.5 20c.4-5 2.9-7.4 7.5-7.4s7.1 2.4 7.5 7.4'],
  bell: ['p:M18 9a6 6 0 0 0-12 0c0 6-2.5 6.5-2.5 8h17c0-1.5-2.5-2-2.5-8', 'p:M10 20h4'],
  search: ['c:10.5 10.5 6.5', 'p:m16 16 4 4'],
  plus: ['p:M12 5v14M5 12h14'],
  arrow: ['p:m5 12 14 0M13 6l6 6-6 6'],
  chevron: ['p:m9 5 7 7-7 7'],
  back: ['p:m15 5-7 7 7 7'],
  calendar: ['r:3.5 5 17 15 2', 'p:M8 3v4M16 3v4M3.5 10h17'],
  users: ['c:9 8 3', 'p:M3 20c.4-4.5 2.4-6.5 6-6.5s5.6 2 6 6.5', 'p:M15 5.5c3.1-.2 4.5 1.2 4.5 3.5S18 12.5 15 12.3M17 14.5c2.5.5 3.8 2.2 4 5'],
  close: ['p:m6 6 12 12M18 6 6 18'],
  play: ['p:m9 7 8 5-8 5V7Z'],
  pin: ['p:M12 21s6-5.5 6-11a6 6 0 0 0-12 0c0 5.5 6 11 6 11Z', 'c:12 10 2'],
  message: ['p:M20 11.5a7.7 7.7 0 0 1-8 7.5 9.4 9.4 0 0 1-3.6-.7L4 20l1.5-4A7.1 7.1 0 0 1 4 11.5 7.7 7.7 0 0 1 12 4a7.7 7.7 0 0 1 8 7.5Z', 'p:M8 11.5h8'],
  explore: ['c:12 12 9', 'p:m15.5 8.5-2 5-5 2 2-5 5-2Z'],
  heart: ['p:M20.8 8.7c0 5.3-8.8 10.4-8.8 10.4S3.2 14 3.2 8.7A4.5 4.5 0 0 1 12 7.3a4.5 4.5 0 0 1 8.8 1.4Z'],
  comment: ['p:M20 11.5a7.7 7.7 0 0 1-8 7.5 9.4 9.4 0 0 1-3.6-.7L4 20l1.5-4A7.1 7.1 0 0 1 4 11.5 7.7 7.7 0 0 1 12 4a7.7 7.7 0 0 1 8 7.5Z'],
  share: ['c:18 5 2', 'c:6 12 2', 'c:18 19 2', 'p:m8 11 8-5M8 13l8 5'],
  camera: ['r:3 6.5 18 13 3', 'p:m8 6.5 1.5-2h5l1.5 2', 'c:12 13 3.2'],
  // au même trait, pour LinkFoot
  bolt: ['p:M13 3 5.5 13.5h6L10.5 21l8-10.5h-6L13 3Z'],
  pack: ['r:4 9.5 16 10.5 2', 'p:M3.5 9.5h17M12 9.5V20', 'p:M12 9.5C10.6 6 6.5 5.3 6.5 7.6c0 1.6 3 1.9 5.5 1.9Zm0 0c1.4-3.5 5.5-4.2 5.5-1.9 0 1.6-3 1.9-5.5 1.9Z'],
  chrono: ['c:12 13.5 7.5', 'p:M12 13.5V9.8M10 3h4M18.4 7.1l1.4-1.4'],
  swap: ['p:M4 8.5h15l-3.5-3.5M20 15.5H5l3.5 3.5'],
  flag: ['p:M5.5 21V4M5.5 4.5h11.5l-2.2 4.2 2.2 4.3H5.5'],
  wallet: ['r:3.5 6.5 17 13 2.5', 'p:M16 11.5h4.5v4H16a2 2 0 0 1 0-4ZM6 6.5l9-3 1 3'],
  board: ['r:3.5 4.5 17 15 2', 'p:m7 8.5 2.5 2.5m0-2.5L7 11', 'c:16 9.8 1.6', 'p:M7.5 16c2.6-2.4 5.6-2.6 8.5-.8m0 0-.3-2m.3 2-2 .3'],
  shield: ['p:M12 3.5 19 6v5.8c0 4.4-2.9 7.6-7 8.7-4.1-1.1-7-4.3-7-8.7V6l7-2.5Z'],
  trophy: ['p:M8 4h8v5.5a4 4 0 0 1-8 0V4Z', 'p:M8 6.5H5c0 2.8 1.4 4.3 3.4 4.4M16 6.5h3c0 2.8-1.4 4.3-3.4 4.4M12 13.5V17M8.5 20.5h7M9.5 17h5'],
  globe: ['c:12 12 8.5', 'p:M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5S9.7 5.9 12 3.5Z'],
  coin: ['c:12 12 8.5', 'c:12 12 4.6'],
  pause: ['p:M9 6.5v11M15 6.5v11'],
  card: ['r:7.5 4.5 9 15 1.5'],
  corner: ['p:M6 21V4M6 4.5l9 3.2-9 3.3', 'p:M3.5 21h8'],
  whistle: ['c:9 14 5', 'p:M13 10.5 20.5 7v4.5l-6 1.5M4 8l2 2'],
  star: ['p:m12 4 2.4 5 5.5.7-4 3.8 1 5.4L12 16.3l-4.9 2.6 1-5.4-4-3.8 5.5-.7L12 4Z']
};
// celles qui se remplissent quand l'onglet est actif (comme la maison de la maquette)
const PLEINES = { home: 1, users: 1, profile: 1, connect: 1, heart: 1, shield: 1, explore: 0 };

export function Icone({ nom, taille = 21, couleur = C.text, plein = false, trait = 1.7 }) {
  const formes = ICONES[nom] || [];
  const remplir = plein && PLEINES[nom];
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24">
      <G fill={remplir ? couleur : 'none'} stroke={couleur} strokeWidth={trait} strokeLinecap="round" strokeLinejoin="round">
        {formes.map((f, i) => {
          const [k, v] = [f[0], f.slice(2)];
          if (k === 'p') return <Path key={i} d={v} />;
          const n = v.split(' ').map(Number);
          if (k === 'c') return <Circle key={i} cx={n[0]} cy={n[1]} r={n[2]} />;
          return <Rect key={i} x={n[0]} y={n[1]} width={n[2]} height={n[3]} rx={n[4]} />;
        })}
      </G>
    </Svg>
  );
}

// ---------- la marque ----------
// Le logo LinkFoot choisi dans le canvas (« A · Le maillon-ballon ») : un maillon de chaîne accroché
// à un ballon, « on relie les fans et leurs réseaux autour du foot ». Le maillon en blanc, le
// ballon vert, « Link » en blanc et « Foot » en vert clair, en Sora.
export const VERT_LOGO = '#2ECC71';
export const VERT_FOOT = '#9BEE8C';
export function Symbole({ taille = 30, creux = '#171B21' }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 96 96">
      <Rect x="6" y="30" width="54" height="36" rx="18" fill="none" stroke="#F2F4F7" strokeWidth="8" />
      <Circle cx="64" cy="48" r="25" fill={VERT_LOGO} />
      <Path d="M64 37 l10.5 7.6 -4 12.4 h-13 l-4-12.4z" fill={creux} />
      <Path d="M64 37 V25 M74.5 44.6 l10.5-3.4 M70.5 57 l6.5 8.8 M57.5 57 l-6.5 8.8 M53.5 44.6 l-10.5-3.4" fill="none" stroke={creux} strokeWidth="3.2" strokeLinecap="round" />
    </Svg>
  );
}

export function Marque({ compacte, taille = 32 }) {
  return (
    <View style={st.marque}>
      <Symbole taille={taille} />
      {compacte ? null : <Text style={st.marqueTxt}>Link<Text style={{ color: VERT_FOOT }}>Foot</Text></Text>}
    </View>
  );
}

// ---------- fonds ----------
// Le dégradé des cartes mises en avant (« carte »), le halo vert du stade (« stade »), et le
// voile qui assombrit le bas d'une image (« voile »). Ils remplissent leur parent, qui doit
// couper ce qui dépasse (overflow: 'hidden').
export function Fond({ type = 'carte' }) {
  const id = useIdSvg('fond');
  let degrade;
  if (type === 'stade') {
    degrade = (
      <RadialGradient id={id} cx="50%" cy="18%" r="75%" fx="50%" fy="18%">
        <Stop offset="0" stopColor="#263229" />
        <Stop offset="1" stopColor="#0B0D0C" />
      </RadialGradient>
    );
  } else if (type === 'voile') {
    degrade = (
      <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#020A05" stopOpacity="0.2" />
        <Stop offset="0.35" stopColor="#050505" stopOpacity="0.08" />
        <Stop offset="1" stopColor="#050505" stopOpacity="0.96" />
      </LinearGradient>
    );
  } else {
    degrade = (
      <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#161C17" />
        <Stop offset="1" stopColor="#0D0F0E" />
      </LinearGradient>
    );
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>{degrade}</Defs>
        <Rect x="0" y="0" width="100" height="100" fill={'url(#' + id + ')'} />
      </Svg>
    </View>
  );
}

// ---------- blason ----------
// Le rond aux couleurs d'un club et son sigle (« PAR », « OM » dans la maquette). Deux couleurs :
// coupé en diagonale ; une seule : du clair au foncé.
const PETITS_MOTS = /^(fc|ac|cf|sc|as|us|du|de|des|la|le|les|d|l)$/i;
export function sigle(nom) {
  const mots = String(nom || '').split(/[\s\-’']+/).filter((m) => m && !PETITS_MOTS.test(m));
  if (!mots.length) return '?';
  if (mots.length === 1) return mots[0].slice(0, 3).toUpperCase();
  return mots.slice(0, 3).map((m) => m[0]).join('').toUpperCase();
}
const rvb = (h) => { const x = String(h || '#777777').replace('#', ''); const v = parseInt(x.length === 3 ? x.split('').map((c) => c + c).join('') : x, 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const hex = (r, g, b) => '#' + [r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
const nuance = (h, k) => { const [r, g, b] = rvb(h); return k > 0 ? hex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k) : hex(r * (1 + k), g * (1 + k), b * (1 + k)); };
const clair = (h) => { const [r, g, b] = rvb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66; };

export function Blason({ nom, c1, c2, taille = 34 }) {
  const id = useIdSvg('blason');
  const a = c1 || '#5C6670';
  const fonce = c2 && c2.toLowerCase() !== a.toLowerCase();
  return (
    <View style={{ width: taille, height: taille, alignItems: 'center', justifyContent: 'center' }}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={taille} height={taille} viewBox="0 0 40 40">
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              {fonce
                ? [<Stop key="a" offset="0" stopColor={a} />, <Stop key="b" offset="0.52" stopColor={a} />,
                  <Stop key="c" offset="0.53" stopColor={c2} />, <Stop key="d" offset="1" stopColor={c2} />]
                : [<Stop key="a" offset="0" stopColor={nuance(a, 0.28)} />, <Stop key="b" offset="1" stopColor={nuance(a, -0.38)} />]}
            </LinearGradient>
          </Defs>
          <Circle cx="20" cy="20" r="19" fill={'url(#' + id + ')'} stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
        </Svg>
      </View>
      <Text style={[st.sigle, { fontSize: Math.max(8, taille * 0.25), color: !fonce && clair(a) ? '#0B0D09' : '#FFFFFF' }]}>{sigle(nom)}</Text>
    </View>
  );
}

// ---------- textes ----------
export function Title({ children, sub, surtitre }) {
  return (
    <View style={{ gap: 6, paddingTop: 2 }}>
      {surtitre ? <Text style={T.surtitre}>{surtitre}</Text> : null}
      <Text style={T.titre}>{children}</Text>
      {sub ? <Text style={[T.aide, { fontSize: 12, lineHeight: 17.5 }]}>{sub}</Text> : null}
    </View>
  );
}

// L'en-tête d'une section : surtitre, titre, et à droite une action (« View all › »).
export function EnTete({ surtitre, titre, action, onAction }) {
  return (
    <View style={st.entete}>
      <View style={{ flex: 1, gap: 7 }}>
        {surtitre ? <Text style={T.surtitre}>{surtitre}</Text> : null}
        <Text style={T.section} numberOfLines={1}>{titre}</Text>
      </View>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={st.action}>
          <Text style={st.actionTxt}>{action}</Text>
          <Icone nom="chevron" taille={14} couleur={C.dim} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------- conteneurs ----------
export function Card({ children, style, tint, vedette }) {
  return (
    <View style={[st.card, vedette && { overflow: 'hidden' }, tint ? { borderColor: tint } : null, style]}>
      {vedette ? <Fond type="carte" /> : null}
      {children}
    </View>
  );
}

// une liste dans un seul cadre, ses lignes séparées d'un filet
export function Groupe({ children, style }) {
  return <View style={[st.groupe, style]}>{children}</View>;
}

// une ligne de liste : l'icône dans son rond, le titre, une précision, la flèche
export function Ligne({ icone, label, sub, onPress, fin, droite, couleur }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [st.ligne, !fin && st.ligneSep, pressed && { backgroundColor: 'rgba(255,255,255,0.03)' }]}>
      {icone ? <View style={st.ligneIcone}><Icone nom={icone} taille={19} couleur={couleur || C.accent} /></View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.ligneLabel}>{label}</Text>
        {sub ? <Text style={st.ligneSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {droite}
      <Icone nom="chevron" taille={16} couleur="#555555" />
    </Pressable>
  );
}

export function Row({ children, style }) {
  return <View style={[st.row, style]}>{children}</View>;
}

// ---------- boutons ----------
// Un bouton qui sait refuser : quand `why` est rempli, il est grisé et la raison
// s'affiche sous lui. C'est la règle du §81 appliquée au natif.
export function Btn({ label, onPress, why, tone, small, style, icone }) {
  // `why` d'un seul espace : le bouton est grisé sans phrase sous lui (rien à expliquer)
  const off = !!why;
  const ghost = tone === 'ghost';
  const bg = off ? C.raised : ghost ? 'transparent' : C.accent;
  const fg = off ? '#5E5E5E' : ghost ? C.text : C.onAccent;
  return (
    <View style={style}>
      <Pressable
        accessibilityRole="button"
        onPress={off ? undefined : onPress}
        style={({ pressed }) => [
          st.btn,
          small && st.btnSmall,
          { backgroundColor: bg },
          ghost && !off ? st.btnGhost : null,
          pressed && !off ? { opacity: 0.86, transform: [{ scale: 0.97 }] } : null
        ]}
      >
        <Text style={[st.btnTxt, small && st.btnTxtSmall, { color: fg }]}>{label}</Text>
        {icone && !off ? <Icone nom={icone} taille={small ? 14 : 17} couleur={fg} trait={2} /> : null}
      </Pressable>
      {off && String(why).trim() ? <Text style={st.why}>{why}</Text> : null}
    </View>
  );
}

// le bouton rond de la barre du haut, avec sa pastille citron quand il y a du nouveau
export function BoutonRond({ icone, onPress, point, actif, label, taille = 38 }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [st.rond, { width: taille, height: taille, borderRadius: taille / 2 },
        actif ? { borderColor: C.accentLine, backgroundColor: C.accentFill } : null,
        pressed ? { transform: [{ scale: 0.94 }] } : null]}>
      <Icone nom={icone} taille={19} couleur={actif ? C.accent : C.text} />
      {point ? <View style={st.point} /> : null}
    </Pressable>
  );
}

// ---------- petites marques ----------
const TONS = {
  direct: { bg: C.liveFill, fg: C.live, bord: 'transparent' },
  accent: { bg: 'rgba(199,255,50,0.08)', fg: C.accent, bord: 'rgba(199,255,50,0.27)' },
  neutre: { bg: 'rgba(255,255,255,0.05)', fg: C.dim, bord: C.line },
  alerte: { bg: 'rgba(245,200,76,0.1)', fg: C.amber, bord: 'rgba(245,200,76,0.3)' }
};
export function Pastille({ children, ton = 'neutre', point }) {
  const t = TONS[ton] || TONS.neutre;
  return (
    <View style={[st.pastille, { backgroundColor: t.bg, borderColor: t.bord }]}>
      {point ? <View style={[st.pastillePoint, { backgroundColor: t.fg }]} /> : null}
      <Text style={[st.pastilleTxt, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

export function Bar({ pct, color }) {
  return (
    <View style={st.barBg}>
      <View style={[st.barFg, { width: Math.max(2, Math.min(100, pct)) + '%', backgroundColor: color || C.accent }]} />
    </View>
  );
}

export function Tag({ children, color }) {
  return (
    <View style={[st.tag, color ? { backgroundColor: color, borderColor: color } : null]}>
      <Text style={[st.tagTxt, color ? { color: '#0B0D09' } : null]}>{children}</Text>
    </View>
  );
}

// un chiffre et son nom (« 48 Matches » de la maquette) ; `sep` trace le filet à sa droite
export function Stat({ label, value, color, sep }) {
  return (
    <View style={[st.stat, sep ? st.statSep : null]}>
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

// ---------- réseau social ----------
// L'avatar de la maquette : les initiales dans un rond (pas de photo de personne), cerclé de
// citron pour soi ou pour quelqu'un qu'on suit.
export function Avatar({ nom, taille = 38, anneau, couleur }) {
  const ini = String(nom || '?').replace(/^@/, '').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase() || '?';
  const fond = couleur || '#232823';
  const rond = (
    <View style={{ width: taille, height: taille, borderRadius: taille / 2, backgroundColor: fond, alignItems: 'center', justifyContent: 'center', borderWidth: anneau ? 2 : 0, borderColor: C.bg }}>
      <Text style={{ fontFamily: F.texte, fontWeight: '700', color: clair(fond) ? '#0B0D09' : '#FFFFFF', fontSize: Math.max(9, taille * 0.34) }}>{ini}</Text>
    </View>
  );
  if (!anneau) return rond;
  return <View style={{ padding: 2, borderRadius: taille / 2 + 4, backgroundColor: C.accent }}>{rond}</View>;
}

// un lien vers un autre site (X, TikTok…) : un vrai lien sur le web, qui s'ouvre dans un nouvel
// onglet ; sur téléphone, l'application ou le navigateur
export function LienExterne({ url, children, style, label }) {
  if (Platform.OS === 'web') {
    return <Text accessibilityRole="link" accessibilityLabel={label} href={url} hrefAttrs={{ target: '_blank', rel: 'noopener noreferrer' }} style={style}>{children}</Text>;
  }
  return <Text accessibilityRole="link" accessibilityLabel={label} onPress={() => Linking.openURL(url).catch(() => {})} style={style}>{children}</Text>;
}

// un bouton qui est un lien vers un autre site (« Partager sur X »), au dessin des boutons :
// sur le web, un vrai lien (une page privée n'ouvre pas de fenêtre par script) ; sur téléphone,
// le même bouton que les autres
export function BtnLien({ url, label, small, tone, style }) {
  const ghost = tone === 'ghost';
  if (Platform.OS !== 'web') {
    return <Btn label={label} small={small} tone={tone} style={style} onPress={() => Linking.openURL(url).catch(() => {})} />;
  }
  return (
    <View style={style}>
      <Text accessibilityRole="link" href={url} hrefAttrs={{ target: '_blank', rel: 'noopener noreferrer' }}
        style={[st.btn, small && st.btnSmall, st.btnLien, { backgroundColor: ghost ? 'transparent' : C.accent }, ghost ? st.btnGhost : null,
          st.btnTxt, small && st.btnTxtSmall, { color: ghost ? C.text : C.onAccent }]}>{label}</Text>
    </View>
  );
}

// le X du réseau, dessiné au trait (pas le logo officiel) : deux barres croisées
export function MarqueX({ taille = 14, couleur = C.text }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24">
      <Path d="M4 4l16 16M20 4 4 20" stroke={couleur} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export function Champ({ valeur, onChange, placeholder, multiline, prefixe, style, max, nom }) {
  return (
    <View style={[st.champ, multiline && { alignItems: 'flex-start', minHeight: 96 }, style]}>
      {prefixe ? <Text style={st.champPrefixe}>{prefixe}</Text> : null}
      <TextInput value={valeur} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#5E5E5E"
        multiline={multiline} maxLength={max} accessibilityLabel={nom || placeholder} nativeID={nom}
        style={[st.champTxt, multiline && { minHeight: 80, textAlignVertical: 'top' }]} />
    </View>
  );
}

// l'interrupteur « Aussi sur X »
export function Interrupteur({ actif, onChange, label }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: !!actif }} onPress={() => onChange(!actif)} style={st.inter}>
      <View style={[st.interRail, actif && { backgroundColor: C.accent }]}>
        <View style={[st.interBouton, actif && { transform: [{ translateX: 16 }], backgroundColor: C.onAccent }]} />
      </View>
      <Text style={st.interTxt}>{label}</Text>
    </Pressable>
  );
}

// les onglets soulignés de la maquette (« Timeline · Stats · Lineups · Social »)
export function Onglets({ items, valeur, onChange }) {
  return (
    <View style={st.onglets}>
      {items.map(([id, label]) => (
        <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: valeur === id }} onPress={() => onChange(id)} style={st.onglet}>
          <Text style={[st.ongletTxt, valeur === id && st.ongletOn]}>{label}</Text>
          <View style={[st.ongletTrait, valeur === id && { backgroundColor: C.accent }]} />
        </Pressable>
      ))}
    </View>
  );
}

// ce qui n'est pas une vraie personne, un vrai lieu ou un vrai événement porte ce mot
export function Exemple() {
  return <View style={st.exemple}><Text style={st.exempleTxt}>EXEMPLE</Text></View>;
}

const st = StyleSheet.create({
  marque: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  marqueTxt: { fontFamily: F.marque, color: '#F2F4F7', fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  sigle: { fontFamily: F.texte, fontWeight: '700', letterSpacing: 0.3, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } },
  entete: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
  actionTxt: { fontFamily: F.texte, color: C.dim, fontSize: 12 },
  card: { backgroundColor: C.card, borderRadius: S.radius, borderWidth: 1, borderColor: C.line, padding: 14, gap: 9 },
  groupe: { backgroundColor: C.card, borderRadius: S.radius, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, overflow: 'hidden' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingVertical: 10 },
  ligneSep: { borderBottomWidth: 1, borderBottomColor: C.line },
  ligneIcone: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' },
  ligneLabel: { fontFamily: F.texte, color: C.text, fontSize: 14, fontWeight: '700' },
  ligneSub: { fontFamily: F.texte, color: C.faint, fontSize: 11.5, marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: { minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 18 },
  btnSmall: { minHeight: 34, borderRadius: 17, paddingHorizontal: 13, gap: 6 },
  btnGhost: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  btnLien: { display: 'flex', textAlign: 'center', textDecorationLine: 'none' },
  btnTxt: { fontFamily: F.texte, fontSize: 13.5, fontWeight: '700', letterSpacing: 0.1 },
  btnTxtSmall: { fontSize: 12 },
  why: { fontFamily: F.texte, color: C.amber, fontSize: 10.5, marginTop: 5, lineHeight: 14 },
  rond: { borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.055)', alignItems: 'center', justifyContent: 'center' },
  point: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, borderWidth: 2, borderColor: C.bg },
  pastille: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  pastillePoint: { width: 6, height: 6, borderRadius: 3 },
  pastilleTxt: { fontFamily: F.texte, fontSize: 9.5, fontWeight: '700', letterSpacing: 0.9 },
  barBg: { height: 4, borderRadius: 2, backgroundColor: '#262626', overflow: 'hidden' },
  barFg: { height: 4, borderRadius: 2 },
  tag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A' },
  tagTxt: { fontFamily: F.texte, color: '#9A9A9A', fontSize: 9.5, fontWeight: '700', letterSpacing: 0.6 },
  stat: { alignItems: 'center', flex: 1, paddingVertical: 2 },
  statSep: { borderRightWidth: 1, borderRightColor: C.line },
  statV: { fontFamily: F.titre, color: C.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.6 },
  statL: { fontFamily: F.texte, color: '#6E6E6E', fontSize: 10.5, marginTop: 3 },
  empty: { padding: 20, borderRadius: S.radius, borderWidth: 1, borderStyle: 'dashed', borderColor: '#2A2A2A' },
  champ: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#303030', backgroundColor: C.card, paddingHorizontal: 13 },
  champPrefixe: { fontFamily: F.texte, color: C.faint, fontSize: 14 },
  champTxt: { flex: 1, fontFamily: F.texte, color: C.text, fontSize: 14, paddingVertical: 10, outlineStyle: 'none' },
  inter: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4 },
  interRail: { width: 36, height: 20, borderRadius: 10, backgroundColor: '#2A2A2A', padding: 2 },
  interBouton: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#8A8A8A' },
  interTxt: { fontFamily: F.texte, color: C.dim, fontSize: 12.5, fontWeight: '600' },
  onglets: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line },
  onglet: { flex: 1, alignItems: 'center', paddingTop: 12, gap: 10 },
  ongletTxt: { fontFamily: F.texte, color: '#6A6A6A', fontSize: 12.5, fontWeight: '600' },
  ongletOn: { color: C.text, fontWeight: '700' },
  ongletTrait: { height: 2, width: '44%', backgroundColor: 'transparent' },
  exemple: { alignSelf: 'flex-start', borderRadius: 6, borderWidth: 1, borderColor: '#3A3A3A', paddingHorizontal: 5, paddingVertical: 1 },
  exempleTxt: { fontFamily: F.texte, color: '#7A7A7A', fontSize: 8.5, fontWeight: '700', letterSpacing: 0.9 },
  emptyTxt: { fontFamily: F.texte, color: C.faint, fontSize: 12, textAlign: 'center', lineHeight: 18 }
});
