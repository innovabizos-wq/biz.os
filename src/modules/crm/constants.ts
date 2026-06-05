import type {
  CrmClienteEstado,
  CrmClienteGenero,
  CrmClienteTipo,
  CrmInteraccionTipo,
  CrmSeguimientoEstado,
} from "@/modules/crm/types";

export const CRM_CLIENTE_TIPOS = [
  "prospecto",
  "cliente",
] as const satisfies readonly CrmClienteTipo[];

export const CRM_CLIENTE_ESTADOS = [
  "nuevo",
  "contactado",
  "calificado",
  "cotizado",
  "ganado",
  "perdido",
  "inactivo",
] as const satisfies readonly CrmClienteEstado[];

export const CRM_CLIENTE_GENEROS = [
  "h",
  "m",
  "o",
] as const satisfies readonly CrmClienteGenero[];

export const CRM_INTERACCION_TIPOS = [
  "nota",
  "llamada",
  "whatsapp",
  "correo",
  "reunion",
  "sistema",
] as const satisfies readonly CrmInteraccionTipo[];

export const CRM_SEGUIMIENTO_ESTADOS = [
  "pendiente",
  "completado",
  "cancelado",
] as const satisfies readonly CrmSeguimientoEstado[];
