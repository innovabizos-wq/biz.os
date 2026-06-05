import type { CatalogEstado, ModuleCode } from "@/types/core";
import { PLATFORM_MODULES } from "@/modules/platform-modules/module-catalog";

export const MODULE_CODES = PLATFORM_MODULES.map(
  (module) => module.code,
) as ModuleCode[];

export const CORE_MODULE_CODES = PLATFORM_MODULES.filter(
  (module) => module.kind === "core",
).map((module) => module.code) as ModuleCode[];

export const MODULO_ESTADOS = [
  "activo",
  "inactivo",
] as const satisfies readonly CatalogEstado[];

export const DEFAULT_MODULO_ESTADO: CatalogEstado = "activo";
