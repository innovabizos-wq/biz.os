import type { SucursalEstado } from "@/types/core";

export const SUCURSAL_ESTADOS = [
  "activa",
  "inactiva",
] as const satisfies readonly SucursalEstado[];

export const DEFAULT_SUCURSAL_ESTADO: SucursalEstado = "activa";
