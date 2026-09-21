import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { PublicApiKeySummary } from "@/modules/public-api/contract";

type PublicApiKeyRow = {
  created_at: string;
  expires_at: string | null;
  id: string;
  key_prefix: string;
  last_used_at: string | null;
  name: string;
  rate_limit_per_minute: number;
  revoked_at: string | null;
  scopes: unknown;
  status: "active" | "revoked";
};

function mapKey(row: PublicApiKeyRow): PublicApiKeySummary {
  return {
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    id: row.id,
    keyPrefix: row.key_prefix,
    lastUsedAt: row.last_used_at,
    name: row.name,
    rateLimitPerMinute: row.rate_limit_per_minute,
    revokedAt: row.revoked_at,
    scopes: Array.isArray(row.scopes)
      ? row.scopes.filter((scope): scope is string => typeof scope === "string")
      : [],
    status: row.status,
  };
}

export async function listPublicApiKeys(empresaId: string) {
  const { data, error } = await createServiceRoleClient()
    .from("public_api_keys")
    .select("id, name, key_prefix, scopes, status, rate_limit_per_minute, expires_at, last_used_at, revoked_at, created_at")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No se pudieron consultar las claves API: ${error.message}`);
  return ((data ?? []) as PublicApiKeyRow[]).map(mapKey);
}

export async function createPublicApiKey(input: {
  actorId: string;
  empresaId: string;
  environment: "live" | "test";
  expiresInDays: number | null;
  name: string;
  rateLimitPerMinute: number;
  scopes: string[];
}) {
  const prefix = randomBytes(6).toString("hex");
  const secret = randomBytes(32).toString("base64url");
  const rawKey = `bizos_${input.environment}_${prefix}_${secret}`;
  const secretHash = createHash("sha256").update(rawKey).digest("hex");
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
    : null;
  const { data, error } = await createServiceRoleClient()
    .from("public_api_keys")
    .insert({
      created_by: input.actorId,
      empresa_id: input.empresaId,
      expires_at: expiresAt,
      key_prefix: prefix,
      name: input.name,
      rate_limit_per_minute: input.rateLimitPerMinute,
      scopes: input.scopes,
      secret_hash: secretHash,
      status: "active",
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw new Error(error?.message ?? "No se pudo crear la clave API.");
  return { id: data.id, rawKey };
}

export async function revokePublicApiKey(input: {
  actorId: string;
  empresaId: string;
  keyId: string;
}) {
  const { data, error } = await createServiceRoleClient()
    .from("public_api_keys")
    .update({ revoked_at: new Date().toISOString(), revoked_by: input.actorId, status: "revoked" })
    .eq("empresa_id", input.empresaId)
    .eq("id", input.keyId)
    .eq("status", "active")
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw new Error(`No se pudo revocar la clave API: ${error.message}`);
  return Boolean(data);
}
