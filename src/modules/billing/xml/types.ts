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
  creditTermDays: number | null;
  currencyCode: string;
  documentTypeCode: FiscalXmlDocumentType;
  exchangeRate: number;
  issuer: {
    address: {
      addressLine: string | null;
      cantonCode: string | null;
      districtCode: string | null;
      neighborhood: string | null;
      provinceCode: string | null;
    };
    email: string | null;
    identificationNumber: string | null;
    identificationType: string | null;
    legalName: string | null;
    softwareProviderIdentification: string | null;
  };
  issueDate: string;
  lines: {
    cabysCode: string | null;
    commercialCode: string | null;
    detail: string;
    discountAmount: number;
    grossAmount: number;
    lineNumber: number;
    quantity: number;
    subtotal: number;
    taxableBase: number | null;
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
  paymentMethods: {
    amount: number;
    code: string;
  }[];
  receiver: {
    email: string | null;
    identificationNumber: string | null;
    identificationType: string | null;
    name: string | null;
  };
  references: {
    code: string | null;
    documentTypeCode: string | null;
    issueDate: string | null;
    reason: string | null;
    reference: string | null;
  }[];
  saleConditionCode: string;
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
