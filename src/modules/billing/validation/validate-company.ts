import type { FiscalConfiguration } from "@/modules/billing/types";
import { validationResult } from "@/modules/billing/validation/types";

export function validateFiscalSettingsCompleteness(config: FiscalConfiguration) {
  return validationResult([
    !config.razonSocial
      ? { code: "missing_legal_name", group: "Empresa" as const, message: "Falta razon social." }
      : null,
    !config.identificacion
      ? { code: "missing_identification", group: "Empresa" as const, message: "Falta identificacion fiscal." }
      : null,
    !config.correoEmisor
      ? { code: "missing_email", group: "Empresa" as const, message: "Falta correo emisor." }
      : null,
    !config.actividadEconomica
      ? { code: "missing_activity", group: "Empresa" as const, message: "Falta actividad economica." }
      : null,
    !config.hasP12 || !config.hasPin
      ? { code: "missing_certificate", group: "Certificado" as const, message: "Falta certificado o PIN." }
      : null,
    !config.hasHaciendaUsuario || !config.hasHaciendaPassword
      ? { code: "missing_hacienda_credentials", group: "Hacienda" as const, message: "Faltan credenciales Hacienda." }
      : null,
  ].filter((issue) => issue !== null));
}
