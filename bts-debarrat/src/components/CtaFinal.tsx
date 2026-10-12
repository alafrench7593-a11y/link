import { ButtonLink, PhoneButton, WhatsAppButton, libelleDevis } from "./Buttons";
import { Split } from "./Split";

export function CtaFinal({ message, titre = "Un espace à vider ? Parlons de votre projet." }: { message?: string; titre?: string }) {
  return (
    <section className="px-3 pb-3 md:px-5 md:pb-5" aria-labelledby="titre-cta">
      <div className="on-dark relative isolate overflow-hidden rounded-[2rem] bg-accent-strong px-6 py-20 text-white md:px-16 md:py-28">
        <div className="pointer-events-none absolute -right-24 -top-24 -z-10 size-[30rem] rounded-full bg-accent-bright/25 blur-[100px]" aria-hidden />
        <svg className="pointer-events-none absolute -bottom-10 -right-10 -z-10 w-[28rem] text-white/[0.06]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} aria-hidden>
          <path d="M3 11 12 3l9 8v10H3z" />
        </svg>
        <div className="mx-auto max-w-4xl text-center">
          <Split id="titre-cta" text={titre} className="text-[clamp(2.2rem,5.6vw,4.4rem)] font-extrabold leading-[1]" />
          <p data-reveal style={{ "--d": 200 } as React.CSSProperties} className="mx-auto mt-6 max-w-xl text-[1.08rem] leading-relaxed text-white/75">
            Décrivez le lieu, envoyez quelques photos : nous revenons vers vous avec les questions utiles et une proposition claire.
          </p>
          <div data-reveal style={{ "--d": 320 } as React.CSSProperties} className="mt-10 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href="/devis/" variant="light">{libelleDevis()}</ButtonLink>
            <WhatsAppButton message={message} emplacement="cta-final" />
            <PhoneButton emplacement="cta-final" variant="outline-light" />
          </div>
        </div>
      </div>
    </section>
  );
}
