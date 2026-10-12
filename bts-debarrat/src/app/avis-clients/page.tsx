import { PageHero } from "@/components/PageHero";
import { Testimonials } from "@/components/Testimonials";
import { ButtonLink, WhatsAppButton } from "@/components/Buttons";
import { IconStar } from "@/components/Icons";
import { CtaFinal } from "@/components/CtaFinal";
import { site } from "@/config/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Avis clients BTS DÉBARRAT | Entreprise de débarras",
  description: "Retours authentiques de clients de BTS DÉBARRAT après leur débarras, avec leur source. Consultez les avis et laissez le vôtre.",
  path: "/avis-clients/",
});

const formatReleve = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function AvisClients() {
  const g = site.releveGoogle;
  return (
    <>
      <PageHero
        eyebrow="Avis clients"
        title="Ils nous ont fait confiance"
        intro="Découvrez les retours de nos clients après leur débarras. Chaque avis publié ici est authentique, reproduit avec l'accord de son auteur et accompagné de sa source."
        crumbs={[{ name: "Avis clients", path: "/avis-clients/" }]}
        aside={
          g && site.lienGoogleBusiness ? (
            <div className="rounded-[1.5rem] bg-white p-8 ">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Note Google</p>
              <p className="mt-3 flex items-center gap-3 font-display text-5xl font-semibold tracking-[-0.03em] font-display">
                {g.note.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                <span className="flex text-[#e2a93b]">{Array.from({ length: 5 }).map((_, i) => <IconStar key={i} filled={i < Math.round(g.note)} className="size-6" />)}</span>
              </p>
              <p className="mt-2 text-muted">{g.nombre} avis — relevé manuel du {formatReleve(g.dateReleve)}</p>
              <a href={site.lienGoogleBusiness} target="_blank" rel="noopener noreferrer" data-track="avis_google_clic" data-track-label="avis-note" className="mt-5 inline-block font-semibold text-accent underline">Voir la fiche Google</a>
            </div>
          ) : undefined
        }
      >
        {site.lienGoogleBusiness && (
          <a href={site.lienGoogleBusiness} target="_blank" rel="noopener noreferrer" data-track="avis_google_clic" data-track-label="avis-hero" className="inline-flex min-h-12 items-center rounded-full border border-ink/20 px-6 font-semibold hover:bg-ink hover:text-white">
            Nos avis sur Google
          </a>
        )}
        {site.lienAvisGoogle && (
          <a href={site.lienAvisGoogle} target="_blank" rel="noopener noreferrer" data-track="avis_google_clic" data-track-label="laisser-avis" className="inline-flex min-h-12 items-center rounded-full bg-ink px-6 font-semibold text-white hover:bg-accent">
            Laisser un avis
          </a>
        )}
      </PageHero>

      <section className="py-20 md:py-28">
        <div className="container-x">
          {site.avis.length > 0 ? (
            <>
              <p className="mb-8 text-sm text-muted">{site.avis.length} avis publiés sur cette page.</p>
              <Testimonials avis={site.avis} />
            </>
          ) : (
            <div data-reveal className="mx-auto max-w-2xl text-center">
              <h2 className="text-[clamp(1.7rem,3vw,2.4rem)] font-semibold tracking-[-0.03em] font-display">Les premiers avis seront publiés ici</h2>
              <p className="mt-4 leading-relaxed text-muted">
                Nous ne publions que des avis réels, avec l&apos;accord de leurs auteurs et en indiquant leur source. Aucun avis n&apos;est rédigé, sélectionné contre rémunération ou modifié par nos soins.
              </p>
            </div>
          )}
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/devis/" variant="dark">Demander un devis</ButtonLink>
            <WhatsAppButton emplacement="page-avis" />
          </div>
        </div>
      </section>
      <CtaFinal />
    </>
  );
}
