import { z } from "zod";

import {
  optionalTextSchema,
  uuidSchema,
} from "@/lib/validation/shared-schemas";

export const recordPaymentSchema = z.object({
  accountId: uuidSchema,
  metodo: z.enum(["cash", "card", "sinpe", "transfer", "other"]).default("cash"),
  monto: z.coerce.number().positive().multipleOf(0.01),
  notas: optionalTextSchema,
  operationId: uuidSchema,
  referencia: optionalTextSchema,
}).superRefine((value, context) => {
  if (["card", "sinpe", "transfer"].includes(value.metodo) && !value.referencia) {
    context.addIssue({
      code: "custom",
      message: "La referencia es requerida para tarjeta, SINPE o transferencia.",
      path: ["referencia"],
    });
  }
});

export const voidPaymentAccountSchema = z.object({
  accountId: uuidSchema,
  notas: optionalTextSchema,
});

export const syncReceivablesSchema = z.object({
  intent: z.enum(["sync-receivables", "sync-payables"]).default("sync-receivables"),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type VoidPaymentAccountInput = z.infer<typeof voidPaymentAccountSchema>;
