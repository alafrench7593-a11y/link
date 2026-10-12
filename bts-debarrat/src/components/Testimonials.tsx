"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Avis } from "@/config/site";
import { IconStar } from "./Icons";

const formatDate = (d: string) => {
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
};

export function AvisCard({ a, exemple = false }: { a: Avis; exemple?: boolean }) {
  return (
    <figure className="relative flex h-full flex-col rounded-[1.25rem] border border-line bg-white p-7">
      {exemple && <span className="absolute right-4 top-4 rounded-full bg-[#f6d77a] px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider">Exemple fictif</span>}
      {a.note !== null && (
        <div className="flex gap-0.5 text-[#e2a93b]" aria-label={`Note : ${a.note} sur 5`}>
          {Array.from({ length: 5 }).map((_, i) => <IconStar key={i} filled={i < Math.round(a.note!)} className="size-4" />)}
        </div>
      )}
      <blockquote className="mt-4 flex-1 text-[1.02rem] leading-relaxed text-ink">« {a.texte} »</blockquote>
      <figcaption className="mt-6 border-t border-line pt-4 text-sm">
        <span className="block font-semibold">{a.auteur}</span>
        <span className="mt-1 block text-muted">
          {[a.prestation, a.ville, formatDate(a.date)].filter(Boolean).join(" · ")}
        </span>
        <span className="mt-1 block text-muted">
          Source :{" "}
          {a.lienSource ? (
            <a href={a.lienSource} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{a.source}</a>
          ) : (
            a.source
          )}
        </span>
      </figcaption>
    </figure>
  );
}

/** Grille sur ordinateur, carrousel glissable et accessible sur mobile. */
export function Testimonials({ avis, exemple = false }: { avis: Avis[]; exemple?: boolean }) {
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const w = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 1;
      setIndex(Math.round(el.scrollLeft / (w + 16)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const aller = (i: number) => {
    const el = track.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div>
      <ul
        ref={track}
        aria-label="Témoignages clients"
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3"
      >
        {avis.map((a, i) => (
          <motion.li
            key={`${a.auteur}-${i}`}
            className="w-[85%] shrink-0 snap-start md:w-auto"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: (i % 3) * 0.1, duration: 0.8 }}
          >
            <AvisCard a={a} exemple={exemple} />
          </motion.li>
        ))}
      </ul>
      {avis.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 md:hidden">
          {avis.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => aller(i)}
              aria-label={`Afficher le témoignage ${i + 1} sur ${avis.length}`}
              aria-current={index === i}
              className="grid size-11 place-items-center"
            >
              <span className={`block h-2 rounded-full transition-all duration-500 ${index === i ? "w-6 bg-ink" : "w-2 bg-ink/25"}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
