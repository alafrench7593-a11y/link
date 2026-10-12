"use client";

import { MotionConfig } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";
import { track, type EvenementSuivi } from "@/lib/track";

const SELECTEUR = "[data-reveal]:not(.is-in),[data-reveal-img]:not(.is-in),[data-split]:not(.is-in)";
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Active les révélations au défilement après l'hydratation, sans masquer ce qui est déjà à l'écran. */
function RevealObserver() {
  const pathname = usePathname();
  useIsoLayoutEffect(() => {
    const racine = document.documentElement;
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entrees) =>
        entrees.forEach((e) => {
          if (e.isIntersecting) reveler(e.target);
        }),
      { rootMargin: "0px 0px -6% 0px", threshold: 0.08 },
    );
    const vus = new WeakSet<Element>();
    const enAttente = new Set<HTMLElement>();
    const reveler = (el: Element) => {
      el.classList.add("is-in");
      io.unobserve(el);
      enAttente.delete(el as HTMLElement);
    };
    const scan = () =>
      document.querySelectorAll<HTMLElement>(SELECTEUR).forEach((el) => {
        if (vus.has(el)) return;
        vus.add(el);
        const r = el.getBoundingClientRect();
        if (!racine.hasAttribute("data-motion") && r.top < window.innerHeight && r.bottom > 0) {
          el.classList.add("is-in");
          return;
        }
        enAttente.add(el);
        io.observe(el);
      });
    // Filet de sécurité : un défilement très rapide (ou un saut d'ancre) peut franchir un élément
    // entre deux images ; tout élément déjà dépassé est révélé à la fin du défilement.
    let minuterie = 0;
    const finDefilement = () => {
      clearTimeout(minuterie);
      minuterie = window.setTimeout(() => {
        const limite = window.innerHeight;
        enAttente.forEach((el) => el.getBoundingClientRect().top < limite && reveler(el));
      }, 120);
    };
    window.addEventListener("scroll", finDefilement, { passive: true });
    scan();
    racine.setAttribute("data-motion", "");
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      clearTimeout(minuterie);
      window.removeEventListener("scroll", finDefilement);
    };
  }, [pathname]);
  return null;
}

/** Suivi par délégation : tout élément portant data-track="…" envoie l'événement au clic. */
function ClickTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-track]");
      if (!el) return;
      track(el.dataset.track as EvenementSuivi, { emplacement: el.dataset.trackLabel ?? "" });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}

export function MotionProviders({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.6 }}>
      <RevealObserver />
      <ClickTracker />
      {children}
    </MotionConfig>
  );
}

/** Déclenche un événement de consultation au montage d'une page. */
export function TrackView({ evenement, label }: { evenement: EvenementSuivi; label?: string }) {
  useEffect(() => {
    track(evenement, label ? { page: label } : {});
  }, [evenement, label]);
  return null;
}
