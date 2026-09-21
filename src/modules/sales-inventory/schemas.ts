import { z } from "zod";

import { uuidSchema } from "@/lib/validation/shared-schemas";

export const applySaleInventorySchema = z.object({
  bodegaId: uuidSchema,
  operationId: uuidSchema,
  ventaId: uuidSchema,
});

export const reserveSaleInventorySchema = applySaleInventorySchema;

export const releaseSaleInventorySchema = z.object({
  operationId: uuidSchema,
  reason: z.string().trim().max(500).optional(),
  ventaId: uuidSchema,
});

export const markSaleWithoutInventorySchema = z.object({
  ventaId: uuidSchema,
});

export type ApplySaleInventoryInput = z.infer<typeof applySaleInventorySchema>;
export type ReserveSaleInventoryInput = z.infer<typeof reserveSaleInventorySchema>;
export type ReleaseSaleInventoryInput = z.infer<typeof releaseSaleInventorySchema>;
export type MarkSaleWithoutInventoryInput = z.infer<
  typeof markSaleWithoutInventorySchema
>;
