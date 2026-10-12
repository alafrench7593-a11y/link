"use client";

import { useState } from "react";

export function CopyMessage({ texte }: { texte: string }) {
  const [copie, setCopie] = useState(false);
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      setCopie(false);
    }
  };
  return (
    <div>
      <textarea readOnly value={texte} rows={5} aria-label="Message de demande d'avis" className="w-full rounded-xl border border-line bg-white p-4 text-[0.95rem] leading-relaxed" />
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={copier} className="min-h-11 rounded-full bg-ink px-5 text-sm font-semibold text-white">
          {copie ? "Message copié ✓" : "Copier le message"}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(texte)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full bg-wa px-5 text-sm font-semibold text-ink">
          Partager via WhatsApp
        </a>
        <a href={`mailto:?subject=${encodeURIComponent("Votre avis sur BTS DÉBARRAT")}&body=${encodeURIComponent(texte)}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm font-semibold">
          Envoyer par e-mail
        </a>
      </div>
      <p className="sr-only" aria-live="polite">{copie ? "Message copié dans le presse-papiers" : ""}</p>
    </div>
  );
}
