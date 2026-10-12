/**
 * Mesure des conversions. Aucun outil n'est chargé tant que site.analytics
 * n'est pas configuré ; avec GA4, rien n'est envoyé sans consentement.
 * Un clic sur un bouton n'est JAMAIS compté comme une demande reçue :
 * seul `devis_transmis` (réponse 200 du serveur) correspond à une demande effective.
 */
export type EvenementSuivi =
  | "whatsapp_clic"
  | "telephone_clic"
  | "devis_ouverture"
  | "devis_debut"
  | "devis_transmis"
  | "service_consultation"
  | "realisations_consultation"
  | "avis_google_clic";

type W = Window & {
  plausible?: (e: string, o?: { props?: Record<string, string> }) => void;
  gtag?: (...a: unknown[]) => void;
  dataLayer?: unknown[];
  __consentAnalytics?: boolean;
};

export function track(evenement: EvenementSuivi, props: Record<string, string> = {}) {
  if (typeof window === "undefined") return;
  const w = window as W;
  w.plausible?.(evenement, { props });
  if (w.gtag && w.__consentAnalytics) w.gtag("event", evenement, props);
  if (process.env.NODE_ENV !== "production") console.debug("[suivi]", evenement, props);
}
