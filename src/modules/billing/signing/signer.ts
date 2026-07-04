import type {
  BillingXmlSigner,
  BillingXmlSignerResult,
} from "@/modules/billing/signing/types";

export class NotConfiguredBillingXmlSigner implements BillingXmlSigner {
  async sign(): Promise<BillingXmlSignerResult> {
    throw new Error(
      "Firma XAdES-EPES no configurada: no se puede marcar XML como firmado sin una firma real.",
    );
  }
}

export function getBillingXmlSigner(): BillingXmlSigner {
  return new NotConfiguredBillingXmlSigner();
}
