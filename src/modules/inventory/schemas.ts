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

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type ChangeWarehouseStatusInput = z.infer<
  typeof changeWarehouseStatusSchema
>;
export type CreateInventoryMovementInput = z.infer<
  typeof createInventoryMovementSchema
>;
export type UpdateStockLimitsInput = z.infer<typeof updateStockLimitsSchema>;
