import Link from "next/link";
import { Photo } from "../Photo";
import { Parallax } from "../motion/ScrollScale";
import { IconArrow } from "../Icons";
import { photoService } from "@/config/photos";
import type { Service } from "@/config/services";

/** Deux prestations mises en avant en grand format, les autres en index typographique. */
export function Prestations({ items }: { items: Service[] }) {
  const [a, b, ...reste] = [
    items.find((s) => s.slug === "debarras-appartement"),
    items.find((s) => s.slug === "debarras-maison"),
    ...items.filter((s) => s.slug !== "debarras-appartement" && s.slug !== "debarras-maison"),
  ].filter((s): s is Service => !!s);

  const Grand = ({ s, className, ratio, delai }: { s: Service; className: string; ratio: string; delai: number }) => (
    <Link href={`/${s.slug}/`} className={`group block ${className}`} data-reveal style={{ "--d": delai } as React.CSSProperties}>
      <Parallax className={`${ratio} rounded-[1.25rem] bg-mist-2`} distance={50}>
        <div className="absolute inset-0 transition-transform duration-[1.4s] ease-[var(--ease-out-expo)] group-hover:scale-[1.03]">
          <Photo id={photoService[s.slug]} sizes="(min-width:1024px) 50vw, 100vw" />
        </div>
      </Parallax>
      <div className="mt-5 flex items-start justify-between gap-6">
        <div>
          <h3 className="font-display text-[1.6rem] font-semibold tracking-[-0.025em]">{s.nomMenu}</h3>
          <p className="mt-1.5 max-w-md text-[0.98rem] leading-relaxed text-muted">{s.carte}</p>
        </div>
        <span className="mt-2 grid size-10 shrink-0 place-items-center rounded-full ring-1 ring-ink/15 transition-colors duration-300 group-hover:bg-ink group-hover:text-white">
          <IconArrow className="size-4" />
        </span>
      </div>
    </Link>
  );

  return (
    <section className="bg-white py-24 md:py-36" aria-labelledby="titre-prestations">
      <div className="container-x">
        <div className="grid gap-6 md:grid-cols-12 md:items-end">
          <h2 id="titre-prestations" data-split="" className="font-display text-[clamp(2.4rem,5.5vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.045em] md:col-span-7">
            {["Un savoir-faire", "pour chaque lieu."].map((l, i) => (
              <span key={l} className="split-word block" style={{ "--i": i * 2 } as React.CSSProperties}><span>{l} </span></span>
            ))}
          </h2>
          <p data-reveal className="max-w-md text-[1.05rem] leading-relaxed text-muted md:col-span-5 md:justify-self-end">
            Particuliers et professionnels. Chaque prestation a sa page : ce que nous prenons en charge, ce qu&apos;il faut anticiper, les questions fréquentes.
          </p>
        </div>

        <div className="mt-16 grid gap-14 md:mt-24 md:grid-cols-12 md:gap-8">
          {a && <Grand s={a} className="md:col-span-7" ratio="aspect-[4/3]" delai={0} />}
          {b && <Grand s={b} className="md:col-span-5 md:mt-40" ratio="aspect-[4/5]" delai={120} />}
        </div>

        <ul className="mt-20 border-t border-line md:mt-28">
          {reste.map((s, i) => (
            <li key={s.slug} data-reveal style={{ "--d": i * 60 } as React.CSSProperties}>
              <Link href={`/${s.slug}/`} className="group grid grid-cols-[auto_1fr_auto] items-center gap-5 border-b border-line py-5 md:grid-cols-[3rem_1.1fr_1fr_auto] md:gap-8 md:py-7">
                <span className="font-display text-[0.9rem] tabular-nums text-stone">{String(i + 3).padStart(2, "0")}</span>
                <span className="font-display text-[1.35rem] font-semibold tracking-[-0.025em] transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-1.5 md:text-[2rem]">
                  {s.nomCourt}
                </span>
                <span className="hidden text-[0.95rem] leading-relaxed text-muted md:block">{s.carte}</span>
                <span className="flex items-center gap-4">
                  <span className="relative hidden h-16 w-0 overflow-hidden rounded-lg bg-mist-2 transition-[width] duration-700 ease-[var(--ease-out-expo)] group-hover:w-24 md:block" aria-hidden>
                    <Photo id={photoService[s.slug]} sizes="96px" legende={false} />
                  </span>
                  <IconArrow className="size-5 text-ink/40 transition-colors group-hover:text-ink" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
