import { Photo } from "../Photo";
import { Parallax } from "../motion/ScrollScale";
import { arguments_ } from "@/content/engagements";

/** Photo d'équipe à gauche, engagements en liste à droite. */
export function Engagements() {
  const items = arguments_.filter((a) => a.actif).slice(0, 4);
  return (
    <section className="bg-white py-24 md:py-36" aria-labelledby="titre-engagements">
      <div className="container-x grid gap-14 md:grid-cols-12 md:gap-10">
        <div className="md:col-span-6" data-reveal>
          <Parallax className="aspect-[4/5] rounded-[1.25rem] bg-mist-2" distance={70}>
            <Photo id="equipe" sizes="(min-width:768px) 50vw, 100vw" />
          </Parallax>
        </div>
        <div className="md:col-span-5 md:col-start-8 md:self-center">
          <h2 id="titre-engagements" data-split="" className="font-display text-[clamp(2.1rem,4.2vw,3.6rem)] font-semibold leading-[1] tracking-[-0.04em]">
            {["Discrets.", "Organisés.", "Respectueux des lieux."].map((l, i) => (
              <span key={l} className="split-word block" style={{ "--i": i * 2 } as React.CSSProperties}><span>{l} </span></span>
            ))}
          </h2>
          <dl className="mt-12 divide-y divide-line border-y border-line">
            {items.map((a, i) => (
              <div key={a.titre} data-reveal style={{ "--d": i * 90 } as React.CSSProperties} className="py-5">
                <dt className="font-medium text-ink">{a.titre}</dt>
                <dd className="mt-1.5 text-[0.97rem] leading-relaxed text-muted">{a.texte}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
