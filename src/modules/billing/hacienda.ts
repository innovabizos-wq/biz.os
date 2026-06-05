import type { FiscalConfiguration } from "@/modules/billing/types";

export const HACIENDA_RECEPCION_URLS = {
  produccion: "https://api.comprobanteselectronicos.go.cr/recepcion/v1/recepcion",
  pruebas: "https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1/recepcion",
} as const;

export const HACIENDA_TOKEN_URLS = {
  produccion:
    "https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token",
  pruebas:
    "https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token",
} as const;

export function assertCanSignWithHacienda(config: FiscalConfiguration) {
  if (!config.listoParaEmitir) {
    throw new Error("Configuracion fiscal incompleta.");
  }

  throw new Error(
    "Firma XAdES-EPES pendiente: se requiere implementar el firmador XML con la llave .p12 antes de enviar a Hacienda.",
  );
}
