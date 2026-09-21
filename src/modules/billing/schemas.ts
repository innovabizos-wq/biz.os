import { z } from "zod";

import { optionalTextSchema, uuidSchema } from "@/lib/validation/shared-schemas";

export const fiscalEnvironmentSchema = z.enum(["pruebas", "produccion"]);

export const fiscalConfigurationSchema = z.object({
  actividadEconomica: z.string().trim().regex(/^\d{6}$/, "La actividad economica debe tener 6 digitos."),
  ambiente: fiscalEnvironmentSchema.default("pruebas"),
  barrio: z.string().trim().min(5).max(50).optional().or(z.literal("")),
  canton: z.string().trim().regex(/^\d{2}$/, "Canton debe tener 2 digitos."),
  condicionVenta: z.enum(["01", "02"]).default("01"),
  correoEmisor: z.string().trim().email("Correo emisor invalido."),
  distrito: z.string().trim().regex(/^\d{2}$/, "Distrito debe tener 2 digitos."),
  haciendaPassword: optionalTextSchema,
  haciendaUsuario: optionalTextSchema,
  identificacion: z.string().trim().min(9, "Indica la identificacion fiscal."),
  identificacionProveedorSistema: z.string().trim().min(1).max(20),
  medioPago: z.enum(["01", "02", "03", "04"]).default("01"),
  otrasSenas: z.string().trim().min(5, "Indica otras senas del domicilio fiscal.").max(250),
  p12Base64: optionalTextSchema,
  pin: optionalTextSchema,
  provincia: z.string().trim().regex(/^[1-7]$/, "Provincia debe ser un codigo del 1 al 7."),
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
  documentDirection: z.enum(["incoming", "outgoing"]).default("incoming"),
  importMode: z.enum(["preview", "import"]).default("preview"),
  importSource: z.enum(["manual_xml", "tico_factura", "rest_import", "other"]),
  linkedSaleId: uuidSchema.optional().or(z.literal("")),
  sourceName: z.string().trim().max(160).optional().or(z.literal("")),
  xmlText: z.string().trim().min(20, "Pega el XML recibido.").max(2_000_000),
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
