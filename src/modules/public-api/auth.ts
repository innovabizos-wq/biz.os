import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { createServiceRoleClient } from "@/lib/supabase/admin";

export type PublicApiContext = {
  apiKeyId: string;
  client: ReturnType<typeof createServiceRoleClient>;
  empresaId: string;
  keyName: string;
  requestId: string;
  startedAt: number;
};

type AuthenticationResult =
  | { context: PublicApiContext; error: null; ok: true }
  | {
      context: null;
      error: { code: "AUTHENTICATION_REQUIRED" | "FORBIDDEN" | "RATE_LIMITED"; status: number };
      ok: false;
    };

type AuthorizationRow = {
  api_key_id: string;
  empresa_id: string;
  key_name: string;
};

function rawApiKey(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return bearer || request.headers.get("x-api-key")?.trim() || null;
}

function parseApiKey(value: string | null) {
  if (!value) return null;
  const match = value.match(/^bizos_(?:live|test)_([0-9a-f]{12})_([A-Za-z0-9_-]{32,})$/);
  if (!match) return null;
  return {
    hash: createHash("sha256").update(value).digest("hex"),
    prefix: match[1],
  };
}

function authenticationFailure(message: string | undefined): AuthenticationResult {
  if (message?.includes("API_RATE_LIMITED")) {
    return { context: null, error: { code: "RATE_LIMITED", status: 429 }, ok: false };
  }
  if (message?.includes("API_SCOPE_DENIED")) {
    return { context: null, error: { code: "FORBIDDEN", status: 403 }, ok: false };
  }
  return {
    context: null,
    error: { code: "AUTHENTICATION_REQUIRED", status: 401 },
    ok: false,
  };
}

export async function authenticatePublicApiRequest(
  request: Request,
  requiredScope: string,
): Promise<AuthenticationResult> {
  const parsed = parseApiKey(rawApiKey(request));
  if (!parsed) return authenticationFailure(undefined);

  const client = createServiceRoleClient();
  const requestId = randomUUID();
  const { data, error } = await client.rpc("authorize_public_api_request", {
    p_key_prefix: parsed.prefix,
    p_method: request.method.toUpperCase(),
    p_path: new URL(request.url).pathname,
    p_request_id: requestId,
    p_required_scope: requiredScope,
    p_secret_hash: parsed.hash,
  });
  if (error) return authenticationFailure(error.message);
  const row = (data as AuthorizationRow[] | null)?.[0];
  if (!row) return authenticationFailure(undefined);

  return {
    context: {
      apiKeyId: row.api_key_id,
      client,
      empresaId: row.empresa_id,
      keyName: row.key_name,
      requestId,
      startedAt: Date.now(),
    },
    error: null,
    ok: true,
  };
}

export async function completePublicApiRequest(context: PublicApiContext, status: number) {
  await context.client.rpc("complete_public_api_request", {
    p_api_key_id: context.apiKeyId,
    p_duration_ms: Date.now() - context.startedAt,
    p_request_id: context.requestId,
    p_response_status: status,
  });
}
