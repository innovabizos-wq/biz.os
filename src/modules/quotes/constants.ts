import type { QuoteStatus, QuoteStatusFilter } from "@/modules/quotes/types";

export const QUOTE_STATUSES = [
  "borrador",
  "enviada",
  "aceptada",
  "rechazada",
  "vencida",
  "anulada",
] as const satisfies readonly QuoteStatus[];

export const QUOTE_STATUS_FILTERS = [
  ...QUOTE_STATUSES,
  "todos",
] as const satisfies readonly QuoteStatusFilter[];

export const QUOTE_MONEDAS = ["CRC", "USD"] as const;

export const DEFAULT_QUOTE_MONEDA = "CRC";
export const DEFAULT_QUOTE_STATUS_FILTER: QuoteStatusFilter = "todos";
