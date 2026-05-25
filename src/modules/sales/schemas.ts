import { z } from "zod";

import { SALE_STATUS_FILTERS, SALE_STATUSES } from "@/modules/sales/constants";
import { optionalTextSchema, uuidSchema } from "@/lib/validation/shared-schemas";

export const saleStatusSchema = z.enum(SALE_STATUSES);
export const saleStatusFilterSchema = z.enum(SALE_STATUS_FILTERS);

export const generateSaleFromQuoteSchema = z.object({
  cotizacionId: uuidSchema,
});

export const changeSaleStatusSchema = z.object({
  estado: saleStatusSchema,
  ventaId: uuidSchema,
});

export const updateSaleNotesSchema = z.object({
  notas: optionalTextSchema,
  ventaId: uuidSchema,
});

export type GenerateSaleFromQuoteInput = z.infer<
  typeof generateSaleFromQuoteSchema
>;
export type ChangeSaleStatusInput = z.infer<typeof changeSaleStatusSchema>;
export type UpdateSaleNotesInput = z.infer<typeof updateSaleNotesSchema>;
