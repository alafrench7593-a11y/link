import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/PageHero";
import { Photo } from "@/components/Photo";
import { Parallax } from "@/components/motion/ScrollScale";
import { photoService } from "@/config/photos";
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
          <div className="relative aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-mist-2">
            <Photo id={photoService[s.slug]} priority sizes="(min-width:1024px) 40vw, 100vw" />
          </div>
        }
      >
        <ButtonLink href={`/devis/?prestation=${s.typeBien}`} variant="primary" arrow={false}>{libelleDevis()}</ButtonLink>
        <WhatsAppButton message={s.whatsapp} emplacement={`service-${s.slug}-hero`}>Photos sur WhatsApp</WhatsAppButton>
      </PageHero>

      <section className="bg-white py-24 md:py-32">
        <div className="container-x grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-7">
            {s.intro.slice(1).map((p) => (
              <p key={p} data-reveal className="font-display text-[clamp(1.35rem,2.2vw,1.8rem)] font-medium leading-[1.35] tracking-[-0.02em] text-ink">{p}</p>
            ))}

            <h2 data-reveal className="mt-20 font-display text-[clamp(1.8rem,3vw,2.5rem)] font-semibold tracking-[-0.035em]">Ce que nous prenons en charge</h2>
            <ul className="mt-6 border-t border-line">
              {s.priseEnCharge.map((x, i) => (
                <li key={x} data-reveal style={{ "--d": i * 50 } as React.CSSProperties} className="flex gap-4 border-b border-line py-4 text-[1.02rem]">
                  <IconCheck className="mt-1 size-4 shrink-0 text-accent" />
                  {x}
                </li>
              ))}
            </ul>
            <p data-reveal className="mt-4 text-[0.9rem] text-muted">Le périmètre exact est défini dans le devis, selon votre situation.</p>

            <h2 data-reveal className="mt-20 font-display text-[clamp(1.8rem,3vw,2.5rem)] font-semibold tracking-[-0.035em]">Ce qu&apos;il faut anticiper</h2>
            <div className="mt-8 space-y-10">
              {s.pointsAttention.map((p, i) => (
                <div key={p.titre} data-reveal style={{ "--d": i * 80 } as React.CSSProperties} className="grid gap-2 md:grid-cols-[3rem_1fr]">
                  <span className="font-display text-[0.95rem] tabular-nums text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="font-display text-[1.3rem] font-semibold tracking-[-0.02em]">{p.titre}</h3>
                    <p className="mt-2 max-w-xl leading-relaxed text-muted">{p.texte}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="lg:col-span-4 lg:col-start-9 lg:sticky lg:top-24 lg:self-start">
            <div data-reveal className="rounded-[1.25rem] bg-mist p-7">
              <IconCamera className="size-6 text-accent" />
              <h2 className="mt-4 font-display text-[1.45rem] font-semibold leading-tight tracking-[-0.025em]">Préparer votre demande</h2>
              <ol className="mt-5 space-y-3">
                {s.preparation.map((x, i) => (
                  <li key={x} className="flex gap-3 text-[0.95rem] leading-relaxed text-ink/80">
                    <span className="tabular-nums text-stone">{i + 1}.</span>
                    {x}
                  </li>
                ))}
              </ol>
              <div className="mt-7 flex flex-col gap-3">
                <WhatsAppButton message={s.whatsapp} emplacement={`service-${s.slug}-encart`}>Envoyer mes photos</WhatsAppButton>
                <ButtonLink href={`/devis/?prestation=${s.typeBien}`} variant="primary" arrow={false}>Formulaire de devis</ButtonLink>
                <PhoneButton emplacement={`service-${s.slug}`} variant="outline" />
              </div>
              <p className="mt-5 text-[0.78rem] leading-relaxed text-muted">
                WhatsApp s&apos;ouvre avec un message prérempli ; vous y joignez vous-même vos photos avant d&apos;envoyer.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-white pb-8">
        <div className="mx-auto max-w-[96rem] px-3 md:px-6">
          <Parallax className="aspect-[16/9] rounded-[1.25rem] bg-mist-2 md:aspect-[21/9]" distance={80}>
            <Photo id="vide" sizes="100vw" />
          </Parallax>
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

      <section className="bg-white py-24 md:py-32">
        <div className="container-x grid gap-12 md:grid-cols-12">
          <div className="md:col-span-4"><SectionHeading title="Questions fréquentes" /></div>
          <div className="md:col-span-8"><Faq items={s.faq} /></div>
        </div>
      </section>

      <section className="bg-mist py-20 md:py-24">
        <div className="container-x">
          <h2 data-reveal className="text-[0.92rem] text-muted">Prestations proches</h2>
          <ul className="mt-4 border-t border-line">
            {lies.map((l, i) => (
              <li key={l.slug} data-reveal style={{ "--d": i * 70 } as React.CSSProperties}>
                <Link href={`/${l.slug}/`} className="group flex items-center justify-between gap-6 border-b border-line py-6">
                  <span className="font-display text-[1.4rem] font-semibold tracking-[-0.025em] transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-1.5 md:text-[1.8rem]">{l.nomMenu}</span>
                  <span className="hidden max-w-sm text-[0.92rem] text-muted md:block">{l.carte}</span>
                  <IconArrow className="size-5 shrink-0 text-ink/40 group-hover:text-ink" />
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
