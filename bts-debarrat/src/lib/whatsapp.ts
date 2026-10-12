import { site } from "@/config/site";

export const messageGeneral =
  "Bonjour BTS DÉBARRAT, je souhaite obtenir un devis pour un débarras. Le type de bien est [type de bien] et la ville est [ville]. Pouvez-vous m'indiquer les informations nécessaires ?";

/** Lien officiel wa.me ; null si le numéro n'est pas encore configuré. */
export function whatsappUrl(message: string = messageGeneral): string | null {
  const numero = site.whatsapp?.replace(/\D/g, "");
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(message)}`;
}

export function telUrl(): string | null {
  return site.telephoneLien ? `tel:${site.telephoneLien.replace(/[^\d+]/g, "")}` : null;
}
