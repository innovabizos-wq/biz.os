import "server-only";

import {
  connectorAuthenticationHeaders,
  ensureAllowedRestHost,
  readConnectorJson,
} from "@/modules/billing/connectors/connector-http";
import { parseRestFiscalProfile } from "@/modules/billing/connectors/rest-profile";
import { getHaciendaRuntimeConfig } from "@/modules/billing/hacienda/config";
import { safeExternalFetch } from "@/modules/billing/connectors/safe-fetch";
import { inspectPkcs12Certificate } from "@/modules/billing/signing/pkcs12";
import type {
  FiscalConnectorAdapter,
  FiscalConnectorContext,
  FiscalProviderCode,
} from "@/modules/billing/connectors/types";

const MAX_VERIFICATION_RESPONSE_BYTES = 250_000;

function text(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function envText(key: string) {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function basicHeader(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

async function readBoundedJson(response: Response) {
  return readConnectorJson(response, MAX_VERIFICATION_RESPONSE_BYTES);
}

class AlegraConnector implements FiscalConnectorAdapter {
  code = "alegra" as const;

  async verify({ credentials }: FiscalConnectorContext) {
    const email = text(credentials, "email");
    const token = text(credentials, "token");
    if (!email || !token) throw new Error("Alegra requiere correo y token de API.");
    const response = await safeExternalFetch("https://api.alegra.com/api/v1/company", {
      headers: { Accept: "application/json", Authorization: basicHeader(email, token) },
    });
    const payload = await readBoundedJson(response) as Record<string, unknown> | null;
    if (!response.ok) throw new Error(`Alegra rechazó la verificación (${response.status}).`);
    const accountId = payload && (text(payload, "id") || text(payload, "identification"));
    const companyName = payload ? text(payload, "name") : null;
    return {
      activatable: false,
      capabilities: ["connection_verified", "customers", "products", "taxes"],
      detail: `${companyName ? `Cuenta ${companyName}` : "Cuenta Alegra"} verificada. Falta completar los mapeos de cliente, productos, impuestos y numeración antes de emitir.`,
      ...(accountId ? { providerAccountId: accountId } : {}),
    };
  }
}

class HaciendaConnector implements FiscalConnectorAdapter {
  code = "hacienda" as const;

  async verify({ credentials, environment }: FiscalConnectorContext) {
    const username = text(credentials, "username");
    const password = text(credentials, "password");
    const certificateBase64 = text(credentials, "certificateBase64");
    const certificatePin = text(credentials, "certificatePin");
    if (!username || !password) {
      throw new Error("Hacienda requiere usuario y contraseña de comprobantes electrónicos.");
    }
    if (!certificateBase64 || !certificatePin) {
      throw new Error("Hacienda requiere la llave criptográfica .p12 y su PIN.");
    }
    const certificate = await inspectPkcs12Certificate(certificateBase64, certificatePin);
    const runtime = getHaciendaRuntimeConfig(environment);
    if (!runtime.authUrl) throw new Error("Hacienda no tiene URL de autenticación configurada.");
    const response = await safeExternalFetch(runtime.authUrl, {
      body: new URLSearchParams({
        client_id: runtime.clientId,
        grant_type: "password",
        password,
        username,
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });
    const payload = await readBoundedJson(response) as {
      access_token?: string;
      error_description?: string;
    } | null;
    if (!response.ok || !payload?.access_token) {
      throw new Error(payload?.error_description || `Hacienda rechazó la autenticación (${response.status}).`);
    }
    return {
      activatable: true,
      capabilities: [
        "issue_invoice",
        "issue_ticket",
        "status",
        "artifacts",
        "credit_note_schema",
        "debit_note_schema",
      ],
      detail: `Credenciales y certificado terminación ${certificate.serialLast4} verificados en Hacienda ${environment === "production" ? "producción" : "pruebas"}. Certificado vigente hasta ${new Date(certificate.expiresAt).toLocaleDateString("es-CR")}.`,
    };
  }
}

class ManagedProviderConnector implements FiscalConnectorAdapter {
  constructor(
    readonly code: "gti" | "factura_profesional",
    private readonly label: string,
    private readonly environmentPrefix: "GTI" | "FACTURA_PROFESIONAL",
  ) {}

  async verify({ credentials, environment, publicConfig }: FiscalConnectorContext) {
    const suffix = environment === "production" ? "PROD" : "TEST";
    const baseUrl = envText(`${this.environmentPrefix}_${suffix}_API_BASE_URL`);
    const verificationPath = envText(`${this.environmentPrefix}_${suffix}_VERIFY_PATH`);
    if (!baseUrl || !verificationPath) {
      throw new Error(
        `${this.label} requiere que el operador de Biz.OS registre primero el contrato técnico y el ambiente de pruebas del proveedor.`,
      );
    }
    const response = await safeExternalFetch(new URL(verificationPath, baseUrl).toString(), {
      headers: connectorAuthenticationHeaders(credentials, publicConfig),
    });
    const payload = await readBoundedJson(response);
    if (!response.ok) throw new Error(`${this.label} rechazó la verificación (${response.status}).`);
    return {
      activatable: false,
      capabilities: ["connection_verified"],
      detail: `${this.label} respondió correctamente en ${environment === "production" ? "producción" : "pruebas"}. La conexión queda verificada hasta instalar y aprobar el contrato de emisión de esta versión.`,
      ...(payload && typeof payload === "object" && !Array.isArray(payload)
        && text(payload as Record<string, unknown>, "id")
        ? { providerAccountId: text(payload as Record<string, unknown>, "id") ?? undefined }
        : {}),
    };
  }
}

class ConfigurableRestConnector implements FiscalConnectorAdapter {
  code = "rest" as const;

  async verify({ credentials, publicConfig }: FiscalConnectorContext) {
    const profile = parseRestFiscalProfile(publicConfig);
    ensureAllowedRestHost(profile.baseUrl);
    const response = await safeExternalFetch(new URL(profile.verificationPath, profile.baseUrl).toString(), {
      headers: connectorAuthenticationHeaders(credentials, publicConfig),
    });
    const payload = await readBoundedJson(response) as Record<string, unknown> | null;
    if (!response.ok) throw new Error(`El servicio REST rechazó la verificación (${response.status}).`);
    const contractVersion = payload && text(payload, "contractVersion");
    const advertisedCapabilities = payload && Array.isArray(payload.capabilities)
      ? payload.capabilities.filter((item): item is string => typeof item === "string")
      : [];
    const requiredCapabilities = ["issue", "status", "idempotency"];
    if (
      contractVersion !== profile.contractVersion ||
      !requiredCapabilities.every((capability) => advertisedCapabilities.includes(capability))
    ) {
      throw new Error(
        "El servicio respondió, pero no confirmó el contrato bizos-fiscal-v1 con emisión, estado e idempotencia.",
      );
    }
    return {
      activatable: true,
      capabilities: ["issue_invoice", "status", "artifacts", "idempotency"],
      detail: "Servicio REST verificado y activado con el contrato bizos-fiscal-v1.",
    };
  }
}

const CONNECTORS = new Map<FiscalProviderCode, FiscalConnectorAdapter>([
  ["alegra", new AlegraConnector()],
  ["hacienda", new HaciendaConnector()],
  ["gti", new ManagedProviderConnector("gti", "GTI", "GTI")],
  [
    "factura_profesional",
    new ManagedProviderConnector(
      "factura_profesional",
      "FacturaProfesional / ComprobantesElectronicosCR",
      "FACTURA_PROFESIONAL",
    ),
  ],
  ["rest", new ConfigurableRestConnector()],
]);

export function getFiscalConnector(code: FiscalProviderCode) {
  return CONNECTORS.get(code) ?? null;
}
