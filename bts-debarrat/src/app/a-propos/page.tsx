import { PageHero } from "@/components/PageHero";
import { SectionHeading } from "@/components/Section";
import { CtaFinal } from "@/components/CtaFinal";
import { arguments_ } from "@/content/engagements";
import { site } from "@/config/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "À propos de BTS DÉBARRAT | Entreprise de débarras en Île-de-France",
  description: "BTS DÉBARRAT intervient pour le débarras de logements et de locaux professionnels à Paris et en Île-de-France. Notre façon de travailler et nos engagements.",
  path: "/a-propos/",
});

export default function APropos() {
  return (
    <>
      <PageHero eyebrow="À propos" title="Libérer un lieu, sans compliquer la vie de ceux qui le quittent" crumbs={[{ name: "À propos", path: "/a-propos/" }]} />
      <section className="py-20 md:py-28">
        <div className="container-x grid gap-14 lg:grid-cols-[1fr_1fr]">
          <div className="prose-site max-w-none text-[1.08rem] text-ink/85">
            <p data-reveal>
              Un débarras arrive rarement à un moment anodin : une succession, une vente, un déménagement, une fin de bail, un local à rendre. BTS DÉBARRAT a été pensé pour ces moments-là : comprendre la situation, poser les bonnes questions, puis prendre en charge l&apos;organisation matérielle.
            </p>
            <p data-reveal>
              Nous travaillons pour les particuliers comme pour les professionnels, à Paris et en Île-de-France selon les zones desservies. Chaque intervention commence par l&apos;étude du lieu et se conclut par un devis écrit que vous validez.
            </p>
            {/* [À COMPLÉTER] histoire de l'entreprise, fondateur, date de création, équipe — uniquement des faits réels. */}
          </div>
          <div className="rounded-[1.5rem] border border-dashed border-line p-8 text-sm leading-relaxed text-muted">
            <p className="font-semibold text-ink">Emplacement à compléter</p>
            <p className="mt-2">Photo réelle de l&apos;équipe ou d&apos;un chantier, date de création, parcours du dirigeant. Ces éléments renforcent la confiance ; ils ne doivent être publiés que s&apos;ils sont exacts.</p>
          </div>
        </div>
      </section>
      <section className="bg-mist py-20 md:py-28">
        <div className="container-x">
          <SectionHeading eyebrow="Nos engagements" title="Ce sur quoi vous pouvez compter" />
          <ul className="mt-12 grid gap-5 md:grid-cols-3">
            {arguments_.filter((a) => a.actif).map((a, i) => (
              <li key={a.titre} data-reveal style={{ "--d": (i % 3) * 80 } as React.CSSProperties} className="rounded-2xl bg-white p-7">
                <h3 className="text-lg font-bold">{a.titre}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{a.texte}</p>
              </li>
            ))}
          </ul>
          {(site.assurance || site.certifications.length > 0 || site.engagementsEnvironnement.length > 0) && (
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {site.assurance && <div className="rounded-2xl bg-white p-7"><h3 className="font-bold">Assurance</h3><p className="mt-2 text-muted">{site.assurance.assureur}{site.assurance.contrat ? ` — contrat ${site.assurance.contrat}` : ""}</p></div>}
              {site.certifications.length > 0 && <div className="rounded-2xl bg-white p-7"><h3 className="font-bold">Certifications</h3><ul className="mt-2 text-muted">{site.certifications.map((c) => <li key={c}>{c}</li>)}</ul></div>}
              {site.engagementsEnvironnement.length > 0 && <div className="rounded-2xl bg-white p-7"><h3 className="font-bold">Environnement</h3><ul className="mt-2 text-muted">{site.engagementsEnvironnement.map((c) => <li key={c}>{c}</li>)}</ul></div>}
            </div>
          )}
        </div>
      </section>
      <div className="pt-20"><CtaFinal /></div>
    </>
  );
}
