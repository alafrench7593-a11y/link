// LinkFoot : la colonne vertébrale de la progression (§70, §72, §81).
// Un seul axe commande tout : le niveau de club. Les cartes, le staff, le stade,
// le centre de formation et les packs lisent leurs paliers ici, et nulle part ailleurs.
// Un bouton qui refuse dit toujours pourquoi : plus aucune action morte dans l'interface.

export const Tracks = {
  // Paliers de niveau de club exigés par chaque palier de chaque piste.
  // Index = le niveau que l'on veut atteindre. 0 = disponible dès le départ.
  GATES() {
    return {
      card: [0, 0, 2, 5, 9, 14],                       // niveaux de carte 1 à 5
      staff: [0, 2, 6, 11],                            // niveaux de staff 0 à 3
      stade: [0, 3, 7, 12, 18],                        // niveaux de stade 0 à 4
      academy: [0, 4, 9, 15],                          // niveaux de centre 0 à 3
      pack: { basic: 0, premium: 3, elite: 7, special: 10, gold: 12 }
    };
  },

  // Le niveau de club exigé pour atteindre `lvl` sur la piste `kind`.
  gateOf(kind, lvl) {
    const G = this.GATES()[kind];
    if (!G) return 0;
    return G[Math.max(0, Math.min(G.length - 1, lvl))] || 0;
  },

  // Verrou unique, utilisé par toutes les pistes et par les packs.
  lockOf(need) {
    const lvl = this.state.level || 1;
    return need > lvl ? { locked: true, need, why: 'Niveau de club ' + need + ' requis (tu es niveau ' + lvl + ')' } : { locked: false, need, why: '' };
  },

  // Le tableau de bord de la progression : la même forme pour toutes les pistes,
  // pour que l'interface les affiche de la même façon et dise la même chose.
  // { key, label, lvl, max, pct, nextLabel, cost, currency, lock, can, why }
  progressBoard() {
    const s = this.state, out = [];
    const row = (key, label, lvl, max, nextLabel, cost, currency, need, extra) => {
      const lock = this.lockOf(need), have = currency === 'shards' ? (s.shards || 0) : s.balance;
      const max_ = lvl >= max;
      out.push(Object.assign({
        key, label, lvl, max, pct: Math.round(lvl / max * 100), nextLabel: max_ ? null : nextLabel,
        cost: max_ ? 0 : cost, currency, locked: lock.locked && !max_,
        can: !max_ && !lock.locked && have >= cost,
        why: max_ ? 'Niveau maximum' : lock.locked ? lock.why : have < cost ? 'Il te manque ' + (cost - have) + (currency === 'shards' ? ' fragments' : ' jetons') : ''
      }, extra || {}));
    };

    const need = this.levelNeed(s.level);
    out.push({ key: 'club', label: 'Niveau de club', lvl: s.level, max: s.level + 1, pct: Math.round((s.xp / need) * 100),
      nextLabel: 'Niveau ' + (s.level + 1), cost: 0, currency: 'xp', locked: false, can: false,
      why: (need - s.xp) + ' XP avant le niveau ' + (s.level + 1), xp: s.xp, xpNeed: need });
    out.push({ key: 'division', label: 'Division', lvl: 6 - s.division, max: 5, pct: Math.round((6 - s.division) / 5 * 100),
      nextLabel: s.division > 1 ? 'Division ' + (s.division - 1) : null, cost: 0, currency: 'rang', locked: false, can: false,
      why: s.division > 1 ? 'Termine dans les 2 premiers de la division ' + s.division : 'Division maximale', division: s.division });

    this.STAFF_DEFS().forEach((d) => {
      const lv = this.staffLv(d.id);
      row('staff:' + d.id, d.label, lv, 3, d.eff[Math.min(3, lv + 1)], lv < 3 ? d.cost[lv] : 0, 'tokens', this.gateOf('staff', lv + 1), { eff: d.eff[lv], wage: d.wage[lv] });
    });
    const L = this.STADES(), sl = s.stade || 0;
    row('stade', 'Stade', sl, L.length - 1, sl < L.length - 1 ? L[sl + 1].name + ' · ' + L[sl + 1].cap + ' places' : null, sl < L.length - 1 ? L[sl + 1].cost : 0, 'tokens', this.gateOf('stade', sl + 1), { name: L[sl].name, cap: L[sl].cap });
    const A = this.ACADEMIES(), al = s.academy || 0;
    row('academy', 'Centre de formation', al, A.length - 1, al < A.length - 1 ? A[al + 1].name : null, al < A.length - 1 ? A[al + 1].cost : 0, 'tokens', this.gateOf('academy', al + 1), { name: A[al].name, note: A[al].note });

    const col = this.collection();
    out.push({ key: 'collection', label: 'Collection', lvl: col.have, max: col.total, pct: Math.round(col.have / col.total * 100),
      nextLabel: col.have < col.total ? (col.total - col.have) + ' cartes manquantes' : null, cost: 0, currency: 'cartes', locked: false, can: false,
      why: col.have >= col.total ? 'Collection complète' : 'Ouvre des packs pour compléter' });
    return out;
  },

  // Résumé d'une ligne : la même phrase partout dans l'interface.
  trackLine(t) {
    if (t.currency === 'xp') return t.why;
    if (t.currency === 'rang') return t.why;
    if (t.currency === 'cartes') return t.lvl + ' / ' + t.max + ' · ' + t.why;
    return 'Niveau ' + t.lvl + ' / ' + t.max + (t.nextLabel ? ' · suivant : ' + t.nextLabel : '') + (t.why ? ' · ' + t.why : '');
  }
};
