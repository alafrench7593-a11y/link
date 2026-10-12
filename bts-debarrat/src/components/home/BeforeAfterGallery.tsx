"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { BeforeAfter } from "../BeforeAfter";
import { RoomIllustration } from "../RoomIllustration";
import { IconArrow, IconWhatsApp } from "../Icons";
import type { Realisation } from "@/config/realisations";
import type { IllustrationKind } from "@/config/services";

type Cat = { id: string; label: string; kind: IllustrationKind; service: string; texte: string };

const CATS: Cat[] = [
  { id: "appartement", label: "Appartement", kind: "appartement", service: "debarras-appartement", texte: "Étage, ascenseur, stationnement : en appartement, l'accès compte autant que le volume." },
  { id: "maison", label: "Maison", kind: "maison", service: "debarras-maison", texte: "Plusieurs niveaux, sous-sol, dépendances : une maison se vide pièce par pièce, selon vos consignes." },
  { id: "cave", label: "Cave", kind: "cave", service: "debarras-cave", texte: "Couloirs étroits, peu de lumière : une cave se vide avec méthode, sans gêner les voisins." },
  { id: "grenier", label: "Grenier", kind: "grenier", service: "debarras-grenier", texte: "Trappe, charpente basse, plancher fragile : l'accès est étudié avant toute intervention." },
  { id: "garage", label: "Garage", kind: "garage", service: "debarras-garage-box", texte: "Étagères, outillage, pneus : un garage ou un box enfin utilisable." },
  { id: "bureau", label: "Local pro", kind: "bureau", service: "debarras-bureaux", texte: "Bureaux, boutiques, réserves : des locaux libérés selon votre calendrier." },
];

const correspond = (r: Realisation, cat: string) => r.typeBien === cat || (cat === "bureau" && r.typeBien === "commerce");
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Une grande réalisation à la fois. Vraies photos dès qu'une réalisation existe pour la catégorie ;
 * sinon, un dessin explicitement légendé (aucun avant/après inventé).
 */
export function BeforeAfterGallery({ realisations, whatsappBase }: { realisations: Realisation[]; whatsappBase: string | null }) {
  const [cat, setCat] = useState(CATS[0].id);
  const c = CATS.find((x) => x.id === cat)!;
  const reel = realisations.find((r) => correspond(r, cat));
  const message = `Bonjour BTS DÉBARRAT, j'ai un projet similaire (${c.label.toLowerCase()}) à [ville]. Je peux vous envoyer des photos.`;
  const wa = whatsappBase ? `${whatsappBase.split("?")[0]}?text=${encodeURIComponent(message)}` : null;

  return (
    <div>
      <div role="tablist" aria-label="Type de bien" className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
        {CATS.map((x) => (
          <button
            key={x.id}
            role="tab"
            type="button"
            aria-selected={cat === x.id}
            aria-controls="panneau-avant-apres"
            onClick={() => setCat(x.id)}
            className={`relative min-h-11 shrink-0 px-4 text-[0.95rem] transition-colors duration-300 ${cat === x.id ? "text-ink" : "text-muted hover:text-ink"}`}
          >
            {x.label}
            {cat === x.id && <motion.span layoutId="onglet-avant-apres" className="absolute inset-x-4 bottom-1 h-px bg-ink" transition={{ duration: 0.5, ease: EASE }} />}
          </button>
        ))}
      </div>

      <div id="panneau-avant-apres" role="tabpanel" className="mt-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={cat}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.22 } }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            {reel ? (
              <BeforeAfter
                label={reel.titre}
                className="aspect-[4/5] sm:aspect-[16/9]"
                avant={<Image src={reel.photoAvant} alt={reel.altAvant} fill sizes="100vw" className="object-cover" />}
                apres={<Image src={reel.photoApres} alt={reel.altApres} fill sizes="100vw" className="object-cover" />}
              />
            ) : (
              <BeforeAfter
                label={`Dessin : ${c.label.toLowerCase()} avant et après débarras`}
                className="aspect-[4/5] sm:aspect-[16/9]"
                avant={<RoomIllustration kind={c.kind} state="avant" />}
                apres={<RoomIllustration kind={c.kind} state="apres" />}
                tag="Dessin d'illustration — en attente des photos de chantier"
              />
            )}

            <div className="mt-8 grid gap-6 md:grid-cols-12 md:items-start">
              <div className="md:col-span-7">
                <p className="text-[0.85rem] text-muted">{reel ? [reel.ville, reel.date].filter(Boolean).join(" · ") || c.label : c.label}</p>
                <h3 className="mt-2 font-display text-[1.9rem] font-semibold leading-tight tracking-[-0.03em]">{reel ? reel.titre : `Débarras ${c.id === "bureau" ? "de local professionnel" : c.id === "appartement" ? "d'appartement" : `de ${c.label.toLowerCase()}`}`}</h3>
                <p className="mt-3 max-w-xl text-[1.02rem] leading-relaxed text-muted">{reel ? reel.resume : c.texte}</p>
              </div>
              <div className="flex flex-wrap gap-3 md:col-span-5 md:justify-end md:pt-7">
                <a
                  href={wa ?? "/espace-pro/#whatsapp"}
                  {...(wa ? { target: "_blank", rel: "noopener noreferrer", "data-track": "whatsapp_clic", "data-track-label": "galerie" } : {})}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 text-[0.92rem] font-medium text-white transition-colors hover:bg-ink-3"
                >
                  <IconWhatsApp className="size-5 text-[#25d366]" />
                  J&apos;ai un projet similaire
                </a>
                <Link href={reel?.pageDediee ? `/realisations/${reel.slug}/` : `/${c.service}/`} className="group inline-flex min-h-12 items-center gap-1.5 px-2 text-[0.92rem] font-medium text-ink">
                  {reel?.pageDediee ? "Voir le chantier" : "La prestation"} <IconArrow className="btn-arrow size-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
