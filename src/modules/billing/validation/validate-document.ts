import { createClient } from "@/lib/supabase/server";
import type { FiscalDocumentDetail } from "@/modules/billing/queries";
import { calculateFiscalDocumentTotals } from "@/modules/billing/tax-engine/calculate-document";
import { validationResult, type BillingValidationIssue } from "@/modules/billing/validation/types";
import type { TenantContext } from "@/types/core";

function textFromRecord(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberFromRecord(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function issue(
  group: BillingValidationIssue["group"],
  code: string,
  message: string,
): BillingValidationIssue {
  return { code, group, message };
}

function nearlyEqual(left: number | null, right: number, tolerance = 0.05) {
  return left !== null && Math.abs(left - right) <= tolerance;
}

function pushTotalsIssue(
  issues: BillingValidationIssue[],
  code: string,
  label: string,
  expected: number,
  actual: number | null,
) {
  if (!nearlyEqual(actual, expected)) {
    issues.push(
      issue(
        "Impuestos",
        code,
        `${label} no coincide con el recalculo fiscal. Esperado ${expected.toFixed(5)}, registrado ${
          actual === null ? "N/D" : actual.toFixed(5)
        }.`,
      ),
    );
  }
}

export async function validateFiscalDocumentReadyForXml(
  tenant: TenantContext,
  document: FiscalDocumentDetail,
) {
  const issues: BillingValidationIssue[] = [];

  if (!["01", "04"].includes(document.documentTypeCode)) {
    issues.push(issue("XML", "unsupported_document_type", "Tipo documental no soportado para XML 4.4."));
  }

  if (!document.clave || document.clave.length !== 50) {
    issues.push(issue("XML", "missing_clave", "Falta clave numerica fiscal de 50 digitos."));
  }

  if (!document.consecutivo || document.consecutivo.length !== 20) {
    issues.push(issue("XML", "missing_consecutivo", "Falta consecutivo fiscal de 20 digitos."));
  }

  if (!document.branchCode || !/^\d{3}$/.test(document.branchCode)) {
    issues.push(issue("Empresa", "invalid_branch", "Sucursal fiscal debe tener 3 digitos."));
  }

  if (!document.terminalCode || !/^\d{5}$/.test(document.terminalCode)) {
    issues.push(issue("Empresa", "invalid_terminal", "Terminal fiscal debe tener 5 digitos."));
  }

  for (const [key, code, message] of [
    ["legalName", "missing_issuer_name", "Falta razon social del emisor."],
    ["identificationNumber", "missing_issuer_identification", "Falta identificacion fiscal del emisor."],
    ["activityCode", "missing_activity", "Falta actividad economica del emisor."],
    ["email", "missing_issuer_email", "Falta correo fiscal del emisor."],
  ] as const) {
    if (!textFromRecord(document.issuerSnapshot, key)) {
      issues.push(issue("Empresa", code, message));
    }
  }

  if (document.documentTypeCode === "01" && !document.receiverName) {
    issues.push(issue("Cliente", "missing_receiver_name", "La factura electronica requiere receptor."));
  }

  const totalComprobante = numberFromRecord(document.totals, "totalComprobante");
  if (totalComprobante === null || totalComprobante <= 0) {
    issues.push(issue("Impuestos", "invalid_total", "Total comprobante debe ser mayor a cero."));
  }

  if (document.lines.length > 0) {
    const recalculatedTotals = calculateFiscalDocumentTotals(
      document.lines.map((line) => ({
        discountAmount: line.discountAmount,
        grossAmount: line.grossAmount,
        isExempt: line.isExempt,
        isNonSubject: line.isNonSubject,
        subtotal: line.subtotal,
        taxAmount: line.taxAmount,
        taxableBase: line.taxableBase ?? 0,
        totalLineAmount: line.totalLineAmount,
      })),
    );

    pushTotalsIssue(
      issues,
      "total_tax_mismatch",
      "Total de impuestos",
      recalculatedTotals.totalImpuestos,
      numberFromRecord(document.totals, "totalImpuestos"),
    );
    pushTotalsIssue(
      issues,
      "net_total_mismatch",
      "Total venta neta",
      recalculatedTotals.totalVentaNeta,
      numberFromRecord(document.totals, "totalVentaNeta"),
    );
    pushTotalsIssue(
      issues,
      "document_total_mismatch",
      "Total comprobante",
      recalculatedTotals.totalComprobante,
      totalComprobante,
    );
  }

  const supabase = await createClient();
  const [
    { count: lineCount },
    { count: missingCabysCount },
    { count: invalidAmountCount },
    { data: taxedLinesWithoutTaxRows },
  ] = await Promise.all([
    supabase
      .from("fiscal_document_lines")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", tenant.empresaId)
      .eq("fiscal_document_id", document.id),
    supabase
      .from("fiscal_document_lines")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", tenant.empresaId)
      .eq("fiscal_document_id", document.id)
      .is("cabys_code", null),
    supabase
      .from("fiscal_document_lines")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", tenant.empresaId)
      .eq("fiscal_document_id", document.id)
      .or("quantity.lte.0,unit_price.lt.0,total_line_amount.lte.0"),
    supabase
      .from("fiscal_document_lines")
      .select("id, fiscal_document_line_taxes(id)")
      .eq("empresa_id", tenant.empresaId)
      .eq("fiscal_document_id", document.id)
      .gt("tax_amount", 0),
  ]);

  if (!lineCount) {
    issues.push(issue("Productos/CABYS", "missing_lines", "Documento fiscal no tiene lineas."));
  }

  if (missingCabysCount) {
    issues.push(issue("Productos/CABYS", "missing_cabys", "Una o mas lineas no tienen CABYS."));
  }

  if (invalidAmountCount) {
    issues.push(issue("Impuestos", "invalid_line_amount", "Una o mas lineas tienen montos invalidos."));
  }

  const taxedLinesWithoutTax = ((taxedLinesWithoutTaxRows ?? []) as {
    fiscal_document_line_taxes?: { id: string }[] | null;
  }[]).filter((row) => !row.fiscal_document_line_taxes?.length);

  if (taxedLinesWithoutTax.length) {
    issues.push(
      issue(
        "Impuestos",
        "missing_line_tax_detail",
        "Una o mas lineas con impuesto no tienen detalle de impuesto fiscal.",
      ),
    );
  }

  return validationResult(issues);
}
