"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";
import { IconArrow } from "./Icons";
import type { Service } from "@/config/services";

type NavService = Pick<Service, "slug" | "nomMenu" | "carte">;

const liens = [
  { href: "/realisations/", label: "Réalisations" },
  { href: "/avis-clients/", label: "Avis" },
  { href: "/zone-intervention/", label: "Zone d'intervention" },
  { href: "/a-propos/", label: "À propos" },
  { href: "/contact/", label: "Contact" },
];

const EASE = [0.16, 1, 0.3, 1] as const;

export function Header({ services, devisLabel, banner }: { services: NavService[]; whatsapp: string | null; devisLabel: string; banner?: React.ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [drop, setDrop] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const survol = useRef(0);
  const fermeture = useRef<number>(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenu(false);
    setDrop(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        burgerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  useEffect(() => {
    if (!drop) return;
    const onDown = (e: PointerEvent) => !dropRef.current?.contains(e.target as Node) && setDrop(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrop(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [drop]);

  const ouvrir = () => {
    clearTimeout(fermeture.current);
    survol.current = Date.now();
    setDrop(true);
  };
  const fermerBientot = () => {
    fermeture.current = window.setTimeout(() => setDrop(false), 120);
  };

  const actif = (href: string) => pathname.startsWith(href);
  const lien = "relative px-3 py-2 text-[0.84rem] tracking-[-0.005em] text-ink/75 transition-colors duration-300 hover:text-ink";

  return (
    <>
      <a href="#contenu" className="sr-only z-[100] rounded-full bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Aller au contenu
      </a>
      <header
        ref={dropRef}
        onMouseLeave={fermerBientot}
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-500 ${
          scrolled || menu || drop ? "bg-white/92 shadow-[0_1px_0_rgba(23,24,26,0.07)] backdrop-blur-md" : "bg-mist/0"
        }`}
      >
        {banner}
        <div className="container-x flex h-14 items-center justify-between gap-6">
          <Logo onClick={() => setMenu(false)} />

          <nav aria-label="Navigation principale" className="hidden items-center lg:flex">
            <button
              type="button"
              className={`${lien} inline-flex items-center gap-1`}
              aria-expanded={drop}
              aria-controls="menu-prestations"
              onMouseEnter={ouvrir}
              onClick={() => setDrop((v) => (Date.now() - survol.current < 600 ? true : !v))}
            >
              Prestations
              <svg viewBox="0 0 24 24" className={`size-3 transition-transform duration-300 ${drop ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {liens.map((l) => (
              <Link key={l.href} href={l.href} className={lien} aria-current={actif(l.href) ? "page" : undefined} onMouseEnter={() => setDrop(false)}>
                {l.label}
                {actif(l.href) && <motion.span layoutId="nav-actif" className="absolute inset-x-3 bottom-0.5 h-px bg-ink" transition={{ duration: 0.5, ease: EASE }} />}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/devis/" className="group hidden h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[0.82rem] font-medium text-white transition-colors hover:bg-ink-3 sm:inline-flex">
              {devisLabel}
            </Link>
            <button
              ref={burgerRef}
              type="button"
              className="relative grid size-11 place-items-center lg:hidden"
              aria-expanded={menu}
              aria-controls="menu-mobile"
              aria-label={menu ? "Fermer le menu" : "Ouvrir le menu"}
              onClick={() => setMenu((v) => !v)}
            >
              <span className={`absolute h-[1.5px] w-[18px] bg-ink transition-transform duration-500 ease-[var(--ease-out-expo)] ${menu ? "rotate-45" : "-translate-y-[4px]"}`} />
              <span className={`absolute h-[1.5px] w-[18px] bg-ink transition-transform duration-500 ease-[var(--ease-out-expo)] ${menu ? "-rotate-45" : "translate-y-[4px]"}`} />
            </button>
          </div>
        </div>

        {/* Panneau Prestations : pleine largeur, s'ouvre en hauteur */}
        <AnimatePresence>
          {drop && (
            <motion.div
              id="menu-prestations"
              className="hidden overflow-hidden border-t border-line bg-white lg:block"
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0, transition: { duration: 0.35, ease: EASE } }}
              transition={{ duration: 0.5, ease: EASE }}
              onMouseEnter={ouvrir}
            >
              <div className="container-x grid grid-cols-[1fr_2.2fr] gap-16 py-10">
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.5, ease: EASE }}>
                  <p className="text-[0.78rem] text-muted">Prestations</p>
                  <p className="mt-3 max-w-xs text-[1.5rem] font-semibold leading-tight tracking-[-0.02em] font-display">Chaque lieu a ses contraintes.</p>
                  <Link href="/devis/" className="group mt-5 inline-flex items-center gap-1.5 text-[0.88rem] font-medium text-accent">
                    {devisLabel} <IconArrow className="btn-arrow size-3.5" />
                  </Link>
                </motion.div>
                <ul className="grid grid-cols-2 gap-x-10">
                  {services.map((s, i) => (
                    <motion.li key={s.slug} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.025, duration: 0.5, ease: EASE }}>
                      <Link href={`/${s.slug}/`} className="group block border-b border-line py-3.5">
                        <span className="flex items-center justify-between text-[0.98rem] font-medium text-ink">
                          {s.nomMenu}
                          <IconArrow className="size-3.5 -translate-x-1 text-ink/40 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                        </span>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <AnimatePresence>
        {menu && (
          <motion.div
            id="menu-mobile"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-0 z-40 overflow-y-auto bg-white pt-20 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
            transition={{ duration: 0.3 }}
          >
            <nav aria-label="Navigation mobile" className="container-x pb-40">
              <ul>
                {[{ href: "/", label: "Accueil" }, ...liens, { href: "/devis/", label: "Demande de devis" }].map((l, i) => (
                  <motion.li key={l.href} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.035, duration: 0.45, ease: EASE }}>
                    <Link href={l.href} className="block py-2 font-display text-[1.75rem] font-semibold tracking-[-0.03em]" aria-current={pathname === l.href ? "page" : undefined}>
                      {l.label}
                    </Link>
                  </motion.li>
                ))}
              </ul>
              <motion.p className="mt-10 text-[0.8rem] text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                Prestations
              </motion.p>
              <ul className="mt-2">
                {services.map((s, i) => (
                  <motion.li key={s.slug} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.03, duration: 0.45, ease: EASE }}>
                    <Link href={`/${s.slug}/`} className="flex min-h-12 items-center justify-between border-b border-line text-[1.02rem]">
                      {s.nomMenu}
                      <IconArrow className="size-4 text-ink/40" />
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
