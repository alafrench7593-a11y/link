import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/PageHero";
import { Visual } from "@/components/Visual";
import { Faq } from "@/components/Faq";
import { CtaFinal } from "@/components/CtaFinal";
import { SectionHeading } from "@/components/Section";
import { ButtonLink, WhatsAppButton, PhoneButton, libelleDevis } from "@/components/Buttons";
import { IconArrow, IconCamera, IconCheck } from "@/components/Icons";
import { JsonLd } from "@/components/JsonLd";
import { TrackView } from "@/components/MotionProviders";
import { getService, servicesAvecPage } from "@/config/services";
import { realisationsPubliees } from "@/config/realisations";
import { faqJsonLd, pageMetadata, serviceJsonLd } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return servicesAvecPage().map((s) => ({ service: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ service: string }> }) {
  const s = getService((await params).service);
  if (!s) return {};
  return pageMetadata({ title: s.title, description: s.metaDescription, path: `/${s.slug}/` });
}

export default async function PageService({ params }: { params: Promise<{ service: string }> }) {
  const s = getService((await params).service);
  if (!s) notFound();
  const lies = s.lies.map((slug) => getService(slug)).filter((x) => x !== undefined);
  const chantiers = realisationsPubliees().filter((r) => r.service === s.slug);

  return (
    <>
      <TrackView evenement="service_consultation" label={s.slug} />
      <PageHero
        eyebrow={s.nomMenu}
        title={s.h1}
        intro={s.intro[0]}
        crumbs={[{ name: s.nomMenu, path: `/${s.slug}/` }]}
        aside={
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-mist-2 shadow-[0_40px_80px_-40px_rgba(17,19,18,0.45)]">
            <Visual photo={s.photo} alt={s.photoAlt} kind={s.illustration} priority sizes="(min-width:1024px) 45vw, 100vw" />
          </div>
        }
      >
        <WhatsAppButton message={s.whatsapp} emplacement={`service-${s.slug}-hero`} />
        <ButtonLink href={`/devis/?prestation=${s.typeBien}`} variant="dark">{libelleDevis()}</ButtonLink>
      </PageHero>

      <section className="py-20 md:py-28">
        <div className="container-x grid gap-14 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            {s.intro.slice(1).map((p) => (
              <p key={p} data-reveal className="text-[1.15rem] leading-relaxed text-ink/85">{p}</p>
            ))}
            <h2 data-reveal className="mt-14 text-[clamp(1.7rem,3vw,2.3rem)] font-extrabold">Ce que nous prenons en charge</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {s.priseEnCharge.map((x, i) => (
                <li key={x} data-reveal style={{ "--d": i * 60 } as React.CSSProperties} className="flex gap-3 rounded-xl border border-line p-4">
                  <IconCheck className="mt-0.5 size-5 shrink-0 text-accent" />
                  <span className="text-[0.98rem]">{x}</span>
                </li>
              ))}
            </ul>
            <p data-reveal className="mt-4 text-sm text-muted">Le périmètre exact est défini dans le devis, en fonction de votre situation.</p>

            <h2 data-reveal className="mt-16 text-[clamp(1.7rem,3vw,2.3rem)] font-extrabold">Les points à anticiper</h2>
            <div className="mt-6 space-y-4">
              {s.pointsAttention.map((p, i) => (
                <div key={p.titre} data-reveal style={{ "--d": i * 80 } as React.CSSProperties} className="rounded-2xl bg-mist p-6">
                  <h3 className="text-[1.15rem] font-bold">{p.titre}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{p.texte}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div data-reveal className="on-dark rounded-[1.5rem] bg-ink p-7 text-white">
              <span className="grid size-11 place-items-center rounded-xl bg-wa text-ink"><IconCamera className="size-5" /></span>
              <h2 className="mt-5 text-[1.5rem] font-extrabold leading-tight">Préparer votre demande</h2>
              <ol className="mt-5 space-y-3">
                {s.preparation.map((x, i) => (
                  <li key={x} className="flex gap-3 text-[0.95rem] text-white/80">
                    <span className="font-display font-extrabold text-accent-bright">{i + 1}.</span>
                    {x}
                  </li>
                ))}
              </ol>
              <div className="mt-7 flex flex-col gap-3">
                <WhatsAppButton message={s.whatsapp} emplacement={`service-${s.slug}-encart`}>Envoyer mes photos</WhatsAppButton>
                <ButtonLink href={`/devis/?prestation=${s.typeBien}`} variant="light">Formulaire de devis</ButtonLink>
                <PhoneButton emplacement={`service-${s.slug}`} variant="outline-light" />
              </div>
              <p className="mt-5 text-xs leading-relaxed text-white/50">
                WhatsApp s&apos;ouvre avec un message prérempli ; vous y joignez vous-même vos photos avant d&apos;envoyer.
              </p>
            </div>
          </aside>
        </div>
      </section>

      {chantiers.length > 0 && (
        <section className="bg-mist py-20">
          <div className="container-x">
            <SectionHeading eyebrow="Réalisations" title="Chantiers similaires" />
            <ul className="mt-10 grid gap-5 md:grid-cols-3">
              {chantiers.slice(0, 3).map((r) => (
                <li key={r.slug}>
                  <Link href={r.pageDediee ? `/realisations/${r.slug}/` : "/realisations/"} className="block font-semibold underline">{r.titre}</Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="bg-mist py-20 md:py-28">
        <div className="container-x grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
          <SectionHeading eyebrow="FAQ" title={`Questions fréquentes — ${s.nomCourt.toLowerCase()}`} />
          <Faq items={s.faq} />
        </div>
      </section>

      <section className="py-20">
        <div className="container-x">
          <h2 data-reveal className="text-2xl font-extrabold">Prestations proches</h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {lies.map((l, i) => (
              <li key={l.slug} data-reveal style={{ "--d": i * 80 } as React.CSSProperties}>
                <Link href={`/${l.slug}/`} className="group flex h-full items-center justify-between gap-4 rounded-2xl border border-line p-5 transition-colors hover:border-ink hover:bg-ink hover:text-white">
                  <span>
                    <span className="block font-semibold">{l.nomMenu}</span>
                    <span className="mt-1 block text-sm text-muted group-hover:text-white/70">{l.carte}</span>
                  </span>
                  <IconArrow className="btn-arrow size-5 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaFinal message={s.whatsapp} />
      <JsonLd data={serviceJsonLd(s.nomMenu, s.metaDescription, `/${s.slug}/`)} />
      <JsonLd data={faqJsonLd(s.faq)} />
    </>
  );
}
