export type BillingXmlValidationResult = {
  errors: string[];
  ok: boolean;
  validator: string;
  xsdVersion: "4.4";
};

type BillingXmlValidationConfig = {
  enabled: boolean;
};

export interface BillingXmlValidator {
  validate(xml: string): Promise<BillingXmlValidationResult>;
}

class NotConfiguredBillingXmlValidator implements BillingXmlValidator {
  async validate(): Promise<BillingXmlValidationResult> {
    throw new Error(
      "Validacion XSD XML 4.4 no configurada: no se puede marcar XML como validado sin XSD oficial.",
    );
  }
}

function validationConfig(): BillingXmlValidationConfig {
  return {
    enabled: process.env.BILLING_XML_VALIDATION_ENABLED === "true",
  };
}

export function getBillingXmlValidator(): BillingXmlValidator {
  return new NotConfiguredBillingXmlValidator();
}

export async function validateFiscalXmlAgainstOfficialXsd(
  xml: string,
): Promise<BillingXmlValidationResult & { enabled: boolean; pendingXsdValidation: boolean }> {
  const config = validationConfig();

  if (!config.enabled) {
    return {
      enabled: false,
      errors: ["Validacion XSD oficial deshabilitada por BILLING_XML_VALIDATION_ENABLED=false."],
      ok: false,
      pendingXsdValidation: true,
      validator: "disabled",
      xsdVersion: "4.4",
    };
  }

  const result = await getBillingXmlValidator().validate(xml);

  return {
    ...result,
    enabled: true,
    pendingXsdValidation: !result.ok,
  };
}
