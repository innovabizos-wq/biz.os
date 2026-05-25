import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const optionalUuidSchema = uuidSchema.optional();

export const nullableUuidSchema = uuidSchema.nullable();

export const emailSchema = z.string().trim().email().toLowerCase();

export const nonEmptyTextSchema = z.string().trim().min(1);

export const optionalTextSchema = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const jsonRecordSchema = z.record(z.string(), z.unknown());

export const phoneSchema = optionalTextSchema;

export const dateStringSchema = z.string().datetime();
