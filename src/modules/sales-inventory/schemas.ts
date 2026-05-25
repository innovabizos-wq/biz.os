import { z } from "zod";

import { uuidSchema } from "@/lib/validation/shared-schemas";

export const applySaleInventorySchema = z.object({
  bodegaId: uuidSchema,
  ventaId: uuidSchema,
});

export const markSaleWithoutInventorySchema = z.object({
  ventaId: uuidSchema,
});

export type ApplySaleInventoryInput = z.infer<typeof applySaleInventorySchema>;
export type MarkSaleWithoutInventoryInput = z.infer<
  typeof markSaleWithoutInventorySchema
>;
