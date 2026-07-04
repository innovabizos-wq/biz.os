export type BillingValidationIssue = {
  code: string;
  group: "Empresa" | "Cliente" | "Productos/CABYS" | "Impuestos" | "Certificado" | "Hacienda" | "XML";
  message: string;
};

export type BillingValidationResult = {
  issues: BillingValidationIssue[];
  ok: boolean;
};

export function validationResult(issues: BillingValidationIssue[]): BillingValidationResult {
  return {
    issues,
    ok: issues.length === 0,
  };
}
