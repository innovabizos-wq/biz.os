import type {
  CatalogCategoryStatus,
  CatalogProductStatus,
  CatalogProductStatusFilter,
  CatalogProductType,
  CatalogProductTypeFilter,
} from "@/modules/catalog/types";

export const CATALOG_CATEGORY_STATUSES = [
  "activa",
  "inactiva",
] as const satisfies readonly CatalogCategoryStatus[];

export const CATALOG_PRODUCT_TYPES = [
  "producto",
  "servicio",
] as const satisfies readonly CatalogProductType[];

export const CATALOG_PRODUCT_STATUSES = [
  "activo",
  "inactivo",
] as const satisfies readonly CatalogProductStatus[];

export const CATALOG_PRODUCT_TYPE_FILTERS = [
  ...CATALOG_PRODUCT_TYPES,
  "todos",
] as const satisfies readonly CatalogProductTypeFilter[];

export const CATALOG_PRODUCT_STATUS_FILTERS = [
  ...CATALOG_PRODUCT_STATUSES,
  "todos",
] as const satisfies readonly CatalogProductStatusFilter[];

export const CATALOG_MONEDAS = ["CRC", "USD"] as const;
export const DEFAULT_CATALOG_MONEDA = "CRC";
export const DEFAULT_UNIDAD_MEDIDA = "unidad";
export const DEFAULT_PRODUCT_TYPE_FILTER: CatalogProductTypeFilter = "todos";
export const DEFAULT_PRODUCT_STATUS_FILTER: CatalogProductStatusFilter = "todos";
