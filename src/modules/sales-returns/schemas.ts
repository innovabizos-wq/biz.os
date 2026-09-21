import { z } from "zod";

import { optionalTextSchema, uuidSchema } from "@/lib/validation/shared-schemas";

const returnQuantitySchema = z.coerce.number().positive().multipleOf(0.01);

export const createSalesReturnSchema = z.object({
  items: z
    .array(
      z.object({
        quantity: returnQuantitySchema,
        saleItemId: uuidSchema,
      }),
    )
    .min(1)
    .max(50),
  operationId: uuidSchema,
  reason: z.string().trim().min(3).max(500),
  saleId: uuidSchema,
});

export const settleSalesReturnFinancialSchema = z
  .object({
    method: z.enum(["cash", "card", "sinpe", "transfer", "other"]),
    notes: optionalTextSchema,
    operationId: uuidSchema,
    reference: optionalTextSchema,
    returnId: uuidSchema,
    saleId: uuidSchema,
  })
  .superRefine((value, context) => {
    if (["card", "sinpe", "transfer"].includes(value.method) && !value.reference) {
      context.addIssue({
        code: "custom",
        message: "La referencia es requerida para tarjeta, SINPE o transferencia.",
        path: ["reference"],
      });
    }
  });

export const applySalesReturnInventorySchema = z.object({
  operationId: uuidSchema,
  returnId: uuidSchema,
  saleId: uuidSchema,
  warehouseId: uuidSchema,
});

export const prepareSalesReturnCreditNoteSchema = z.object({
  operationId: uuidSchema,
  returnId: uuidSchema,
  saleId: uuidSchema,
});
