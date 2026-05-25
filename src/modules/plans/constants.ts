import type { CatalogEstado, EmpresaPlanEstado, PlanCode } from "@/types/core";

export const PLAN_CODES = [
  "starter",
  "pro",
  "enterprise",
] as const satisfies readonly PlanCode[];

export const PLAN_ESTADOS = [
  "activo",
  "inactivo",
] as const satisfies readonly CatalogEstado[];

export const EMPRESA_PLAN_ESTADOS = [
  "activo",
  "inactivo",
  "cancelado",
  "vencido",
] as const satisfies readonly EmpresaPlanEstado[];

export const DEFAULT_EMPRESA_PLAN_ESTADO: EmpresaPlanEstado = "activo";
