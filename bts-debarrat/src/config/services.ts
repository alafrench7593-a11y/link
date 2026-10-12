/**
 * PRESTATIONS — chaque prestation peut être activée ou désactivée (`actif`).
 * Une prestation désactivée disparaît du menu, de l'accueil, du formulaire,
 * du sitemap, et sa page renvoie une 404.
 */

export type IllustrationKind = "maison" | "appartement" | "cave" | "grenier" | "garage" | "bureau" | "commerce";

export type FaqItem = { q: string; r: string };

export type Service = {
  slug: string;
  actif: boolean;
  /** true = page dédiée ; false = mentionnée dans « Autres prestations ». */
  aPage: boolean;
  nomCourt: string;
  nomMenu: string;
  h1: string;
  title: string;
  metaDescription: string;
  illustration: IllustrationKind;
  /** Photo réelle dans /public/photos, ex. "/photos/services/cave.webp". null = illustration. */
  photo: string | null;
  photoAlt: string | null;
  carte: string;
  intro: string[];
  priseEnCharge: string[];
  pointsAttention: { titre: string; texte: string }[];
  preparation: string[];
  faq: FaqItem[];
  /** Message WhatsApp prérempli. [ville] est laissé au visiteur. */
  whatsapp: string;
  /** Catégorie pour le formulaire et les réalisations. */
  typeBien: TypeBien;
  lies: string[];
};

export type TypeBien = "maison" | "appartement" | "cave" | "grenier" | "garage" | "bureau" | "commerce" | "autre";

export const services: Service[] = [
  {
    slug: "debarras-maison",
    actif: true,
    aPage: true,
    nomCourt: "Maison",
    nomMenu: "Débarras de maison",
    h1: "Débarras de maison en Île-de-France",
    title: "Débarras de maison à Paris et en Île-de-France | BTS DÉBARRAT",
    metaDescription:
      "Vider une maison entière ou une partie seulement : pièces, sous-sol, dépendances. Présentez votre projet à BTS DÉBARRAT et recevez un devis détaillé.",
    illustration: "maison",
    photo: null,
    photoAlt: null,
    carte: "Pièces de vie, sous-sol, dépendances : une maison complète ou seulement ce qui doit partir.",
    intro: [
      "Une maison concentre souvent des décennies d'objets répartis sur plusieurs niveaux : pièces de vie, chambres, sous-sol, garage, abri de jardin. Le débarras demande donc une vraie organisation, pas seulement des bras.",
      "Nous commençons par comprendre votre situation : vente du bien, remise en location, départ en maison de retraite, succession ou simple besoin de place. Vous nous indiquez ce qui doit partir et ce qui doit rester, et nous construisons l'intervention autour de ces consignes.",
    ],
    priseEnCharge: [
      "Mobilier, électroménager, literie et vaisselle",
      "Contenu des placards, armoires et bibliothèques",
      "Sous-sol, buanderie, garage attenant",
      "Abri de jardin et dépendances, selon accès",
      "Tri des objets à conserver que vous nous signalez",
    ],
    pointsAttention: [
      {
        titre: "Plusieurs niveaux",
        texte:
          "Escaliers étroits, sous-sol sans accès direct ou combles par trappe allongent la manutention. Ces éléments sont pris en compte dans le devis plutôt que découverts le jour J.",
      },
      {
        titre: "Accès du véhicule",
        texte:
          "Une allée privée, une rue étroite ou un stationnement réglementé changent l'organisation du chargement. Précisez-le dans votre demande, des photos de la rue aident beaucoup.",
      },
      {
        titre: "Objets à conserver",
        texte:
          "Papiers, photos de famille, objets de valeur sentimentale : signalez-les avant l'intervention ou mettez-les de côté. Nous vous conseillons de faire ce tri en amont, même rapidement.",
      },
    ],
    preparation: [
      "Retirez ou isolez les documents personnels et objets à garder.",
      "Indiquez les pièces concernées et celles à ne pas toucher.",
      "Photographiez chaque pièce, y compris sous-sol et dépendances.",
      "Signalez les contraintes d'accès : escaliers, portail, stationnement.",
    ],
    faq: [
      {
        q: "Pouvez-vous vider une maison entière ?",
        r: "Oui, c'est le cœur de cette prestation. Le volume, le nombre de niveaux et les accès déterminent la durée et l'organisation. Nous l'évaluons à partir de vos photos ou d'une visite, selon le projet.",
      },
      {
        q: "Peut-on ne débarrasser qu'une partie de la maison ?",
        r: "Oui. Vous pouvez limiter l'intervention à certaines pièces, au sous-sol ou aux dépendances. Il suffit de le préciser dans votre demande.",
      },
      {
        q: "Que faire des meubles encore en bon état ?",
        r: "Selon leur état et les filières disponibles, ils peuvent être orientés vers le réemploi, le don ou le recyclage. Ce qui ne peut pas être réemployé suit les filières de traitement adaptées.",
      },
      {
        q: "Faut-il vider la maison avant une vente ?",
        r: "Ce n'est pas une obligation légale dans tous les cas, mais l'acte de vente prévoit généralement la remise d'un bien libre. Vérifiez les conditions avec votre notaire ou votre agent immobilier.",
      },
    ],
    whatsapp:
      "Bonjour BTS DÉBARRAT, je souhaite obtenir un devis pour le débarras d'une maison située à [ville]. Je peux vous envoyer des photos des pièces concernées.",
    typeBien: "maison",
    lies: ["debarras-succession", "debarras-garage-box", "debarras-grenier"],
  },
  {
    slug: "debarras-appartement",
    actif: true,
    aPage: true,
    nomCourt: "Appartement",
    nomMenu: "Débarras d'appartement",
    h1: "Débarras d'appartement à Paris et en Île-de-France",
    title: "Débarras d'appartement à Paris | BTS DÉBARRAT",
    metaDescription:
      "Étage, ascenseur, stationnement, parties communes : un débarras d'appartement se prépare. Envoyez vos photos à BTS DÉBARRAT et obtenez un devis adapté.",
    illustration: "appartement",
    photo: null,
    photoAlt: null,
    carte: "Studio ou grand appartement, avec ou sans ascenseur : une intervention pensée pour l'immeuble.",
    intro: [
      "En appartement, la difficulté tient rarement au volume seul. Ce sont l'étage, la taille de l'ascenseur, l'escalier, le stationnement en bas de l'immeuble et le respect des parties communes qui font la différence.",
      "Nous étudions ces contraintes avant de vous proposer des modalités : nombre de personnes, durée prévisible, protection des passages si nécessaire, et créneau compatible avec le règlement de copropriété.",
    ],
    priseEnCharge: [
      "Meubles, y compris volumineux, démontés si nécessaire",
      "Électroménager et literie",
      "Cartons, vêtements, livres et petits objets",
      "Cave et parking rattachés au logement, sur demande",
      "Débarras partiel avant travaux ou déménagement",
    ],
    pointsAttention: [
      {
        titre: "Étage et ascenseur",
        texte:
          "Sans ascenseur, ou avec une cabine trop petite pour les meubles, tout passe par l'escalier. Indiquez l'étage et les dimensions approximatives de l'ascenseur dans votre demande.",
      },
      {
        titre: "Stationnement",
        texte:
          "À Paris et en proche couronne, le stationnement du véhicule de chargement est souvent la principale contrainte. Selon la rue, une autorisation peut être nécessaire : nous en parlons lors de l'étude.",
      },
      {
        titre: "Copropriété",
        texte:
          "Certains immeubles imposent des horaires ou une information du gardien ou du syndic. Pensez à vérifier le règlement intérieur.",
      },
    ],
    preparation: [
      "Notez l'étage, la présence et la taille de l'ascenseur.",
      "Prévenez le gardien ou le syndic si le règlement l'exige.",
      "Mettez de côté ce que vous souhaitez conserver.",
      "Envoyez des photos de chaque pièce et de l'entrée de l'immeuble.",
    ],
    faq: [
      {
        q: "Intervenez-vous dans un appartement sans ascenseur ?",
        r: "Oui. L'absence d'ascenseur augmente la manutention, ce qui est intégré dans le devis. Indiquez l'étage pour une estimation cohérente.",
      },
      {
        q: "Pouvez-vous aussi vider la cave de l'appartement ?",
        r: "Oui, la cave ou le box rattaché au logement peut être ajouté à l'intervention. Précisez-le dans votre demande.",
      },
      {
        q: "Faut-il être présent le jour du débarras ?",
        r: "Pas forcément. Une remise des clés peut être organisée si les consignes sont claires et validées à l'avance. Les modalités sont fixées ensemble avant l'intervention.",
      },
      {
        q: "Combien coûte le débarras d'un appartement ?",
        r: "Le prix dépend du volume, de l'étage, de l'ascenseur, du stationnement, du temps de manutention et des coûts d'évacuation. Des photos de chaque pièce permettent une première estimation.",
      },
    ],
    whatsapp:
      "Bonjour BTS DÉBARRAT, je souhaite obtenir un devis pour le débarras d'un appartement situé à [ville]. Je peux vous envoyer des photos afin de vous présenter le volume à débarrasser.",
    typeBien: "appartement",
    lies: ["debarras-cave", "debarras-succession", "debarras-maison"],
  },
  {
    slug: "debarras-cave",
    actif: true,
    aPage: true,
    nomCourt: "Cave",
    nomMenu: "Débarras de cave",
    h1: "Débarras de cave à Paris et en Île-de-France",
    title: "Débarras de cave à Paris et en Île-de-France | BTS DÉBARRAT",
    metaDescription:
      "Cave d'immeuble ou de maison, couloirs étroits, peu de lumière : BTS DÉBARRAT étudie l'accès et vous propose un devis pour vider votre cave.",
    illustration: "cave",
    photo: null,
    photoAlt: null,
    carte: "Couloirs étroits, peu de lumière, objets oubliés : une cave se vide avec méthode.",
    intro: [
      "Les caves accumulent ce qu'on ne voit plus : cartons humides, vieux meubles, vélos, pots de peinture, bouteilles. Leur débarras est souvent demandé avant une vente, à la demande d'un syndic ou simplement pour récupérer de l'espace.",
      "L'accès est déterminant : escalier raide, couloirs en sous-sol, distance jusqu'à la sortie, absence d'éclairage. Nous l'évaluons avant de vous proposer une intervention.",
    ],
    priseEnCharge: [
      "Cartons, objets divers et petits meubles",
      "Vélos, outillage, matériel de jardin",
      "Étagères et rangements démontables",
      "Caves d'immeuble comme caves de maison",
    ],
    pointsAttention: [
      {
        titre: "Produits particuliers",
        texte:
          "Peintures, solvants, produits chimiques, bouteilles de gaz ou batteries suivent des filières spécifiques. Signalez-les : ils ne peuvent pas toujours être évacués avec le reste.",
      },
      {
        titre: "Humidité",
        texte:
          "Les cartons humides et les objets moisis sont plus lourds et plus fragiles à manipuler. Une photo permet d'anticiper.",
      },
      {
        titre: "Parties communes",
        texte:
          "Le passage dans les couloirs de caves et le hall doit rester propre et dégagé. Nous organisons le chargement pour gêner le moins possible les autres occupants.",
      },
    ],
    preparation: [
      "Vérifiez que vous avez la clé de la cave et des accès.",
      "Photographiez la cave et le trajet jusqu'à la sortie.",
      "Signalez les produits dangereux ou inhabituels.",
    ],
    faq: [
      {
        q: "Proposez-vous le débarras de caves ?",
        r: "Oui, à Paris et en Île-de-France selon les zones desservies. Envoyez une photo de la cave et du chemin d'accès pour une estimation.",
      },
      {
        q: "Pouvez-vous évacuer les pots de peinture et produits chimiques ?",
        r: "Ces produits relèvent de filières spécifiques. Signalez-les dans votre demande : nous vous indiquerons ce qui peut être pris en charge et comment.",
      },
      {
        q: "Combien de temps dure le débarras d'une cave ?",
        r: "Cela dépend du volume et de la distance jusqu'à la sortie. La durée prévisible vous est indiquée avec le devis.",
      },
    ],
    whatsapp:
      "Bonjour BTS DÉBARRAT, je souhaite obtenir un devis pour le débarras d'une cave située à [ville]. Pouvez-vous m'indiquer les informations nécessaires ?",
    typeBien: "cave",
    lies: ["debarras-appartement", "debarras-garage-box", "debarras-grenier"],
  },
  {
    slug: "debarras-grenier",
    actif: true,
    aPage: true,
    nomCourt: "Grenier",
    nomMenu: "Débarras de grenier",
    h1: "Débarras de grenier et de combles",
    title: "Débarras de grenier et combles en Île-de-France | BTS DÉBARRAT",
    metaDescription:
      "Trappe, échelle, charpente basse : vider un grenier demande une organisation précise. Décrivez l'accès à BTS DÉBARRAT pour un devis adapté.",
    illustration: "grenier",
    photo: null,
    photoAlt: null,
    carte: "Trappe, échelle, charpente basse : nous évaluons l'accès avant de vider vos combles.",
    intro: [
      "Un grenier se remplit lentement et se vide difficilement. L'accès se fait souvent par une trappe ou un escalier escamotable, la hauteur sous charpente est limitée et le plancher n'est pas toujours prévu pour supporter du poids.",
      "Avant toute intervention, nous regardons comment les objets peuvent descendre en sécurité. C'est ce qui détermine le nombre de personnes et la durée.",
    ],
    priseEnCharge: [
      "Cartons, malles, valises et objets anciens",
      "Petits meubles et éléments démontables",
      "Jouets, décorations, textiles",
      "Combles aménagés ou non, selon accès",
    ],
    pointsAttention: [
      {
        titre: "Accès par trappe",
        texte:
          "Ce qui ne passe pas par la trappe doit être démonté. Prenez une photo de l'ouverture et indiquez ses dimensions approximatives.",
      },
      {
        titre: "Plancher et isolation",
        texte:
          "Un plancher fragile ou de l'isolant en vrac limite les déplacements dans les combles. Signalez-le s'il est visible.",
      },
      {
        titre: "Chaleur en été",
        texte:
          "Les combles peuvent être très chauds en été. L'horaire de l'intervention est choisi en conséquence.",
      },
    ],
    preparation: [
      "Photographiez l'accès (trappe, escalier) et l'intérieur.",
      "Dégagez le passage sous la trappe.",
      "Récupérez au préalable ce que vous souhaitez garder si c'est possible sans risque.",
    ],
    faq: [
      {
        q: "Intervenez-vous dans les combles non aménagés ?",
        r: "Oui lorsque l'accès et le plancher le permettent en sécurité. Nous l'évaluons à partir de photos ou lors d'une visite.",
      },
      {
        q: "Que faire des objets anciens trouvés au grenier ?",
        r: "Signalez-nous ce que vous souhaitez conserver. Les objets restants sont orientés selon leur état vers le réemploi, le recyclage ou le traitement adapté.",
      },
      {
        q: "Le grenier peut-il être vidé en même temps que la maison ?",
        r: "Oui, c'est fréquent. Indiquez toutes les zones concernées pour recevoir un devis global.",
      },
    ],
    whatsapp:
      "Bonjour BTS DÉBARRAT, je souhaite obtenir un devis pour le débarras d'un grenier à [ville]. Je peux vous envoyer des photos de l'accès et du volume.",
    typeBien: "grenier",
    lies: ["debarras-maison", "debarras-succession", "debarras-cave"],
  },
  {
    slug: "debarras-garage-box",
    actif: true,
    aPage: true,
    nomCourt: "Garage et box",
    nomMenu: "Débarras de garage et de box",
    h1: "Débarras de garage et de box",
    title: "Débarras de garage et de box en Île-de-France | BTS DÉBARRAT",
    metaDescription:
      "Garage de maison, box en sous-sol ou parking : BTS DÉBARRAT vous aide à vider l'espace. Envoyez vos photos sur WhatsApp pour un devis.",
    illustration: "garage",
    photo: null,
    photoAlt: null,
    carte: "Outillage, pneus, étagères, cartons : un garage ou un box enfin utilisable.",
    intro: [
      "Garages et box servent de stockage par défaut. Avant une vente, une restitution de location ou simplement pour y garer à nouveau un véhicule, il faut tout sortir : outillage, étagères, pneus, matériel de sport, cartons.",
      "Pour un box en sous-sol, la hauteur de passage et la circulation dans le parking comptent autant que le volume. Nous en tenons compte dans notre proposition.",
    ],
    priseEnCharge: [
      "Étagères, établis et rangements",
      "Outillage, matériel de jardin et de bricolage",
      "Vélos, articles de sport, mobilier stocké",
      "Box en parking souterrain, selon hauteur de passage",
    ],
    pointsAttention: [
      {
        titre: "Pneus, batteries, huiles",
        texte:
          "Ces éléments relèvent de filières de collecte spécifiques. Indiquez leur présence pour savoir comment ils peuvent être pris en charge.",
      },
      {
        titre: "Parking souterrain",
        texte:
          "La hauteur limite d'accès au parking conditionne le véhicule utilisé. Elle est souvent indiquée à l'entrée : notez-la.",
      },
    ],
    preparation: [
      "Photographiez le garage ou le box porte ouverte.",
      "Notez la hauteur limite d'accès du parking.",
      "Signalez pneus, batteries, bidons et produits.",
    ],
    faq: [
      {
        q: "Pouvez-vous vider un box dans un parking souterrain ?",
        r: "Oui lorsque la hauteur de passage et la circulation le permettent. Indiquez-nous la hauteur limite affichée à l'entrée.",
      },
      {
        q: "Prenez-vous les pneus et batteries ?",
        r: "Ces déchets suivent des filières particulières. Signalez-les : nous vous dirons ce qui peut être pris en charge.",
      },
      {
        q: "Peut-on combiner garage et maison ?",
        r: "Oui, il est souvent plus simple de regrouper les zones dans une même intervention.",
      },
    ],
    whatsapp:
      "Bonjour BTS DÉBARRAT, je souhaite obtenir un devis pour le débarras d'un garage ou d'un box situé à [ville]. Pouvez-vous m'indiquer les informations nécessaires ?",
    typeBien: "garage",
    lies: ["debarras-maison", "debarras-cave", "debarras-appartement"],
  },
  {
    slug: "debarras-succession",
    actif: true,
    aPage: true,
    nomCourt: "Après succession",
    nomMenu: "Débarras après succession",
    h1: "Débarras après une succession",
    title: "Débarras après succession à Paris et en Île-de-France | BTS DÉBARRAT",
    metaDescription:
      "Vider le logement d'un proche disparu demande tact et méthode. BTS DÉBARRAT vous accompagne, avec un devis clair et le respect de vos consignes.",
    illustration: "maison",
    photo: null,
    photoAlt: null,
    carte: "Un accompagnement attentif pour vider le logement d'un proche, à votre rythme.",
    intro: [
      "Vider le logement d'un proche disparu est une étape chargée. Les héritiers vivent parfois loin, ne sont pas toujours d'accord sur ce qui doit être gardé, et doivent composer avec les délais de la succession, du notaire ou du bailleur.",
      "Notre rôle est de vous décharger de l'organisation matérielle, en respectant les consignes que vous nous donnez : objets à conserver, documents à mettre de côté, pièces à ne pas toucher.",
    ],
    priseEnCharge: [
      "Débarras complet ou partiel du logement",
      "Mise de côté des documents et objets que vous signalez",
      "Cave, grenier et garage rattachés",
      "Coordination possible avec un héritier présent sur place ou à distance",
    ],
    pointsAttention: [
      {
        titre: "Accord des héritiers",
        texte:
          "Le débarras intervient lorsque les personnes habilitées sont d'accord. En cas de doute, votre notaire est le bon interlocuteur avant de nous mandater.",
      },
      {
        titre: "Documents et objets de valeur",
        texte:
          "Papiers administratifs, bijoux, photos : nous vous conseillons de les récupérer avant l'intervention. Si vous découvrez tardivement un objet à conserver, signalez-le au plus vite.",
      },
      {
        titre: "Biens ayant une valeur",
        texte:
          "Lorsque certains biens ont une valeur de revente, elle peut être prise en compte dans le devis. Cela ne rend pas le débarras automatiquement gratuit : tout dépend de l'équilibre avec les coûts réels.",
      },
    ],
    preparation: [
      "Vérifiez avec le notaire que le débarras peut avoir lieu.",
      "Désignez un interlocuteur unique pour les consignes.",
      "Récupérez documents, bijoux et souvenirs avant le jour J.",
      "Envoyez des photos de chaque pièce et des annexes.",
    ],
    faq: [
      {
        q: "Intervenez-vous après une succession ?",
        r: "Oui. Nous intervenons à la demande des personnes habilitées, avec des consignes claires sur ce qui doit être conservé.",
      },
      {
        q: "Les héritiers doivent-ils être présents ?",
        r: "Pas obligatoirement. Une personne peut être désignée pour remettre les clés et valider les consignes. Les modalités sont fixées avant l'intervention.",
      },
      {
        q: "Le débarras d'une succession peut-il être gratuit ?",
        r: "Ce n'est pas systématique. Si des biens ont une valeur récupérable suffisante pour couvrir les coûts réels, le prix peut être réduit, voire nul. Cela s'évalue au cas par cas.",
      },
      {
        q: "Combien de temps faut-il prévoir ?",
        r: "Le délai dépend du volume, de nos disponibilités et des contraintes du logement. Il vous est précisé au moment du devis, sans promesse que nous ne pourrions pas tenir.",
      },
    ],
    whatsapp:
      "Bonjour BTS DÉBARRAT, je souhaite obtenir un devis pour un débarras après succession, pour un logement situé à [ville]. Pouvez-vous m'indiquer les informations nécessaires ?",
    typeBien: "maison",
    lies: ["debarras-maison", "debarras-appartement", "debarras-grenier"],
  },
  {
    slug: "debarras-bureaux",
    actif: true,
    aPage: true,
    nomCourt: "Bureaux",
    nomMenu: "Débarras de bureaux",
    h1: "Débarras de bureaux en Île-de-France",
    title: "Débarras de bureaux en Île-de-France | BTS DÉBARRAT",
    metaDescription:
      "Déménagement, fin de bail, réaménagement : BTS DÉBARRAT organise le débarras de vos bureaux selon les contraintes de l'immeuble et de votre activité.",
    illustration: "bureau",
    photo: null,
    photoAlt: null,
    carte: "Fin de bail, réaménagement, déménagement : des locaux libérés selon votre planning.",
    intro: [
      "Le débarras de bureaux répond à des contraintes précises : date de restitution des locaux, horaires imposés par le gestionnaire de l'immeuble, continuité de l'activité si les équipes sont encore présentes.",
      "Nous établissons avec vous un périmètre clair, poste par poste ou zone par zone, et un devis détaillé que vous pouvez transmettre en interne.",
    ],
    priseEnCharge: [
      "Mobilier de bureau : postes, sièges, armoires, cloisonnettes",
      "Mobilier de salle de réunion et d'accueil",
      "Cartons et fournitures",
      "Matériel informatique et électronique, via les filières adaptées",
    ],
    pointsAttention: [
      {
        titre: "Données et archives",
        texte:
          "Les documents confidentiels et les supports de données ne doivent pas partir avec le mobilier. Si une destruction certifiée est nécessaire, précisez-le : elle relève d'un prestataire spécialisé.",
      },
      {
        titre: "Règles de l'immeuble",
        texte:
          "Monte-charge à réserver, quai de livraison, horaires autorisés : transmettez-nous le règlement ou le contact du gestionnaire.",
      },
      {
        titre: "Équipements électriques",
        texte:
          "Ordinateurs, écrans et imprimantes relèvent de la filière des équipements électriques et électroniques.",
      },
    ],
    preparation: [
      "Définissez le périmètre : ce qui part, ce qui reste.",
      "Retirez données et documents confidentiels.",
      "Réservez le monte-charge ou le quai si nécessaire.",
      "Désignez un interlocuteur sur place.",
    ],
    faq: [
      {
        q: "Pouvez-vous intervenir en dehors des heures de bureau ?",
        r: "Les horaires sont définis avec vous en fonction de nos disponibilités et des règles de l'immeuble. Indiquez vos contraintes dès la demande.",
      },
      {
        q: "Établissez-vous un devis pour une entreprise ?",
        r: "Oui, un devis détaillé est établi au nom de votre structure, avec le périmètre convenu.",
      },
      {
        q: "Que devient le mobilier de bureau ?",
        r: "Selon son état et les filières disponibles, il peut être orienté vers le réemploi, le recyclage ou le traitement adapté.",
      },
    ],
    whatsapp:
      "Bonjour BTS DÉBARRAT, je souhaite obtenir un devis pour le débarras de bureaux situés à [ville]. Pouvez-vous m'indiquer les informations nécessaires ?",
    typeBien: "bureau",
    lies: ["debarras-local-commercial", "debarras-cave", "debarras-garage-box"],
  },
  {
    slug: "debarras-local-commercial",
    actif: true,
    aPage: true,
    nomCourt: "Commerces et locaux pro",
    nomMenu: "Débarras de commerces et locaux professionnels",
    h1: "Débarras de commerces et de locaux professionnels",
    title: "Débarras de local commercial et professionnel | BTS DÉBARRAT",
    metaDescription:
      "Boutique, restaurant, atelier, réserve : BTS DÉBARRAT vide votre local professionnel avant restitution, cession ou travaux. Demandez un devis.",
    illustration: "commerce",
    photo: null,
    photoAlt: null,
    carte: "Boutique, atelier, réserve : un local libéré avant restitution, cession ou travaux.",
    intro: [
      "Fin de bail commercial, cession de fonds, cessation d'activité ou travaux : un local professionnel doit souvent être libéré à une date précise. Il peut contenir du mobilier d'agencement, des stocks, des équipements et des réserves en sous-sol.",
      "Nous étudions la nature des éléments à évacuer et les conditions d'accès, notamment en rue commerçante où le stationnement est limité.",
    ],
    priseEnCharge: [
      "Mobilier et agencement démontable",
      "Stocks invendus et réserves",
      "Rayonnages, présentoirs, comptoirs",
      "Locaux d'activité, ateliers et entrepôts selon volume",
    ],
    pointsAttention: [
      {
        titre: "Équipements spécifiques",
        texte:
          "Équipements frigorifiques, de cuisine professionnelle ou machines nécessitent parfois un démontage ou une filière dédiée. Décrivez-les précisément.",
      },
      {
        titre: "Date de restitution",
        texte:
          "Indiquez la date limite de libération des lieux dès votre demande, pour vérifier ensemble ce qui est réalisable.",
      },
    ],
    preparation: [
      "Listez les équipements particuliers (froid, cuisine, machines).",
      "Indiquez la date de restitution ou de cession.",
      "Photographiez la boutique, la réserve et l'accès livraison.",
    ],
    faq: [
      {
        q: "Intervenez-vous pour une cessation d'activité ?",
        r: "Oui, à la demande du responsable de l'activité ou de la personne habilitée. Le périmètre est défini dans le devis.",
      },
      {
        q: "Pouvez-vous démonter l'agencement ?",
        r: "Le démontage d'éléments simples peut être inclus. Pour des travaux de dépose lourds, nous vous dirons si cela relève de notre prestation.",
      },
      {
        q: "Comment se passe le stationnement en rue commerçante ?",
        r: "C'est un point étudié avant l'intervention. Selon la rue et la commune, une autorisation peut être nécessaire.",
      },
    ],
    whatsapp:
      "Bonjour BTS DÉBARRAT, je souhaite obtenir un devis pour le débarras d'un local professionnel situé à [ville]. Pouvez-vous m'indiquer les informations nécessaires ?",
    typeBien: "commerce",
    lies: ["debarras-bureaux", "debarras-cave", "debarras-garage-box"],
  },

  // Prestations sans page dédiée : affichées dans « Autres prestations ».
  secondaire("debarras-apres-demenagement", "Débarras après déménagement", "Ce qui n'a pas suivi le déménagement : meubles restés sur place, cartons, encombrants.", "appartement"),
  secondaire("evacuation-encombrants", "Évacuation de meubles et d'encombrants", "Quelques meubles ou encombrants à évacuer, sans vider tout le logement.", "appartement"),
  secondaire("logement-tres-encombre", "Débarras de logements très encombrés", "Logements fortement encombrés, avec discrétion et une organisation adaptée.", "appartement"),
  secondaire("debarras-avant-vente-location", "Débarras avant vente ou mise en location", "Libérer un bien avant les visites, la signature ou l'arrivée d'un locataire.", "maison"),
];

function secondaire(slug: string, nom: string, carte: string, illustration: IllustrationKind): Service {
  return {
    slug,
    actif: true,
    aPage: false,
    nomCourt: nom,
    nomMenu: nom,
    h1: nom,
    title: nom,
    metaDescription: carte,
    illustration,
    photo: null,
    photoAlt: null,
    carte,
    intro: [],
    priseEnCharge: [],
    pointsAttention: [],
    preparation: [],
    faq: [],
    whatsapp: `Bonjour BTS DÉBARRAT, je souhaite obtenir un devis (${nom.toLowerCase()}) à [ville]. Pouvez-vous m'indiquer les informations nécessaires ?`,
    typeBien: "autre",
    lies: [],
  };
}

export const servicesActifs = () => services.filter((s) => s.actif);
export const servicesAvecPage = () => services.filter((s) => s.actif && s.aPage);
export const servicesSecondaires = () => services.filter((s) => s.actif && !s.aPage);
export const getService = (slug: string) => services.find((s) => s.slug === slug && s.actif && s.aPage);
