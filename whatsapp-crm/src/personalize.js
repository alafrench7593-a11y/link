// Rédaction des messages. Deux moteurs :
//  - par défaut, des formulations écrites à la main, choisies selon la relation,
//    le type de message et ce que la fiche contient réellement ;
//  - si ANTHROPIC_API_KEY est défini, Claude rédige trois propositions à partir
//    de la fiche et de l'historique, avec interdiction d'inventer.
// Dans les deux cas, rien n'est inventé : sans note sur la fiche, le message ne
// parle d'aucune rencontre ni d'aucun échange.

export const MISSING = '[à compléter';

const TONES = {
  client: 'chaleureux',
  partenaire: 'cordial',
  professionnel: 'professionnel',
  organisateur: 'professionnel',
  fournisseur: 'professionnel',
  prospect: 'professionnel',
  autre: 'professionnel',
};

const OPENERS = {
  chaleureux: ['Bonjour {prenom},', 'Bonjour {prenom}, j’espère que vous allez bien.', 'Bonjour {prenom}, ravi de vous retrouver ici.'],
  cordial: ['Bonjour {prenom},', 'Bonjour {prenom}, j’espère que tout va bien de votre côté.', 'Bonjour {prenom}, merci encore pour notre collaboration.'],
  professionnel: ['Bonjour {prenom},', 'Bonjour {prenom}, {moi} de {societe}.', 'Bonjour {prenom}, je me permets de vous écrire.'],
};

const BODIES = {
  premier_contact: [
    '{contexte}Je vous écris au sujet de {offre}. Est-ce un sujet pour vous en ce moment ?',
    '{contexte}Je pense que {offre} pourrait vous être utile. Souhaitez-vous que je vous en dise plus ?',
    '{contexte}Je travaille sur {offre}. Seriez-vous d’accord pour en parler quelques minutes ?',
  ],
  relance: [
    'Je reviens vers vous suite à mon message du {date}. Avez-vous eu le temps d’y jeter un œil ?',
    'Petit suivi de mon message du {date} : est-ce toujours d’actualité pour vous ? Un simple oui ou non me suffit.',
    'Je me permets de vous relancer une dernière fois au sujet de {offre}. Si ce n’est pas le moment, aucun souci, dites-le-moi simplement.',
  ],
  reprise: [
    'Cela fait un moment depuis notre dernier échange. {contexte}Je voulais savoir si {offre} pouvait de nouveau vous intéresser.',
    '{contexte}Nous avons du nouveau sur {offre} et j’ai pensé à vous. Voulez-vous que je vous présente ce qui a changé ?',
    'J’espère que tout se passe bien depuis notre dernier échange. {contexte}Seriez-vous ouvert à refaire un point ?',
  ],
  reponse: [
    'Merci pour votre réponse. {suite}',
    'Merci beaucoup pour votre retour. {suite}',
    'Merci de m’avoir répondu. {suite}',
  ],
};

const CLOSERS = ['Bonne journée,\n{moi}', 'Belle journée à vous,\n{moi}', 'À bientôt,\n{moi}'];

function fmtDate(isoStr) {
  if (!isoStr) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(new Date(isoStr));
}

function fill(tpl, v) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '').replace(/ {2,}/g, ' ').replace(/ ,/g, ',').trim();
}

export function similarity(a, b) {
  const words = (s) => new Set(String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{3,}/g) || []);
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export function ruleBasedVariants({ contact, kind, cfg, previous = [], pitch }) {
  const tone = TONES[contact.category] || 'professionnel';
  const vars = {
    prenom: contact.first_name || '',
    moi: cfg.senderName || `${MISSING} : votre prénom]`,
    societe: cfg.senderBusiness || `${MISSING} : votre entreprise]`,
    offre: pitch || `${MISSING} : ce que vous proposez]`,
    // Seul contexte autorisé : ce que vous avez écrit vous-même dans la fiche.
    contexte: contact.notes ? `${contact.notes.trim().replace(/[.]?$/, '.')} ` : '',
    date: fmtDate(contact.last_outbound_at),
    suite: `${MISSING} : votre réponse à « ${String(contact.last_inbound_text || '').slice(0, 80)} »]`,
  };
  const bodies = BODIES[kind] || BODIES.premier_contact;
  const out = bodies.map((b, i) => {
    const opener = OPENERS[tone][i % OPENERS[tone].length];
    const closer = CLOSERS[i % CLOSERS.length];
    return [fill(opener, vars), fill(b, vars), fill(closer, vars)].join('\n\n').replace(/^Bonjour ,/, 'Bonjour,');
  });
  return rankAgainstHistory(out, previous);
}

// Écarte les formulations trop proches de ce qu'on a déjà envoyé à cette personne.
export function rankAgainstHistory(variants, previous) {
  const scored = variants.map((v) => ({ v, s: Math.max(0, ...previous.map((p) => similarity(v, p))) }));
  const fresh = scored.filter((x) => x.s < 0.6).sort((a, b) => a.s - b.s).map((x) => x.v);
  return fresh.length ? fresh : scored.sort((a, b) => a.s - b.s).map((x) => x.v);
}

const SYSTEM = `Tu rédiges des messages WhatsApp commerciaux en français pour une petite entreprise.
Règles absolues :
- N'invente JAMAIS une rencontre, un échange, une recommandation ou un fait absent des données fournies.
- Utilise uniquement le prénom, la catégorie, les notes et l'historique fournis.
- Ton adapté à la relation (client : chaleureux ; partenaire : cordial ; prospect et professionnels : professionnel et direct). Vouvoiement.
- 2 à 4 phrases, une seule question, pas de majuscules criardes, pas d'emoji en excès, pas de pression ni de fausse urgence.
- Pour une relance : reconnaître le message précédent, proposer une sortie simple (« dites-le-moi si ce n'est pas le moment »).
- Ne répète pas les formulations des messages déjà envoyés.
- Si une information indispensable manque (offre, signature), écris [à compléter : …] au lieu de l'inventer.
Réponds uniquement en JSON : {"variants": ["…", "…", "…"]}`;

export async function generateVariants({ contact, kind, cfg, history = [], pitch, fetchImpl = fetch }) {
  const previous = history.filter((m) => m.direction === 'sortant').map((m) => m.body).filter(Boolean).slice(-5);
  if (!cfg.anthropicApiKey) return { engine: 'regles', variants: ruleBasedVariants({ contact, kind, cfg, previous, pitch }) };
  const payload = {
    type_de_message: kind,
    contact: { prenom: contact.first_name, categorie: contact.category, entreprise: contact.company, notes: contact.notes, statut: contact.status },
    expediteur: { prenom: cfg.senderName, entreprise: cfg.senderBusiness, offre: pitch },
    historique: history.slice(-12).map((m) => ({ sens: m.direction, date: m.created_at, texte: m.body })),
  };
  try {
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': cfg.anthropicApiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: cfg.anthropicModel, max_tokens: 1200, system: SYSTEM, messages: [{ role: 'user', content: JSON.stringify(payload) }] }),
    });
    if (!res.ok) throw new Error(`API Claude ${res.status}`);
    const data = await res.json();
    const text = data.content?.find((b) => b.type === 'text')?.text || '';
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    const variants = parsed.variants?.filter((v) => typeof v === 'string' && v.trim());
    if (!variants?.length) throw new Error('réponse vide');
    return { engine: 'claude', variants: rankAgainstHistory(variants, previous) };
  } catch (err) {
    return { engine: 'regles', fallback: err.message, variants: ruleBasedVariants({ contact, kind, cfg, previous, pitch }) };
  }
}
