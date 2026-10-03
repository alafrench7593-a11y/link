// La partie réseau social de LinkFoot : l'accueil, Explorer, le profil, la publication (le bouton
// « + »), le salon pendant un match et le partage vers X.
//
// Ce qui est vrai : tes posts, ton profil, tes réseaux, ce que tu suis (sur l'appareil, src/social.js),
// et tout ce qui vient de la partie (tes matchs, ceux de la division, le classement, tes joueurs).
// Ce qui ne l'est pas encore : les autres personnes, leurs posts, les communautés et les
// événements, en attendant le serveur en ligne ; ils portent la marque EXEMPLE (src/exemples.js).
//
// Le dessin suit la maquette Figma « Football-app » (le brief LINKCONNECT) : héros en grand,
// cartes de match, fil de posts, personnes à suivre, événements, communautés, profil à statistiques.
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { C, S, T, F } from './theme';
import { Card, Row, Btn, BtnLien, Bar, Stat, Empty, EnTete, Groupe, Ligne, Blason, Fond, Pastille, Icone, Avatar, LienExterne, Champ, Interrupteur, Onglets, Exemple, Symbole } from './ui';
import { RESEAUX, lienReseau, partageX, postXValide, pseudoPropre, publier, ilYa, moi, postsDuJeu, matchsDeLaJournee } from './social';
import { PERSONNES, COMMUNAUTES, EVENEMENTS, LIEUX, POSTS, personne } from './exemples';
import { image } from './fichiers';

// le héros de l'accueil : un footballeur du jeu sous les projecteurs, rendu par le moteur 3D de
// LinkFoot (pas une photo ; à remplacer par tes photos de référence quand tu les fournis)
const HEROS_SOCIAL = image(require('../assets/heros-nuit.jpg'));
// le joueur à la une d'Explorer : le même footballeur du jeu, de face (rendu, pas une photo)
const ALAUNE = image(require('../assets/alaune.jpg'));

const nombre = (n) => (n >= 1000 ? (Math.round(n / 100) / 10).toString().replace('.', ',') + ' k' : String(n));

// ---------- accueil ----------
export function AccueilScreen({ club, state, go, social, majSocial, creer }) {
  const m = moi(social, state);
  const matchs = matchsDeLaJournee(club, state);
  const jeu = postsDuJeu(club, state);
  const ville = String(social.profil.ville || '').toUpperCase();
  const jour = matchs.length ? matchs[0].jour + '/' + matchs[0].total : '';
  return (
    <ScrollView contentContainerStyle={st.accueil}>
      <View style={st.heros}>
        <Image source={HEROS_SOCIAL} style={st.herosImage} resizeMode="cover" accessibilityIgnoresInvertColors />
        <Fond type="voile" />
        <View style={st.herosTexte}>
          <Text style={st.kicker} numberOfLines={1}>{(ville ? ville + ' · ' : '') + 'FOOTBALL CULTURE'}</Text>
          <Text style={st.herosTitre}>CONNECT{'\n'}THROUGH{'\n'}<Text style={{ color: C.accent }}>FOOTBALL.</Text></Text>
          <Btn label="Trouve tes gens" icone="arrow" onPress={() => go('explorer')} style={{ alignSelf: 'flex-start' }} />
        </View>
      </View>

      <View style={st.section}>
        <EnTete surtitre={'DIVISION ' + state.division + (jour ? ' · JOURNÉE ' + jour : '')} titre="En direct" action="Classement" onAction={() => go('division')} />
        {matchs.map((mt, i) => (
          <CarteMatch key={i} dom={mt.dom} ext={mt.ext}
            pastille={mt.moi && club.enDirect ? <Pastille ton="direct" point>TON MATCH · EN COURS</Pastille>
              : mt.moi ? <Pastille ton="accent">TON MATCH</Pastille> : <Pastille>JOURNÉE {mt.jour}</Pastille>}
            lieu={mt.moi ? 'à jouer' : 'en même temps'} onPress={() => go(mt.moi ? 'match' : 'division')} />
        ))}
      </View>

      <View style={st.section}>
        <EnTete surtitre="TON RÉSEAU" titre="Le fil" action="Publier" onAction={creer} />
        <Pressable accessibilityRole="button" onPress={creer} style={st.composer}>
          <Avatar nom={m.nom} taille={36} anneau />
          <Text style={st.composerTxt}>Quoi de neuf, @{m.pseudo} ?</Text>
          <View style={st.composerBtn}><Icone nom="plus" taille={16} couleur={C.onAccent} trait={2.2} /></View>
        </Pressable>
        {social.posts.map((p) => <PostMoi key={p.id} p={p} m={m} social={social} majSocial={majSocial} />)}
        {jeu.map((p) => <PostJeu key={p.id} p={p} social={social} majSocial={majSocial} />)}
        {POSTS.map((p) => <PostExemple key={p.id} p={p} social={social} majSocial={majSocial} />)}
      </View>

      <View style={st.section}>
        <EnTete surtitre="SUGGESTIONS" titre="Des gens à suivre" action="Explorer" onAction={() => go('explorer')} />
        {PERSONNES.slice(0, 3).map((p) => <CartePersonne key={p.id} p={p} social={social} majSocial={majSocial} />)}
      </View>

      <View style={st.section}>
        <EnTete surtitre="PRÈS DE TOI" titre="Événements" />
        {EVENEMENTS.slice(0, 2).map((e) => <CarteEvenement key={e.id} e={e} social={social} majSocial={majSocial} />)}
      </View>

      <View style={st.section}>
        <EnTete surtitre="POUR TOI" titre="Communautés" action="Tout voir" onAction={() => go('explorer')} />
        {COMMUNAUTES.slice(0, 3).map((c) => <CarteCommunaute key={c.id} c={c} social={social} majSocial={majSocial} />)}
      </View>
    </ScrollView>
  );
}

// ---------- les cartes ----------
// un match (« Live now » de la maquette) : les deux clubs, leurs couleurs, où il se joue
function CarteMatch({ dom, ext, pastille, lieu, onPress, score }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [st.carteMatch, pressed && { opacity: 0.92 }]}>
      <Fond type="carte" />
      <View style={st.cmHaut}>{pastille}<Text style={st.cmLieu}>{String(lieu || '').toUpperCase()}</Text></View>
      <View style={st.cmLigne}>
        <View style={st.cmEquipe}><Blason nom={dom.nom} c1={dom.c1} c2={dom.c2} taille={38} /><Text style={st.cmNom} numberOfLines={2}>{dom.nom}</Text></View>
        <Text style={st.cmCentre}>{score || 'VS'}</Text>
        <View style={st.cmEquipe}><Blason nom={ext.nom} c1={ext.c1} c2={ext.c2} taille={38} /><Text style={st.cmNom} numberOfLines={2}>{ext.nom}</Text></View>
      </View>
    </Pressable>
  );
}

// la tête d'un post : avatar, nom, et ce qui le situe
function TetePost({ nom, couleur, anneau, sous, exemple, createur, journal }) {
  return (
    <View style={st.postTete}>
      {journal
        ? <View style={st.journalRond}><Symbole taille={30} /></View>
        : <Avatar nom={nom} taille={40} anneau={anneau} couleur={couleur} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={st.postNom} numberOfLines={1}>{nom}</Text>
          {createur ? <Pastille ton="accent">CRÉATEUR</Pastille> : null}
          {exemple ? <Exemple /> : null}
        </View>
        <Text style={st.postSous} numberOfLines={1}>{sous}</Text>
      </View>
    </View>
  );
}

// la rangée d'actions : j'aime, commentaires, partager sur X
function Actions({ id, aimes, commentaires, texte, social, majSocial, tag }) {
  const aime = !!social.aimes[id];
  return (
    <View style={st.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={aime ? 'Je n’aime plus' : 'J’aime'} onPress={() => majSocial((s) => { s.aimes[id] = !s.aimes[id]; })} style={st.action}>
        <Icone nom="heart" taille={19} plein={aime} couleur={aime ? '#FF5A6C' : '#8E8E8E'} />
        <Text style={[st.actionTxt, aime && { color: '#FF5A6C' }]}>{(aimes || 0) + (aime ? 1 : 0)}</Text>
      </Pressable>
      {commentaires != null ? (
        <View style={st.action}><Icone nom="comment" taille={19} couleur="#8E8E8E" /><Text style={st.actionTxt}>{commentaires}</Text></View>
      ) : null}
      <LienExterne url={partageX(texte)} label="Partager sur X" style={st.actionLien}>Partager sur X ↗</LienExterne>
      {tag ? <Text style={st.postTag}>{tag}</Text> : null}
    </View>
  );
}

function CarteDansPost({ carte }) {
  if (!carte) return null;
  if (carte.type === 'match') {
    return (
      <View style={st.postCarte}>
        <Fond type="stade" />
        <Text style={[T.surtitre, { textAlign: 'center' }]}>{carte.titre}</Text>
        <View style={st.cmLigne}>
          <View style={st.cmEquipe}><Blason nom={carte.dom.nom} c1={carte.dom.c1} c2={carte.dom.c2} taille={34} /><Text style={st.cmNom} numberOfLines={2}>{carte.dom.nom}</Text></View>
          <Text style={st.cmCentre}>{carte.score || 'VS'}</Text>
          <View style={st.cmEquipe}><Blason nom={carte.ext.nom} c1={carte.ext.c1} c2={carte.ext.c2} taille={34} /><Text style={st.cmNom} numberOfLines={2}>{carte.ext.nom}</Text></View>
        </View>
      </View>
    );
  }
  if (carte.type === 'sondage') return <Sondage q={carte.question} options={carte.options} votes={carte.votes} />;
  return null;
}

function Sondage({ q, options, votes, choix, onChoix }) {
  const tot = (votes || []).reduce((a, b) => a + b, 0) || 0;
  return (
    <View style={st.sondage}>
      <Text style={[T.nom, { fontSize: 13.5 }]}>{q}</Text>
      {options.map((o, i) => {
        const pct = tot ? Math.round((100 * (votes[i] || 0)) / tot) : 0;
        return (
          <Pressable key={i} disabled={!onChoix} onPress={() => onChoix && onChoix(i)} style={[st.sondageLigne, choix === i && { borderColor: C.accentLine }]}>
            <View style={[st.sondageFond, { width: pct + '%' }]} />
            <Text style={st.sondageTxt}>{o}</Text>
            {tot ? <Text style={st.sondagePct}>{pct} %</Text> : null}
          </Pressable>
        );
      })}
      {tot ? <Text style={T.aide}>{tot} votes</Text> : null}
    </View>
  );
}

function PostMoi({ p, m, social, majSocial }) {
  return (
    <View style={st.post}>
      <TetePost nom={m.nom} anneau sous={'@' + m.pseudo + ' · ' + ilYa(p.t) + (p.aussiX ? ' · aussi sur X' : '')} />
      {p.texte ? <Text style={st.postTexte}>{p.texte}</Text> : null}
      <CarteDansPost carte={p.carte} />
      <Actions id={p.id} aimes={0} texte={p.texte + ' #LinkFoot'} social={social} majSocial={majSocial} tag="TOI" />
    </View>
  );
}

function PostJeu({ p, social, majSocial }) {
  return (
    <View style={st.post}>
      <TetePost journal nom="LinkFoot Journal" sous={'tiré de ta partie · ' + p.quand} />
      <Text style={st.postTexte}>{p.texte}</Text>
      <Actions id={p.id} aimes={0} texte={p.texte + ' #LinkFoot'} social={social} majSocial={majSocial} tag={String(p.club || '').toUpperCase()} />
    </View>
  );
}

function PostExemple({ p, social, majSocial }) {
  const qui = personne(p.qui) || {};
  return (
    <View style={st.post}>
      <TetePost nom={qui.nom} couleur={qui.couleur} exemple createur={qui.createur} sous={'@' + qui.pseudo + ' · ' + qui.ville + ' · ' + p.quand} />
      <Text style={st.postTexte}>{p.texte}</Text>
      {p.live ? <View style={{ flexDirection: 'row', gap: 8 }}><Pastille ton="direct" point>LIVE À 21:00</Pastille><Pastille>{(qui.reseaux || []).join(' · ')}</Pastille></View> : null}
      {p.sondage ? <Sondage q={p.sondage.question} options={p.sondage.options} votes={p.sondage.votes} /> : null}
      <Actions id={p.id} aimes={p.aimes} commentaires={p.commentaires} texte={p.texte} social={social} majSocial={majSocial} tag={p.tag} />
    </View>
  );
}

function CartePersonne({ p, social, majSocial }) {
  const suivi = !!social.suivis[p.id];
  return (
    <View style={st.personne}>
      <Avatar nom={p.nom} taille={50} couleur={p.couleur} anneau={suivi} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={T.nom} numberOfLines={1}>{p.nom}</Text><Exemple /></View>
        <Text style={T.aide} numberOfLines={1}>{p.ville} · {p.role} · {p.club}</Text>
        <Text style={[T.aide, { fontSize: 10.5, color: '#5E5E5E' }]}>{p.identite} · {p.communs} contacts en commun</Text>
      </View>
      <Btn small tone={suivi ? 'ghost' : undefined} label={suivi ? 'Suivi' : 'Suivre'} onPress={() => majSocial((s) => { s.suivis[p.id] = !s.suivis[p.id]; })} />
    </View>
  );
}

function CarteEvenement({ e, social, majSocial }) {
  const inscrit = !!social.evenements[e.id];
  const n = e.inscrits + (inscrit ? 1 : 0);
  return (
    <View style={st.evenement}>
      <Fond type="stade" />
      <View style={st.evDate}><Text style={st.evJour}>{e.date}</Text><Text style={st.evMois}>{e.mois}</Text></View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={st.evNiveau}>{e.niveau.toUpperCase()}</Text><Exemple /></View>
        <Text style={st.evTitre}>{e.titre}</Text>
        <Text style={T.aide}>{e.jour} · {e.heure} · {e.lieu}</Text>
        <Bar pct={(100 * n) / e.places} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={[T.aide, { color: C.accent }]}>{n} / {e.places} · {e.places - n} places</Text>
          <Btn small tone={inscrit ? 'ghost' : undefined} label={inscrit ? 'Inscrit' : 'Rejoindre'} onPress={() => majSocial((s) => { s.evenements[e.id] = !s.evenements[e.id]; })} />
        </Row>
      </View>
    </View>
  );
}

function CarteCommunaute({ c, social, majSocial }) {
  const membre = !!social.communautes[c.id];
  const fonce = c.couleur === '#232823';
  return (
    <View style={st.communaute}>
      <View style={[st.comVisuel, { backgroundColor: c.couleur }]}><Text style={[st.comSigle, { color: fonce ? C.text : '#111111' }]}>{c.sigle}</Text></View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={T.nom} numberOfLines={1}>{c.nom}</Text><Exemple /></View>
        <Text style={T.aide} numberOfLines={1}>{nombre(c.membres + (membre ? 1 : 0))} membres{c.pres ? ' · ' + c.pres + ' près de toi' : ''}</Text>
      </View>
      <Btn small tone={membre ? 'ghost' : undefined} label={membre ? 'Membre' : 'Rejoindre'} onPress={() => majSocial((s) => { s.communautes[c.id] = !s.communautes[c.id]; })} />
    </View>
  );
}

// ---------- explorer ----------
const sansAccents = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const FILTRES = [['tout', 'Tout'], ['joueurs', 'Joueurs'], ['clubs', 'Clubs'], ['personnes', 'Personnes'], ['communautes', 'Communautés'], ['evenements', 'Événements'], ['lieux', 'Lieux']];

export function ExplorerScreen({ club, state, go, social, majSocial }) {
  const [q, setQ] = useState('');
  const [filtre, setFiltre] = useState('tout');
  const lg = club.divisionCourante();
  const joueurs = state.squad.map((p) => Object.assign({}, p, { ou: 'Ton effectif' }))
    .concat(club.marketList().map((p) => Object.assign({}, p, { ou: 'Sur le marché' })))
    .sort((a, b) => b.ovr - a.ovr);
  const clubs = lg.clubs.map((c) => ({ id: c.id, nom: c.club, c1: c.color, ovr: c.ovr, style: (club.styles()[c.style] || {}).name || c.style }));
  const r = sansAccents(q.trim());
  const garde = (cat, txt) => (filtre === 'tout' || filtre === cat) && (!r || sansAccents(txt).includes(r));
  const res = {
    joueurs: joueurs.filter((p) => garde('joueurs', p.name + ' ' + p.pos)).slice(0, r ? 12 : 4),
    clubs: clubs.filter((c) => garde('clubs', c.nom + ' ' + c.style)),
    personnes: PERSONNES.filter((p) => garde('personnes', p.nom + ' ' + p.pseudo + ' ' + p.ville + ' ' + p.role + ' ' + p.club)),
    communautes: COMMUNAUTES.filter((c) => garde('communautes', c.nom + ' ' + c.desc)),
    evenements: EVENEMENTS.filter((e) => garde('evenements', e.titre + ' ' + e.lieu + ' ' + e.niveau)),
    lieux: LIEUX.filter((l) => garde('lieux', l.nom + ' ' + l.type))
  };
  const vide = r && !Object.values(res).some((x) => x.length);
  const meilleur = state.squad.slice().sort((a, b) => b.ovr - a.ovr)[0];
  return (
    <ScrollView contentContainerStyle={st.page} keyboardShouldPersistTaps="handled">
      <View style={st.recherche}>
        <Icone nom="search" taille={19} couleur="#6A6A6A" />
        <Champ valeur={q} onChange={setQ} placeholder="Joueurs, clubs, communautés…" nom="Rechercher" style={st.rechercheChamp} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FILTRES.map(([id, l]) => (
          <Pressable key={id} onPress={() => setFiltre(id)} style={[st.filtre, filtre === id && st.filtreOn]}>
            <Text style={[st.filtreTxt, filtre === id && st.filtreTxtOn]}>{l}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {vide ? <Empty>Rien pour « {q} ». Essaie un nom de joueur, de club ou de ville.</Empty> : null}

      {!r && filtre === 'tout' && meilleur ? (
        <Pressable accessibilityRole="button" onPress={() => go('squad')} style={st.alaune}>
          <Image source={ALAUNE} style={st.herosImage} resizeMode="cover" accessibilityIgnoresInvertColors />
          <Fond type="voile" />
          <Text style={st.alauneLabel}>JOUEUR À LA UNE · TON EFFECTIF</Text>
          <View style={{ marginTop: 'auto', gap: 12 }}>
            <Text style={st.alaunePoste}>{meilleur.pos} · {club.rarityFor(meilleur).label.toUpperCase()}</Text>
            <Text style={st.alauneNom}>{/^\S+\.\s/.test(meilleur.name) ? meilleur.name : String(meilleur.name).replace(' ', '\n')}</Text>
            <View style={{ flexDirection: 'row', gap: 22 }}>
              <Text style={st.alauneStat}>{meilleur.ovr}{'\n'}<Text style={st.alauneStatL}>NOTE</Text></Text>
              <Text style={st.alauneStat}>{club.playerProgress(meilleur).lvl}{'\n'}<Text style={st.alauneStatL}>NIVEAU</Text></Text>
              <Text style={st.alauneStat}>{club.profile(meilleur).pot}{'\n'}<Text style={st.alauneStatL}>POTENTIEL</Text></Text>
            </View>
          </View>
          <View style={st.alauneCta}><Icone nom="arrow" taille={20} couleur={C.onAccent} trait={2} /></View>
        </Pressable>
      ) : null}

      {res.joueurs.length ? (
        <View style={st.bloc}>
          <EnTete surtitre="DANS LA PARTIE" titre="Joueurs" />
          <Groupe>
            {res.joueurs.map((p, i) => (
              <Pressable key={p.ou + p.id} onPress={() => go(p.ou === 'Ton effectif' ? 'squad' : 'transfers')} style={[st.ligneRes, i < res.joueurs.length - 1 && st.sep]}>
                <View style={st.noteCase}><Text style={st.noteCaseTxt}>{p.ovr}</Text></View>
                <View style={{ flex: 1 }}><Text style={T.nom}>{p.name}</Text><Text style={T.aide}>{p.pos} · {p.ou}</Text></View>
                <Icone nom="chevron" taille={16} couleur="#555555" />
              </Pressable>
            ))}
          </Groupe>
        </View>
      ) : null}

      {res.clubs.length ? (
        <View style={st.bloc}>
          <EnTete surtitre={'DIVISION ' + state.division} titre="Clubs" action="Classement" onAction={() => go('division')} />
          <Groupe>
            {res.clubs.map((c, i) => (
              <Pressable key={c.id} onPress={() => go('division')} style={[st.ligneRes, i < res.clubs.length - 1 && st.sep]}>
                <Blason nom={c.nom} c1={c.c1} taille={36} />
                <View style={{ flex: 1 }}><Text style={T.nom}>{c.nom}</Text><Text style={T.aide}>{c.style} · note {c.ovr}</Text></View>
                <Icone nom="chevron" taille={16} couleur="#555555" />
              </Pressable>
            ))}
          </Groupe>
        </View>
      ) : null}

      {res.personnes.length ? (
        <View style={st.bloc}>
          <EnTete surtitre="LE RÉSEAU" titre="Personnes" />
          {res.personnes.map((p) => <CartePersonne key={p.id} p={p} social={social} majSocial={majSocial} />)}
        </View>
      ) : null}

      {res.communautes.length ? (
        <View style={st.bloc}>
          <EnTete surtitre="CONSTRUITES AUTOUR DE TOI" titre="Communautés" />
          {res.communautes.map((c) => <CarteCommunaute key={c.id} c={c} social={social} majSocial={majSocial} />)}
        </View>
      ) : null}

      {res.evenements.length ? (
        <View style={st.bloc}>
          <EnTete surtitre="À VENIR" titre="Événements" />
          {res.evenements.map((e) => <CarteEvenement key={e.id} e={e} social={social} majSocial={majSocial} />)}
        </View>
      ) : null}

      {res.lieux.length ? (
        <View style={st.bloc}>
          <EnTete surtitre="AUTOUR DE TOI" titre="Où jouer" />
          <Carte />
          <Groupe>
            {res.lieux.map((l, i) => (
              <View key={l.id} style={[st.ligneRes, i < res.lieux.length - 1 && st.sep]}>
                <View style={st.lieuIcone}><Icone nom={l.type === 'Bar sportif' ? 'message' : 'pin'} taille={17} couleur={C.accent} /></View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={T.nom}>{l.nom}</Text><Exemple /></View>
                  <Text style={T.aide}>{l.type} · {l.distance}</Text>
                </View>
              </View>
            ))}
          </Groupe>
        </View>
      ) : null}
    </ScrollView>
  );
}

// la carte des lieux, minimaliste comme celle de la maquette (un quadrillage, une rivière, des repères)
function Carte() {
  return (
    <View style={st.carte}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {Array.from({ length: 9 }, (_, i) => <View key={'h' + i} style={[st.carteTrait, { top: i * 26, left: -20, right: -20, height: 1, transform: [{ rotate: '-8deg' }] }]} />)}
        {Array.from({ length: 16 }, (_, i) => <View key={'v' + i} style={[st.carteTrait, { left: i * 26, top: -20, bottom: -20, width: 1, transform: [{ rotate: '-8deg' }] }]} />)}
        <View style={st.riviere} />
      </View>
      {[[70, 46, 'match'], [220, 70, 'users'], [150, 104, 'match']].map(([x, y, ic], i) => (
        <View key={i} style={[st.repere, { left: x, top: y }]}><Icone nom={ic} taille={15} couleur="#111111" trait={2} /></View>
      ))}
      <View style={st.carteLegende}>
        <Text style={[T.nom, { fontSize: 12.5 }]}>{LIEUX.length} lieux près de toi</Text>
        <Exemple />
      </View>
    </View>
  );
}

// ---------- profil ----------
export function ProfilScreen({ club, state, go, social, majSocial }) {
  const [edition, setEdition] = useState(false);
  const [onglet, setOnglet] = useState('posts');
  const p = social.profil;
  const m = moi(social, state);
  const rec = state.record || { w: 0, d: 0, l: 0 };
  const joues = (rec.w || 0) + (rec.d || 0) + (rec.l || 0);
  const ovr = Math.round(club.metrics(club.pickXI(state.formation)).ovr);
  if (edition) return <EditionProfil social={social} majSocial={majSocial} fermer={() => setEdition(false)} />;
  const suivis = Object.keys(social.suivis).filter((k) => social.suivis[k]).length;
  const badges = [
    ['Premier match', joues >= 1], ['Première victoire', (rec.w || 0) >= 1], ['Série de 3', (state.winStreak || 0) >= 3],
    ['Premier pack', (club.collection().have || 0) > 0], ['Club niveau 5', state.level >= 5], ['Relié à X', !!p.reseaux.x],
    ['5 posts', social.posts.length >= 5], ['3 personnes suivies', suivis >= 3]
  ];
  const etiquettes = [p.clubCoeur, p.poste, p.style, 'Directeur sportif'].filter(Boolean);
  return (
    <ScrollView contentContainerStyle={st.page}>
      <View style={st.profilTete}>
        <Fond type="stade" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar nom={m.nom} taille={66} anneau />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.profilNom} numberOfLines={2}>{m.nom}</Text>
            <Text style={T.aide}>@{m.pseudo}{p.ville ? ' · ' + p.ville : ''}</Text>
          </View>
        </View>
        {p.bio ? <Text style={[T.corps, { color: '#C4C4C4' }]}>{p.bio}</Text> : null}
        <View style={st.etiquettes}>{etiquettes.map((e) => <Text key={e} style={st.etiquette}>{String(e).toUpperCase()}</Text>)}</View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn label="Modifier le profil" onPress={() => setEdition(true)} style={{ flex: 1 }} />
          <BtnLien url={partageX('Je dirige ' + (state.clubName || 'mon club') + ' sur LinkFoot : division ' + state.division + ', note ' + ovr + '. Qui me suit ?')} label="Sur X ↗" tone="ghost" />
        </View>
      </View>

      <View style={st.statsLigne}>
        <Stat label="matchs" value={joues} sep />
        <Stat label="victoires" value={rec.w || 0} sep />
        <Stat label="série" value={state.winStreak || 0} sep />
        <Stat label="niveau" value={state.level} />
      </View>

      <View style={st.identite}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[T.surtitre, { color: C.accent }]}>IDENTITÉ FOOT</Text>
          <Text style={T.nom}>Directeur sportif · {state.clubName || 'FC TonPseudo'}</Text>
          <Text style={T.aide}>Division {state.division} · {state.formation}</Text>
        </View>
        <View style={{ alignItems: 'center' }}><Text style={st.noteGrand}>{ovr}</Text><Text style={st.noteL}>NOTE</Text></View>
      </View>

      <Card>
        <Row>
          <Text style={[T.surtitre, { flex: 1 }]}>MES RÉSEAUX</Text>
          <Pressable onPress={() => setEdition(true)}><Text style={st.lienTxt}>Relier</Text></Pressable>
        </Row>
        <Text style={T.aide}>Pour partager en un geste et que ton réseau te retrouve. LinkFoot ne publie jamais rien à ta place.</Text>
        {RESEAUX.map(([id, nom]) => {
          const h = p.reseaux[id], url = lienReseau(id, h);
          return (
            <View key={id} style={st.reseau}>
              <Text style={st.reseauNom}>{nom}</Text>
              {url ? <LienExterne url={url} label={'Voir ' + nom} style={st.reseauLien}>@{pseudoPropre(h)} ↗</LienExterne>
                : <Text style={st.reseauVide}>non relié</Text>}
            </View>
          );
        })}
      </Card>

      {p.postXEpingle && postXValide(p.postXEpingle) ? (
        <Card tint={C.accentLine}>
          <Text style={[T.surtitre, { color: C.accent }]}>POST X ÉPINGLÉ</Text>
          <Text style={T.aide} numberOfLines={1}>{p.postXEpingle.replace(/^https:\/\/(www\.)?/, '')}</Text>
          <BtnLien url={p.postXEpingle} label="Voir sur X ↗" small tone="ghost" style={{ alignSelf: 'flex-start' }} />
        </Card>
      ) : null}

      <Onglets items={[['posts', 'Posts · ' + social.posts.length], ['badges', 'Badges']]} valeur={onglet} onChange={setOnglet} />
      {onglet === 'posts' ? (
        social.posts.length
          ? social.posts.map((x) => <PostMoi key={x.id} p={x} m={m} social={social} majSocial={majSocial} />)
          : <Empty>Pas encore de post. Le bouton « + » en bas publie ton premier.</Empty>
      ) : (
        <View style={st.badges}>
          {badges.map(([nom, ok]) => (
            <View key={nom} style={[st.badge, ok && st.badgeOk]}>
              <Icone nom={ok ? 'star' : 'flag'} taille={20} couleur={ok ? C.accent : '#4A4A4A'} />
              <Text style={[st.badgeTxt, ok && { color: C.text }]}>{nom}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function EditionProfil({ social, majSocial, fermer }) {
  const [b, setB] = useState(() => JSON.parse(JSON.stringify(social.profil)));
  const champ = (k) => (v) => setB((x) => Object.assign({}, x, { [k]: v }));
  const reseau = (k) => (v) => setB((x) => Object.assign({}, x, { reseaux: Object.assign({}, x.reseaux, { [k]: v }) }));
  const epingleKo = b.postXEpingle && !postXValide(b.postXEpingle);
  const enregistrer = () => {
    majSocial((s) => {
      s.profil = Object.assign({}, b, { pseudo: pseudoPropre(b.pseudo), reseaux: {} });
      RESEAUX.forEach(([id]) => { const v = pseudoPropre(b.reseaux[id]); if (v) s.profil.reseaux[id] = v; });
      if (epingleKo) s.profil.postXEpingle = '';
    });
    fermer();
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={st.page} keyboardShouldPersistTaps="handled">
        <Text style={T.surtitre}>TON PROFIL</Text>
        <Text style={T.titre}>Modifier</Text>
        <Champ nom="Nom" valeur={b.nom} onChange={champ('nom')} placeholder="Ton nom" max={40} />
        <Champ nom="Pseudo" prefixe="@" valeur={b.pseudo} onChange={champ('pseudo')} placeholder="pseudo" max={30} />
        <Champ nom="Ville" valeur={b.ville} onChange={champ('ville')} placeholder="Ta ville" max={40} />
        <Champ nom="Club de cœur" valeur={b.clubCoeur} onChange={champ('clubCoeur')} placeholder="Ton club de cœur" max={40} />
        <Champ nom="Poste" valeur={b.poste} onChange={champ('poste')} placeholder="Ton poste (milieu, gardien…)" max={30} />
        <Champ nom="Style" valeur={b.style} onChange={champ('style')} placeholder="Ton style de jeu" max={30} />
        <Champ nom="Bio" valeur={b.bio} onChange={champ('bio')} placeholder="Deux lignes sur toi et le foot" multiline max={160} />
        <Text style={[T.surtitre, { marginTop: 8 }]}>MES RÉSEAUX</Text>
        {RESEAUX.map(([id, nom]) => (
          <View key={id} style={{ gap: 6 }}>
            <Text style={[T.aide, { color: C.dim }]}>{nom}</Text>
            <Champ nom={'Pseudo ' + nom} prefixe="@" valeur={b.reseaux[id] || ''} onChange={reseau(id)} placeholder={'ton pseudo ' + nom} max={30} />
          </View>
        ))}
        <Text style={[T.surtitre, { marginTop: 8 }]}>ÉPINGLER UN POST X</Text>
        <Champ nom="Post X épinglé" valeur={b.postXEpingle} onChange={champ('postXEpingle')} placeholder="https://x.com/compte/status/…" max={200} />
        {epingleKo ? <Text style={st.why}>Ce n’est pas l’adresse d’un post X (https://x.com/compte/status/numéro).</Text> : <Text style={T.aide}>Colle le lien d’un de tes posts : il s’affiche sur ton profil avec un lien vers X.</Text>}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          <Btn label="Annuler" tone="ghost" onPress={fermer} style={{ flex: 1 }} />
          <Btn label="Enregistrer" onPress={enregistrer} style={{ flex: 1 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------- publier (le bouton « + ») ----------
// La feuille de la maquette (« Create ») : un post, ton dernier match, un sondage, un post X à
// épingler. « Aussi sur X » ouvre X avec le même texte : c'est toi qui publies, depuis ton compte.
export function FeuilleCreer({ club, state, social, majSocial, fermer, go }) {
  const [mode, setMode] = useState(null);
  const [texte, setTexte] = useState('');
  const [aussiX, setAussiX] = useState(!!social.profil.reseaux.x);
  const [options, setOptions] = useState(['', '', '']);
  const [publie, setPublie] = useState(null);
  const [lien, setLien] = useState('');
  const nom = state.clubName || 'FC TonPseudo', kit = state.kit || {};
  const pm = club.prochainMatch();
  const lg = club.divisionCourante();
  const dernier = lg.day > 0 ? (club.resultatsDeJournee(lg.day, lg) || []).find((x) => x.moi) : null;
  const carteMatch = () => {
    const c = (n) => (n === nom ? { nom, c1: kit.c1, c2: kit.c2 } : (() => { const k = lg.clubs.find((x) => x.club === n) || {}; return { nom: n, c1: k.color }; })());
    if (dernier) return { type: 'match', titre: 'JOURNÉE ' + lg.day + ' · RÉSULTAT', dom: c(dernier.home), ext: c(dernier.away), score: dernier.hs + ' - ' + dernier.as };
    const moiC = { nom, c1: kit.c1, c2: kit.c2 }, eux = { nom: pm.opp.club, c1: pm.opp.color };
    return { type: 'match', titre: 'JOURNÉE ' + pm.day + ' · À VENIR', dom: pm.domicile ? moiC : eux, ext: pm.domicile ? eux : moiC };
  };
  const choisir = (m) => {
    setMode(m);
    if (m === 'match') setTexte(dernier ? 'Journée ' + lg.day + ' : ' + dernier.home + ' ' + dernier.hs + '-' + dernier.as + ' ' + dernier.away + '.' : 'Journée ' + pm.day + ' : ' + (pm.domicile ? nom + ' reçoit ' + pm.opp.club : nom + ' chez ' + pm.opp.club) + '. Pronos ?');
  };
  const envoyer = () => {
    const carte = mode === 'match' ? carteMatch() : mode === 'sondage' ? { type: 'sondage', question: texte, options: options.map((o) => o.trim()).filter(Boolean), votes: [] } : null;
    majSocial((s) => publier(s, { texte, carte, aussiX }));
    setPublie({ texte, aussiX });
  };
  const opts = options.map((o) => o.trim()).filter(Boolean);
  const pourquoi = !texte.trim() ? (mode === 'sondage' ? 'Écris la question' : 'Écris quelque chose') : mode === 'sondage' && opts.length < 2 ? 'Deux réponses au moins' : '';
  return (
    <View style={st.voile}>
      <Pressable accessibilityLabel="Fermer" style={StyleSheet.absoluteFill} onPress={fermer} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
        <View style={st.feuille}>
          <View style={st.poignee} />
          <View style={st.feuilleTete}>
            <View style={{ flex: 1 }}><Text style={T.surtitre}>PARTAGE TON FOOT</Text><Text style={[T.titre, { fontSize: 24 }]}>{publie ? 'C’est publié' : 'Créer'}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={fermer} style={st.fermer}><Icone nom="close" taille={18} /></Pressable>
          </View>

          {publie ? (
            <View style={{ gap: 12 }}>
              <Text style={T.corps}>Ton post est dans le fil de LinkFoot.</Text>
              {publie.aussiX ? <BtnLien url={partageX(publie.texte + ' #LinkFoot')} label="Ouvrir X pour le poster aussi ↗" /> : null}
              <Btn label="Voir le fil" tone="ghost" onPress={() => { fermer(); go('accueil'); }} />
            </View>
          ) : !mode ? (
            <View style={st.grille}>
              {[['post', 'comment', 'Post', 'Partage un moment'], ['match', 'match', 'Match', 'Ton dernier match'], ['sondage', 'users', 'Sondage', 'Demande à ton réseau'], ['epingle', 'pin', 'Post X', 'Épingle-le au profil']].map(([id, ic, t, d]) => (
                <Pressable key={id} accessibilityRole="button" onPress={() => choisir(id)} style={st.tuile}>
                  <View style={st.tuileIcone}><Icone nom={ic} taille={19} couleur={C.accent} /></View>
                  <Text style={st.tuileTitre}>{t}</Text>
                  <Text style={st.tuileTxt}>{d}</Text>
                </Pressable>
              ))}
            </View>
          ) : mode === 'epingle' ? (
            <View style={{ gap: 10 }}>
              <Champ nom="Lien du post X" valeur={lien} onChange={setLien} placeholder="https://x.com/compte/status/…" max={200} />
              {lien && !postXValide(lien) ? <Text style={st.why}>Ce n’est pas l’adresse d’un post X.</Text> : <Text style={T.aide}>Il s’affiche sur ton profil, avec un lien vers X.</Text>}
              <Btn label="Épingler" why={postXValide(lien) ? '' : 'Colle le lien d’un post X'} onPress={() => { majSocial((s) => { s.profil.postXEpingle = lien.trim(); }); fermer(); go('profil'); }} />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Champ nom="Texte du post" valeur={texte} onChange={setTexte} placeholder={mode === 'sondage' ? 'Ta question' : 'Quoi de neuf ?'} multiline max={280} />
              {mode === 'match' ? <CarteDansPost carte={carteMatch()} /> : null}
              {mode === 'sondage' ? options.map((o, i) => (
                <Champ key={i} nom={'Réponse ' + (i + 1)} valeur={o} onChange={(v) => setOptions((x) => x.map((y, j) => (j === i ? v : y)))} placeholder={'Réponse ' + (i + 1) + (i === 2 ? ' (facultatif)' : '')} max={40} />
              )) : null}
              <Row style={{ justifyContent: 'space-between' }}>
                <Interrupteur actif={aussiX} onChange={setAussiX} label="Aussi sur X" />
                <Text style={T.aide}>{texte.length} / 280</Text>
              </Row>
              <Btn label="Publier le post" why={pourquoi} onPress={envoyer} />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ---------- le salon du match ----------
// Pendant le match : réagir, pronostiquer, écrire, partager le score sur X. Les messages des
// autres supporters arriveront avec le mode en ligne ; ici, ce sont les tiens.
const REACTIONS = ['🔥', '⚽', '😱', '😂', '👏'];
export function SalonMatch({ club, vue, social, majSocial }) {
  const [msg, setMsg] = useState('');
  const nom = club.state.clubName || 'FC TonPseudo';
  const cle = (vue.opp.club || '') + '|' + club.prochainMatch().day + '|' + club.state.division;
  const salon = social.salons[cle] || { reactions: {}, vote: null, messages: [] };
  const maj = (fn) => majSocial((s) => {
    const x = s.salons[cle] || { reactions: {}, vote: null, messages: [] };
    fn(x); s.salons[cle] = x;
    const cles = Object.keys(s.salons); if (cles.length > 12) delete s.salons[cles[0]];
  });
  const issues = [nom, 'Nul', vue.opp.club];
  const score = nom + ' ' + vue.score[0] + '-' + vue.score[1] + ' ' + vue.opp.club + ' (' + vue.clock + ')';
  return (
    <Card>
      <Row>
        <Text style={[T.surtitre, { flex: 1 }]}>SALON DU MATCH</Text>
        <Pastille ton="direct" point>EN DIRECT</Pastille>
      </Row>
      <View style={st.reactions}>
        <Text style={[T.aide, { marginRight: 'auto' }]}>Réagis</Text>
        {REACTIONS.map((r) => (
          <Pressable key={r} accessibilityRole="button" accessibilityLabel={'Réaction ' + r} onPress={() => maj((x) => { x.reactions[r] = (x.reactions[r] || 0) + 1; })} style={st.reaction}>
            <Text style={{ fontSize: 15 }}>{r}</Text>
            {salon.reactions[r] ? <Text style={st.reactionN}>{salon.reactions[r]}</Text> : null}
          </Pressable>
        ))}
      </View>
      <Text style={[T.aide, { color: C.dim }]}>Qui va gagner ?</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {issues.map((o, i) => (
          <Pressable key={i} onPress={() => maj((x) => { x.vote = i; })} style={[st.issue, salon.vote === i && st.issueOn]}>
            <Text style={[st.issueTxt, salon.vote === i && { color: '#050505' }]} numberOfLines={1}>{o}</Text>
          </Pressable>
        ))}
      </View>
      {salon.messages.slice(-4).map((x, i) => (
        <View key={i} style={st.message}>
          <Text style={st.messageMin}>{x.minute}</Text>
          <Text style={[T.corps, { flex: 1 }]}><Text style={{ fontWeight: '700' }}>Toi </Text>{x.texte}</Text>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Champ nom="Message du salon" valeur={msg} onChange={setMsg} placeholder="Ton message" max={140} style={{ flex: 1 }} />
        <Btn small label="Envoyer" why={msg.trim() ? '' : ' '} onPress={() => { const t = msg.trim(); maj((x) => { x.messages.push({ texte: t, minute: vue.clock }); x.messages = x.messages.slice(-30); }); setMsg(''); }} />
      </View>
      <Text style={T.aide}>Les messages des autres supporters arriveront avec le mode en ligne.</Text>
      <BtnLien url={partageX(score + ' en direct sur LinkFoot #LinkFoot')} label="Partager le score sur X ↗" small tone="ghost" style={{ alignSelf: 'flex-start' }} />
    </Card>
  );
}

// ---------- après le match ----------
export function PartageResultat({ club, state, res, social, majSocial, go }) {
  const [potm, setPotm] = useState(null);
  const [fait, setFait] = useState(false);
  const nom = state.clubName || 'FC TonPseudo', kit = state.kit || {};
  const adv = (res.opp && res.opp.club) || 'l’adversaire';
  const texte = nom + ' ' + res.score[0] + '-' + res.score[1] + ' ' + adv + (res.amical ? ' (amical)' : ' · division ' + state.division) + (potm != null ? '. Homme du match : ' + potm : '') + '.';
  const xi = club.pickXI(state.formation).slice(0, 11);
  return (
    <View style={{ gap: 10 }}>
      <Text style={T.surtitre}>HOMME DU MATCH · TON VOTE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {xi.map((p) => (
          <Pressable key={p.slot || p.id} onPress={() => setPotm(p.name)} style={[st.puce, potm === p.name && st.issueOn]}>
            <Text style={[st.issueTxt, potm === p.name && { color: '#050505' }]} numberOfLines={1}>{p.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn small label={fait ? 'Dans le fil' : 'Publier dans le fil'} why={fait ? ' ' : ''}
          onPress={() => {
            const c = (n, k) => ({ nom: n, c1: k.c1, c2: k.c2 });
            majSocial((s) => publier(s, { texte, carte: { type: 'match', titre: res.amical ? 'MATCH AMICAL' : 'CHAMPIONNAT · RÉSULTAT', dom: c(nom, kit), ext: { nom: adv, c1: res.opp && res.opp.color }, score: res.score[0] + ' - ' + res.score[1] }, aussiX: false }));
            setFait(true);
          }} />
        <BtnLien url={partageX(texte + ' #LinkFoot')} label="Partager sur X ↗" small tone="ghost" />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  page: { padding: S.pad, gap: S.gap, paddingBottom: 56 },
  accueil: { paddingBottom: 56 },
  section: { paddingHorizontal: S.pad, paddingTop: 30, gap: 14 },
  bloc: { gap: 12, marginTop: 6 },
  sep: { borderBottomWidth: 1, borderBottomColor: C.line },
  why: { fontFamily: F.texte, color: C.amber, fontSize: 11, fontWeight: '700' },
  // héros
  heros: { height: 440, marginHorizontal: 12, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden', backgroundColor: '#111111' },
  herosImage: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  herosTexte: { position: 'absolute', left: 22, right: 22, bottom: 26 },
  kicker: { fontFamily: F.texte, color: C.accent, fontSize: 9.5, fontWeight: '700', letterSpacing: 1.8 },
  herosTitre: { fontFamily: F.titre, color: C.text, fontSize: 42, fontWeight: '800', lineHeight: 39, letterSpacing: -2.8, marginTop: 12, marginBottom: 22 },
  // match
  carteMatch: { borderRadius: S.radius, borderWidth: 1, borderColor: C.line, overflow: 'hidden', padding: 14, gap: 4 },
  cmHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cmLieu: { fontFamily: F.texte, color: '#686E69', fontSize: 9.5, letterSpacing: 1.1 },
  cmLigne: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 4 },
  cmEquipe: { flex: 1, alignItems: 'center', gap: 6 },
  cmNom: { fontFamily: F.texte, color: C.text, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  cmCentre: { width: 84, textAlign: 'center', fontFamily: F.titre, color: C.text, fontSize: 24, fontWeight: '800', letterSpacing: -1 },
  // fil
  composer: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: S.radius, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, padding: 10, paddingRight: 12 },
  composerTxt: { flex: 1, fontFamily: F.texte, color: '#777777', fontSize: 13 },
  composerBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  post: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14, gap: 10 },
  postTete: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  journalRond: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#171B21', alignItems: 'center', justifyContent: 'center' },
  postNom: { fontFamily: F.texte, color: C.text, fontSize: 13.5, fontWeight: '700' },
  postSous: { fontFamily: F.texte, color: C.faint, fontSize: 11, marginTop: 2 },
  postTexte: { fontFamily: F.texte, color: '#D2D2D2', fontSize: 13.5, lineHeight: 20 },
  postCarte: { borderRadius: 15, overflow: 'hidden', padding: 12, gap: 4, borderWidth: 1, borderColor: C.line },
  postTag: { marginLeft: 'auto', fontFamily: F.texte, color: '#666666', fontSize: 9.5, letterSpacing: 0.8 },
  actions: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6 },
  actionTxt: { fontFamily: F.texte, color: '#8E8E8E', fontSize: 11.5 },
  actionLien: { fontFamily: F.texte, color: '#8E8E8E', fontSize: 11.5, textDecorationLine: 'none' },
  sondage: { gap: 6 },
  sondageLigne: { minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: C.line, justifyContent: 'center', paddingHorizontal: 12, overflow: 'hidden' },
  sondageFond: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(199,255,50,0.12)' },
  sondageTxt: { fontFamily: F.texte, color: C.text, fontSize: 12.5 },
  sondagePct: { position: 'absolute', right: 12, fontFamily: F.titre, color: C.dim, fontSize: 12.5, fontWeight: '800' },
  // personnes, événements, communautés
  personne: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, padding: 11 },
  evenement: { flexDirection: 'row', gap: 14, borderRadius: S.radius, borderWidth: 1, borderColor: C.line, overflow: 'hidden', padding: 14 },
  evDate: { width: 48, height: 54, borderRadius: 10, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  evJour: { fontFamily: F.titre, color: '#0B0E08', fontSize: 20, fontWeight: '800', lineHeight: 22 },
  evMois: { fontFamily: F.texte, color: '#0B0E08', fontSize: 9, fontWeight: '700' },
  evNiveau: { fontFamily: F.texte, color: C.accent, fontSize: 9.5, fontWeight: '700', letterSpacing: 1.2 },
  evTitre: { fontFamily: F.titre, color: C.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.7 },
  communaute: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 13, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, padding: 9 },
  comVisuel: { width: 50, height: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333333' },
  comSigle: { fontFamily: F.titre, fontSize: 14, fontWeight: '800' },
  // explorer
  recherche: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 13, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingLeft: 12 },
  rechercheChamp: { flex: 1, borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 6 },
  filtre: { paddingHorizontal: 14, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  filtreOn: { backgroundColor: C.text, borderColor: C.text },
  filtreTxt: { fontFamily: F.texte, color: '#8A8A8A', fontSize: 12, fontWeight: '600' },
  filtreTxtOn: { color: '#050505', fontWeight: '700' },
  alaune: { height: 360, borderRadius: 20, overflow: 'hidden', padding: 18, borderWidth: 1, borderColor: C.line },
  alauneLabel: { fontFamily: F.texte, color: C.accent, fontSize: 9.5, fontWeight: '700', letterSpacing: 1.7 },
  alaunePoste: { fontFamily: F.texte, color: '#A0A0A0', fontSize: 10, letterSpacing: 1.4 },
  alauneNom: { fontFamily: F.titre, color: C.text, fontSize: 38, fontWeight: '800', lineHeight: 35, letterSpacing: -2.4 },
  alauneStat: { fontFamily: F.titre, color: C.text, fontSize: 18, fontWeight: '800' },
  alauneStatL: { fontFamily: F.texte, color: '#797979', fontSize: 8.5, fontWeight: '700', letterSpacing: 1 },
  alauneCta: { position: 'absolute', right: 16, bottom: 20, width: 46, height: 46, borderRadius: 23, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  ligneRes: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  noteCase: { width: 42, height: 42, borderRadius: 11, backgroundColor: C.cardAlt, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  noteCaseTxt: { fontFamily: F.titre, color: C.text, fontSize: 17, fontWeight: '800' },
  lieuIcone: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' },
  carte: { height: 190, borderRadius: S.radius, borderWidth: 1, borderColor: C.line, backgroundColor: '#111613', overflow: 'hidden' },
  carteTrait: { position: 'absolute', backgroundColor: 'rgba(119,129,119,0.16)' },
  riviere: { position: 'absolute', left: 150, top: -40, width: 56, height: 280, backgroundColor: '#18231C', borderWidth: 1, borderColor: '#26362B', transform: [{ rotate: '60deg' }] },
  repere: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 6, borderColor: 'rgba(199,255,50,0.16)' },
  carteLegende: { position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(10,13,11,0.85)', padding: 10 },
  // profil
  profilTete: { borderRadius: 20, overflow: 'hidden', padding: 16, gap: 12, borderWidth: 1, borderColor: C.line },
  profilNom: { fontFamily: F.titre, color: C.text, fontSize: 26, fontWeight: '800', letterSpacing: -1.2, lineHeight: 28 },
  etiquettes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  etiquette: { fontFamily: F.texte, color: '#909090', fontSize: 9.5, fontWeight: '700', letterSpacing: 0.8, borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' },
  statsLigne: { flexDirection: 'row', paddingVertical: 8 },
  identite: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, backgroundColor: '#121512' },
  noteGrand: { fontFamily: F.titre, color: C.accent, fontSize: 30, fontWeight: '800', letterSpacing: -1.2 },
  noteL: { fontFamily: F.texte, color: '#666666', fontSize: 8.5, letterSpacing: 1.2 },
  lienTxt: { fontFamily: F.texte, color: C.accent, fontSize: 12.5, fontWeight: '700' },
  reseau: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.lineSoft },
  reseauNom: { fontFamily: F.texte, color: C.text, fontSize: 13.5, fontWeight: '700' },
  reseauLien: { fontFamily: F.texte, color: C.accent, fontSize: 13, fontWeight: '700', textDecorationLine: 'none' },
  reseauVide: { fontFamily: F.texte, color: '#5E5E5E', fontSize: 12.5 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { width: '48.5%', flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, padding: 12 },
  badgeOk: { borderColor: C.accentLine, backgroundColor: C.accentFill },
  badgeTxt: { flex: 1, fontFamily: F.texte, color: '#5E5E5E', fontSize: 12, fontWeight: '700' },
  // la feuille « Publier »
  voile: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.66)', justifyContent: 'flex-end', alignItems: 'stretch' },
  feuille: { backgroundColor: '#111111', borderTopLeftRadius: 27, borderTopRightRadius: 27, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28, gap: 16 },
  poignee: { width: 36, height: 3, borderRadius: 2, backgroundColor: '#444444', alignSelf: 'center' },
  feuilleTete: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fermer: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.055)', alignItems: 'center', justifyContent: 'center' },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tuile: { flexGrow: 1, flexBasis: '45%', minHeight: 100, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: '#171717', padding: 12, gap: 4 },
  tuileIcone: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(199,255,50,0.07)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tuileTitre: { fontFamily: F.texte, color: C.text, fontSize: 13.5, fontWeight: '700' },
  tuileTxt: { fontFamily: F.texte, color: '#6A6A6A', fontSize: 11 },
  // salon
  reactions: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 26, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingVertical: 7, paddingLeft: 14, paddingRight: 8 },
  reaction: { minWidth: 34, height: 34, borderRadius: 17, backgroundColor: '#202020', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3, paddingHorizontal: 7 },
  reactionN: { fontFamily: F.texte, color: C.accent, fontSize: 10.5, fontWeight: '700' },
  issue: { flex: 1, minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  issueOn: { backgroundColor: C.text, borderColor: C.text },
  puce: { flexShrink: 0, minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  issueTxt: { fontFamily: F.texte, color: C.dim, fontSize: 11.5, fontWeight: '600' },
  message: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  messageMin: { width: 36, fontFamily: F.texte, color: '#6A6A6A', fontSize: 10.5, fontWeight: '700', paddingTop: 2 }
});
