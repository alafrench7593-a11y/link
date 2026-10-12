import Link from "next/link";
import { site } from "@/config/site";
import { IconArrow, IconStar } from "../Icons";

/** Avis réels uniquement. Sans avis, la section l'annonce sobrement — rien n'est simulé. */
export function AvisSection() {
  const [premier, ...autres] = site.avis;
  return (
    <section className="bg-white py-24 md:py-32" aria-labelledby="titre-avis">
      <div className="container-x">
        <div className="flex flex-col justify-between gap-6 border-t border-line pt-10 md:flex-row md:items-end">
          <h2 id="titre-avis" data-reveal className="font-display text-[clamp(2rem,4vw,3.2rem)] font-semibold leading-[1.02] tracking-[-0.04em]">
            Ils nous ont fait confiance
          </h2>
          <div data-reveal className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.92rem]">
            {site.releveGoogle && site.lienGoogleBusiness && (
              <a href={site.lienGoogleBusiness} target="_blank" rel="noopener noreferrer" data-track="avis_google_clic" data-track-label="accueil-note" className="inline-flex items-center gap-2">
                <span className="font-display text-[1.4rem] font-semibold">{site.releveGoogle.note.toLocaleString("fr-FR", { minimumFractionDigits: 1 })}</span>
                <IconStar className="size-4 text-accent-bright" />
                <span className="text-muted">{site.releveGoogle.nombre} avis Google</span>
              </a>
            )}
            <Link href="/avis-clients/" className="group inline-flex min-h-11 items-center gap-1.5 font-medium">
              Tous les avis <IconArrow className="btn-arrow size-4" />
            </Link>
          </div>
        </div>

        {premier ? (
          <div className="mt-14 grid gap-12 md:grid-cols-12">
            <figure data-reveal className="md:col-span-7">
              <blockquote className="font-display text-[clamp(1.5rem,2.8vw,2.3rem)] font-medium leading-[1.25] tracking-[-0.02em]">« {premier.texte} »</blockquote>
              <figcaption className="mt-6 text-[0.92rem] text-muted">
                <span className="font-medium text-ink">{premier.auteur}</span> · {[premier.prestation, premier.ville, premier.source].filter(Boolean).join(" · ")}
              </figcaption>
            </figure>
            <ul className="space-y-8 md:col-span-4 md:col-start-9">
              {autres.slice(0, 3).map((a, i) => (
                <li key={i} data-reveal style={{ "--d": (i + 1) * 100 } as React.CSSProperties} className="border-t border-line pt-5">
                  <p className="leading-relaxed text-ink/85">« {a.texte} »</p>
                  <p className="mt-3 text-[0.85rem] text-muted"><span className="text-ink">{a.auteur}</span> · {a.source}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p data-reveal className="mt-10 max-w-xl text-[1.02rem] leading-relaxed text-muted">
            Les avis de nos clients seront publiés ici tels qu&apos;ils ont été rédigés, avec leur source. Aucun avis n&apos;est écrit, retouché ou sélectionné par nos soins.
          </p>
        )}
      </div>
    </section>
  );
}
