import type { EmpresaEstado } from "@/types/core";

export const EMPRESA_ESTADOS = [
  "activa",
  "inactiva",
  "suspendida",
] as const satisfies readonly EmpresaEstado[];

export const DEFAULT_EMPRESA_ESTADO: EmpresaEstado = "activa";
