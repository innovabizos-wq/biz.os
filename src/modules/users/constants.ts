import type { ProfileEstado } from "@/types/core";

export const PROFILE_ESTADOS = [
  "activo",
  "inactivo",
  "suspendido",
] as const satisfies readonly ProfileEstado[];

export const DEFAULT_PROFILE_ESTADO: ProfileEstado = "activo";
