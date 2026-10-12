"use client";

import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";

function Mot({ mot, progress, debut, fin }: { mot: string; progress: MotionValue<number>; debut: number; fin: number }) {
  const opacity = useTransform(progress, [debut, fin], [0.18, 1]);
  return <motion.span style={{ opacity }}>{mot} </motion.span>;
}

/** Paragraphe dont les mots s'éclairent un à un au fil du défilement. Le texte reste entier dans le DOM. */
export function WordsReveal({ texte, className = "" }: { texte: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduit = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const mots = texte.split(" ");
  if (reduit) return <p className={className}>{texte}</p>;
  return (
    <p ref={ref} className={className}>
      {mots.map((m, i) => (
        <Mot key={i} mot={m} progress={scrollYProgress} debut={i / mots.length} fin={(i + 1) / mots.length} />
      ))}
    </p>
  );
}
