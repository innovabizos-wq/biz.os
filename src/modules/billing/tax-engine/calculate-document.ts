import type {
  FiscalDocumentTotals,
  FiscalLineCalculation,
} from "@/modules/billing/tax-engine/types";

type ClassifiedLine = FiscalLineCalculation & {
  isExempt?: boolean;
  isNonSubject?: boolean;
};

function sum(lines: ClassifiedLine[], selector: (line: ClassifiedLine) => number) {
  return lines.reduce((total, line) => total + selector(line), 0);
}

function roundFiscal(value: number) {
  return Math.round((value + Number.EPSILON) * 100000) / 100000;
}

export function calculateFiscalDocumentTotals(lines: ClassifiedLine[]): FiscalDocumentTotals {
  const totalExento = sum(lines, (line) => (line.isExempt ? line.subtotal : 0));
  const totalNoSujeto = sum(lines, (line) => (line.isNonSubject ? line.subtotal : 0));
  const totalGravado = sum(lines, (line) =>
    !line.isExempt && !line.isNonSubject ? line.subtotal : 0,
  );
  const totalDescuentos = sum(lines, (line) => line.discountAmount);
  const totalImpuestos = sum(lines, (line) => line.taxAmount);
  const totalVenta = totalGravado + totalExento + totalNoSujeto + totalDescuentos;
  const totalVentaNeta = totalGravado + totalExento + totalNoSujeto;

  return {
    totalComprobante: roundFiscal(totalVentaNeta + totalImpuestos),
    totalDescuentos: roundFiscal(totalDescuentos),
    totalExento: roundFiscal(totalExento),
    totalGravado: roundFiscal(totalGravado),
    totalImpuestos: roundFiscal(totalImpuestos),
    totalNoSujeto: roundFiscal(totalNoSujeto),
    totalVenta: roundFiscal(totalVenta),
    totalVentaNeta: roundFiscal(totalVentaNeta),
  };
}
