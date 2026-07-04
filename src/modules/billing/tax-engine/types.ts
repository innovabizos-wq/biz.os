export type FiscalLineInput = {
  discountAmount?: number;
  isExempt?: boolean;
  isNonSubject?: boolean;
  quantity: number;
  taxRate?: number;
  unitPrice: number;
};

export type FiscalLineCalculation = {
  discountAmount: number;
  grossAmount: number;
  subtotal: number;
  taxAmount: number;
  taxableBase: number;
  totalLineAmount: number;
};

export type FiscalDocumentTotals = {
  totalComprobante: number;
  totalDescuentos: number;
  totalExento: number;
  totalGravado: number;
  totalImpuestos: number;
  totalNoSujeto: number;
  totalVenta: number;
  totalVentaNeta: number;
};
