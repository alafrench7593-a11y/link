"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

/** L'image s'élargit légèrement à mesure qu'elle entre dans l'écran (effet « plein cadre »). */
export function ScrollScale({ children, className = "", from = 0.92 }: { children: React.ReactNode; className?: string; from?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduit = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const scale = useTransform(scrollYProgress, [0, 1], [from, 1]);
  const radius = useTransform(scrollYProgress, [0, 1], [36, 20]);
  return (
    <motion.div ref={ref} style={reduit ? undefined : { scale, borderRadius: radius }} className={`relative overflow-hidden ${className}`}>
      {children}
    </motion.div>
  );
}

/** Léger décalage vertical (parallaxe) de l'image à l'intérieur de son cadre. */
export function Parallax({ children, className = "", distance = 60 }: { children: React.ReactNode; className?: string; distance?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduit = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-distance / 2, distance / 2]);
  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <motion.div style={reduit ? undefined : { y, scale: 1.08 }} className="absolute inset-0">
        {children}
      </motion.div>
    </div>
  );
}
