import { arguments_ } from "@/content/engagements";
import { SectionHeading } from "../Section";
import { IconCheck, IconClipboard, IconPhone, IconRecycle, IconShield, IconTruck } from "../Icons";

const icones = { phone: IconPhone, clipboard: IconClipboard, check: IconCheck, truck: IconTruck, shield: IconShield, recycle: IconRecycle };

export function Why() {
  return (
    <section className="bg-mist py-24 md:py-32" aria-labelledby="titre-pourquoi">
      <div className="container-x">
        <SectionHeading id="titre-pourquoi" eyebrow="Pourquoi BTS DÉBARRAT ?" title="Des engagements simples, tenus à chaque chantier" />
        <ul className="mt-14 grid gap-px overflow-hidden rounded-[1.5rem] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {arguments_.filter((a) => a.actif).map((a, i) => {
            const Icone = icones[a.icone];
            return (
              <li key={a.titre} data-reveal style={{ "--d": (i % 3) * 90 } as React.CSSProperties} className="group bg-white p-8 transition-colors duration-500 hover:bg-ink">
                <span className="grid size-12 place-items-center rounded-xl bg-accent-soft text-accent transition-[transform,background-color,color] duration-500 ease-[var(--ease-out-expo)] group-hover:-rotate-6 group-hover:scale-110 group-hover:bg-accent group-hover:text-white">
                  <Icone className="size-6" />
                </span>
                <h3 className="mt-6 text-[1.25rem] font-bold transition-colors duration-500 group-hover:text-white">{a.titre}</h3>
                <p className="mt-2.5 text-[0.97rem] leading-relaxed text-muted transition-colors duration-500 group-hover:text-white/70">{a.texte}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
