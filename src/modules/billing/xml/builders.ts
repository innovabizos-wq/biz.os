import { escapeXmlText } from "@/modules/billing/xml/serialize";
import type { FiscalXmlBuildInput, FiscalXmlBuildResult } from "@/modules/billing/xml/types";

const DOCUMENTS: Record<string, { namespace: string; root: string }> = {
  "01": {
    namespace: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica",
    root: "FacturaElectronica",
  },
  "02": {
    namespace: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaDebitoElectronica",
    root: "NotaDebitoElectronica",
  },
  "03": {
    namespace: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaCreditoElectronica",
    root: "NotaCreditoElectronica",
  },
  "04": {
    namespace: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/tiqueteElectronico",
    root: "TiqueteElectronico",
  },
};

function tag(name: string, value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  return `<${name}>${escapeXmlText(String(value))}</${name}>`;
}

function money(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(5) : null;
}

function quantity(value: number) {
  return Number.isFinite(value) ? value.toFixed(3) : null;
}

function rate(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : null;
}

function required(value: string | null | undefined, message: string) {
  if (!value?.trim()) throw new Error(message);
  return value.trim();
}

function costaRicaDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Fecha fiscal invalida.");
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: "America/Costa_Rica",
    year: "numeric",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}-06:00`;
}

function buildIdentification(type: string | null, number: string | null) {
  return [
    `<Identificacion>`,
    tag("Tipo", required(type, "Falta tipo de identificacion fiscal.")),
    tag("Numero", required(number, "Falta numero de identificacion fiscal.")),
    `</Identificacion>`,
  ].join("");
}

function buildLocation(input: FiscalXmlBuildInput["issuer"]["address"]) {
  return [
    `<Ubicacion>`,
    tag("Provincia", required(input.provinceCode, "Falta provincia del emisor.")),
    tag("Canton", required(input.cantonCode, "Falta canton del emisor.")),
    tag("Distrito", required(input.districtCode, "Falta distrito del emisor.")),
    tag("Barrio", input.neighborhood),
    tag("OtrasSenas", required(input.addressLine, "Faltan otras senas del emisor.")),
    `</Ubicacion>`,
  ].join("");
}

function buildIssuer(input: FiscalXmlBuildInput) {
  return [
    `<Emisor>`,
    tag("Nombre", required(input.issuer.legalName, "Falta razon social del emisor.")),
    buildIdentification(input.issuer.identificationType, input.issuer.identificationNumber),
    buildLocation(input.issuer.address),
    tag("CorreoElectronico", required(input.issuer.email, "Falta correo del emisor.")),
    `</Emisor>`,
  ].join("");
}

function buildReceiver(input: FiscalXmlBuildInput) {
  const completeIdentification = Boolean(
    input.receiver.identificationNumber && input.receiver.identificationType,
  );
  if (input.documentTypeCode === "04" && !completeIdentification) return "";
  return [
    `<Receptor>`,
    tag("Nombre", required(input.receiver.name, "Falta nombre del receptor.")),
    buildIdentification(input.receiver.identificationType, input.receiver.identificationNumber),
    tag("CorreoElectronico", input.receiver.email),
    `</Receptor>`,
  ].join("");
}

function buildCommercialCode(value: string | null) {
  if (!value) return "";
  return `<CodigoComercial>${tag("Tipo", "01")}${tag("Codigo", value)}</CodigoComercial>`;
}

function buildTaxes(taxes: FiscalXmlBuildInput["lines"][number]["taxes"]) {
  if (taxes.length === 0) {
    throw new Error("Cada linea XML 4.4 debe conservar su detalle de impuesto, incluso a tarifa cero.");
  }
  return taxes.map((tax) => [
    `<Impuesto>`,
    tag("Codigo", tax.taxCode),
    tag("CodigoTarifaIVA", tax.taxCode === "01" ? tax.taxRateCode : null),
    tag("Tarifa", rate(tax.rate)),
    tag("Monto", money(tax.amount)),
    `</Impuesto>`,
  ].join("")).join("");
}

function buildLines(input: FiscalXmlBuildInput) {
  return [
    `<DetalleServicio>`,
    ...input.lines.map((line) => [
      `<LineaDetalle>`,
      tag("NumeroLinea", line.lineNumber),
      tag("CodigoCABYS", required(line.cabysCode, "Falta CABYS en una linea fiscal.")),
      buildCommercialCode(line.commercialCode),
      tag("Cantidad", quantity(line.quantity)),
      tag("UnidadMedida", line.unitCode),
      tag("Detalle", line.detail),
      tag("PrecioUnitario", money(line.unitPrice)),
      tag("MontoTotal", money(line.grossAmount)),
      line.discountAmount > 0
        ? `<Descuento>${tag("MontoDescuento", money(line.discountAmount))}${tag("CodigoDescuento", "07")}</Descuento>`
        : "",
      tag("SubTotal", money(line.subtotal)),
      tag("BaseImponible", money(line.taxableBase ?? line.subtotal)),
      buildTaxes(line.taxes),
      tag("ImpuestoAsumidoEmisorFabrica", money(0)),
      tag("ImpuestoNeto", money(line.taxAmount)),
      tag("MontoTotalLinea", money(line.totalLineAmount)),
      `</LineaDetalle>`,
    ].join("")),
    `</DetalleServicio>`,
  ].join("");
}

function buildTaxBreakdown(input: FiscalXmlBuildInput) {
  const totals = new Map<string, { amount: number; code: string; rateCode: string | null }>();
  for (const line of input.lines) {
    for (const tax of line.taxes) {
      const key = `${tax.taxCode}:${tax.taxRateCode ?? ""}`;
      const current = totals.get(key);
      totals.set(key, {
        amount: (current?.amount ?? 0) + tax.amount,
        code: tax.taxCode,
        rateCode: tax.taxRateCode,
      });
    }
  }
  return [...totals.values()].map((tax) => [
    `<TotalDesgloseImpuesto>`,
    tag("Codigo", tax.code),
    tag("CodigoTarifaIVA", tax.code === "01" ? tax.rateCode : null),
    tag("TotalMontoImpuesto", money(tax.amount)),
    `</TotalDesgloseImpuesto>`,
  ].join("")).join("");
}

function buildPaymentMethods(input: FiscalXmlBuildInput) {
  return input.paymentMethods.map((payment) => [
    `<MedioPago>`,
    tag("TipoMedioPago", payment.code),
    tag("TotalMedioPago", money(payment.amount)),
    `</MedioPago>`,
  ].join("")).join("");
}

function buildSummary(input: FiscalXmlBuildInput) {
  return [
    `<ResumenFactura>`,
    `<CodigoTipoMoneda>${tag("CodigoMoneda", input.currencyCode)}${tag("TipoCambio", money(input.exchangeRate))}</CodigoTipoMoneda>`,
    tag("TotalVenta", money(input.totals.totalVenta)),
    input.totals.totalDescuentos && input.totals.totalDescuentos > 0
      ? tag("TotalDescuentos", money(input.totals.totalDescuentos))
      : "",
    tag("TotalVentaNeta", money(input.totals.totalVentaNeta)),
    buildTaxBreakdown(input),
    tag("TotalImpuesto", money(input.totals.totalImpuestos)),
    buildPaymentMethods(input),
    tag("TotalComprobante", money(input.totals.totalComprobante)),
    `</ResumenFactura>`,
  ].join("");
}

function buildReferences(input: FiscalXmlBuildInput) {
  if (["02", "03"].includes(input.documentTypeCode) && input.references.length === 0) {
    throw new Error("Las notas de credito y debito requieren el documento de referencia.");
  }
  return input.references.map((reference) => [
    `<InformacionReferencia>`,
    tag("TipoDocIR", required(reference.documentTypeCode, "Falta tipo de documento de referencia.")),
    tag("Numero", required(reference.reference, "Falta numero del documento de referencia.")),
    tag("FechaEmisionIR", costaRicaDateTime(required(reference.issueDate, "Falta fecha de referencia."))),
    tag("Codigo", required(reference.code, "Falta codigo de referencia.")),
    tag("Razon", required(reference.reason, "Falta razon de referencia.")),
    `</InformacionReferencia>`,
  ].join("")).join("");
}

export function buildBasicFiscalXml(input: FiscalXmlBuildInput): FiscalXmlBuildResult {
  const document = DOCUMENTS[input.documentTypeCode];
  if (!document) throw new Error("Tipo documental preparado pero no implementado todavia.");
  if (input.lines.length === 0) throw new Error("El documento fiscal no contiene lineas.");
  const creditTerm = input.saleConditionCode === "02"
    ? tag("PlazoCredito", input.creditTermDays ?? 0)
    : "";

  return {
    documentTypeCode: input.documentTypeCode,
    pendingXsdValidation: true,
    xml: [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<${document.root} xmlns="${document.namespace}">`,
      tag("Clave", input.clave),
      tag(
        "ProveedorSistemas",
        required(input.issuer.softwareProviderIdentification, "Falta identificacion del proveedor del sistema."),
      ),
      tag("CodigoActividadEmisor", input.activityCode),
      tag("NumeroConsecutivo", input.consecutivo),
      tag("FechaEmision", costaRicaDateTime(input.issueDate)),
      buildIssuer(input),
      buildReceiver(input),
      tag("CondicionVenta", input.saleConditionCode),
      creditTerm,
      buildLines(input),
      buildSummary(input),
      buildReferences(input),
      `</${document.root}>`,
    ].join(""),
  };
}
