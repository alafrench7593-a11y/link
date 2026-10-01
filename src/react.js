// Pont React et React Native. Aucune dépendance déclarée : React est passé en paramètre,
// ce qui évite tout conflit de version et marche aussi bien en web qu'en natif.
//
//   import React from 'react';
//   import { createClubHooks } from 'linkfoot-engine/react';
//   const { useClub } = createClubHooks(React);
//
import { Club } from './club.js';
import { SaveManager } from './save.js';

export function createClubHooks(React) {
  const { useState, useEffect, useMemo, useRef, useCallback } = React;

  // Garde un Club vivant, le relie à un stockage, et re-rend le composant à chaque changement.
  function useClub(options) {
    const o = options || {};
    const ref = useRef(null);
    if (!ref.current) ref.current = o.club || new Club(o.initialState);
    const club = ref.current;

    const [, bump] = useState(0);
    const [ready, setReady] = useState(!o.store);
    const mgr = useMemo(() => (o.store ? new SaveManager(club, o.store, { delay: o.delay, onError: o.onError }) : null), [o.store]);

    useEffect(() => club.onChange(() => bump((n) => n + 1)), [club]);

    useEffect(() => {
      if (!mgr) return undefined;
      let alive = true;
      mgr.load().then(() => { if (alive) { setReady(true); mgr.start(); } });
      return () => { alive = false; mgr.stop(); };
    }, [mgr]);

    const playMatch = useCallback((opp, opts) => club.playMatch(opp, opts), [club]);
    const act = useCallback((fn) => { fn(club); bump((n) => n + 1); }, [club]);

    return { club, state: club.state, ready, playMatch, act, save: () => (mgr ? mgr.save() : Promise.resolve(false)), lastSavedAt: mgr ? mgr.lastSavedAt : null };
  }

  // Déroule un match en temps réel pour l'affichage : une image toutes les 100 ms de temps
  // moteur, accélérée par `speed`. Rends `frame` avec ton propre canvas ou tes composants.
  function useLiveMatch(club, cfg, opts) {
    const o = opts || {};
    const [frame, setFrame] = useState(null);
    const [ended, setEnded] = useState(false);
    const eng = useRef(null), raf = useRef(null), acc = useRef(0), last = useRef(0);

    useEffect(() => {
      if (!cfg) return undefined;
      const E = club.makeEngine(cfg); eng.current = E;
      last.current = Date.now(); acc.current = 0;
      const loop = () => {
        const now = Date.now(), dt = Math.min(0.25, (now - last.current) / 1000); last.current = now;
        acc.current += dt * (o.speed || 1);
        let guard = 0;
        while (acc.current >= 0.1 && guard++ < 6) {
          acc.current -= 0.1;
          if (!E.step()) { setEnded(true); return; }
        }
        setFrame(E.frame());
        raf.current = (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (f) => setTimeout(f, 16))(loop);
      };
      loop();
      return () => { if (raf.current) { if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf.current); else clearTimeout(raf.current); } };
    }, [cfg]);

    return { frame, ended, engine: eng.current, state: () => (eng.current ? eng.current.state() : null) };
  }

  return { useClub, useLiveMatch };
}
