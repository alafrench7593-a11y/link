"""Catalogue IRLY : univers, campagnes, accroches et blocs de script.

Tout le texte est écrit à la main pour sonner comme une vraie pub, pas comme une IA.
Règles : aucun témoignage inventé, aucun chiffre d'utilisateurs, aucun partenaire cité.
Chaque bloc suit la structure imposée : accroche, problème, situation, IRLY,
fonctionnalité concrète, appel à l'action.
"""

UNIVERSES = {
    "mixte": {
        "label": "IRLY Mixte",
        "topics": ["Rencontres amicales", "Activités", "Communautés", "Sorties",
                   "Nouveaux arrivants à Dubaï"],
        "accent": "#FF5A3C",
    },
    "girl": {
        "label": "IRLY Girl",
        "topics": ["Communautés féminines", "Girl Trip", "Girl Sport", "Girl Expat",
                   "Girl Networking", "Activités entre femmes"],
        "accent": "#FF6FA8",
    },
    "network": {
        "label": "IRLY Network",
        "topics": ["Networking professionnel", "Entrepreneurs", "Freelances",
                   "Créateurs de startups", "Rencontres professionnelles", "Événements"],
        "accent": "#4C7DFF",
    },
    "sport": {
        "label": "IRLY Sport",
        "topics": ["Running clubs", "Padel", "Football", "Fitness", "Activités sportives"],
        "accent": "#2FD27A",
    },
    "activites": {
        "label": "IRLY Activités",
        "topics": ["Restaurants", "Beach clubs", "Zoo", "Sorties", "Excursions",
                   "Week-ends", "Découverte de Dubaï"],
        "accent": "#FFB020",
    },
}

TONES = {
    "emotionnel": "Émotionnel",
    "dynamique": "Dynamique",
    "naturel": "Naturel",
    "cinematique": "Cinématique",
    "publicitaire": "Publicitaire",
}

# Les trois variantes demandées par campagne, chacune mappée sur un ton de voix.
VARIANTS = {
    "emotionnelle": "emotionnel",
    "dynamique": "dynamique",
    "explicative": "naturel",
}

DURATIONS = (15, 30, 45, 60)
LANGUAGES = {"fr": "Français", "en": "English", "es": "Español", "de": "Deutsch", "it": "Italiano"}
# Langues couvertes par les textes écrits à la main. Les autres passent par un LLM.
TEMPLATE_LANGUAGES = ("fr", "en")

FORMATS = {
    "tiktok": {"label": "TikTok 9:16", "size": (1080, 1920)},
    "reels": {"label": "Instagram Reels 9:16", "size": (1080, 1920)},
    "shorts": {"label": "YouTube Shorts 9:16", "size": (1080, 1920)},
    "horizontal": {"label": "Horizontal 16:9", "size": (1920, 1080)},
}

DEFAULT_CTA = {
    "fr": "IRLY arrive bientôt. Suis @irlyofficial pour ne pas rater le lancement.",
    "en": "IRLY is coming soon. Follow @irlyofficial for launch updates.",
}

SHORT_CTA = {
    "fr": "IRLY arrive bientôt. Suis @irlyofficial.",
    "en": "IRLY is coming soon. Follow @irlyofficial.",
}

# Chaque campagne : univers, pitch interne, et blocs de texte par langue.
# Les listes contiennent des alternatives ; le générateur en choisit une par variante
# pour éviter deux vidéos identiques. "extra_*" sert à allonger les formats 45 et 60 s.
CAMPAIGNS = {
    "solitude": {
        "label": "Campagne 1 — Solitude",
        "universe": "mixte",
        "brief": "Une personne vient d'arriver à Dubaï et cherche à rencontrer du monde.",
        "fr": {
            "hook": {
                "emotionnel": ["Tu vis à Dubaï… mais tu ne connais presque personne ?",
                               "Nouvelle ville, nouvel appart… et personne à appeler le vendredi soir."],
                "dynamique": ["Arrivé à Dubaï il y a trois mois et toujours pas de crew ?",
                              "Dubaï, c'est incroyable. Seul, beaucoup moins."],
                "naturel": ["Tu viens d'arriver à Dubaï et tu cherches à rencontrer du monde ?",
                            "Rencontrer des gens à Dubaï, ça ne se fait pas tout seul."],
            },
            "problem": ["Entre le travail et le quotidien, ce n'est pas toujours évident de rencontrer du monde.",
                        "Le boulot, l'appart, la salle… et les week-ends passent sans que tu voies personne."],
            "situation": ["Tu as envie d'un brunch, d'un padel ou d'une soirée à la plage, mais pas tout seul.",
                          "Tu regardes les stories des autres et tu te dis : moi aussi, j'aimerais être là."],
            "irly": ["Avec IRLY, découvre des communautés près de chez toi.",
                     "IRLY, c'est l'app pour rencontrer du monde dans la vraie vie, à Dubaï."],
            "feature": ["Rejoins une activité en un clic, ou organise toi-même une sortie.",
                        "Padel, running, brunch, plage : choisis une activité et retrouve d'autres personnes sur place."],
            "extra_situation": ["Les premières semaines, on se dit que ça viendra. Puis les mois passent."],
            "extra_feature": ["Tu vois qui participe, tu rejoins le groupe, et tu y vas. Aussi simple que ça."],
            "close": ["Parce que vivre à Dubaï, c'est encore mieux à plusieurs."],
        },
        "en": {
            "hook": {
                "emotionnel": ["You live in Dubai… but you barely know anyone?"],
                "dynamique": ["Three months in Dubai and still no crew?"],
                "naturel": ["Just moved to Dubai and looking to meet people?"],
            },
            "problem": ["Between work and daily life, meeting new people isn't easy."],
            "situation": ["You want a brunch, a padel game or a beach day, just not alone."],
            "irly": ["With IRLY, discover communities around you."],
            "feature": ["Join an activity in one tap, or host your own meetup."],
            "extra_situation": ["The first weeks, you tell yourself it'll happen. Then months go by."],
            "extra_feature": ["See who's going, join the group, show up. That simple."],
            "close": ["Because Dubai is better together."],
        },
    },
    "girl": {
        "label": "Campagne 2 — IRLY Girl",
        "universe": "girl",
        "brief": "Communautés féminines et activités entre femmes.",
        "fr": {
            "hook": {
                "emotionnel": ["Et si tu trouvais enfin ta bande de filles à Dubaï ?"],
                "dynamique": ["Girl trip, padel, brunch : il te manque juste les copines ?"],
                "naturel": ["Tu cherches des femmes avec qui sortir à Dubaï ?"],
            },
            "problem": ["Quand on arrive seule, se faire des amies prend du temps."],
            "situation": ["Tu voudrais une sortie entre filles, sans attendre que ça arrive par hasard."],
            "irly": ["IRLY Girl, c'est l'espace d'IRLY pensé pour les femmes."],
            "feature": ["Rejoins des communautés féminines : sport, voyages, expat, networking."],
            "extra_situation": ["Un cours de yoga, un week-end à Oman, un dîner : c'est mieux entre copines."],
            "extra_feature": ["Tu peux aussi lancer ta propre activité et choisir qui la rejoint."],
            "close": ["Ta prochaine meilleure amie est peut-être déjà à Dubaï."],
        },
        "en": {
            "hook": {
                "emotionnel": ["What if you finally found your girl gang in Dubai?"],
                "dynamique": ["Girl trip, padel, brunch: just missing the girls?"],
                "naturel": ["Looking for women to hang out with in Dubai?"],
            },
            "problem": ["Moving alone, making girlfriends takes time."],
            "situation": ["You want a girls' day out without waiting for luck."],
            "irly": ["IRLY Girl is the women's space inside IRLY."],
            "feature": ["Join women-only communities: sport, travel, expat life, networking."],
            "extra_situation": ["Yoga class, a weekend in Oman, a dinner: better with friends."],
            "extra_feature": ["Host your own activity and choose who joins."],
            "close": ["Your next best friend might already be in Dubai."],
        },
    },
    "network": {
        "label": "Campagne 3 — IRLY Network",
        "universe": "network",
        "brief": "Networking entre entrepreneurs, freelances et professionnels.",
        "fr": {
            "hook": {
                "emotionnel": ["Tu as lancé ton projet à Dubaï, mais tu avances seul ?"],
                "dynamique": ["Entrepreneur à Dubaï ? Ton prochain associé n'est pas sur LinkedIn."],
                "naturel": ["Tu cherches à rencontrer d'autres entrepreneurs à Dubaï ?"],
            },
            "problem": ["Les bonnes rencontres pro se font rarement derrière un écran."],
            "situation": ["Un café avec un freelance, un afterwork entre fondateurs : c'est là que tout commence."],
            "irly": ["Avec IRLY Network, retrouve les professionnels de Dubaï en vrai."],
            "feature": ["Rejoins des rencontres entre entrepreneurs, freelances et créateurs de startups."],
            "extra_situation": ["Tu as une idée, il te manque un regard extérieur, un contact, un partenaire."],
            "extra_feature": ["Ou organise ton propre événement et fais venir les bonnes personnes."],
            "close": ["Ton réseau à Dubaï commence par une rencontre."],
        },
        "en": {
            "hook": {
                "emotionnel": ["You launched your project in Dubai, but you're building alone?"],
                "dynamique": ["Founder in Dubai? Your next partner isn't on LinkedIn."],
                "naturel": ["Want to meet other entrepreneurs in Dubai?"],
            },
            "problem": ["The best professional connections rarely happen behind a screen."],
            "situation": ["A coffee with a freelancer, an afterwork with founders: that's where it starts."],
            "irly": ["With IRLY Network, meet Dubai's professionals in real life."],
            "feature": ["Join meetups for entrepreneurs, freelancers and startup founders."],
            "extra_situation": ["You have an idea, you're missing a fresh eye, a contact, a partner."],
            "extra_feature": ["Or host your own event and bring the right people."],
            "close": ["Your Dubai network starts with one meeting."],
        },
    },
    "sport": {
        "label": "Campagne 4 — IRLY Sport",
        "universe": "sport",
        "brief": "Activités sportives et running clubs.",
        "fr": {
            "hook": {
                "emotionnel": ["Courir seul à 6 h du matin, ça va cinq minutes."],
                "dynamique": ["Il te manque un quatrième pour le padel ?"],
                "naturel": ["Tu cherches des gens pour faire du sport à Dubaï ?"],
            },
            "problem": ["La motivation, c'est plus simple quand quelqu'un t'attend."],
            "situation": ["Running au coucher du soleil, foot le jeudi, padel le samedi : il te faut juste l'équipe."],
            "irly": ["Avec IRLY Sport, trouve des partenaires près de chez toi."],
            "feature": ["Running clubs, padel, football, fitness : rejoins une session ou crée la tienne."],
            "extra_situation": ["Tu as les baskets, la raquette, le créneau. Il manque les autres."],
            "extra_feature": ["Choisis ton niveau, ton quartier, ton horaire, et rejoins le groupe."],
            "close": ["À Dubaï, le sport se vit à plusieurs."],
        },
        "en": {
            "hook": {
                "emotionnel": ["Running alone at 6 a.m. gets old fast."],
                "dynamique": ["Missing a fourth player for padel?"],
                "naturel": ["Looking for people to train with in Dubai?"],
            },
            "problem": ["Motivation is easier when someone is waiting for you."],
            "situation": ["Sunset runs, Thursday football, Saturday padel: you just need the team."],
            "irly": ["With IRLY Sport, find training partners near you."],
            "feature": ["Running clubs, padel, football, fitness: join a session or start yours."],
            "extra_situation": ["You've got the shoes, the racket, the slot. Just missing the others."],
            "extra_feature": ["Pick your level, your area, your time, and join the group."],
            "close": ["In Dubai, sport is better together."],
        },
    },
    "activites": {
        "label": "Campagne 5 — IRLY Activités",
        "universe": "activites",
        "brief": "Découvrir une activité, s'inscrire et rencontrer les autres participants.",
        "fr": {
            "hook": {
                "emotionnel": ["Combien de week-ends à Dubaï as-tu passés chez toi ?"],
                "dynamique": ["Beach club, zoo, excursion dans le désert : ce week-end, tu sors."],
                "naturel": ["Envie de découvrir Dubaï avec d'autres personnes ?"],
            },
            "problem": ["Il y a mille choses à faire ici, mais on finit souvent par ne rien faire seul."],
            "situation": ["Un nouveau restaurant, une sortie en mer, un week-end dans les montagnes."],
            "irly": ["Sur IRLY, découvre les activités proposées près de toi."],
            "feature": ["Choisis une sortie, inscris-toi, et retrouve les autres participants sur place."],
            "extra_situation": ["Tu as la liste, tu as l'envie. Ce qui manque, c'est un groupe."],
            "extra_feature": ["Et si rien ne te plaît, propose ta propre sortie."],
            "close": ["Dubaï est immense. Découvre-la à plusieurs."],
        },
        "en": {
            "hook": {
                "emotionnel": ["How many Dubai weekends have you spent at home?"],
                "dynamique": ["Beach club, zoo, desert trip: this weekend, you're going out."],
                "naturel": ["Want to explore Dubai with other people?"],
            },
            "problem": ["There's so much to do here, but alone we often end up doing nothing."],
            "situation": ["A new restaurant, a boat trip, a weekend in the mountains."],
            "irly": ["On IRLY, discover activities happening near you."],
            "feature": ["Pick an outing, sign up, and meet the other participants there."],
            "extra_situation": ["You have the list, you have the will. You're missing a group."],
            "extra_feature": ["Nothing you like? Host your own outing."],
            "close": ["Dubai is huge. Explore it together."],
        },
    },
    "tutoriel": {
        "label": "Campagne 6 — Comment utiliser IRLY",
        "universe": "mixte",
        "brief": "Présenter les vrais écrans : inscription, communautés, recherche, participation, création.",
        "requires_screens": ["inscription", "communautes", "recherche", "participation", "creation"],
        "fr": {
            "hook": {
                "emotionnel": ["Rencontrer du monde à Dubaï, en cinq étapes."],
                "dynamique": ["IRLY en 30 secondes, chrono."],
                "naturel": ["Voici comment fonctionne IRLY."],
            },
            "problem": ["Pas besoin d'être doué pour les rencontres. L'app s'en charge."],
            "situation": ["Tu ouvres l'app, tu crées ton profil."],
            "irly": ["Tu découvres les communautés qui te ressemblent."],
            "feature": ["Tu cherches une activité, tu la rejoins, ou tu crées la tienne."],
            "extra_situation": ["Tu filtres par envie, par quartier, par date."],
            "extra_feature": ["Le jour J, tu retrouves le groupe sur place."],
            "close": ["IRLY. Les rencontres, dans la vraie vie."],
        },
        "en": {
            "hook": {
                "emotionnel": ["Meeting people in Dubai, in five steps."],
                "dynamique": ["IRLY in 30 seconds."],
                "naturel": ["Here's how IRLY works."],
            },
            "problem": ["No need to be good at meeting people. The app does the work."],
            "situation": ["Open the app, create your profile."],
            "irly": ["Discover communities that fit you."],
            "feature": ["Find an activity, join it, or create your own."],
            "extra_situation": ["Filter by interest, area or date."],
            "extra_feature": ["On the day, meet the group in person."],
            "close": ["IRLY. Meeting people, in real life."],
        },
    },
}

# Mots mis en évidence dans les sous-titres (comparaison insensible à la casse).
HIGHLIGHT_WORDS = {
    "fr": ["IRLY", "Dubaï", "personne", "communautés", "activités", "plusieurs", "vraie vie",
           "bientôt", "copines", "entrepreneurs", "padel", "running"],
    "en": ["IRLY", "Dubai", "anyone", "communities", "activities", "together", "real life",
           "soon", "girls", "founders", "padel", "running"],
}
