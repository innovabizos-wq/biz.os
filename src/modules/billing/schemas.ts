import { z } from "zod";

import { optionalTextSchema, uuidSchema } from "@/lib/validation/shared-schemas";

export const fiscalEnvironmentSchema = z.enum(["pruebas", "produccion"]);

export const fiscalConfigurationSchema = z.object({
  actividadEconomica: z.string().trim().min(1, "Indica la actividad economica."),
  ambiente: fiscalEnvironmentSchema.default("pruebas"),
  correoEmisor: z.string().trim().email("Correo emisor invalido."),
  haciendaPassword: optionalTextSchema,
  haciendaUsuario: optionalTextSchema,
  identificacion: z.string().trim().min(9, "Indica la identificacion fiscal."),
  p12Base64: optionalTextSchema,
  pin: optionalTextSchema,
  razonSocial: z.string().trim().min(2, "Indica la razon social."),
  sucursal: z.string().trim().regex(/^\d{3}$/, "Sucursal debe tener 3 digitos."),
  terminal: z.string().trim().regex(/^\d{5}$/, "Terminal debe tener 5 digitos."),
  tipoIdentificacion: z.enum(["01", "02", "03", "04"]).default("02"),
});

export const issueInvoiceSchema = z.object({
  actividadEconomica: z.string().trim().min(1),
  condicionVenta: z.string().trim().min(1),
  correoReceptor: z.string().trim().email().optional().or(z.literal("")),
  identificacionReceptor: optionalTextSchema,
  medioPago: z.string().trim().min(1),
  nombreReceptor: optionalTextSchema,
  ventaId: uuidSchema,
});

export const prepareFiscalDocumentFromSaleSchema = z.object({
  documentTypeCode: z.enum(["01", "04"]).default("01"),
  ventaId: uuidSchema,
});

export const generateFiscalDocumentXmlSchema = z.object({
  documentId: uuidSchema,
});

export const signFiscalDocumentXmlSchema = z.object({
  documentId: uuidSchema,
});

export const sendFiscalDocumentToHaciendaSchema = z.object({
  documentId: uuidSchema,
});

export const queryFiscalDocumentHaciendaStatusSchema = z.object({
  documentId: uuidSchema,
});

export const issueFiscalDocumentNowSchema = z.object({
  documentId: uuidSchema,
});

export const recoverPendingFiscalDocumentsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export const generateFiscalPdfRepresentationSchema = z.object({
  documentId: uuidSchema,
});

export const registerFiscalDocumentDeliverySchema = z.object({
  deliveryType: z.enum(["download", "manual"]),
  documentId: uuidSchema,
  recipientEmail: z.string().trim().email().optional().or(z.literal("")),
});

export const registerReceivedFiscalXmlSchema = z.object({
  xmlText: z.string().trim().min(20, "Pega el XML recibido.").max(500_000),
});

export const prepareReceiverMessageSchema = z.object({
  detail: optionalTextSchema,
  receivedDocumentId: uuidSchema,
  responseStatus: z.enum(["accepted", "partially_accepted", "rejected"]),
});

export const assignProductCabysSchema = z.object({
  cabysCode: z.string().trim().regex(/^\d{1,20}$/, "Codigo CABYS invalido."),
  fiscalNotes: optionalTextSchema,
  fiscalUnitCode: optionalTextSchema,
  productId: uuidSchema,
});

export const importCabysCatalogSchema = z.object({
  cabysText: z.string().trim().min(20, "Pega el archivo CABYS.").max(1_000_000),
  importMode: z.enum(["dry_run", "import"]).default("dry_run"),
  sourceName: optionalTextSchema,
  sourceUrl: optionalTextSchema,
  sourceVersion: optionalTextSchema,
});
