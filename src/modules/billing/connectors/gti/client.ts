import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { readConnectorJson } from "@/modules/billing/connectors/connector-http";
import { getGtiRuntimeConfig, type GtiEnvironment } from "@/modules/billing/connectors/gti/config";
import { safeExternalFetch } from "@/modules/billing/connectors/safe-fetch";
import { decryptSecret } from "@/modules/billing/crypto";

type GtiConnectionRow = {
  encrypted_credentials: string | null;
  environment: GtiEnvironment;
  public_config: Record<string, unknown> | null;
  status: string;
};

type GtiCredentials = { password: string; username: string };

export type GtiSubmissionResult = {
  providerDocumentId: string | null;
  rawResponse: unknown;
  status: "processing" | "unknown";
};

export class GtiAmbiguousSubmissionError extends Error {
  constructor(message: string, readonly causeValue?: unknown) {
    super(message);
    this.name = "GtiAmbiguousSubmissionError";
  }
}

function requiredText(record: Record<string, unknown>, key: string, message: string) {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value.trim();
}

function parseCredentials(value: string | null): GtiCredentials {
  const decrypted = decryptSecret(value);
  if (!decrypted) throw new Error("La conexión GTI no conserva credenciales.");
  const parsed = JSON.parse(decrypted) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Las credenciales GTI guardadas no son válidas.");
  }
  return {
    password: requiredText(parsed as Record<string, unknown>, "password", "Falta la contraseña GTI."),
    username: requiredText(parsed as Record<string, unknown>, "username", "Falta el usuario GTI."),
  };
}

function recursiveText(value: unknown, keys: Set<string>): string | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = recursiveText(item, keys);
      if (found) return found;
    }
    return null;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (keys.has(key.toLowerCase()) && (typeof item === "string" || typeof item === "number")) {
      return String(item);
    }
    const found = recursiveText(item, keys);
    if (found) return found;
  }
  return null;
}

export class GtiFiscalClient {
  constructor(
    private readonly documentUrl: string,
    private readonly accountNumber: string,
    private readonly credentials: GtiCredentials,
  ) {}

  async submit(idempotencyKey: string, payload: Record<string, unknown>): Promise<GtiSubmissionResult> {
    const url = new URL(this.documentUrl);
    url.searchParams.set("pUsuario", this.credentials.username);
    url.searchParams.set("pClave", this.credentials.password);
    url.searchParams.set("pNumCuenta", this.accountNumber);
    url.searchParams.set("idPedido", idempotencyKey);
    try {
      const response = await safeExternalFetch(url.toString(), {
        body: JSON.stringify(payload),
        headers: { Accept: "application/json", "Content-Type": "application/json; charset=utf-8" },
        method: "POST",
      }, 20_000);
      const body = await readConnectorJson(response);
      const rawResponse = {
        body,
        requestId: response.headers.get("x-request-id"),
        statusCode: response.status,
      };
      if (!response.ok) {
        throw new GtiAmbiguousSubmissionError(
          `GTI respondió ${response.status}; el resultado debe conciliarse antes de reintentar.`,
          rawResponse,
        );
      }
      return {
        providerDocumentId: recursiveText(body, new Set(["clave", "consecutivo", "iddocumento", "documentoid"])),
        rawResponse,
        status: "processing",
      };
    } catch (error) {
      if (error instanceof GtiAmbiguousSubmissionError) throw error;
      throw new GtiAmbiguousSubmissionError(
        "La comunicación con GTI terminó sin una respuesta concluyente; el documento queda por confirmar y no se reenviará automáticamente.",
        error,
      );
    }
  }
}

export async function getGtiFiscalClientForConnection(
  empresaId: string,
  connectionId: string,
  expectedEnvironment: GtiEnvironment,
) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("company_fiscal_connections")
    .select("environment, status, public_config, encrypted_credentials")
    .eq("id", connectionId)
    .eq("empresa_id", empresaId)
    .eq("provider_code", "gti")
    .maybeSingle<GtiConnectionRow>();
  if (error) throw new Error(`No se pudo cargar la conexión GTI: ${error.message}`);
  if (!data) throw new Error("La conexión GTI asignada ya no está disponible.");
  if (data.status === "disabled") throw new Error("La conexión GTI está deshabilitada.");
  if (data.environment !== expectedEnvironment) throw new Error("El ambiente GTI no coincide con el documento.");
  const accountNumber = requiredText(data.public_config ?? {}, "accountNumber", "Falta el número de cuenta GTI.");
  if (!/^\d+$/.test(accountNumber)) throw new Error("El número de cuenta GTI debe ser numérico.");
  const runtime = getGtiRuntimeConfig(expectedEnvironment);
  if (!runtime.documentUrl) {
    throw new Error("GTI debe proporcionar un endpoint HTTPS de pruebas antes de habilitar emisiones en sandbox.");
  }
  return {
    accountNumber,
    client: new GtiFiscalClient(runtime.documentUrl, accountNumber, parseCredentials(data.encrypted_credentials)),
  };
}
