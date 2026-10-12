import { etapes } from "@/content/engagements";

export function Methode() {
  return (
    <section className="bg-mist py-24 md:py-36" aria-labelledby="titre-methode">
      <div className="container-x">
        <h2 id="titre-methode" data-split="" className="max-w-3xl font-display text-[clamp(2.2rem,5vw,4.2rem)] font-semibold leading-[1] tracking-[-0.045em]">
          {["Simple, du premier message", "à la remise des clés."].map((l, i) => (
            <span key={l} className="split-word block" style={{ "--i": i * 3 } as React.CSSProperties}><span>{l} </span></span>
          ))}
        </h2>
        <ol className="mt-16 grid gap-12 md:mt-24 md:grid-cols-3 md:gap-10">
          {etapes.map((e, i) => (
            <li key={e.titre} data-reveal style={{ "--d": i * 140 } as React.CSSProperties} className="group">
              <div className="h-px w-full origin-left bg-ink/15">
                <div className="h-px w-full origin-left scale-x-0 bg-ink transition-transform duration-[1.4s] ease-[var(--ease-out-expo)] [.is-in_&]:scale-x-100" style={{ transitionDelay: `${300 + i * 200}ms` }} />
              </div>
              <p className="mt-6 font-display text-[0.95rem] tabular-nums text-accent">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-3 font-display text-[1.55rem] font-semibold leading-tight tracking-[-0.025em]">{e.titre}</h3>
              <p className="mt-3 max-w-sm text-[1rem] leading-relaxed text-muted">{e.texte}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
