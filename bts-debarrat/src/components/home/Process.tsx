import { etapes } from "@/content/engagements";
import { SectionHeading } from "../Section";

export function Process() {
  return (
    <section className="bg-white py-24 md:py-32" aria-labelledby="titre-etapes">
      <div className="container-x grid gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionHeading id="titre-etapes" eyebrow="Comment ça marche ?" title="Quatre étapes, aucune surprise" intro="Rien n'est engagé avant que vous ayez validé un devis écrit. Vous gardez la main sur ce qui part et ce qui reste." />
        </div>
        <ol className="relative">
          <span data-reveal="scale" className="absolute bottom-10 left-[1.45rem] top-10 w-px origin-top bg-gradient-to-b from-accent via-accent/40 to-transparent" aria-hidden />
          {etapes.map((e, i) => (
            <li key={e.titre} data-reveal style={{ "--d": i * 120 } as React.CSSProperties} className="relative flex gap-6 pb-12 last:pb-0">
              <span className="relative z-10 grid size-12 shrink-0 place-items-center rounded-full bg-ink font-display text-lg font-extrabold text-white ring-8 ring-white">
                {i + 1}
              </span>
              <div className="pt-2">
                <h3 className="text-[1.35rem] font-bold leading-tight">{e.titre}</h3>
                <p className="mt-2 max-w-lg text-[1rem] leading-relaxed text-muted">{e.texte}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
