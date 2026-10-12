"use client";

import Script from "next/script";
import Link from "next/link";
import { useEffect, useState } from "react";

const CLE = "bts-consentement-mesure";

/**
 * Plausible : sans cookie, chargé directement.
 * GA4 : chargé uniquement après acceptation explicite (bannière).
 */
export function Analytics({ fournisseur, identifiant }: { fournisseur: "plausible" | "ga4" | null; identifiant: string | null }) {
  const [consent, setConsent] = useState<"oui" | "non" | null>(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(CLE);
      if (v === "oui" || v === "non") setConsent(v);
    } catch {}
    setPret(true);
  }, []);

  useEffect(() => {
    (window as unknown as { __consentAnalytics?: boolean }).__consentAnalytics = consent === "oui";
  }, [consent]);

  if (!fournisseur || !identifiant) return null;

  if (fournisseur === "plausible") {
    return <Script defer data-domain={identifiant} src="https://plausible.io/js/script.js" strategy="afterInteractive" />;
  }

  const choisir = (v: "oui" | "non") => {
    setConsent(v);
    try {
      localStorage.setItem(CLE, v);
    } catch {}
  };

  return (
    <>
      {consent === "oui" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${identifiant}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${identifiant}',{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {pret && consent === null && (
        <div role="dialog" aria-label="Mesure d'audience" className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-xl rounded-2xl border border-line bg-white p-5 shadow-2xl md:bottom-6">
          <p className="text-sm leading-relaxed text-ink">
            Nous souhaitons mesurer la fréquentation du site pour l&apos;améliorer. Ces cookies de mesure ne sont déposés qu&apos;avec votre accord.{" "}
            <Link href="/cookies/" className="underline">En savoir plus</Link>
          </p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => choisir("non")} className="min-h-11 flex-1 rounded-full border border-ink/20 px-4 text-sm font-semibold">
              Refuser
            </button>
            <button type="button" onClick={() => choisir("oui")} className="min-h-11 flex-1 rounded-full bg-ink px-4 text-sm font-semibold text-white">
              Accepter
            </button>
          </div>
        </div>
      )}
    </>
  );
}
