// LinkFoot sur téléphone.
//
// L'app ne contient aucune règle du jeu : elle importe le moteur depuis ../src et se
// contente de l'afficher. Le même code décide des matchs ici, sur le web, et sur le
// serveur. Une règle changée dans le moteur change les trois d'un coup.
//
// Deux parties dans une seule app, comme dans les écrans d'origine de LinkFoot : le réseau
// social du foot (Accueil, Explorer, Profil, le bouton « + » pour publier, le partage vers X) et
// le jeu du directeur sportif (Mon Club, et le Match). Le dessin suit la maquette Figma
// « Football-app » ; le logo est celui de LinkFoot (le maillon-ballon du canvas).
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
import { useSocial } from './src/social';
import { AccueilScreen, ExplorerScreen, ProfilScreen, FeuilleCreer } from './src/reseau';
import { MonClubScreen, SquadScreen, MatchScreen, TrainScreen, PacksScreen, SkillsScreen, OnlineScreen } from './src/screens';
import { TransfersScreen, QuestsScreen, FinancesScreen, TacticScreen, ClubScreen, DivisionScreen } from './src/directeur';

const { useClub } = createClubHooks(React);
chargerPolices();

// Pour brancher le mode en ligne, décommente ces deux lignes et mets l'adresse de
// ton serveur. Sans elles, le jeu tourne entièrement sur le téléphone.
//
//   import { OnlineClient, connectOnline } from '../src/online.js';
//   connectOnline(club, new OnlineClient({ url: 'https://ton-serveur/online', headers: { 'x-club-id': monId } }));

// Les cinq onglets du bas, comme la maquette : Accueil, Explorer, Match, Mon Club, Profil ; au-dessus
// du Match, le bouton « + » pour publier.
const TABS = [
  ['accueil', 'Accueil', 'home'], ['explorer', 'Explorer', 'explore'], ['match', 'Match', 'match'],
  ['monclub', 'Mon Club', 'shield'], ['profil', 'Profil', 'profile']
];
const PREMIERS = TABS.map((t) => t[0]);
// les écrans du jeu : l'onglet Mon Club reste allumé quand on y est
const DU_JEU = ['squad', 'train', 'packs', 'skills', 'online', 'transfers', 'quests', 'finances', 'tactic', 'club', 'division'];

export default function App() {
  const store = useMemo(() => new PhoneStore('linkfoot.save.v1'), []);
  const { club, state, ready, fresh, act, save } = useClub({ store, delay: 600 });
  const [tab, setTab] = useState('accueil');
  const [social, majSocial] = useSocial();
  const [creation, setCreation] = useState(false);
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
  const retour = () => { const p = pile.slice(); const avant = p.pop() || (DU_JEU.includes(tab) ? 'monclub' : 'accueil'); setPile(p); setTab(avant); };
  const sousEcran = !PREMIERS.includes(tab);
  const allume = DU_JEU.includes(tab) ? 'monclub' : tab;
  const aRecuperer = club.activeQuests().some((q) => q.prog >= q.goal && !q.claimed);

  const props = { club, state, act, go, save, social, majSocial, creer: () => setCreation(true) };
  const Screen = {
    accueil: AccueilScreen, explorer: ExplorerScreen, match: MatchScreen, monclub: MonClubScreen, profil: ProfilScreen,
    squad: SquadScreen, train: TrainScreen, packs: PacksScreen, skills: SkillsScreen, online: OnlineScreen,
    // §17 les entrées du directeur sportif qui n'avaient pas d'écran ici
    transfers: TransfersScreen, quests: QuestsScreen, finances: FinancesScreen, tactic: TacticScreen, club: ClubScreen,
    division: DivisionScreen
  }[tab] || AccueilScreen;

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
            <BoutonRond icone="search" label="Rechercher" actif={tab === 'explorer'} onPress={() => ouvrir('explorer')} />
            <BoutonRond icone="bell" label="Quêtes" point={aRecuperer} actif={tab === 'quests'} onPress={() => go('quests')} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Screen {...props} />
        </View>

        <View style={st.nav}>
          {TABS.map(([id, label, icone]) => {
            const on = allume === id;
            return (
              <View key={id} style={st.navSlot}>
                {id === 'match' ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Publier" onPress={() => setCreation(true)} style={st.fab}>
                    <Icone nom="plus" taille={24} couleur={C.onAccent} trait={2.2} />
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" onPress={() => ouvrir(id)} style={st.navBtn}>
                  <Icone nom={icone} taille={22} couleur={on ? C.text : '#646464'} plein={on} />
                  <Text style={[st.navTxt, on && st.navOn]}>{label}</Text>
                  <View style={[st.navPoint, on && { backgroundColor: C.accent }]} />
                </Pressable>
              </View>
            );
          })}
        </View>

        {creation ? <FeuilleCreer club={club} state={state} social={social} majSocial={majSocial} go={go} fermer={() => setCreation(false)} /> : null}
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
  navSlot: { flex: 1, alignItems: 'center' },
  navBtn: { alignSelf: 'stretch', alignItems: 'center', gap: 4, paddingVertical: 2 },
  navTxt: { fontFamily: F.texte, color: '#646464', fontSize: 10, fontWeight: '600' },
  navOn: { color: C.text },
  navPoint: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent', marginTop: 1 },
  // le bouton « + » de la maquette : rond citron, bordé de noir, au-dessus du Match
  fab: { position: 'absolute', zIndex: 2, top: -41, width: 46, height: 46, borderRadius: 23, backgroundColor: C.accent,
    borderWidth: 4, borderColor: '#080808', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 }
});
