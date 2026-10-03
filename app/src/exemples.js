// Les exemples du réseau social : des personnes, des communautés, des événements et des posts
// inventés, pour montrer à quoi ressemble LinkFoot avant que le serveur en ligne n'y mette de vrais
// utilisateurs. Chacun porte la marque EXEMPLE à l'écran. Aucun n'est une vraie personne, aucun
// lieu ni événement n'existe ; les clubs cités sont ceux de la division du jeu.
export const PERSONNES = [
  { id: 'lina', nom: 'Lina Moreau', pseudo: 'lina_virage', ville: 'Paris 18e', club: 'Kop Bleu FC', role: 'Supportrice', identite: 'Ultra du virage', couleur: '#2F8FE0', communs: 4 },
  { id: 'noe', nom: 'Noé Diallo', pseudo: 'noe10', ville: 'Saint-Denis', club: 'Auteuil United', role: 'Attaquant', identite: 'Finisseur', couleur: '#C7FF32', communs: 2 },
  { id: 'yanis', nom: 'Yanis Kerbal', pseudo: 'yanis_street', ville: 'Montreuil', club: 'Street Foot Paris', role: 'Milieu', identite: 'Meneur créatif', couleur: '#FF8A65', communs: 3 },
  { id: 'sarah', nom: 'Sarah Delmas', pseudo: 'sarah_gk', ville: 'Lyon 7e', club: 'Olympique Vieux-Port', role: 'Gardienne', identite: 'Mur sur sa ligne', couleur: '#B98CFF', communs: 1 },
  { id: 'malik', nom: 'Malik Touré', pseudo: 'malik_five', ville: 'Paris 11e', club: 'Duel FC', role: 'Défenseur', identite: 'Organise le five du samedi', couleur: '#F2C66B', communs: 5 },
  { id: 'nico', nom: 'Nico Débrief', pseudo: 'nico_debrief', ville: 'Lille', club: 'Calcio Brindille', role: 'Créateur', identite: 'Lives d’après-match', couleur: '#5CC8FF', communs: 6, createur: true, reseaux: ['Twitch', 'YouTube', 'X'] }
];

export const COMMUNAUTES = [
  { id: 'paris', nom: 'Paris Football', sigle: 'PF', membres: 12800, pres: 346, desc: 'Matchs, culture et gens du foot en Île-de-France.', couleur: '#C7FF32' },
  { id: 'street', nom: 'Street Foot Paris', sigle: 'SFP', membres: 8400, pres: 120, desc: 'Le foot de rue, les cages de quartier, les tournois du dimanche.', couleur: '#232823' },
  { id: 'feminin', nom: 'Foot féminin', sigle: 'FF', membres: 6900, pres: 88, desc: 'Joueuses, supportrices et clubs : tout le foot féminin, du district à la D1.', couleur: '#B98CFF' },
  { id: 'gardiens', nom: 'Le club des gardiens', sigle: 'GB', membres: 2300, pres: 31, desc: 'Plongeons, relances, séances spécifiques : entre gardiens.', couleur: '#5CC8FF' },
  { id: 'kopbleu', nom: 'Kop Bleu FC · supporters', sigle: 'KB', membres: 1200, pres: 64, desc: 'Les supporters du Kop Bleu FC, adversaire de ta division.', couleur: '#5CC8FF' },
  { id: 'dubai', nom: 'Football Dubaï', sigle: 'FD', membres: 3100, pres: 0, desc: 'Les matchs du soir et les terrains de Dubaï.', couleur: '#F2C66B' }
];

export const EVENEMENTS = [
  { id: 'five', titre: '5v5 du samedi', lieu: 'Five · Paris 18e', jour: 'SAM', date: '09', mois: 'NOV', heure: '19:00 – 21:00', inscrits: 24, places: 30, niveau: 'Intermédiaire', orga: 'malik' },
  { id: 'tournoi', titre: 'Tournoi de quartier', lieu: 'Terrain municipal · Montreuil', jour: 'DIM', date: '10', mois: 'NOV', heure: '14:00 – 18:00', inscrits: 48, places: 64, niveau: 'Tous niveaux', orga: 'yanis' },
  { id: 'gardiens', titre: 'Séance gardiens', lieu: 'Gymnase · Lyon 7e', jour: 'MER', date: '13', mois: 'NOV', heure: '18:30 – 20:00', inscrits: 9, places: 12, niveau: 'Confirmé', orga: 'sarah' }
];

export const LIEUX = [
  { id: 'l1', nom: 'Five Paris 18e', type: 'Terrain', distance: '1,2 km' },
  { id: 'l2', nom: 'City stade des Poissonniers', type: 'Terrain', distance: '1,8 km' },
  { id: 'l3', nom: 'Le Comptoir du match', type: 'Bar sportif', distance: '2,4 km' }
];

// des posts d'exemple : du texte, parfois une carte (un match du jeu, un sondage)
export const POSTS = [
  { id: 'e1', qui: 'lina', quand: 'il y a 2 h', texte: 'Ambiance de fou au virage pour Kop Bleu – Auteuil. On remet ça samedi ?', aimes: 248, commentaires: 32, partages: 12, aussiX: true, tag: '#KOPBLEU' },
  { id: 'e2', qui: 'nico', quand: 'il y a 3 h', texte: 'Ce soir 21:00, je débriefe toute la journée de la division en direct. Vos pronos en commentaire.', aimes: 1240, commentaires: 210, partages: 88, live: true, tag: 'LIVE' },
  { id: 'e3', qui: 'yanis', quand: 'il y a 5 h', texte: 'Sur un terrain de five, tu joues avec quel système ?', aimes: 96, commentaires: 41, partages: 3,
    sondage: { question: 'Ton système à cinq ?', options: ['2-2', '1-2-1', '2-1-1'], votes: [44, 38, 18] } },
  { id: 'e4', qui: 'noe', quand: 'hier', texte: 'Doublé ce soir au five. Le ballon ne voulait plus me quitter.', aimes: 412, commentaires: 27, partages: 9, tag: '#STREETFOOT' }
];

export const personne = (id) => PERSONNES.find((p) => p.id === id);
