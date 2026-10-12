import { reassurance } from "@/content/engagements";
import { IconCheck } from "../Icons";

export function Reassurance() {
  const items = reassurance();
  const ligne = [...items, ...items];
  return (
    <section aria-label="Nos engagements" className="relative overflow-hidden border-b border-line bg-white py-5">
      <ul className="sr-only">
        {items.map((r) => <li key={r.texte}>{r.texte}</li>)}
      </ul>
      <div className="flex w-max marquee-track hover:[animation-play-state:paused]" aria-hidden>
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center">
            {ligne.map((r, i) => (
              <span key={`${k}-${i}`} className="flex items-center gap-3 px-7 text-[0.98rem] font-medium text-ink">
                <IconCheck className="size-5 text-accent" />
                {r.texte}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white" aria-hidden />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white" aria-hidden />
    </section>
  );
}
