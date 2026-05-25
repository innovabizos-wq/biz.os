import type { RolEstado } from "@/types/core";

export const ROL_ESTADOS = [
  "activo",
  "inactivo",
] as const satisfies readonly RolEstado[];

export const DEFAULT_ROL_ESTADO: RolEstado = "activo";
