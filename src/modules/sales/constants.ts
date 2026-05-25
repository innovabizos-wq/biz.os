import type { SaleStatus, SaleStatusFilter } from "@/modules/sales/types";

export const SALE_STATUSES = [
  "nueva",
  "confirmada",
  "en_proceso",
  "completada",
  "cancelada",
] as const satisfies readonly SaleStatus[];

export const SALE_STATUS_FILTERS = [
  ...SALE_STATUSES,
  "todos",
] as const satisfies readonly SaleStatusFilter[];

export const DEFAULT_SALE_STATUS_FILTER: SaleStatusFilter = "todos";
