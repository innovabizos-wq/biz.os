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
  ventaId: optionalFormUuidSchema,
});

export const dispatchResultSchema = z.object({
  resultado: nonEmptyTextSchema,
});

export const dispatchMobileTargetStatusSchema = z.enum([
  "en_ruta",
  "entregado",
  "fallido",
]);

export const dispatchMobileMetadataSchema = z
  .object({
    accuracyMeters: z.coerce.number().min(0).max(100_000).optional(),
    capturedAt: z.iso.datetime({ offset: true }),
    dispatchId: uuidSchema,
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    operationId: uuidSchema,
    receiverName: optionalTextSchema,
    result: optionalTextSchema,
    targetStatus: dispatchMobileTargetStatusSchema,
  })
  .superRefine((value, context) => {
    if (value.targetStatus === "entregado" && !value.receiverName) {
      context.addIssue({
        code: "custom",
        message: "El nombre del receptor es requerido.",
        path: ["receiverName"],
      });
    }
    if (value.targetStatus === "fallido" && !value.result) {
      context.addIssue({
        code: "custom",
        message: "Describe el resultado del intento.",
        path: ["result"],
      });
    }
  });

export type CreateDispatchFromSaleInput = z.infer<
  typeof createDispatchFromSaleSchema
>;
export type UpdateDispatchInput = z.infer<typeof updateDispatchSchema>;
export type ChangeDispatchStatusInput = z.infer<
  typeof changeDispatchStatusSchema
>;
export type DispatchMobileMetadataInput = z.infer<
  typeof dispatchMobileMetadataSchema
>;
