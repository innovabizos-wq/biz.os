import { z } from "zod";

import {
  nonEmptyTextSchema,
  optionalTextSchema,
  uuidSchema,
} from "@/lib/validation/shared-schemas";

export const createSupplierSchema = z.object({
  correo: optionalTextSchema,
  direccion: optionalTextSchema,
  identificacion: optionalTextSchema,
  nombre: nonEmptyTextSchema,
  notas: optionalTextSchema,
  telefono: optionalTextSchema,
});

export const createPurchaseOrderSchema = z.object({
  bodegaId: uuidSchema,
  estado: z.enum(["borrador", "emitida"]).default("emitida"),
  items: z
    .array(
      z.object({
        cantidad: z.coerce.number().positive(),
        costoUnitario: z.coerce.number().nonnegative(),
        descripcion: optionalTextSchema,
        impuestoPorcentaje: z.coerce.number().nonnegative().default(0),
        productoId: uuidSchema,
      }),
    )
    .min(1),
  notas: optionalTextSchema,
  supplierId: uuidSchema,
});

export const receivePurchaseOrderSchema = z.object({
  items: z
    .array(
      z.object({
        cantidad: z.coerce.number().nonnegative(),
        itemId: uuidSchema,
      }),
    )
    .min(1),
  notas: optionalTextSchema,
  orderId: uuidSchema,
});

export const changePurchaseOrderStatusSchema = z.object({
  orderId: uuidSchema,
});

export const updateSupplierStatusSchema = z.object({
  estado: z.enum(["activo", "inactivo"]),
  supplierId: uuidSchema,
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;
