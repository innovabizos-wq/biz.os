import { ensureAllowedRestHost } from "@/modules/billing/connectors/host-allowlist";

export const MAX_CONNECTOR_RESPONSE_BYTES = 1_000_000;

function text(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function basicHeader(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

export function connectorAuthenticationHeaders(
  credentials: Record<string, string>,
  publicConfig: Record<string, unknown>,
) {
  const headers: Record<string, string> = { Accept: "application/json" };
  const bearer = text(credentials, "token");
  const username = text(credentials, "username");
  const password = text(credentials, "password");
  const apiKey = text(credentials, "apiKey");
  const apiKeyHeader = text(publicConfig, "apiKeyHeader") || "X-API-Key";
  const forbiddenHeaders = new Set([
    "connection",
    "content-length",
    "cookie",
    "host",
    "proxy-authorization",
    "transfer-encoding",
    "x-forwarded-for",
    "x-forwarded-host",
  ]);
  if (!/^[A-Za-z0-9-]{1,64}$/.test(apiKeyHeader)
      || forbiddenHeaders.has(apiKeyHeader.toLowerCase())) {
    throw new Error("El nombre del header de API key no está permitido.");
  }
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  else if (username && password) headers.Authorization = basicHeader(username, password);
  if (apiKey) headers[apiKeyHeader] = apiKey;
  return headers;
}

export async function readConnectorJson(
  response: Response,
  maxBytes = MAX_CONNECTOR_RESPONSE_BYTES,
) {
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > maxBytes) {
    throw new Error("El proveedor devolvió una respuesta demasiado grande.");
  }
  if (bytes.byteLength === 0) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error("El proveedor devolvió una respuesta que no es JSON válido.");
  }
}

export { ensureAllowedRestHost };
