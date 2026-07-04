import { z } from "zod";

import {
  nonEmptyTextSchema,
  optionalTextSchema,
  uuidSchema,
} from "@/lib/validation/shared-schemas";

export const recordPaymentSchema = z.object({
  accountId: uuidSchema,
  metodo: nonEmptyTextSchema.default("manual"),
  monto: z.coerce.number().positive(),
  notas: optionalTextSchema,
  referencia: optionalTextSchema,
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
