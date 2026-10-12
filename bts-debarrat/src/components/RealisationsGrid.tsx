"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { categoriesRealisations, type Realisation } from "@/config/realisations";
import { IconArrow } from "./Icons";

export function RealisationsGrid({ items }: { items: Realisation[] }) {
  const [filtre, setFiltre] = useState<string>("tous");
  const visibles = items.filter((r) => filtre === "tous" || r.typeBien === filtre || (filtre === "bureau" && r.typeBien === "commerce"));
  return (
    <div>
      <div role="group" aria-label="Filtrer les réalisations" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {categoriesRealisations.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={filtre === c.id}
            onClick={() => setFiltre(c.id)}
            className={`relative min-h-11 shrink-0 rounded-full px-5 text-sm font-semibold transition-colors ${filtre === c.id ? "text-white" : "bg-mist text-ink hover:bg-mist-2"}`}
          >
            {filtre === c.id && <motion.span layoutId="filtre-actif" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
            <span className="relative">{c.label}</span>
          </button>
        ))}
      </div>
      <motion.ul layout className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {visibles.map((r) => (
            <motion.li key={r.slug} layout initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.45 }}>
              <Link href={r.pageDediee ? `/realisations/${r.slug}/` : `/${r.service}/`} className="group block overflow-hidden rounded-[1.25rem] border border-line bg-white">
                <div className="relative aspect-[3/2] overflow-hidden">
                  <Image src={r.photoApres} alt={r.altApres} fill sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw" className="object-cover transition-opacity duration-700 group-hover:opacity-0" />
                  <Image src={r.photoAvant} alt="" fill sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw" className="-z-10 object-cover" />
                  <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold">Survolez pour voir l&apos;avant</span>
                </div>
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{[r.ville, r.date].filter(Boolean).join(" · ") || "Réalisation"}</p>
                  <h2 className="mt-2 text-lg font-bold">{r.titre}</h2>
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{r.resume}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent">Découvrir <IconArrow className="btn-arrow size-4" /></span>
                </div>
              </Link>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
      {visibles.length === 0 && <p className="mt-10 text-muted">Aucune réalisation publiée dans cette catégorie pour le moment.</p>}
    </div>
  );
}
