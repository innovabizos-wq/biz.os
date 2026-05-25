import { z } from "zod";

import { DISPATCH_STATUSES, DISPATCH_STATUS_FILTERS } from "@/modules/dispatch/constants";
import {
  nonEmptyTextSchema,
  optionalTextSchema,
  uuidSchema,
} from "@/lib/validation/shared-schemas";

const optionalFormUuidSchema = uuidSchema
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalDateSchema = z
  .string()
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalTimeSchema = z
  .string()
  .optional()
  .or(z.literal("").transform(() => undefined));

export const dispatchStatusSchema = z.enum(DISPATCH_STATUSES);
export const dispatchStatusFilterSchema = z.enum(DISPATCH_STATUS_FILTERS);

export const createDispatchFromSaleSchema = z.object({
  contactoEntrega: optionalTextSchema,
  direccionEntrega: optionalTextSchema,
  fechaProgramada: optionalDateSchema,
  horaProgramada: optionalTimeSchema,
  notas: optionalTextSchema,
  responsableId: optionalFormUuidSchema,
  telefonoEntrega: optionalTextSchema,
  ventaId: uuidSchema,
});

export const updateDispatchSchema = createDispatchFromSaleSchema
  .omit({ ventaId: true })
  .extend({
    despachoId: uuidSchema,
  });

export const changeDispatchStatusSchema = z.object({
  despachoId: uuidSchema,
  estado: dispatchStatusSchema,
  resultado: optionalTextSchema,
});

export const dispatchResultSchema = z.object({
  resultado: nonEmptyTextSchema,
});

export type CreateDispatchFromSaleInput = z.infer<
  typeof createDispatchFromSaleSchema
>;
export type UpdateDispatchInput = z.infer<typeof updateDispatchSchema>;
export type ChangeDispatchStatusInput = z.infer<
  typeof changeDispatchStatusSchema
>;
