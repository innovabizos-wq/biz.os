import type { FiscalLineCalculation, FiscalLineInput } from "@/modules/billing/tax-engine/types";

function roundFiscal(value: number) {
  return Math.round((value + Number.EPSILON) * 100000) / 100000;
}

export function calculateFiscalLine(input: FiscalLineInput): FiscalLineCalculation {
  if (input.quantity <= 0) {
    throw new Error("La cantidad fiscal debe ser mayor a cero.");
  }

  if (input.unitPrice < 0) {
    throw new Error("El precio fiscal no puede ser negativo.");
  }

  const discountAmount = Math.max(input.discountAmount ?? 0, 0);
  const grossAmount = roundFiscal(input.quantity * input.unitPrice);
  const subtotal = roundFiscal(Math.max(grossAmount - discountAmount, 0));
  const taxableBase = input.isExempt || input.isNonSubject ? 0 : subtotal;
  const taxAmount = roundFiscal(taxableBase * ((input.taxRate ?? 0) / 100));

  return {
    discountAmount,
    grossAmount,
    subtotal,
    taxAmount,
    taxableBase,
    totalLineAmount: roundFiscal(subtotal + taxAmount),
  };
}
