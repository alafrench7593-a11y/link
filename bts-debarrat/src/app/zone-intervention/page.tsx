import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { ZoneMap } from "@/components/ZoneMap";
import { CtaFinal } from "@/components/CtaFinal";
import { WhatsAppButton } from "@/components/Buttons";
import { departements, communesPubliees, communesConfirmees } from "@/config/zones";
import { servicesAvecPage } from "@/config/services";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Zone d'intervention : Paris et Île-de-France | BTS DÉBARRAT",
  description: "BTS DÉBARRAT étudie les demandes de débarras à Paris et dans les départements d'Île-de-France. Vérifiez si votre commune est desservie.",
  path: "/zone-intervention/",
});

export default function Zone() {
  const publiees = communesPubliees();
  const confirmees = communesConfirmees();
  return (
    <>
      <PageHero
        eyebrow="Zone d'intervention"
        title="Débarras à Paris et en Île-de-France"
        intro="Nous étudions les demandes dans les huit départements franciliens. Pour savoir si nous pouvons intervenir chez vous, indiquez simplement votre commune : la réponse dépend de l'adresse et du chantier."
        crumbs={[{ name: "Zone d'intervention", path: "/zone-intervention/" }]}
      >
        <WhatsAppButton emplacement="zone-hero" message="Bonjour BTS DÉBARRAT, intervenez-vous à [ville] ? Il s'agit du débarras d'un(e) [type de bien]." >Vérifier ma commune</WhatsAppButton>
      </PageHero>
      <section className="py-20 md:py-28">
        <div className="container-x">
          <ZoneMap departements={departements} />
        </div>
      </section>
      <section className="bg-mist py-20">
        <div className="container-x grid gap-12 lg:grid-cols-2">
          <div className="prose-site">
            <h2>Ce qui change d&apos;une commune à l&apos;autre</h2>
            <p>À Paris et en petite couronne, le stationnement du véhicule de chargement, les immeubles sans ascenseur et les règles de copropriété sont les contraintes les plus fréquentes. En grande couronne, les maisons avec sous-sol, combles et dépendances représentent souvent des volumes plus importants.</p>
            <p>Ces différences se retrouvent dans l&apos;organisation de l&apos;intervention et dans le devis. C&apos;est pourquoi nous vous demandons la ville et le code postal dès le premier contact.</p>
          </div>
          <div>
            <h2 className="text-xl font-bold">Communes</h2>
            {confirmees.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {confirmees.map((c) => {
                  const page = publiees.find((p) => p.slug === c.slug);
                  return (
                    <li key={c.slug}>
                      {page ? (
                        <Link href={`/zone-intervention/${c.slug}/`} className="inline-block rounded-full bg-white px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-white">{c.nom} ({c.departement})</Link>
                      ) : (
                        <span className="inline-block rounded-full bg-white px-4 py-2 text-sm">{c.nom} ({c.departement})</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 leading-relaxed text-muted">La liste des communes desservies sera publiée prochainement. En attendant, indiquez votre commune dans votre demande.</p>
            )}
            <h2 className="mt-10 text-xl font-bold">Prestations</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {servicesAvecPage().map((s) => <li key={s.slug}><Link className="text-accent underline underline-offset-2" href={`/${s.slug}/`}>{s.nomMenu}</Link></li>)}
            </ul>
          </div>
        </div>
      </section>
      <div className="pt-20"><CtaFinal /></div>
    </>
  );
}
