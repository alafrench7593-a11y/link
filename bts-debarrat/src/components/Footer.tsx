import Link from "next/link";
import { Logo } from "./Logo";
import { WhatsAppButton, PhoneButton } from "./Buttons";
import { IconMail, IconPin } from "./Icons";
import { site } from "@/config/site";
import { servicesAvecPage } from "@/config/services";
import { departements } from "@/config/zones";

export function Footer() {
  const annee = new Date().getFullYear();
  return (
    <footer className="on-dark relative overflow-hidden bg-ink pb-24 pt-20 text-white md:pb-10">
      <div className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full bg-accent/25 blur-[120px]" aria-hidden />
      <div className="container-x relative">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-5 max-w-sm text-[0.95rem] leading-relaxed text-muted-dark">
              Débarras de maisons, appartements, caves, greniers, garages et locaux professionnels à Paris et en Île-de-France, selon les zones desservies.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <WhatsAppButton emplacement="pied-de-page" compact>
                WhatsApp
              </WhatsAppButton>
              <PhoneButton emplacement="pied-de-page" variant="outline-light" className="min-h-11 px-4 text-sm" />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60">Prestations</h2>
            <ul className="mt-5 space-y-2.5 text-[0.93rem]">
              {servicesAvecPage().map((s) => (
                <li key={s.slug}>
                  <Link href={`/${s.slug}/`} className="text-white/85 transition-colors hover:text-accent-bright">
                    {s.nomMenu}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60">BTS DÉBARRAT</h2>
            <ul className="mt-5 space-y-2.5 text-[0.93rem]">
              {[
                ["/devis/", "Demande de devis"],
                ["/realisations/", "Nos réalisations"],
                ["/avis-clients/", "Avis clients"],
                ["/zone-intervention/", "Zone d'intervention"],
                ["/a-propos/", "À propos"],
                ["/contact/", "Contact"],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-white/85 transition-colors hover:text-accent-bright">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60">Contact</h2>
            <ul className="mt-5 space-y-3 text-[0.93rem] text-white/85">
              {site.email && (
                <li className="flex gap-2.5">
                  <IconMail className="mt-0.5 size-4 shrink-0 text-accent-bright" />
                  <a href={`mailto:${site.email}`} className="hover:text-accent-bright">{site.email}</a>
                </li>
              )}
              {site.adresse && (
                <li className="flex gap-2.5">
                  <IconPin className="mt-0.5 size-4 shrink-0 text-accent-bright" />
                  <span>{site.adresse.rue}, {site.adresse.codePostal} {site.adresse.ville}</span>
                </li>
              )}
              {site.horaires?.map((h) => <li key={h}>{h}</li>)}
              <li className="pt-2 text-white/60">
                Départements étudiés : {departements.map((d) => d.code).join(", ")}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-white/10 pt-6 text-[0.82rem] text-white/55 md:flex-row md:items-center md:justify-between">
          <p>© {annee} BTS DÉBARRAT{site.juridique.siret ? ` — SIRET ${site.juridique.siret}` : ""}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li><Link href="/mentions-legales/" className="hover:text-white">Mentions légales</Link></li>
            <li><Link href="/politique-de-confidentialite/" className="hover:text-white">Confidentialité</Link></li>
            <li><Link href="/cookies/" className="hover:text-white">Cookies</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
