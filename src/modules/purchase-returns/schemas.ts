import { z } from "zod";

import { optionalTextSchema, uuidSchema } from "@/lib/validation/shared-schemas";

const quantitySchema = z.coerce.number().positive().multipleOf(0.01);

export const createPurchaseReturnSchema = z.object({
  items: z
    .array(
      z.object({
        quantity: quantitySchema,
        receiptItemId: uuidSchema,
      }),
    )
    .min(1)
    .max(50),
  operationId: uuidSchema,
  orderId: uuidSchema,
  reason: z.string().trim().min(3).max(500),
});

export const applyPurchaseReturnInventorySchema = z.object({
  operationId: uuidSchema,
  orderId: uuidSchema,
  returnId: uuidSchema,
});

export const settlePurchaseReturnFinancialSchema = z.object({
  operationId: uuidSchema,
  orderId: uuidSchema,
  returnId: uuidSchema,
  supplierDocumentReference: optionalTextSchema,
});
