import { z } from "zod";

import {
  CATALOG_CATEGORY_STATUSES,
  CATALOG_MONEDAS,
  CATALOG_PRODUCT_STATUSES,
  CATALOG_PRODUCT_STATUS_FILTERS,
  CATALOG_PRODUCT_TYPE_FILTERS,
  CATALOG_PRODUCT_TYPES,
  DEFAULT_CATALOG_MONEDA,
  DEFAULT_UNIDAD_MEDIDA,
} from "@/modules/catalog/constants";
import {
  nonEmptyTextSchema,
  optionalTextSchema,
  uuidSchema,
} from "@/lib/validation/shared-schemas";

const optionalFormUuidSchema = uuidSchema
  .optional()
  .or(z.literal("").transform(() => undefined));

const nonNegativeNumberSchema = z.coerce.number().min(0);

export const catalogCategoryStatusSchema = z.enum(CATALOG_CATEGORY_STATUSES);
export const catalogProductStatusSchema = z.enum(CATALOG_PRODUCT_STATUSES);
export const catalogProductTypeSchema = z.enum(CATALOG_PRODUCT_TYPES);
export const catalogProductTypeFilterSchema = z.enum(CATALOG_PRODUCT_TYPE_FILTERS);
export const catalogProductStatusFilterSchema = z.enum(
  CATALOG_PRODUCT_STATUS_FILTERS,
);
export const catalogMonedaSchema = z.enum(CATALOG_MONEDAS);

export const createCategorySchema = z.object({
  descripcion: optionalTextSchema,
  nombre: nonEmptyTextSchema,
});

export const updateCategorySchema = createCategorySchema.extend({
  categoriaId: uuidSchema,
});

export const changeCategoryStatusSchema = z.object({
  categoriaId: uuidSchema,
  estado: catalogCategoryStatusSchema,
});

export const createProductSchema = z.object({
  categoriaId: optionalFormUuidSchema,
  codigo: optionalTextSchema,
  descripcion: optionalTextSchema,
  impuestoPorcentaje: nonNegativeNumberSchema.max(100).default(0),
  moneda: catalogMonedaSchema.default(DEFAULT_CATALOG_MONEDA),
  nombre: nonEmptyTextSchema,
  precioBase: nonNegativeNumberSchema.default(0),
  tipo: catalogProductTypeSchema,
  unidadMedida: nonEmptyTextSchema.default(DEFAULT_UNIDAD_MEDIDA),
});

export const updateProductSchema = createProductSchema.extend({
  productoId: uuidSchema,
});

export const changeProductStatusSchema = z.object({
  estado: catalogProductStatusSchema,
  productoId: uuidSchema,
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ChangeCategoryStatusInput = z.infer<
  typeof changeCategoryStatusSchema
>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ChangeProductStatusInput = z.infer<typeof changeProductStatusSchema>;
