import type { CatalogEstado, ModuleCode } from "@/types/core";

export const MODULE_CODES = [
  "admin",
  "crm",
  "sales",
  "inventory",
  "billing",
  "dispatch",
  "hr",
  "reports",
  "ai",
] as const satisfies readonly ModuleCode[];

export const MODULO_ESTADOS = [
  "activo",
  "inactivo",
] as const satisfies readonly CatalogEstado[];

export const DEFAULT_MODULO_ESTADO: CatalogEstado = "activo";
