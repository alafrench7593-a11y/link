import { Breadcrumbs } from "./Breadcrumbs";
import { Split } from "./Split";

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
  return (
    <section className="relative overflow-hidden bg-mist pb-16 pt-32 md:pb-24 md:pt-40">
      <div className="pointer-events-none absolute -left-32 top-10 size-[28rem] rounded-full bg-accent/10 blur-[110px]" aria-hidden />
      <div className={`container-x relative grid gap-12 ${aside ? "lg:grid-cols-[1.15fr_1fr] lg:items-center" : ""}`}>
        <div>
          <Breadcrumbs items={crumbs} />
          <p className="hero-fade eyebrow mt-8 text-accent" style={{ "--delay": "80ms" } as React.CSSProperties}>{eyebrow}</p>
          <Split as="h1" hero text={title} className="mt-4 text-[clamp(2.3rem,6vw,4.6rem)] font-extrabold leading-[0.98]" />
          {intro && (
            <p className="hero-fade mt-6 max-w-2xl text-[1.1rem] leading-relaxed text-muted" style={{ "--delay": "420ms" } as React.CSSProperties}>
              {intro}
            </p>
          )}
          {children && <div className="hero-fade mt-8 flex flex-wrap gap-3" style={{ "--delay": "560ms" } as React.CSSProperties}>{children}</div>}
        </div>
        {aside && <div className="hero-fade" style={{ "--delay": "300ms" } as React.CSSProperties}>{aside}</div>}
      </div>
    </section>
  );
}
