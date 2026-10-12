import Link from "next/link";
import { ButtonLink, WhatsAppButton } from "@/components/Buttons";
import { servicesAvecPage } from "@/config/services";

export default function NotFound() {
  return (
    <section className="bg-mist pb-24 pt-36">
      <div className="container-x max-w-3xl">
        <p className="eyebrow text-accent">Erreur 404</p>
        <h1 className="mt-4 text-[clamp(2.4rem,6vw,4.4rem)] font-semibold tracking-[-0.03em] font-display leading-none">Cette page a déjà été débarrassée.</h1>
        <p className="mt-6 text-lg text-muted">L&apos;adresse demandée n&apos;existe pas ou plus. Voici où trouver ce que vous cherchez :</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/" variant="dark">Retour à l&apos;accueil</ButtonLink>
          <ButtonLink href="/devis/" variant="outline">Demander un devis</ButtonLink>
          <WhatsAppButton emplacement="404" />
        </div>
        <ul className="mt-12 grid gap-2 sm:grid-cols-2">
          {servicesAvecPage().map((s) => (
            <li key={s.slug}><Link href={`/${s.slug}/`} className="text-accent underline underline-offset-2">{s.nomMenu}</Link></li>
          ))}
        </ul>
      </div>
    </section>
  );
}
