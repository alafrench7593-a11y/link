"use client";

import { useSearchParams } from "next/navigation";
import { QuoteForm } from "@/components/QuoteForm";

export function DevisParams(props: { whatsappNumero: string | null; telephone: string | null }) {
  const params = useSearchParams();
  return <QuoteForm {...props} prestationInitiale={params.get("prestation") ?? undefined} />;
}
