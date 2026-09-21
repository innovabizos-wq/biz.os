export type BillingXmlSignerInput = {
  connectionId: string;
  empresaId: string;
  unsignedXml: string;
};

export type BillingXmlSignerResult = {
  algorithm: string;
  certificateExpiresAt?: string;
  certificateSerialLast4?: string;
  signedXml: string;
};

export interface BillingXmlSigner {
  sign(input: BillingXmlSignerInput): Promise<BillingXmlSignerResult>;
}
