export type BillingXmlSignerInput = {
  certificateSecretRef: string;
  pinSecretRef: string;
  unsignedXml: string;
};

export type BillingXmlSignerResult = {
  algorithm: string;
  signedXml: string;
};

export interface BillingXmlSigner {
  sign(input: BillingXmlSignerInput): Promise<BillingXmlSignerResult>;
}
