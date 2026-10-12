import Link from "next/link";
import { Visual } from "./Visual";
import { IconArrow } from "./Icons";
import type { Service } from "@/config/services";

export function ServiceCards({ items }: { items: Service[] }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((s, i) => (
        <li key={s.slug} data-reveal style={{ "--d": (i % 4) * 80 } as React.CSSProperties}>
          <Link
            href={`/${s.slug}/`}
            className="group relative flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-line bg-white transition-[transform,box-shadow,border-color] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1.5 hover:border-ink/15 hover:shadow-[0_30px_60px_-30px_rgba(17,19,18,0.4)]"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-mist">
              <div className="absolute inset-0 transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-[1.06]">
                <Visual photo={s.photo} alt={s.photoAlt} kind={s.illustration} sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw" tag={null} />
              </div>
              <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 font-display text-xs font-bold text-ink">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h3 className="text-[1.2rem] font-bold leading-tight">{s.nomMenu}</h3>
              <p className="mt-2 flex-1 text-[0.93rem] leading-relaxed text-muted">{s.carte}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent">
                Voir la prestation
                <IconArrow className="btn-arrow size-4" />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
