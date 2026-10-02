// LinkFoot sur téléphone.
//
// L'app ne contient aucune règle du jeu : elle importe le moteur depuis ../src et se
// contente de l'afficher. Le même code décide des matchs ici, sur le web, et sur le
// serveur. Une règle changée dans le moteur change les trois d'un coup.
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
import { C } from './src/theme';
import { HomeScreen, SquadScreen, MatchScreen, TrainScreen, PacksScreen, SkillsScreen, OnlineScreen } from './src/screens';
import { TransfersScreen, QuestsScreen, FinancesScreen, TacticScreen, ClubScreen, DivisionScreen } from './src/directeur';

const { useClub } = createClubHooks(React);

// Pour brancher le mode en ligne, décommente ces deux lignes et mets l'adresse de
// ton serveur. Sans elles, le jeu tourne entièrement sur le téléphone.
//
//   import { OnlineClient, connectOnline } from '../src/online.js';
//   connectOnline(club, new OnlineClient({ url: 'https://ton-serveur/online', headers: { 'x-club-id': monId } }));

const TABS = [
  ['home', 'Accueil'], ['squad', 'Effectif'], ['match', 'Match'],
  ['train', 'Entraîn.'], ['packs', 'Packs'], ['online', 'En ligne']
];

export default function App() {
  const store = useMemo(() => new PhoneStore('linkfoot.save.v1'), []);
  const { club, state, ready, fresh, act, save } = useClub({ store, delay: 600 });
  const [tab, setTab] = useState('home');

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
          <ActivityIndicator color={C.green} />
          <Text style={st.loadTxt}>Chargement de ton club…</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  const go = (id) => setTab(id);
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
        <View style={st.head}>
          <Text style={st.title}>LinkFoot</Text>
          <Text style={st.sub}>Directeur sportif · {state.clubName || 'FC TonPseudo'}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Screen {...props} />
        </View>

        <View style={st.nav}>
          {TABS.map(([id, label]) => (
            <Pressable key={id} onPress={() => setTab(id)} style={st.navBtn}>
              <Text style={[st.navTxt, tab === id && st.navOn]}>{label}</Text>
              <View style={[st.dash, tab === id && { backgroundColor: C.green }]} />
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  load: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadTxt: { color: C.faint, fontSize: 13 },
  head: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  title: { color: C.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  sub: { color: C.faint, fontSize: 11, textAlign: 'center', marginTop: 2 },
  nav: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.cardAlt, paddingTop: 8, paddingBottom: 4 },
  navBtn: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 2 },
  navTxt: { color: C.faint, fontSize: 10.5, fontWeight: '600' },
  navOn: { color: C.text, fontWeight: '800' },
  dash: { width: 16, height: 3, borderRadius: 2, backgroundColor: 'transparent' }
});
