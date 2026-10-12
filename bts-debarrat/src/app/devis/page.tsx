import { Suspense } from "react";
import { PageHero } from "@/components/PageHero";
import { QuoteForm } from "@/components/QuoteForm";
import { WhatsAppButton, PhoneButton } from "@/components/Buttons";
import { IconCamera, IconClipboard, IconPhone } from "@/components/Icons";
import { site } from "@/config/site";
import { pageMetadata } from "@/lib/seo";
import { DevisParams } from "./DevisParams";

export const metadata = pageMetadata({
  title: `${site.confirmations.devisGratuit ? "Devis gratuit" : "Demande de devis"} de débarras | BTS DÉBARRAT`,
  description: "Décrivez votre débarras en quatre étapes : type de lieu, caractéristiques du chantier, photos et coordonnées. BTS DÉBARRAT revient vers vous avec un devis.",
  path: "/devis/",
});

export default function PageDevis() {
  return (
    <>
      <PageHero
        eyebrow="Demande de devis"
        title="Présentez-nous votre débarras"
        intro="Quatre étapes, environ trois minutes. Plus votre description est précise, plus notre réponse sera fiable."
        crumbs={[{ name: "Demande de devis", path: "/devis/" }]}
      />
      <section className="bg-mist pb-24">
        <div className="container-x grid gap-10 lg:grid-cols-[1.5fr_0.7fr]">
          <div className="-mt-6 md:-mt-10">
            <Suspense fallback={<QuoteForm whatsappNumero={site.whatsapp} telephone={site.telephoneLien} />}>
              <DevisParams whatsappNumero={site.whatsapp} telephone={site.telephoneLien} />
            </Suspense>
          </div>
          <aside className="space-y-4 lg:pt-4">
            {[
              { I: IconClipboard, t: "Ce qui se passe ensuite", x: "Nous étudions votre demande et revenons vers vous pour préciser ce qui doit l'être, puis nous vous proposons un devis détaillé." },
              { I: IconCamera, t: "Les photos aident beaucoup", x: "Une photo par pièce, plus l'accès (escalier, entrée, rue) : c'est souvent suffisant pour une première estimation." },
              { I: IconPhone, t: "Vous préférez parler ?", x: "WhatsApp ou téléphone : choisissez le canal le plus simple pour vous." },
            ].map(({ I, t, x }) => (
              <div key={t} className="rounded-2xl bg-white p-6">
                <I className="size-6 text-accent" />
                <h2 className="mt-3 text-lg font-bold">{t}</h2>
                <p className="mt-1.5 text-[0.93rem] leading-relaxed text-muted">{x}</p>
              </div>
            ))}
            <div className="flex flex-col gap-3">
              <WhatsAppButton emplacement="page-devis" />
              <PhoneButton emplacement="page-devis" />
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
