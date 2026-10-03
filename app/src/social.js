// Le réseau social de LinkFoot sur l'appareil : ton profil, tes réseaux (X, TikTok, YouTube,
// Instagram, Twitch), tes posts, ce que tu suis, tes réactions pendant les matchs. Rangé à part
// de la partie, dans le stockage de l'appareil : le moteur du jeu ne le lit pas et n'en dépend
// pas. Le jour où le serveur en ligne est branché, il prendra le relais (les autres personnes,
// leurs posts, les communautés).
//
// X, sans clé : LinkFoot ouvre X avec le post déjà écrit (« Aussi sur X », « Partager sur X ») et
// c'est toi qui publies, depuis ton compte. Se connecter avec X ou afficher des posts X dans l'app
// demanderait une application développeur X et un serveur (l'API X est payante) : pas branché.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';

const CLE = 'linkfoot.social.v1';

// [identifiant, nom, adresse du profil]
export const RESEAUX = [
  ['x', 'X', (p) => 'https://x.com/' + p],
  ['tiktok', 'TikTok', (p) => 'https://www.tiktok.com/@' + p],
  ['youtube', 'YouTube', (p) => 'https://www.youtube.com/@' + p],
  ['instagram', 'Instagram', (p) => 'https://www.instagram.com/' + p],
  ['twitch', 'Twitch', (p) => 'https://www.twitch.tv/' + p]
];

export const pseudoPropre = (v) => String(v || '').trim().replace(/^@+/, '').replace(/[^A-Za-z0-9_.]/g, '').slice(0, 30);

export const lienReseau = (id, pseudo) => {
  const r = RESEAUX.find((x) => x[0] === id), p = pseudoPropre(pseudo);
  return r && p ? r[2](p) : null;
};

// la page de X qui ouvre un post prêt à publier (l'intention web de X : ni clé ni connexion)
export const partageX = (texte) => 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(String(texte || '').slice(0, 270));

// l'adresse d'un post X : https://x.com/<compte>/status/<numéro>
export const postXValide = (u) => /^https:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/\d{5,25}(\?\S*)?$/.test(String(u || '').trim());

export const DEPART = {
  profil: { nom: '', pseudo: '', ville: '', clubCoeur: '', poste: '', style: '', bio: '', reseaux: {}, postXEpingle: '' },
  posts: [], aimes: {}, suivis: {}, communautes: {}, evenements: {}, salons: {}
};
const copie = (o) => JSON.parse(JSON.stringify(o));
const complet = (e) => {
  const s = Object.assign(copie(DEPART), e || {});
  s.profil = Object.assign(copie(DEPART.profil), (e && e.profil) || {});
  s.profil.reseaux = Object.assign({}, s.profil.reseaux);
  return s;
};

// Un seul état social pour toute l'app (App.js le tient et le passe aux écrans). Chaque
// changement est enregistré un peu après, comme la partie.
let minuteur = null;
export function useSocial() {
  const [etat, setEtat] = useState(null);
  const vivant = useRef(true);
  useEffect(() => {
    AsyncStorage.getItem(CLE).then((r) => (r ? JSON.parse(r) : null)).catch(() => null)
      .then((e) => { if (vivant.current) setEtat(complet(e)); });
    return () => { vivant.current = false; };
  }, []);
  const maj = (fn) => setEtat((avant) => {
    const s = complet(avant);
    fn(s);
    clearTimeout(minuteur);
    minuteur = setTimeout(() => { AsyncStorage.setItem(CLE, JSON.stringify(s)).catch(() => {}); }, 400);
    return s;
  });
  return [etat || complet(null), maj, !!etat];
}

// publier un post (texte, et éventuellement une carte : un match, un sondage)
export function publier(s, { texte, carte, aussiX }) {
  s.posts.unshift({ id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), t: Date.now(), texte: String(texte || '').trim(), carte: carte || null, aussiX: !!aussiX });
  s.posts = s.posts.slice(0, 200);
}

export function ilYa(t) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'à l’instant';
  if (m < 60) return 'il y a ' + m + ' min';
  if (m < 1440) return 'il y a ' + Math.round(m / 60) + ' h';
  return 'il y a ' + Math.round(m / 1440) + ' j';
}

// le nom qu'on montre pour soi : celui du profil, sinon celui du club
export const moi = (s, state) => {
  const p = s.profil || {};
  const pseudo = pseudoPropre(p.pseudo) || pseudoPropre((state.clubName || 'TonPseudo').replace(/^FC\s+/i, '')) || 'TonPseudo';
  return { nom: p.nom || state.clubName || 'FC TonPseudo', pseudo };
};

// Ce que le jeu raconte lui-même, en posts du compte « LinkFoot Journal » : le résultat de ton
// dernier match, la journée de la division, le classement, ton prochain match. Rien d'inventé :
// tout vient de la partie.
export function postsDuJeu(club, state) {
  const out = [];
  const lg = club.divisionCourante();
  const pm = club.prochainMatch();
  const nom = state.clubName || 'FC TonPseudo';
  if (state.lastGain) out.push({ id: 'j-gain', texte: state.lastGain, quand: 'ton dernier match', club: nom });
  if (lg.day > 0) {
    const res = club.resultatsDeJournee(lg.day, lg) || [];
    if (res.length) out.push({ id: 'j-res', texte: 'Journée ' + lg.day + ' de la division ' + state.division + ' : ' + res.map((x) => x.home + ' ' + x.hs + '-' + x.as + ' ' + x.away).join(' · ') + '.', quand: 'journée ' + lg.day, club: 'Division ' + state.division });
  }
  const tbl = club.table(lg), moiLigne = tbl.find((r) => r.me);
  if (lg.day === 0) out.push({ id: 'j-cla', texte: club.situationDivision(lg), quand: 'saison ' + lg.saison, club: 'Division ' + state.division });
  else if (tbl.length) {
    out.push({ id: 'j-cla', texte: tbl[0].club + ' mène la division ' + state.division + ' avec ' + tbl[0].pts + ' point' + (tbl[0].pts > 1 ? 's' : '') + '. ' + nom + ' est ' + (moiLigne.rank === 1 ? '1er' : moiLigne.rank + 'e') + '.', quand: 'classement', club: 'Division ' + state.division });
  }
  out.push({ id: 'j-next', texte: 'Journée ' + pm.day + ' : ' + (pm.domicile ? nom + ' reçoit ' + pm.opp.club : nom + ' se déplace chez ' + pm.opp.club) + ' (' + pm.opp.styleName + ', note ' + pm.opp.ovr + ').', quand: 'à venir', club: nom });
  return out;
}

// Les matchs de la journée en cours, dans la division : le tien et les deux autres (de vrais
// matchs du jeu ; les deux autres sont simulés d'après la note et le style des clubs).
export function matchsDeLaJournee(club, state) {
  const lg = club.divisionCourante();
  const jour = lg.days[lg.day] || [];
  const nom = state.clubName || 'FC TonPseudo', kit = state.kit || {};
  const qui = (id) => (id === 'moi' ? { nom, c1: kit.c1, c2: kit.c2, moi: true } : (() => { const c = lg.clubs.find((x) => x.id === id) || {}; return { nom: c.club || id, c1: c.color, ovr: c.ovr }; })());
  return jour.map((m) => ({ dom: qui(m.home), ext: qui(m.away), moi: m.home === 'moi' || m.away === 'moi', jour: lg.day + 1, total: lg.days.length }));
}
