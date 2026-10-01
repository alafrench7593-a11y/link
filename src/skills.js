// LinkFoot : Compétences procédurales : 20 effets x 14 conditions x 7 raretés x 5 niveaux (§32 à §36).
// Les 7 raretés sont celles des cartes (cards.js) : une seule échelle dans tout le jeu.
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
export const Skills = {
  SKILL_DEF() {
    if (this._skill) return this._skill;
    const E = [
      ['tueur', 'Tueur', 'Attaque', { sht: 6 }, 'finition sur les grosses occasions'],
      ['visionnaire', 'Visionnaire', 'Passe', { pas: 5, dec: 4 }, 'passes qui créent le danger'],
      ['laser', 'Passe laser', 'Passe', { pas: 7 }, 'précision des passes longues'],
      ['chef', 'Chef d’orchestre', 'Tactique', { dec: 6, pas: 3 }, 'contrôle du rythme'],
      ['renard', 'Renard des surfaces', 'Attaque', { sht: 4, dec: 4 }, 'déplacements dans la surface'],
      ['sprinter', 'Sprinter', 'Physique', { pace: 7 }, 'exploitation des espaces en contre'],
      ['pressing', 'Pressing fou', 'Défense', { def: 4, pace: 3, drain: 1.25 }, 'pressing plus intense, plus fatigant'],
      ['gladiateur', 'Gladiateur', 'Physique', { phy: 7 }, 'duels physiques'],
      ['calme', 'Calme absolu', 'Mental', { dec: 6, pas: 2 }, 'moins d’erreurs sous pression'],
      ['mur', 'Mur', 'Défense', { def: 8 }, 'interventions dans sa surface'],
      ['acier', 'Mental d’acier', 'Mental', { dec: 5, sht: 2 }, 'résiste à la pression des grands moments'],
      ['dribbleur', 'Funambule', 'Dribble', { dri: 7 }, 'dribbles réussis'],
      ['aerien', 'Tour de contrôle', 'Coup de pied arrêté', { phy: 5, def: 3, sht: 2 }, 'jeu de tête'],
      ['moteur', 'Moteur', 'Physique', { drain: 0.8, pace: 2 }, 'endurance, fatigue plus lente'],
      ['leader', 'Leader', 'Leadership', { team: { dec: 2 } }, 'concentration des coéquipiers'],
      ['meneur', 'Meneur', 'Collectif', { team: { pas: 2 } }, 'jeu collectif autour de lui'],
      ['grinta', 'Grinta', 'Mental', { phy: 5, def: 3, pace: 3, team: { phy: 1 } }, 'agressivité et pressing quand l’équipe est menée'],
      ['clutch', 'Clutch', 'Spécial', { sht: 5, dec: 5 }, 'dernières minutes d’un match serré'],
      ['gk_reflex', 'Réflexes félins', 'Gardien', { ref: 7 }, 'parades réflexes'],
      ['gk_mains', 'Mains sûres', 'Gardien', { han: 7 }, 'ballons captés, pas de rebond']
    ];
    const C = [
      ['always', 'en permanence', 1.0], ['trail70', 'quand l’équipe est menée après la 70e', 1.9], ['closeLate', 'dans les 15 dernières minutes d’un match serré', 1.8],
      ['leading', 'quand l’équipe mène', 1.3], ['first15', 'dans le premier quart d’heure', 1.4], ['momentum', 'pendant 6 minutes après une action décisive', 1.7],
      ['tired', 'quand son énergie passe sous 55 %', 1.5], ['home', 'à domicile', 1.25], ['counter', 'en phase de contre', 1.6], ['box', 'dans une surface de réparation', 1.5],
      ['setpiece', 'sur coup de pied arrêté', 1.6], ['pressed', 'quand l’équipe subit le pressing', 1.5], ['derby', 'contre un adversaire mieux classé', 1.4], ['second', 'en seconde période', 1.2]
    ];
    // une seule échelle de raretés dans tout le jeu : celle des cartes (cards.js).
    // Les compétences, les packs et les joueurs parlent donc le même langage.
    const RAR = this.RARITY().map((r, i) => [r.id, r.label, 0.55 + i * 0.21, r.tint]);
    const POSOK = { GB: ['gk_reflex', 'gk_mains', 'calme', 'leader', 'acier', 'moteur'], DEF: ['mur', 'gladiateur', 'aerien', 'leader', 'calme', 'moteur', 'grinta', 'pressing', 'laser', 'sprinter', 'acier'], MIL: ['visionnaire', 'laser', 'chef', 'meneur', 'moteur', 'pressing', 'dribbleur', 'calme', 'grinta', 'clutch', 'gladiateur', 'sprinter'], ATT: ['tueur', 'renard', 'sprinter', 'dribbleur', 'clutch', 'aerien', 'grinta', 'acier', 'gladiateur', 'visionnaire'] };
    return (this._skill = { E, C, RAR, POSOK, LVL: ['I', 'II', 'III', 'IV', 'V'] });
  },

  skillCount() { const D = this.SKILL_DEF(); let n = 0; for (const pos in D.POSOK) n += D.POSOK[pos].length; return n * D.C.length * D.RAR.length * D.LVL.length; },

  makeSkill(eid, cid, rar, lvl, cond) {
    const D = this.SKILL_DEF(), e = D.E.find((x) => x[0] === eid), c = D.C[cid], R2 = D.RAR[rar];
    const mult = R2[2] * (0.7 + lvl * 0.15) * c[2] * 0.55;
    const eff = {}; for (const k in e[3]) eff[k] = k === 'drain' ? e[3][k] : k === 'team' ? Object.fromEntries(Object.entries(e[3][k]).map(([a, v]) => [a, v * mult])) : e[3][k] * mult;
    const name = e[1] + (lvl ? ' ' + D.LVL[lvl] : '') + (c[0] === 'always' ? '' : ' · ' + ['', 'grinta', 'clutch', 'dominant', 'précoce', 'momentum', 'increvable', 'local', 'contre', 'surface', 'CPA', 'sous pression', 'outsider', '2e MT'][cid]);
    return { id: eid + ':' + cid + ':' + rar + ':' + lvl, eid, cid: c[0], name, cat: e[2], rar: R2[0], rarLabel: R2[1], color: R2[3], lvl: lvl + 1, eff, desc: e[4] + (c[0] === 'always' ? '' : ', ' + c[1]) + '.' };
  },

  skillsOf(p) {
    if (p.skills) return p.skills;
    const D = this.SKILL_DEF(), r = this.seedR((p.id || 1) * 104729 + 3), pool = D.POSOK[p.pos] || D.POSOK.MIL;
    const n = p.ovr >= 80 ? 3 : p.ovr >= 68 ? 2 : 1, out = [];
    // la rareté d'une compétence se tire sur les taux des cartes, pas sur une échelle à part.
    // Un joueur ne peut pas porter une compétence plus rare que sa propre carte.
    const R = this.RARITY(), capRar = Math.max(0, R.findIndex((x) => x.id === this.rarityFor(p).id));
    for (let i = 0; i < n; i++) {
      let q = r(), rar = 0;
      for (let k = 0; k < R.length; k++) { q -= R[k].rate; if (q <= 0) { rar = k; break; } }
      out.push(this.makeSkill(pool[Math.floor(r() * pool.length)], Math.floor(r() * D.C.length), Math.min(rar, capRar), Math.min(4, Math.floor(r() * 2 + (p.ovr - 55) / 12)), null));
    }
    return out;
  }
};
