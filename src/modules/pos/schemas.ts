import { z } from "zod";

const uuid = z.string().uuid();

export const createPosTerminalSchema = z.object({
  branchId: uuid.nullish(),
  code: z.string().trim().min(1).max(20),
  idempotencyKey: z.string().trim().min(8).max(200),
  name: z.string().trim().min(1).max(100),
  offlineEnabled: z.boolean().default(true),
  warehouseId: uuid,
});

export const openPosSessionSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200),
  openingCash: z.coerce.number().min(0).max(999_999_999_999),
  terminalId: uuid,
});

export const posSaleSchema = z.object({
  capturedAt: z.string().datetime({ offset: true }),
  clientOperationId: uuid,
  items: z.array(z.object({
    productId: uuid,
    quantity: z.number().positive().max(999_999),
  })).min(1).max(500),
  offline: z.boolean(),
  payments: z.array(z.object({
    amount: z.number().positive().max(999_999_999_999),
    method: z.enum(["cash", "card", "sinpe", "other"]),
    reference: z.string().trim().max(200).optional(),
    verified: z.boolean().optional(),
  })).min(1).max(10),
  sequence: z.number().int().positive(),
  sessionId: uuid,
});

export const closePosSessionSchema = z.object({
  countedCash: z.coerce.number().min(0).max(999_999_999_999),
  lastSequence: z.coerce.number().int().min(0),
  sessionId: uuid,
});
