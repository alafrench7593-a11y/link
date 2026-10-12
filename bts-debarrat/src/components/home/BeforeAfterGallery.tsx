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

type Cat = { id: string; label: string; kind: IllustrationKind; service: string };

const CATS: Cat[] = [
  { id: "maison", label: "Maisons", kind: "maison", service: "debarras-maison" },
  { id: "appartement", label: "Appartements", kind: "appartement", service: "debarras-appartement" },
  { id: "cave", label: "Caves", kind: "cave", service: "debarras-cave" },
  { id: "grenier", label: "Greniers", kind: "grenier", service: "debarras-grenier" },
  { id: "garage", label: "Garages", kind: "garage", service: "debarras-garage-box" },
  { id: "bureau", label: "Bureaux et locaux pro", kind: "bureau", service: "debarras-bureaux" },
];

const correspond = (r: Realisation, cat: string) => r.typeBien === cat || (cat === "bureau" && r.typeBien === "commerce");

/**
 * Galerie avant/après de l'accueil. Affiche les vraies réalisations dès qu'elles existent ;
 * sinon, des illustrations explicitement étiquetées (aucun chantier inventé).
 */
export function BeforeAfterGallery({ realisations, whatsappBase }: { realisations: Realisation[]; whatsappBase: string | null }) {
  const [cat, setCat] = useState(CATS[1].id);
  const c = CATS.find((x) => x.id === cat)!;
  const reel = realisations.find((r) => correspond(r, cat));
  const message = `Bonjour BTS DÉBARRAT, j'ai un projet similaire (${c.label.toLowerCase()}) à [ville]. Je peux vous envoyer des photos.`;
  const wa = whatsappBase ? `${whatsappBase.split("?")[0]}?text=${encodeURIComponent(message)}` : null;

  return (
    <div className="grid gap-10 lg:grid-cols-[0.8fr_1.4fr] lg:items-start">
      <div>
        <div role="tablist" aria-label="Catégories de réalisations" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 lg:flex-col lg:overflow-visible">
          {CATS.map((x) => (
            <button
              key={x.id}
              role="tab"
              type="button"
              aria-selected={cat === x.id}
              aria-controls="panneau-avant-apres"
              onClick={() => setCat(x.id)}
              className={`relative flex min-h-11 shrink-0 items-center justify-between gap-6 rounded-full px-5 text-left text-[0.95rem] font-semibold transition-colors lg:rounded-xl lg:py-3.5 ${
                cat === x.id ? "text-white" : "text-white/70 hover:text-white"
              }`}
            >
              {cat === x.id && <motion.span layoutId="cat-actif" className="absolute inset-0 -z-0 rounded-full bg-white/10 ring-1 ring-white/15 lg:rounded-xl" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
              <span className="relative">{x.label}</span>
              <IconArrow className={`relative hidden size-4 transition-opacity lg:block ${cat === x.id ? "opacity-100" : "opacity-0"}`} />
            </button>
          ))}
        </div>
      </div>

      <div id="panneau-avant-apres" role="tabpanel" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.div
            key={cat}
            initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -16, filter: "blur(6px)", transition: { duration: 0.25 } }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {reel ? (
              <BeforeAfter
                label={reel.titre}
                avant={<Image src={reel.photoAvant} alt={reel.altAvant} fill sizes="(min-width:1024px) 60vw, 100vw" className="object-cover" />}
                apres={<Image src={reel.photoApres} alt={reel.altApres} fill sizes="(min-width:1024px) 60vw, 100vw" className="object-cover" />}
              />
            ) : (
              <div className="relative">
                <BeforeAfter
                  label={`Illustration : ${c.label.toLowerCase()} avant et après débarras`}
                  avant={<RoomIllustration kind={c.kind} state="avant" />}
                  apres={<RoomIllustration kind={c.kind} state="apres" />}
                  tag="Illustration — pas une réalisation"
                />
              </div>
            )}
            <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-md">
                {reel ? (
                  <>
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent-bright">{reel.ville ?? c.label}</p>
                    <h3 className="mt-2 text-xl font-bold text-white">{reel.titre}</h3>
                    <p className="mt-2 text-[0.95rem] leading-relaxed text-white/65">{reel.resume}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent-bright">Illustration</p>
                    <p className="mt-2 text-[0.95rem] leading-relaxed text-white/65">
                      Les photos avant/après des chantiers de BTS DÉBARRAT seront publiées ici, avec l&apos;accord des clients. Ce visuel n&apos;est pas une réalisation.
                    </p>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href={wa ?? "/espace-pro/#whatsapp"}
                  {...(wa ? { target: "_blank", rel: "noopener noreferrer", "data-track": "whatsapp_clic", "data-track-label": "galerie" } : {})}
                  className="group inline-flex min-h-12 items-center gap-2 rounded-full bg-wa px-5 text-sm font-semibold text-ink transition-colors hover:bg-wa-strong"
                >
                  <IconWhatsApp className="size-5" />
                  J&apos;ai un projet similaire
                </a>
                <Link href={reel?.pageDediee ? `/realisations/${reel.slug}/` : `/${c.service}/`} className="group inline-flex min-h-12 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-ink">
                  {reel?.pageDediee ? "Voir le chantier" : "La prestation"}
                  <IconArrow className="btn-arrow size-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
