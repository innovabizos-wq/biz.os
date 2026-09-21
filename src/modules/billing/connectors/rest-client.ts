import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  connectorAuthenticationHeaders,
  ensureAllowedRestHost,
  readConnectorJson,
} from "@/modules/billing/connectors/connector-http";
import {
  parseRestFiscalProfile,
  responseField,
  restProviderStatus,
  type RestFiscalProfile,
} from "@/modules/billing/connectors/rest-profile";
import { safeExternalFetch } from "@/modules/billing/connectors/safe-fetch";
import { decryptSecret } from "@/modules/billing/crypto";

type RestConnectionRow = {
  encrypted_credentials: string | null;
  environment: "testing" | "production";
  public_config: Record<string, unknown> | null;
  status: string;
};

export type RestFiscalResult = {
  providerDocumentId: string | null;
  rawResponse: unknown;
  status: "accepted" | "processing" | "rejected" | "unknown";
};

function credentials(value: string | null) {
  const decrypted = decryptSecret(value);
  if (!decrypted) return {};
  const parsed = JSON.parse(decrypted) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Las credenciales REST guardadas no son válidas.");
  }
  return Object.fromEntries(
    Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function rawResponse(response: Response, body: unknown) {
  return {
    body,
    location: response.headers.get("location"),
    requestId: response.headers.get("x-request-id"),
    statusCode: response.status,
  };
}

export class ConfigurableRestFiscalClient {
  constructor(
    private readonly profile: RestFiscalProfile,
    private readonly headers: Record<string, string>,
  ) {}

  async submit(idempotencyKey: string, payload: Record<string, unknown>): Promise<RestFiscalResult> {
    const response = await safeExternalFetch(
      new URL(this.profile.issuePath, this.profile.baseUrl).toString(),
      {
        body: JSON.stringify(payload),
        headers: {
          ...this.headers,
          "Content-Type": "application/json; charset=utf-8",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST",
      },
      20_000,
    );
    const body = await readConnectorJson(response);
    if (!response.ok) {
      throw new Error(`El servicio REST rechazó la emisión (${response.status}).`);
    }
    const echoedReference = responseField(body, this.profile.referenceField);
    if (echoedReference !== idempotencyKey) {
      throw new Error("El servicio REST no devolvió la misma referencia idempotente de la solicitud.");
    }
    const status = restProviderStatus(this.profile, body);
    return {
      providerDocumentId: responseField(body, this.profile.documentIdField),
      rawResponse: rawResponse(response, body),
      status: status === "unknown" && response.status === 202 ? "processing" : status,
    };
  }

  async queryStatus(reference: string): Promise<RestFiscalResult> {
    const path = this.profile.statusPathTemplate.replace(
      "{reference}",
      encodeURIComponent(reference),
    );
    const response = await safeExternalFetch(
      new URL(path, this.profile.baseUrl).toString(),
      { headers: this.headers, method: "GET" },
      15_000,
    );
    const body = await readConnectorJson(response);
    if (response.status === 404) {
      return {
        providerDocumentId: null,
        rawResponse: rawResponse(response, body),
        status: "unknown",
      };
    }
    if (!response.ok) {
      throw new Error(`El servicio REST rechazó la consulta (${response.status}).`);
    }
    const echoedReference = responseField(body, this.profile.referenceField);
    if (echoedReference && echoedReference !== reference) {
      throw new Error("El servicio REST respondió con una referencia distinta a la consultada.");
    }
    return {
      providerDocumentId: responseField(body, this.profile.documentIdField),
      rawResponse: rawResponse(response, body),
      status: restProviderStatus(this.profile, body),
    };
  }
}

export async function getRestFiscalClientForConnection(
  empresaId: string,
  connectionId: string,
  expectedEnvironment: "testing" | "production",
) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("company_fiscal_connections")
    .select("environment, status, public_config, encrypted_credentials")
    .eq("id", connectionId)
    .eq("empresa_id", empresaId)
    .eq("provider_code", "rest")
    .maybeSingle<RestConnectionRow>();
  if (error) throw new Error(`No se pudo cargar la conexión REST asignada: ${error.message}`);
  if (!data) throw new Error("La conexión REST asignada al documento ya no está disponible.");
  if (data.status === "disabled") throw new Error("La conexión REST asignada está deshabilitada.");
  if (data.environment !== expectedEnvironment) {
    throw new Error("El ambiente de la conexión REST no coincide con el documento fiscal.");
  }
  const profile = parseRestFiscalProfile(data.public_config ?? {});
  ensureAllowedRestHost(profile.baseUrl);
  return new ConfigurableRestFiscalClient(
    profile,
    connectorAuthenticationHeaders(credentials(data.encrypted_credentials), data.public_config ?? {}),
  );
}
