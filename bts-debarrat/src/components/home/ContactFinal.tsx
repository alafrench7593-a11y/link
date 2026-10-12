import { ButtonLink, PhoneButton, WhatsAppButton, libelleDevis } from "../Buttons";
import { Photo } from "../Photo";

export function ContactFinal({ message }: { message?: string }) {
  return (
    <section className="bg-ink text-white" aria-labelledby="titre-contact">
      <div className="grid md:grid-cols-2">
        <div className="container-x flex flex-col justify-center py-24 md:max-w-none md:py-36 md:pl-[max(2.5rem,calc((100vw-80rem)/2+2.5rem))] md:pr-16">
          <h2 id="titre-contact" data-split="" className="font-display text-[clamp(2.4rem,5vw,4.4rem)] font-semibold leading-[0.98] tracking-[-0.045em]">
            {["Un espace à vider ?", "Parlons-en."].map((l, i) => (
              <span key={l} className="split-word block" style={{ "--i": i * 3 } as React.CSSProperties}><span>{l} </span></span>
            ))}
          </h2>
          <p data-reveal style={{ "--d": 200 } as React.CSSProperties} className="mt-6 max-w-md text-[1.05rem] leading-relaxed text-white/65">
            Quelques photos et l&apos;adresse suffisent pour commencer. Nous revenons vers vous avec les questions utiles, puis une proposition écrite.
          </p>
          <div data-reveal style={{ "--d": 320 } as React.CSSProperties} className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href="/devis/" variant="light" arrow={false}>{libelleDevis()}</ButtonLink>
            <WhatsAppButton message={message} emplacement="contact-final">WhatsApp</WhatsAppButton>
            <PhoneButton emplacement="contact-final" variant="outline-light" />
          </div>
        </div>
        <div className="relative min-h-[22rem] bg-ink-3 md:min-h-full">
          <Photo id="contact" sizes="(min-width:768px) 50vw, 100vw" />
        </div>
      </div>
    </section>
  );
}
