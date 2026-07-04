import { escapeXmlText } from "@/modules/billing/xml/serialize";
import type { FiscalXmlBuildInput, FiscalXmlBuildResult } from "@/modules/billing/xml/types";

const ROOTS: Record<string, string> = {
  "01": "FacturaElectronica",
  "02": "NotaDebitoElectronica",
  "03": "NotaCreditoElectronica",
  "04": "TiqueteElectronico",
};

function tag(name: string, value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  return `<${name}>${escapeXmlText(String(value))}</${name}>`;
}

function amount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(5) : null;
}

function buildIdentification(type: string | null, number: string | null) {
  if (!type || !number) return "";
  return [
    `<Identificacion>`,
    tag("Tipo", type),
    tag("Numero", number),
    `</Identificacion>`,
  ].join("");
}

function buildIssuer(input: FiscalXmlBuildInput) {
  return [
    `<Emisor>`,
    tag("Nombre", input.issuer.legalName),
    buildIdentification(input.issuer.identificationType, input.issuer.identificationNumber),
    tag("CorreoElectronico", input.issuer.email),
    `</Emisor>`,
  ].join("");
}

function buildReceiver(input: FiscalXmlBuildInput) {
  if (!input.receiver.name && !input.receiver.identificationNumber && !input.receiver.email) {
    return "";
  }

  return [
    `<Receptor>`,
    tag("Nombre", input.receiver.name),
    buildIdentification(input.receiver.identificationType, input.receiver.identificationNumber),
    tag("CorreoElectronico", input.receiver.email),
    `</Receptor>`,
  ].join("");
}

function buildTaxes(taxes: FiscalXmlBuildInput["lines"][number]["taxes"]) {
  return taxes
    .map((tax) =>
      [
        `<Impuesto>`,
        tag("Codigo", tax.taxCode),
        tag("CodigoTarifaIVA", tax.taxRateCode),
        tag("Tarifa", amount(tax.rate)),
        tag("Monto", amount(tax.amount)),
        `</Impuesto>`,
      ].join(""),
    )
    .join("");
}

function buildLines(input: FiscalXmlBuildInput) {
  return [
    `<DetalleServicio>`,
    ...input.lines.map((line) =>
      [
        `<LineaDetalle>`,
        tag("NumeroLinea", line.lineNumber),
        tag("CodigoCABYS", line.cabysCode),
        tag("Cantidad", amount(line.quantity)),
        tag("UnidadMedida", line.unitCode),
        tag("Detalle", line.detail),
        tag("PrecioUnitario", amount(line.unitPrice)),
        tag("MontoTotal", amount(line.grossAmount)),
        tag("SubTotal", amount(line.subtotal)),
        buildTaxes(line.taxes),
        tag("ImpuestoNeto", amount(line.taxAmount)),
        tag("MontoTotalLinea", amount(line.totalLineAmount)),
        `</LineaDetalle>`,
      ].join(""),
    ),
    `</DetalleServicio>`,
  ].join("");
}

function buildSummary(input: FiscalXmlBuildInput) {
  return [
    `<ResumenFactura>`,
    tag("CodigoTipoMoneda", "CRC"),
    tag("TotalVenta", amount(input.totals.totalVenta)),
    tag("TotalDescuentos", amount(input.totals.totalDescuentos)),
    tag("TotalVentaNeta", amount(input.totals.totalVentaNeta)),
    tag("TotalImpuesto", amount(input.totals.totalImpuestos)),
    tag("TotalComprobante", amount(input.totals.totalComprobante)),
    `</ResumenFactura>`,
  ].join("");
}

export function buildBasicFiscalXml(input: FiscalXmlBuildInput): FiscalXmlBuildResult {
  const root = ROOTS[input.documentTypeCode];

  if (!root) {
    throw new Error("Tipo documental preparado pero no implementado todavia.");
  }

  return {
    documentTypeCode: input.documentTypeCode,
    pendingXsdValidation: true,
    xml: [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<${root}>`,
      `<Clave>${escapeXmlText(input.clave)}</Clave>`,
      tag("CodigoActividadEmisor", input.activityCode),
      `<NumeroConsecutivo>${escapeXmlText(input.consecutivo)}</NumeroConsecutivo>`,
      `<FechaEmision>${escapeXmlText(input.issueDate)}</FechaEmision>`,
      buildIssuer(input),
      buildReceiver(input),
      tag("CondicionVenta", "01"),
      tag("MedioPago", "01"),
      buildLines(input),
      buildSummary(input),
      `</${root}>`,
    ].join(""),
  };
}
