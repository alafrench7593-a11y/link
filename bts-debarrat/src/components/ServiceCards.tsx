import Link from "next/link";
import { Photo } from "./Photo";
import { IconArrow } from "./Icons";
import { photoService } from "@/config/photos";
import type { Service } from "@/config/services";

export function ServiceCards({ items }: { items: Service[] }) {
  return (
    <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((s, i) => (
        <li key={s.slug} data-reveal style={{ "--d": (i % 4) * 80 } as React.CSSProperties}>
          <Link href={`/${s.slug}/`} className="group block">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1rem] bg-mist-2">
              <div className="absolute inset-0 transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-[1.03]">
                <Photo id={photoService[s.slug]} sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw" legende={false} />
              </div>
            </div>
            <h3 className="mt-4 flex items-center justify-between font-display text-[1.15rem] font-semibold tracking-[-0.02em]">
              {s.nomMenu} <IconArrow className="btn-arrow size-4 text-ink/40" />
            </h3>
            <p className="mt-1 text-[0.92rem] leading-relaxed text-muted">{s.carte}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
