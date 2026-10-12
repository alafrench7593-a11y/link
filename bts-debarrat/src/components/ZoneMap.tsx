"use client";

import { motion } from "motion/react";
import { useState } from "react";
import type { Departement } from "@/config/zones";
import { libelleCouverture } from "@/config/zones";

/** Schéma (non cartographique) des huit départements d'Île-de-France, en anneaux autour de Paris. */
const SECTEURS: Record<string, { r0: number; r1: number; a0: number; a1: number }> = {
  "75": { r0: 0, r1: 34, a0: 0, a1: 360 },
  "92": { r0: 38, r1: 84, a0: 110, a1: 260 },
  "93": { r0: 38, r1: 84, a0: 260, a1: 370 },
  "94": { r0: 38, r1: 84, a0: 10, a1: 110 },
  "95": { r0: 88, r1: 150, a0: 200, a1: 300 },
  "77": { r0: 88, r1: 150, a0: 300, a1: 440 },
  "91": { r0: 88, r1: 150, a0: 80, a1: 140 },
  "78": { r0: 88, r1: 150, a0: 140, a1: 200 },
};
const CX = 160;
const CY = 160;
const pt = (r: number, a: number) => [CX + r * Math.cos((a * Math.PI) / 180), CY + r * Math.sin((a * Math.PI) / 180)];

function secteur({ r0, r1, a0, a1 }: (typeof SECTEURS)[string]) {
  if (a1 - a0 >= 360) return `M${CX - r1},${CY}a${r1},${r1} 0 1,0 ${2 * r1},0a${r1},${r1} 0 1,0 ${-2 * r1},0`;
  const g = 1.6; // espacement entre secteurs (degrés)
  const [b0, b1] = [a0 + g, a1 - g];
  const large = b1 - b0 > 180 ? 1 : 0;
  const [x1, y1] = pt(r1, b0);
  const [x2, y2] = pt(r1, b1);
  const [x3, y3] = pt(r0, b1);
  const [x4, y4] = pt(r0, b0);
  return `M${x1},${y1}A${r1},${r1} 0 ${large} 1 ${x2},${y2}L${x3},${y3}A${r0},${r0} 0 ${large} 0 ${x4},${y4}Z`;
}

const couleur = { confirmee: "#17181a", "sur-demande": "#b0823e", "a-confirmer": "#e2e0da" } as const;

export function ZoneMap({ departements }: { departements: Departement[] }) {
  const [actif, setActif] = useState<string | null>(null);
  return (
    <div className="grid items-center gap-10 md:grid-cols-[1fr_1fr]">
      <div className="relative mx-auto w-full max-w-[26rem]" aria-hidden>
        <svg viewBox="0 0 320 320" className="w-full overflow-visible">
          {departements.map((d, i) => {
            const s = SECTEURS[d.code];
            if (!s) return null;
            const mid = (s.a0 + s.a1) / 2;
            const [lx, ly] = d.code === "75" ? [CX, CY] : pt((s.r0 + s.r1) / 2, mid);
            const on = actif === d.code;
            return (
              <motion.g
                key={d.code}
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: 0.06 * i, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformBox: "view-box", transformOrigin: `${CX}px ${CY}px` }}
                onMouseEnter={() => setActif(d.code)}
                onMouseLeave={() => setActif(null)}
              >
                <path d={secteur(s)} fill={couleur[d.couverture]} stroke={on ? "#111312" : "#fff"} strokeWidth={on ? 2.5 : 1} className="transition-[stroke] duration-300" />
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" className="font-display" fontSize={d.code === "75" ? 18 : 15} fontWeight={800} fill={d.couverture === "confirmee" ? "#fff" : "#111312"}>
                  {d.code}
                </text>
              </motion.g>
            );
          })}
        </svg>
        <p className="mt-3 text-center text-xs text-muted">Schéma indicatif, sans échelle</p>
      </div>

      <div>
        <ul className="divide-y divide-line border-y border-line">
          {departements.map((d) => (
            <li
              key={d.code}
              onMouseEnter={() => setActif(d.code)}
              onMouseLeave={() => setActif(null)}
              className={`flex items-center justify-between gap-4 py-3.5 transition-colors ${actif === d.code ? "bg-mist" : ""}`}
            >
              <span className="flex items-center gap-3">
                <span className="grid h-8 w-11 place-items-center rounded-lg font-display text-sm font-semibold tracking-[-0.03em] font-display" style={{ background: couleur[d.couverture], color: d.couverture === "confirmee" ? "#fff" : "#111312" }}>
                  {d.code}
                </span>
                <span className="font-semibold">{d.nom}</span>
              </span>
              <span className="text-right text-[0.82rem] text-muted">{libelleCouverture[d.couverture]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[0.92rem] leading-relaxed text-muted">
          La présence d&apos;un département dans cette liste ne signifie pas que toutes ses communes sont desservies. Indiquez votre adresse : nous vous confirmons clairement si nous pouvons intervenir.
        </p>
      </div>
    </div>
  );
}
