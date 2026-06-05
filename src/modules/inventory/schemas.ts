import { z } from "zod";

import {
  INVENTORY_MOVEMENT_TYPE_FILTERS,
  INVENTORY_MOVEMENT_TYPES,
  INVENTORY_WAREHOUSE_STATUSES,
} from "@/modules/inventory/constants";
import {
  nonEmptyTextSchema,
  optionalTextSchema,
  uuidSchema,
} from "@/lib/validation/shared-schemas";

const nonNegativeNumberSchema = z.coerce.number().min(0);
const positiveNumberSchema = z.coerce.number().positive();
const optionalFormUuidSchema = uuidSchema
  .optional()
  .or(z.literal("").transform(() => undefined));

export const warehouseStatusSchema = z.enum(INVENTORY_WAREHOUSE_STATUSES);
export const inventoryMovementTypeSchema = z.enum(INVENTORY_MOVEMENT_TYPES);
export const inventoryMovementTypeFilterSchema = z.enum(
  INVENTORY_MOVEMENT_TYPE_FILTERS,
);

export const createWarehouseSchema = z.object({
  descripcion: optionalTextSchema,
  nombre: nonEmptyTextSchema,
  ubicacion: optionalTextSchema,
});

export const updateWarehouseSchema = createWarehouseSchema.extend({
  bodegaId: uuidSchema,
});

export const changeWarehouseStatusSchema = z.object({
  bodegaId: uuidSchema,
  estado: warehouseStatusSchema,
});

export const createInventoryMovementSchema = z.object({
  bodegaId: uuidSchema,
  cantidad: positiveNumberSchema,
  motivo: optionalTextSchema,
  productoId: uuidSchema,
  tipo: inventoryMovementTypeSchema,
});

export const createInventoryTransferSchema = z
  .object({
    bodegaDestinoId: uuidSchema,
    bodegaOrigenId: uuidSchema,
    cantidad: positiveNumberSchema,
    motivo: optionalTextSchema,
    productoId: uuidSchema,
  })
  .refine((input) => input.bodegaDestinoId !== input.bodegaOrigenId, {
    message: "La bodega destino debe ser diferente a la bodega origen.",
    path: ["bodegaDestinoId"],
  });

export const updateStockLimitsSchema = z
  .object({
    bodegaId: uuidSchema,
    productoId: uuidSchema,
    stockMaximo: nonNegativeNumberSchema.optional().or(
      z.literal("").transform(() => undefined),
    ),
    stockMinimo: nonNegativeNumberSchema.default(0),
  })
  .refine(
    (input) =>
      input.stockMaximo === undefined || input.stockMaximo >= input.stockMinimo,
    {
      message: "El maximo debe ser mayor o igual al minimo.",
      path: ["stockMaximo"],
    },
  );

const optionalPositiveNumberSchema = z.coerce
  .number()
  .nonnegative()
  .optional()
  .or(z.literal("").transform(() => undefined));

export const createMaterialEntrySchema = z
  .object({
    bodegaId: optionalFormUuidSchema,
    cantidadInicial: optionalPositiveNumberSchema,
    categoriaId: optionalFormUuidSchema,
    codigo: optionalTextSchema,
    descripcion: optionalTextSchema,
    motivo: optionalTextSchema,
    nombre: nonEmptyTextSchema,
    precioBase: nonNegativeNumberSchema.default(0),
    unidadMedida: nonEmptyTextSchema.default("unidad"),
  })
  .refine(
    (input) =>
      !input.cantidadInicial || input.cantidadInicial === 0 || Boolean(input.bodegaId),
    {
      message: "La bodega es requerida cuando hay cantidad inicial.",
      path: ["bodegaId"],
    },
  );

export const importMaterialRowsSchema = z.object({
  bodegaId: optionalFormUuidSchema,
  categoriaId: optionalFormUuidSchema,
  motivo: optionalTextSchema,
  rowsJson: optionalTextSchema,
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type ChangeWarehouseStatusInput = z.infer<
  typeof changeWarehouseStatusSchema
>;
export type CreateInventoryMovementInput = z.infer<
  typeof createInventoryMovementSchema
>;
export type CreateInventoryTransferInput = z.infer<
  typeof createInventoryTransferSchema
>;
export type UpdateStockLimitsInput = z.infer<typeof updateStockLimitsSchema>;
export type CreateMaterialEntryInput = z.infer<typeof createMaterialEntrySchema>;
export type ImportMaterialRowsInput = z.infer<typeof importMaterialRowsSchema>;
