// LinkFoot sur téléphone.
//
// L'app ne contient aucune règle du jeu : elle importe le moteur depuis ../src et se
// contente de l'afficher. Le même code décide des matchs ici, sur le web, et sur le
// serveur. Une règle changée dans le moteur change les trois d'un coup.
//
// Le dessin suit la maquette Figma « Football-app » (Figma Make) : la barre du haut avec la
// marque et ses boutons ronds, la barre du bas à icônes et son bouton central citron, qui est
// ici le Match.
//
//   npx expo start   puis scanner le QR code avec Expo Go
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Club } from '../src/club.js';
import { SaveManager } from '../src/save.js';
import { createClubHooks } from '../src/react.js';
import { PhoneStore } from './src/store';
import { C, F } from './src/theme';
import { chargerPolices } from './src/polices';
import { Icone, Marque, BoutonRond } from './src/ui';
import { HomeScreen, SquadScreen, MatchScreen, TrainScreen, PacksScreen, SkillsScreen, OnlineScreen } from './src/screens';
import { TransfersScreen, QuestsScreen, FinancesScreen, TacticScreen, ClubScreen, DivisionScreen } from './src/directeur';

const { useClub } = createClubHooks(React);
chargerPolices();

// Pour brancher le mode en ligne, décommente ces deux lignes et mets l'adresse de
// ton serveur. Sans elles, le jeu tourne entièrement sur le téléphone.
//
//   import { OnlineClient, connectOnline } from '../src/online.js';
//   connectOnline(club, new OnlineClient({ url: 'https://ton-serveur/online', headers: { 'x-club-id': monId } }));

// Les cinq onglets du bas (le troisième, le Match, est le bouton central). En ligne est en haut,
// à côté des Quêtes, comme les deux boutons ronds de la maquette.
const TABS = [
  ['home', 'Accueil', 'home'], ['squad', 'Effectif', 'users'], ['match', 'Match', 'match'],
  ['train', 'Entraîn.', 'chrono'], ['packs', 'Packs', 'pack']
];
const PREMIERS = ['home', 'squad', 'match', 'train', 'packs', 'online'];

export default function App() {
  const store = useMemo(() => new PhoneStore('linkfoot.save.v1'), []);
  const { club, state, ready, fresh, act, save } = useClub({ store, delay: 600 });
  const [tab, setTab] = useState('home');
  // d'où l'on vient, pour le bouton retour des écrans du directeur sportif
  const [pile, setPile] = useState([]);

  // Première partie : on crée le club, avec son effectif normal et son joueur rare offert
  // (§2 à §4). Le test était « l'effectif est vide », mais un Club neuf a déjà un effectif
  // de démonstration : la création ne se déclenchait JAMAIS, et tout nouveau joueur
  // commençait au niveau 7 avec 1 000 jetons. `fresh` dit si la sauvegarde était vide.
  useEffect(() => {
    if (ready && fresh) act((c) => c.createClub({ name: 'FC TonPseudo' }));
  }, [ready, fresh]);

  // Un match engagé puis interrompu (l'app fermée pendant le direct) se rejoue au retour,
  // à l'identique et jusqu'au bout (src/direct.js) : fermer l'app ne fait pas fuir une défaite.
  useEffect(() => {
    if (ready && !fresh && club.state.matchEngage && !club.enDirect) act((c) => c.reprendreMatch());
  }, [ready, fresh]);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={st.load}>
          <Marque />
          <ActivityIndicator color={C.accent} />
          <Text style={st.loadTxt}>Chargement de ton club…</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  // un onglet (en bas, ou les boutons ronds) repart de zéro ; un écran ouvert depuis un autre
  // se souvient d'où il vient
  const ouvrir = (id) => { setPile([]); setTab(id); };
  const go = (id) => { if (id !== tab) { setPile((p) => p.concat([tab])); setTab(id); } };
  const retour = () => { const p = pile.slice(); const avant = p.pop() || 'home'; setPile(p); setTab(avant); };
  const sousEcran = !PREMIERS.includes(tab);
  const aRecuperer = club.activeQuests().some((q) => q.prog >= q.goal && !q.claimed);

  const props = { club, state, act, go, save };
  const Screen = {
    home: HomeScreen, squad: SquadScreen, match: MatchScreen,
    train: TrainScreen, packs: PacksScreen, skills: SkillsScreen, online: OnlineScreen,
    // §17 les entrées du directeur sportif qui n'avaient pas d'écran ici
    transfers: TransfersScreen, quests: QuestsScreen, finances: FinancesScreen, tactic: TacticScreen, club: ClubScreen,
    division: DivisionScreen
  }[tab] || HomeScreen;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={st.app} edges={['top', 'bottom']}>
        <View style={st.haut}>
          <View style={st.hautGauche}>
            {sousEcran ? <BoutonRond icone="back" label="Retour" taille={36} onPress={retour} /> : null}
            <Marque />
          </View>
          <View style={st.hautDroite}>
            <BoutonRond icone="globe" label="En ligne" actif={tab === 'online'} onPress={() => ouvrir('online')} />
            <BoutonRond icone="bell" label="Quêtes" point={aRecuperer} actif={tab === 'quests'} onPress={() => go('quests')} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Screen {...props} />
        </View>

        <View style={st.nav}>
          {TABS.map(([id, label, icone]) => {
            const on = tab === id;
            const central = id === 'match';
            return (
              <Pressable key={id} accessibilityRole="button" onPress={() => ouvrir(id)} style={st.navBtn}>
                {central
                  ? <View style={[st.fab, on && st.fabOn]}><Icone nom="match" taille={24} couleur={C.onAccent} trait={1.9} /></View>
                  : null}
                {central ? <View style={{ height: 22 }} /> : <Icone nom={icone} taille={22} couleur={on ? C.text : '#646464'} plein={on} />}
                <Text style={[st.navTxt, on && st.navOn]}>{label}</Text>
                <View style={[st.navPoint, on && { backgroundColor: C.accent }]} />
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  load: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadTxt: { fontFamily: F.texte, color: C.faint, fontSize: 13 },
  haut: { height: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(5,5,5,0.92)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  hautGauche: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hautDroite: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nav: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, backgroundColor: 'rgba(9,9,9,0.96)',
    paddingTop: 7, paddingBottom: 6, paddingHorizontal: 6 },
  navBtn: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 2 },
  navTxt: { fontFamily: F.texte, color: '#646464', fontSize: 10, fontWeight: '600' },
  navOn: { color: C.text },
  navPoint: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent', marginTop: 1 },
  // le bouton central de la maquette : rond citron, bordé de noir, qui dépasse de la barre
  fab: { position: 'absolute', top: -27, width: 50, height: 50, borderRadius: 25, backgroundColor: C.accent,
    borderWidth: 4, borderColor: '#080808', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  fabOn: { borderColor: '#1A2208' }
});
