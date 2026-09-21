import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/modules/billing/crypto";
import { safeExternalFetch } from "@/modules/billing/connectors/safe-fetch";
import {
  assertHaciendaOperationEnabled,
  getHaciendaRuntimeConfig,
} from "@/modules/billing/hacienda/config";
import type {
  HaciendaClient,
  HaciendaEnvironment,
  HaciendaSendResult,
  HaciendaStatusResult,
} from "@/modules/billing/hacienda/types";

type HaciendaCredentials = { password: string; username: string };

type TokenPayload = {
  access_token?: string;
  error_description?: string;
  expires_in?: number;
};

type HaciendaResponsePayload = {
  "ind-estado"?: string;
  clave?: string;
  fecha?: string;
  "respuesta-xml"?: string;
};

function parseCredentials(encrypted: string | null): HaciendaCredentials {
  const decrypted = decryptSecret(encrypted);
  if (!decrypted) throw new Error("La conexion Hacienda no tiene credenciales guardadas.");
  const parsed = JSON.parse(decrypted) as Record<string, unknown>;
  const username = typeof parsed.username === "string" ? parsed.username.trim() : "";
  const password = typeof parsed.password === "string" ? parsed.password : "";
  if (!username || !password) throw new Error("La conexion Hacienda requiere usuario y contraseña.");
  return { password, username };
}

async function responseText(response: Response, maxBytes = 2_000_000) {
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new Error("Hacienda devolvio una respuesta demasiado grande.");
  return new TextDecoder().decode(bytes);
}

function parsedJson(value: string) {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { text: value.slice(0, 4_000) };
  }
}

function statusFromPayload(payload: HaciendaResponsePayload | null): HaciendaStatusResult["status"] {
  const status = payload?.["ind-estado"];
  if (status === "recibido") return "procesando";
  return ["aceptado", "rechazado", "procesando", "error"].includes(status ?? "")
    ? (status as HaciendaStatusResult["status"])
    : "desconocido";
}

export class HaciendaApiClient implements HaciendaClient {
  private accessToken: { expiresAt: number; value: string } | null = null;

  constructor(
    private readonly credentials: HaciendaCredentials,
    private readonly environment: HaciendaEnvironment,
  ) {}

  private async token() {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 15_000) return this.accessToken.value;
    const runtime = getHaciendaRuntimeConfig(this.environment);
    if (!runtime.authUrl) throw new Error("Hacienda no tiene URL de autenticacion configurada.");
    const response = await safeExternalFetch(runtime.authUrl, {
      body: new URLSearchParams({
        client_id: runtime.clientId,
        grant_type: "password",
        password: this.credentials.password,
        username: this.credentials.username,
      }),
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
      method: "POST",
    });
    const body = await responseText(response, 100_000);
    const payload = (parsedJson(body) ?? {}) as TokenPayload;
    if (!response.ok || !payload.access_token) {
      throw new Error(payload.error_description || `Hacienda rechazo la autenticacion (${response.status}).`);
    }
    this.accessToken = {
      expiresAt: Date.now() + Math.max(30, payload.expires_in ?? 300) * 1_000,
      value: payload.access_token,
    };
    return payload.access_token;
  }

  async sendSignedXml(params: Parameters<HaciendaClient["sendSignedXml"]>[0]): Promise<HaciendaSendResult> {
    const runtime = assertHaciendaOperationEnabled("send", this.environment);
    if (!runtime.apiUrl) throw new Error("Hacienda no tiene URL de recepcion configurada.");
    const response = await safeExternalFetch(`${runtime.apiUrl}/recepcion`, {
      body: JSON.stringify({
        clave: params.clave,
        comprobanteXml: Buffer.from(params.signedXml, "utf8").toString("base64"),
        emisor: params.emisor,
        fecha: params.fecha,
        ...(params.receptor ? { receptor: params.receptor } : {}),
      }),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${await this.token()}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      method: "POST",
    }, 20_000);
    const body = await responseText(response);
    const raw = {
      body: parsedJson(body),
      errorCause: response.headers.get("x-error-cause"),
      location: response.headers.get("location"),
      rateLimitRemaining: response.headers.get("x-ratelimit-remaining"),
      statusCode: response.status,
    };
    if (response.status === 201 || response.status === 202) return { rawResponse: raw, status: "recibido" };
    if (response.status === 400 && /ya fue recibido/i.test(raw.errorCause ?? body)) {
      const existing = await this.queryStatus(params.clave);
      return { rawResponse: { duplicateReception: raw, existing: existing.rawResponse }, status: "procesando" };
    }
    if (response.status === 429 || response.status >= 500) {
      throw new Error(`Hacienda no esta disponible temporalmente (${response.status}).`);
    }
    throw new Error(raw.errorCause || `Hacienda rechazo el envio (${response.status}).`);
  }

  async queryStatus(clave: string): Promise<HaciendaStatusResult> {
    const runtime = assertHaciendaOperationEnabled("status", this.environment);
    if (!runtime.apiUrl) throw new Error("Hacienda no tiene URL de consulta configurada.");
    const response = await safeExternalFetch(`${runtime.apiUrl}/recepcion/${encodeURIComponent(clave)}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${await this.token()}` },
      method: "GET",
    }, 15_000);
    const body = await responseText(response);
    const payload = parsedJson(body) as HaciendaResponsePayload | null;
    const raw = {
      body: payload,
      errorCause: response.headers.get("x-error-cause"),
      rateLimitRemaining: response.headers.get("x-ratelimit-remaining"),
      statusCode: response.status,
    };
    if (response.status === 404) return { rawResponse: raw, status: "desconocido" };
    if (response.status === 429 || response.status >= 500) {
      throw new Error(`Hacienda no esta disponible temporalmente (${response.status}).`);
    }
    if (!response.ok) throw new Error(raw.errorCause || `Hacienda rechazo la consulta (${response.status}).`);
    const status = statusFromPayload(payload);
    const responseXmlBase64 = typeof payload?.["respuesta-xml"] === "string"
      ? payload["respuesta-xml"]
      : undefined;
    if (["aceptado", "rechazado"].includes(status) && !responseXmlBase64) {
      throw new Error("Hacienda devolvio un estado final sin el XML oficial de respuesta.");
    }
    return { rawResponse: raw, responseXmlBase64, status };
  }
}

export async function getHaciendaClientForCompany(empresaId: string): Promise<HaciendaClient> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("company_fiscal_connections")
    .select("id, environment, encrypted_credentials")
    .eq("empresa_id", empresaId)
    .eq("provider_code", "hacienda")
    .eq("status", "active")
    .maybeSingle<{ encrypted_credentials: string | null; environment: HaciendaEnvironment; id: string }>();
  if (error) throw new Error(`No se pudo cargar la conexion Hacienda: ${error.message}`);
  if (!data) throw new Error("No hay una conexion Hacienda directa activa para esta empresa.");
  return new HaciendaApiClient(parseCredentials(data.encrypted_credentials), data.environment);
}

export async function getHaciendaClientForConnection(
  empresaId: string,
  connectionId: string,
  expectedEnvironment: HaciendaEnvironment,
): Promise<HaciendaClient> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("company_fiscal_connections")
    .select("environment, encrypted_credentials, status")
    .eq("id", connectionId)
    .eq("empresa_id", empresaId)
    .eq("provider_code", "hacienda")
    .maybeSingle<{
      encrypted_credentials: string | null;
      environment: HaciendaEnvironment;
      status: string;
    }>();
  if (error) throw new Error(`No se pudo cargar la conexion Hacienda asignada: ${error.message}`);
  if (!data) throw new Error("La conexión Hacienda asignada al documento ya no está disponible.");
  if (data.status === "disabled") throw new Error("La conexión Hacienda asignada está deshabilitada.");
  if (data.environment !== expectedEnvironment) {
    throw new Error("El ambiente de la conexión Hacienda no coincide con el documento fiscal.");
  }
  return new HaciendaApiClient(parseCredentials(data.encrypted_credentials), data.environment);
}
