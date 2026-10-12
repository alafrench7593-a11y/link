import Link from "next/link";
import { WhatsAppButton, PhoneButton } from "./Buttons";
import { site } from "@/config/site";
import { servicesAvecPage } from "@/config/services";

export function Footer() {
  const annee = new Date().getFullYear();
  const col = "text-[0.82rem] font-medium text-ink";
  const lien = "text-[0.82rem] text-muted transition-colors hover:text-ink";
  return (
    <footer className="bg-mist pb-28 pt-16 md:pb-10">
      <div className="container-x">
        <div className="flex flex-col justify-between gap-8 border-b border-line pb-10 md:flex-row md:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-horizontal.svg" alt="BTS DÉBARRAT" width={240} height={22} className="h-[1.3rem] w-auto" />
          <div className="flex flex-wrap gap-3">
            <WhatsAppButton emplacement="pied-de-page" compact>WhatsApp</WhatsAppButton>
            <PhoneButton emplacement="pied-de-page" className="min-h-11 px-4 text-sm" />
          </div>
        </div>
        <div className="grid gap-10 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h2 className={col}>Prestations</h2>
            <ul className="mt-3 space-y-2">
              {servicesAvecPage().map((s) => (
                <li key={s.slug}><Link href={`/${s.slug}/`} className={lien}>{s.nomMenu}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className={col}>BTS DÉBARRAT</h2>
            <ul className="mt-3 space-y-2">
              {[
                ["/devis/", "Demande de devis"],
                ["/realisations/", "Réalisations"],
                ["/avis-clients/", "Avis clients"],
                ["/zone-intervention/", "Zone d'intervention"],
                ["/a-propos/", "À propos"],
                ["/contact/", "Contact"],
              ].map(([href, label]) => (
                <li key={href}><Link href={href} className={lien}>{label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className={col}>Contact</h2>
            <ul className="mt-3 space-y-2 text-[0.82rem] text-muted">
              {site.email && <li><a href={`mailto:${site.email}`} className="hover:text-ink">{site.email}</a></li>}
              {site.adresse && <li>{site.adresse.rue}, {site.adresse.codePostal} {site.adresse.ville}</li>}
              {site.horaires?.map((h) => <li key={h}>{h}</li>)}
              <li>Paris et Île-de-France, selon l&apos;adresse</li>
            </ul>
          </div>
          <div>
            <h2 className={col}>Informations</h2>
            <ul className="mt-3 space-y-2">
              <li><Link href="/mentions-legales/" className={lien}>Mentions légales</Link></li>
              <li><Link href="/politique-de-confidentialite/" className={lien}>Confidentialité</Link></li>
              <li><Link href="/cookies/" className={lien}>Cookies</Link></li>
            </ul>
          </div>
        </div>
        <p className="border-t border-line pt-6 text-[0.75rem] text-muted">
          © {annee} BTS DÉBARRAT{site.juridique.siret ? ` · SIRET ${site.juridique.siret}` : ""}
        </p>
      </div>
    </footer>
  );
}
