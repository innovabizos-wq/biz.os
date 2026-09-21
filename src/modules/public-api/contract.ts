export const PUBLIC_API_SCOPES = [
  { label: "Consultar clientes", value: "clients:read" },
  { label: "Consultar catalogo", value: "catalog:read" },
  { label: "Consultar ventas", value: "sales:read" },
  { label: "Consultar cuentas y saldos", value: "payments:read" },
  { label: "Consultar documentos fiscales", value: "fiscal_documents:read" },
] as const;

export type PublicApiKeySummary = {
  createdAt: string;
  expiresAt: string | null;
  id: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  name: string;
  rateLimitPerMinute: number;
  revokedAt: string | null;
  scopes: string[];
  status: "active" | "revoked";
};
