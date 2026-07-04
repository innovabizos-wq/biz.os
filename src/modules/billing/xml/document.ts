import type { FiscalDocumentDetail } from "@/modules/billing/queries";
import { buildBasicFiscalXml } from "@/modules/billing/xml/builders";
import type { FiscalXmlBuildResult, FiscalXmlDocumentType } from "@/modules/billing/xml/types";

const SUPPORTED_DOCUMENT_TYPES: FiscalXmlDocumentType[] = ["01", "02", "03", "04"];

function normalizeDocumentType(value: string): FiscalXmlDocumentType {
  if (SUPPORTED_DOCUMENT_TYPES.includes(value as FiscalXmlDocumentType)) {
    return value as FiscalXmlDocumentType;
  }

  throw new Error("Tipo documental preparado pero no implementado todavia.");
}

export function buildUnsignedXmlFromFiscalDocument(
  document: FiscalDocumentDetail,
): FiscalXmlBuildResult {
  if (document.status !== "validated") {
    throw new Error("El XML solo puede generarse para documentos fiscales validados.");
  }

  if (!document.clave || !document.consecutivo) {
    throw new Error(
      "Falta clave numerica y consecutivo fiscal. No se genera XML oficial sin esos datos.",
    );
  }

  return buildBasicFiscalXml({
    activityCode:
      typeof document.issuerSnapshot.activityCode === "string"
        ? document.issuerSnapshot.activityCode
        : null,
    clave: document.clave,
    consecutivo: document.consecutivo,
    documentTypeCode: normalizeDocumentType(document.documentTypeCode),
    issuer: {
      email: typeof document.issuerSnapshot.email === "string" ? document.issuerSnapshot.email : null,
      identificationNumber:
        typeof document.issuerSnapshot.identificationNumber === "string"
          ? document.issuerSnapshot.identificationNumber
          : null,
      identificationType:
        typeof document.issuerSnapshot.identificationType === "string"
          ? document.issuerSnapshot.identificationType
          : null,
      legalName:
        typeof document.issuerSnapshot.legalName === "string" ? document.issuerSnapshot.legalName : null,
    },
    issueDate: document.issueDatetime ?? document.createdAt,
    lines: document.lines.map((line) => ({
      cabysCode: line.cabysCode,
      detail: line.detail,
      discountAmount: line.discountAmount,
      grossAmount: line.grossAmount,
      lineNumber: line.lineNumber,
      quantity: line.quantity,
      subtotal: line.subtotal,
      taxAmount: line.taxAmount,
      taxes: line.taxes,
      totalLineAmount: line.totalLineAmount,
      unitCode: line.unitCode,
      unitPrice: line.unitPrice,
    })),
    receiver: {
      email: document.receiverEmail,
      identificationNumber:
        typeof document.receiverSnapshot.identificationNumber === "string"
          ? document.receiverSnapshot.identificationNumber
          : null,
      identificationType: document.receiverIdentificationType,
      name: document.receiverName,
    },
    totals: {
      totalComprobante:
        typeof document.totals.totalComprobante === "number" ? document.totals.totalComprobante : null,
      totalDescuentos:
        typeof document.totals.totalDescuentos === "number" ? document.totals.totalDescuentos : null,
      totalImpuestos:
        typeof document.totals.totalImpuestos === "number" ? document.totals.totalImpuestos : null,
      totalVenta: typeof document.totals.totalVenta === "number" ? document.totals.totalVenta : null,
      totalVentaNeta:
        typeof document.totals.totalVentaNeta === "number" ? document.totals.totalVentaNeta : null,
    },
  });
}
