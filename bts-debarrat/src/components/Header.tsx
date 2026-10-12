"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";
import { IconArrow, IconWhatsApp } from "./Icons";
import type { Service } from "@/config/services";

type NavService = Pick<Service, "slug" | "nomMenu" | "carte">;

const liens = [
  { href: "/realisations/", label: "Réalisations" },
  { href: "/avis-clients/", label: "Avis clients" },
  { href: "/zone-intervention/", label: "Zone d'intervention" },
  { href: "/a-propos/", label: "À propos" },
  { href: "/contact/", label: "Contact" },
];

export function Header({ services, whatsapp, devisLabel, banner }: { services: NavService[]; whatsapp: string | null; devisLabel: string; banner?: React.ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [drop, setDrop] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const survol = useRef(0);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const dark = pathname === "/" && !scrolled && !menu;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
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

  const actif = (href: string) => pathname.startsWith(href);
  const lien = `relative rounded-full px-3.5 py-2 text-[0.92rem] font-medium transition-colors duration-300 ${dark ? "text-white/85 hover:text-white" : "text-ink/75 hover:text-ink"}`;

  return (
    <>
      <a href="#contenu" className="sr-only z-[100] rounded-full bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Aller au contenu
      </a>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-500 ${
          scrolled || menu ? "bg-white/88 shadow-[0_1px_0_rgba(17,19,18,0.08)] backdrop-blur-xl" : "bg-transparent"
        } ${dark ? "on-dark" : ""}`}
      >
        {banner}
        <div className="container-x flex h-[4.5rem] items-center justify-between gap-4">
          <Logo light={dark} onClick={() => setMenu(false)} />

          <nav aria-label="Navigation principale" className="hidden items-center gap-0.5 lg:flex">
            <div ref={dropRef} className="relative" onMouseEnter={() => {
                survol.current = Date.now();
                setDrop(true);
              }} onMouseLeave={() => setDrop(false)}>
              <button type="button" className={`${lien} inline-flex items-center gap-1.5`} aria-expanded={drop} aria-controls="menu-prestations" onClick={() => setDrop((v) => (Date.now() - survol.current < 600 ? true : !v))}>
                Prestations
                <svg viewBox="0 0 24 24" className={`size-3.5 transition-transform duration-300 ${drop ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <AnimatePresence>
                {drop && (
                  <motion.div
                    id="menu-prestations"
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.18 } }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute left-1/2 top-full w-[40rem] -translate-x-1/2 pt-3"
                  >
                    <ul className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-white p-2 shadow-[0_30px_80px_-30px_rgba(17,19,18,0.35)]">
                      {services.map((s, i) => (
                        <motion.li key={s.slug} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }}>
                          <Link href={`/${s.slug}/`} className="group block rounded-xl p-3 transition-colors hover:bg-mist focus-visible:bg-mist">
                            <span className="flex items-center justify-between text-[0.93rem] font-semibold text-ink">
                              {s.nomMenu}
                              <IconArrow className="btn-arrow size-3.5 text-accent opacity-0 transition-opacity group-hover:opacity-100" />
                            </span>
                            <span className="mt-1 line-clamp-2 block text-[0.8rem] leading-snug text-muted">{s.carte}</span>
                          </Link>
                        </motion.li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {liens.map((l) => (
              <Link key={l.href} href={l.href} className={lien} aria-current={actif(l.href) ? "page" : undefined}>
                {l.label}
                {actif(l.href) && <motion.span layoutId="nav-actif" className={`absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full ${dark ? "bg-accent-bright" : "bg-accent"}`} />}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden size-11 place-items-center rounded-full bg-wa text-ink transition-transform hover:scale-105 sm:grid"
                aria-label="Écrire sur WhatsApp (nouvel onglet)"
                data-track="whatsapp_clic"
                data-track-label="en-tete"
              >
                <IconWhatsApp className="size-5" />
              </a>
            )}
            <Link
              href="/devis/"
              className={`group hidden min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors sm:inline-flex ${dark ? "bg-white text-ink hover:bg-accent-bright" : "bg-ink text-white hover:bg-accent"}`}
            >
              {devisLabel}
              <IconArrow className="btn-arrow size-4" />
            </Link>
            <button
              ref={burgerRef}
              type="button"
              className={`relative grid size-11 place-items-center rounded-full lg:hidden ${dark ? "bg-white/10 text-white" : "bg-mist text-ink"}`}
              aria-expanded={menu}
              aria-controls="menu-mobile"
              aria-label={menu ? "Fermer le menu" : "Ouvrir le menu"}
              onClick={() => setMenu((v) => !v)}
            >
              <span className={`absolute h-0.5 w-5 rounded bg-current transition-transform duration-500 ease-[var(--ease-out-expo)] ${menu ? "rotate-45" : "-translate-y-1.5"}`} />
              <span className={`absolute h-0.5 w-5 rounded bg-current transition-all duration-300 ${menu ? "scale-x-0 opacity-0" : ""}`} />
              <span className={`absolute h-0.5 w-5 rounded bg-current transition-transform duration-500 ease-[var(--ease-out-expo)] ${menu ? "-rotate-45" : "translate-y-1.5"}`} />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menu && (
          <motion.div
            id="menu-mobile"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-0 z-40 overflow-y-auto bg-white pt-[4.5rem] lg:hidden"
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)", transition: { duration: 0.45, ease: [0.76, 0, 0.24, 1] } }}
            transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
          >
            <nav aria-label="Navigation mobile" className="container-x pb-36 pt-6">
              <p className="eyebrow text-muted">Prestations</p>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {services.map((s, i) => (
                  <motion.li key={s.slug} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 + i * 0.035 }}>
                    <Link href={`/${s.slug}/`} className="flex min-h-12 items-center justify-between py-3 text-[1.05rem] font-medium">
                      {s.nomMenu}
                      <IconArrow className="size-4 text-accent" />
                    </Link>
                  </motion.li>
                ))}
              </ul>
              <ul className="mt-8 space-y-1">
                {[{ href: "/", label: "Accueil" }, ...liens, { href: "/devis/", label: "Demande de devis" }].map((l, i) => (
                  <motion.li key={l.href} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.04 }}>
                    <Link href={l.href} className="font-display block py-1.5 text-[1.9rem] font-bold tracking-tight" aria-current={pathname === l.href ? "page" : undefined}>
                      {l.label}
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
