import type { FiscalDocumentDetail } from "@/modules/billing/queries";
import { buildBasicFiscalXml } from "@/modules/billing/xml/builders";
import type { FiscalXmlBuildResult, FiscalXmlDocumentType } from "@/modules/billing/xml/types";

const SUPPORTED_DOCUMENT_TYPES: FiscalXmlDocumentType[] = ["01", "02", "03", "04"];

function text(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nestedRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

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

  const issuerAddress = nestedRecord(document.issuerSnapshot, "address");
  const totalComprobante =
    typeof document.totals.totalComprobante === "number"
      ? document.totals.totalComprobante
      : null;
  const defaultPaymentMethod =
    text(document.issuerSnapshot, "defaultPaymentMethodCode") ?? "01";
  const exchangeRate = document.exchangeRate ?? (document.currencyCode === "CRC" ? 1 : 0);
  if (exchangeRate <= 0) {
    throw new Error("Falta el tipo de cambio utilizado por el documento fiscal.");
  }

  return buildBasicFiscalXml({
    activityCode:
      typeof document.issuerSnapshot.activityCode === "string"
        ? document.issuerSnapshot.activityCode
        : null,
    clave: document.clave,
    consecutivo: document.consecutivo,
    creditTermDays: document.creditTermDays,
    currencyCode: document.currencyCode,
    documentTypeCode: normalizeDocumentType(document.documentTypeCode),
    exchangeRate,
    issuer: {
      address: {
        addressLine: text(issuerAddress, "addressLine"),
        cantonCode: text(issuerAddress, "cantonCode"),
        districtCode: text(issuerAddress, "districtCode"),
        neighborhood: text(issuerAddress, "neighborhood"),
        provinceCode: text(issuerAddress, "provinceCode"),
      },
      email: text(document.issuerSnapshot, "email"),
      identificationNumber: text(document.issuerSnapshot, "identificationNumber"),
      identificationType: text(document.issuerSnapshot, "identificationType"),
      legalName: text(document.issuerSnapshot, "legalName"),
      softwareProviderIdentification: text(
        document.issuerSnapshot,
        "softwareProviderIdentification",
      ),
    },
    issueDate: document.issueDatetime ?? document.createdAt,
    lines: document.lines.map((line) => ({
      cabysCode: line.cabysCode,
      commercialCode: line.commercialCode,
      detail: line.detail,
      discountAmount: line.discountAmount,
      grossAmount: line.grossAmount,
      lineNumber: line.lineNumber,
      quantity: line.quantity,
      subtotal: line.subtotal,
      taxableBase: line.taxableBase,
      taxAmount: line.taxAmount,
      taxes: line.taxes,
      totalLineAmount: line.totalLineAmount,
      unitCode: line.unitCode,
      unitPrice: line.unitPrice,
    })),
    paymentMethods: document.payments.length
      ? document.payments.map((payment) => ({
          amount: payment.amount,
          code: payment.paymentMethodCode,
        }))
      : totalComprobante !== null
        ? [{ amount: totalComprobante, code: defaultPaymentMethod }]
        : [],
    receiver: {
      email: document.receiverEmail,
      identificationNumber:
        typeof document.receiverSnapshot.identificationNumber === "string"
          ? document.receiverSnapshot.identificationNumber
          : null,
      identificationType: document.receiverIdentificationType,
      name: document.receiverName,
    },
    references: document.references.map((reference) => ({
      code: reference.referenceCode,
      documentTypeCode: reference.referenceDocumentTypeCode,
      issueDate: reference.referenceIssueDate,
      reason: reference.reason,
      reference: reference.referenceClave,
    })),
    saleConditionCode:
      document.saleConditionCode ??
      text(document.issuerSnapshot, "defaultSaleConditionCode") ??
      "01",
    totals: {
      totalComprobante,
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
