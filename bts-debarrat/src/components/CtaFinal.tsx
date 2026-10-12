import { ContactFinal } from "./home/ContactFinal";

/** Appel à l'action de fin de page, commun à toutes les pages. */
export function CtaFinal({ message }: { message?: string; titre?: string }) {
  return <ContactFinal message={message} />;
}
