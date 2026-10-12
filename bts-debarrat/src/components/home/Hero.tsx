import { ButtonLink, WhatsAppButton, libelleDevis } from "../Buttons";
import { Photo } from "../Photo";
import { ScrollScale } from "../motion/ScrollScale";
import { messageGeneral } from "@/lib/whatsapp";

export function Hero() {
  return (
    <section className="bg-mist pb-10 pt-28 md:pb-16 md:pt-36">
      <div className="container-x">
        <p className="hero-fade text-[0.95rem] text-muted" style={{ "--delay": "60ms" } as React.CSSProperties}>
          Débarras à Paris et en Île-de-France
        </p>
        <div className="mt-4 grid gap-8 lg:grid-cols-12 lg:items-end">
          <h1 className="font-display text-[clamp(3rem,9vw,7.6rem)] font-semibold leading-[0.92] tracking-[-0.05em] lg:col-span-8">
            {["De la place", "pour ce qui", "compte."].map((l, i) => (
              <span key={l} className="split-word hero-word block" style={{ "--i": i * 2 } as React.CSSProperties}>
                <span>{l} </span>
              </span>
            ))}
          </h1>
          <div className="hero-fade lg:col-span-4 lg:pb-3" style={{ "--delay": "520ms" } as React.CSSProperties}>
            <p className="max-w-sm text-[1.12rem] leading-relaxed text-ink/80">
              Débarras de maisons, appartements, caves et locaux professionnels à Paris et en Île-de-France.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-start">
              <ButtonLink href="/devis/" variant="primary" arrow={false}>{libelleDevis()}</ButtonLink>
              <WhatsAppButton message={messageGeneral} emplacement="hero">Photos sur WhatsApp</WhatsAppButton>
            </div>
          </div>
        </div>
      </div>
      <div className="hero-fade mx-auto mt-12 max-w-[96rem] px-3 md:mt-16 md:px-6" style={{ "--delay": "300ms" } as React.CSSProperties}>
        <ScrollScale className="aspect-[4/5] bg-mist-2 sm:aspect-[16/10] lg:aspect-[21/9]" from={0.95}>
          <Photo id="hero" priority sizes="100vw" />
        </ScrollScale>
      </div>
    </section>
  );
}
