import { PageHero } from "@/components/PageHero";
import { ButtonLink, PhoneButton, WhatsAppButton, libelleDevis } from "@/components/Buttons";
import { IconMail, IconPin } from "@/components/Icons";
import { site } from "@/config/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Contact | BTS DÉBARRAT — débarras Paris et Île-de-France",
  description: "Contactez BTS DÉBARRAT par WhatsApp, téléphone, e-mail ou via le formulaire de devis pour votre débarras à Paris et en Île-de-France.",
  path: "/contact/",
});

export default function Contact() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Parlons de votre débarras" intro="Le moyen le plus rapide : un message WhatsApp avec quelques photos du lieu. Vous pouvez aussi appeler ou remplir le formulaire de devis." crumbs={[{ name: "Contact", path: "/contact/" }]} />
      <section className="py-20 md:py-28">
        <div className="container-x grid gap-6 md:grid-cols-3">
          <div id="whatsapp" data-reveal className="on-dark rounded-[1.5rem] bg-ink p-8 text-white">
            <h2 className="text-2xl font-extrabold">WhatsApp</h2>
            <p className="mt-3 leading-relaxed text-white/70">Le bouton ouvre une conversation avec un message prérempli. Ajoutez vos photos dans WhatsApp avant d&apos;envoyer.</p>
            <div className="mt-6"><WhatsAppButton emplacement="contact" /></div>
          </div>
          <div data-reveal style={{ "--d": 100 } as React.CSSProperties} className="rounded-[1.5rem] bg-mist p-8">
            <h2 className="text-2xl font-extrabold">Téléphone</h2>
            <p className="mt-3 leading-relaxed text-muted">{site.horaires?.length ? site.horaires.join(" · ") : "Horaires communiqués prochainement."}</p>
            <div className="mt-6"><PhoneButton emplacement="contact" variant="dark" /></div>
          </div>
          <div data-reveal style={{ "--d": 200 } as React.CSSProperties} className="rounded-[1.5rem] bg-mist p-8">
            <h2 className="text-2xl font-extrabold">Formulaire</h2>
            <p className="mt-3 leading-relaxed text-muted">Décrivez le chantier étape par étape et joignez jusqu&apos;à six photos.</p>
            <div className="mt-6"><ButtonLink href="/devis/" variant="primary">{libelleDevis()}</ButtonLink></div>
          </div>
        </div>
        <div className="container-x mt-10 grid gap-4 text-[0.98rem] md:grid-cols-2">
          {site.email && (
            <p className="flex items-center gap-3"><IconMail className="size-5 text-accent" /><a className="underline" href={`mailto:${site.email}`}>{site.email}</a></p>
          )}
          {site.adresse && (
            <p className="flex items-center gap-3"><IconPin className="size-5 text-accent" />{site.adresse.rue}, {site.adresse.codePostal} {site.adresse.ville}{!site.adresse.recoitDuPublic && " (siège, sans accueil du public)"}</p>
          )}
        </div>
      </section>
    </>
  );
}
