import { Breadcrumbs } from "./Breadcrumbs";

export function PageHero({
  eyebrow,
  title,
  intro,
  crumbs,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  crumbs: { name: string; path: string }[];
  children?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  const mots = title.split(" ");
  return (
    <section className="bg-mist pb-16 pt-28 md:pb-24 md:pt-36">
      <div className={`container-x grid gap-12 ${aside ? "lg:grid-cols-12 lg:items-end" : ""}`}>
        <div className={aside ? "lg:col-span-7" : "max-w-4xl"}>
          <Breadcrumbs items={crumbs} />
          <p className="hero-fade mt-10 text-[0.95rem] text-muted" style={{ "--delay": "60ms" } as React.CSSProperties}>{eyebrow}</p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,6vw,5rem)] font-semibold leading-[0.98] tracking-[-0.045em]">
            {mots.map((m, i) => (
              <span key={i}>
                <span className="split-word hero-word" style={{ "--i": i } as React.CSSProperties}><span>{m}</span></span>
                {i < mots.length - 1 ? " " : null}
              </span>
            ))}
          </h1>
          {intro && (
            <p className="hero-fade mt-6 max-w-2xl text-[1.12rem] leading-relaxed text-ink/75" style={{ "--delay": "420ms" } as React.CSSProperties}>
              {intro}
            </p>
          )}
          {children && <div className="hero-fade mt-8 flex flex-wrap gap-3" style={{ "--delay": "560ms" } as React.CSSProperties}>{children}</div>}
        </div>
        {aside && <div className="hero-fade lg:col-span-5" style={{ "--delay": "300ms" } as React.CSSProperties}>{aside}</div>}
      </div>
    </section>
  );
}
