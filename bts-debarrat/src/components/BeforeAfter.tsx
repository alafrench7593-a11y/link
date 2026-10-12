"use client";

import { useCallback, useId, useRef, useState } from "react";
import { motion } from "motion/react";

/** Comparateur avant/après : glisser (souris, doigt) ou flèches du clavier. */
export function BeforeAfter({
  avant,
  apres,
  label,
  className = "",
  initial = 50,
  tag,
}: {
  avant: React.ReactNode;
  apres: React.ReactNode;
  label: string;
  className?: string;
  initial?: number;
  /** Étiquette visible, ex. « Illustration » tant que les vraies photos manquent. */
  tag?: string;
}) {
  const [pos, setPos] = useState(initial);
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  const fromClientX = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }, []);

  return (
    <div
      ref={ref}
      className={`relative isolate select-none overflow-hidden rounded-[1.25rem] bg-mist-2 ${className.includes("aspect-") ? "" : "aspect-[3/2]"} ${drag ? "cursor-grabbing" : "cursor-ew-resize"} ${className}`}
      style={{ touchAction: "pan-y" }}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        setDrag(true);
        fromClientX(e.clientX);
      }}
      onPointerMove={(e) => drag && fromClientX(e.clientX)}
      onPointerUp={() => setDrag(false)}
      onPointerCancel={() => setDrag(false)}
    >
      <div className="absolute inset-0 [&>*]:size-full [&>*]:object-cover">{apres}</div>
      <div className="absolute inset-0 [&>*]:size-full [&>*]:object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} aria-hidden>
        {avant}
      </div>

      <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/92 px-3 py-1 text-[0.75rem] font-medium text-ink">Avant</span>
      <span className="pointer-events-none absolute right-4 top-4 rounded-full bg-white/92 px-3 py-1 text-[0.75rem] font-medium text-ink">Après</span>

      {tag && <span className="placeholder-tag pointer-events-none">{tag}</span>}

      <div className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" style={{ left: `${pos}%` }}>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          className="grid size-11 place-items-center rounded-full bg-white text-ink shadow-[0_4px_16px_-6px_rgba(0,0,0,0.35)]"
          animate={{ scale: drag ? 1.12 : 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path d="m9 6-6 6 6 6M15 6l6 6-6 6" />
          </svg>
        </motion.div>
        </div>
      </div>

      <label htmlFor={id} className="sr-only">
        {label} — curseur de comparaison avant / après
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={Math.round(pos)}
        onChange={(e) => setPos(Number(e.target.value))}
        className="peer absolute inset-x-0 bottom-0 h-1 w-full opacity-0"
        aria-valuetext={`${Math.round(pos)} % de la photo avant visible`}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[1.25rem] ring-accent ring-offset-2 peer-focus-visible:ring-4" />
    </div>
  );
}
