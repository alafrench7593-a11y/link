import { Split } from "../Split";
import { ButtonLink, WhatsAppButton, libelleDevis } from "../Buttons";
import { BeforeAfter } from "../BeforeAfter";
import { RoomIllustration } from "../RoomIllustration";
import { messageGeneral } from "@/lib/whatsapp";

export function Hero() {
  return (
    <section className="on-dark relative isolate overflow-hidden bg-ink pb-20 pt-36 text-white md:pb-28 md:pt-44 lg:min-h-[100svh]">
      {/* trame architecturale */}
      <svg className="pointer-events-none absolute inset-0 -z-10 size-full opacity-[0.07]" aria-hidden>
        <defs>
          <pattern id="grille" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M64 0H0V64" fill="none" stroke="#fff" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grille)" />
      </svg>
      <div className="pointer-events-none absolute -right-48 top-0 -z-10 size-[44rem] rounded-full bg-accent/35 blur-[140px]" aria-hidden />
      <div className="pointer-events-none absolute -bottom-64 -left-40 -z-10 size-[36rem] rounded-full bg-accent-bright/10 blur-[140px]" aria-hidden />

      <div className="container-x grid items-center gap-14 lg:grid-cols-[1.08fr_1fr]">
        <div>
          <p className="hero-fade eyebrow text-accent-bright" style={{ "--delay": "60ms" } as React.CSSProperties}>
            Débarras · Paris &amp; Île-de-France
          </p>
          <Split
            as="h1"
            hero
            text="BTS DÉBARRAT — Votre débarras en toute simplicité"
            className="mt-6 text-[clamp(2.5rem,6.4vw,4.7rem)] font-extrabold leading-[0.98] tracking-[-0.035em]"
          />
          <p className="hero-fade mt-7 max-w-xl text-[1.12rem] leading-relaxed text-white/75" style={{ "--delay": "650ms" } as React.CSSProperties}>
            Maison, appartement, cave ou local professionnel : présentez-nous votre projet de débarras à Paris et en Île-de-France.
          </p>
          <div className="hero-fade mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap" style={{ "--delay": "800ms" } as React.CSSProperties}>
            <WhatsAppButton message={messageGeneral} emplacement="hero" className="sm:order-1" />
            <ButtonLink href="/devis/" variant="light" className="sm:order-2">
              {libelleDevis()}
            </ButtonLink>
            <ButtonLink href="/realisations/" variant="outline-light" arrow={false} className="sm:order-3">
              Découvrir nos réalisations
            </ButtonLink>
          </div>
          <p className="hero-fade mt-6 text-sm text-white/55" style={{ "--delay": "950ms" } as React.CSSProperties}>
            Après ouverture de WhatsApp, ajoutez vos photos dans la conversation : elles nous aident à estimer le volume.
          </p>
        </div>

        <div className="hero-fade relative" style={{ "--delay": "350ms" } as React.CSSProperties}>
          <div className="absolute -inset-3 -z-10 rounded-[1.75rem] border border-white/10" aria-hidden />
          <BeforeAfter
            label="Illustration d'un appartement avant et après débarras"
            initial={58}
            avant={<RoomIllustration kind="appartement" state="avant" />}
            apres={<RoomIllustration kind="appartement" state="apres" />}
            className="shadow-[0_60px_120px_-40px_rgba(0,0,0,0.7)]"
            tag="Illustration"
          />
          <div className="mt-4 flex items-center justify-between gap-4 text-[0.8rem] text-white/55">
            <span>Faites glisser pour comparer</span>
            <span>Illustration — vos photos réelles remplaceront ce visuel</span>
          </div>
        </div>
      </div>
    </section>
  );
}
