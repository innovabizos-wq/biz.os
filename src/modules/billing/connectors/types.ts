export type FiscalProviderCode =
  | "gti"
  | "factura_profesional"
  | "alegra"
  | "hacienda"
  | "rest"
  | "tico_factura_import";

export type FiscalConnection = {
  activatedAt: string | null;
  capabilities: string[];
  environment: "testing" | "production";
  hasCredentials: boolean;
  id: string;
  lastError: string | null;
  lastVerifiedAt: string | null;
  name: string;
  providerCode: FiscalProviderCode;
  publicConfig: Record<string, unknown>;
  status: "draft" | "verified" | "active" | "error" | "disabled";
  updatedAt: string;
};

export type FiscalConnectorVerification = {
  activatable: boolean;
  capabilities: string[];
  detail: string;
  providerAccountId?: string;
};

export type FiscalConnectorContext = {
  credentials: Record<string, string>;
  environment: "testing" | "production";
  publicConfig: Record<string, unknown>;
};

export interface FiscalConnectorAdapter {
  code: FiscalProviderCode;
  verify(context: FiscalConnectorContext): Promise<FiscalConnectorVerification>;
}
