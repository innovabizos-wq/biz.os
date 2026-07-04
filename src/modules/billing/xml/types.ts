export type FiscalXmlDocumentType =
  | "01"
  | "02"
  | "03"
  | "04"
  | "08"
  | "09"
  | "10"
  | "MR";

export type FiscalXmlBuildInput = {
  activityCode: string | null;
  clave: string;
  consecutivo: string;
  documentTypeCode: FiscalXmlDocumentType;
  issuer: {
    email: string | null;
    identificationNumber: string | null;
    identificationType: string | null;
    legalName: string | null;
  };
  issueDate: string;
  lines: {
    cabysCode: string | null;
    detail: string;
    discountAmount: number;
    grossAmount: number;
    lineNumber: number;
    quantity: number;
    subtotal: number;
    taxAmount: number;
    taxes: {
      amount: number;
      rate: number | null;
      taxCode: string;
      taxRateCode: string | null;
      taxableBase: number | null;
    }[];
    totalLineAmount: number;
    unitCode: string;
    unitPrice: number;
  }[];
  receiver: {
    email: string | null;
    identificationNumber: string | null;
    identificationType: string | null;
    name: string | null;
  };
  totals: {
    totalComprobante: number | null;
    totalDescuentos: number | null;
    totalImpuestos: number | null;
    totalVenta: number | null;
    totalVentaNeta: number | null;
  };
};

export type FiscalXmlBuildResult = {
  documentTypeCode: FiscalXmlDocumentType;
  pendingXsdValidation: boolean;
  xml: string;
};
