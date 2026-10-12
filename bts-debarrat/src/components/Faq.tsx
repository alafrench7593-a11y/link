"use client";

import { motion } from "motion/react";
import { useId, useState } from "react";
import type { FaqItem } from "@/config/services";

export function Faq({ items, dark = false }: { items: FaqItem[]; dark?: boolean }) {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  return (
    <div className={`divide-y border-y ${dark ? "divide-white/10 border-white/10" : "divide-line border-line"}`}>
      {items.map((f, i) => {
        const ouvert = open === i;
        const idQ = `${base}-q${i}`;
        const idR = `${base}-r${i}`;
        return (
          <div key={f.q} data-reveal style={{ "--d": Math.min(i, 6) * 50 } as React.CSSProperties}>
            <h3>
              <button
                id={idQ}
                type="button"
                aria-expanded={ouvert}
                aria-controls={idR}
                onClick={() => setOpen(ouvert ? null : i)}
                className="group flex w-full items-center justify-between gap-6 py-5 text-left"
              >
                <span className={`font-sans text-[1.05rem] font-medium tracking-[-0.01em] md:text-[1.15rem] ${dark ? "text-white" : "text-ink"}`}>
                  {f.q}
                </span>
                <span
                  className={`relative grid size-8 shrink-0 place-items-center rounded-full transition-colors duration-300 ${
                    ouvert ? "bg-ink text-white" : dark ? "text-white ring-1 ring-white/20" : "text-ink ring-1 ring-ink/15 group-hover:ring-ink/40"
                  }`}
                  aria-hidden
                >
                  <span className="absolute h-[1.5px] w-3 bg-current" />
                  <motion.span className="absolute h-3 w-[1.5px] bg-current" animate={{ scaleY: ouvert ? 0 : 1 }} transition={{ duration: 0.3 }} />
                </span>
              </button>
            </h3>
            {/* La réponse reste dans le DOM (indexable), seule sa hauteur est animée. */}
            <motion.div
              id={idR}
              role="region"
              aria-labelledby={idQ}
              initial={false}
              animate={{ height: ouvert ? "auto" : 0, opacity: ouvert ? 1 : 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
              inert={!ouvert}
            >
              <p className={`max-w-3xl pb-6 pr-12 text-[1rem] leading-relaxed ${dark ? "text-muted-dark" : "text-muted"}`}>{f.r}</p>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
