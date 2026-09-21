import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const routes = ["clients", "catalog", "sales", "payments", "fiscal-documents"];
const migration = read("supabase/migrations/20260914143000_public_api_v1.sql");
const auth = read("src/modules/public-api/auth.ts");
const pagination = read("src/modules/public-api/pagination.ts");
const handler = read("src/modules/public-api/list-handler.ts");
const management = read("src/modules/public-api/management.ts");

test("public API v1 exposes the committed resources and OpenAPI contract", () => {
  for (const route of routes) {
    assert.equal(existsSync(new URL(`src/app/api/v1/${route}/route.ts`, root)), true, route);
  }
  const openapi = read("src/app/api/v1/openapi.json/route.ts");
  assert.match(openapi, /openapi: "3\.1\.0"/);
  assert.match(openapi, /BearerApiKey/);
  assert.match(openapi, /HeaderApiKey/);
  assert.match(openapi, /x-required-scope/);
});

test("API credentials are hashed, scoped, expiring and never readable by authenticated clients", () => {
  assert.match(migration, /create table if not exists public\.public_api_keys/);
  assert.match(migration, /secret_hash text not null/);
  assert.match(migration, /expires_at timestamptz/);
  assert.match(migration, /scopes jsonb/);
  assert.match(migration, /revoke all on public\.public_api_keys from public, anon, authenticated/);
  assert.match(migration, /authorize_public_api_request/);
  assert.match(migration, /to service_role/);
  assert.doesNotMatch(migration, /grant (?:select|execute)[^;]+to authenticated/is);
  assert.match(management, /createHash\("sha256"\)\.update\(rawKey\)/);
  assert.doesNotMatch(management, /secret:\s*rawKey/);
});

test("API authorization enforces company state, scope and an atomic per-minute limit", () => {
  assert.match(migration, /v_company_status <> 'activa'/);
  assert.match(migration, /v_key\.scopes \? p_required_scope/);
  assert.match(migration, /on conflict on constraint public_api_rate_buckets_pkey do update/);
  assert.match(migration, /API_RATE_LIMITED/);
  assert.match(auth, /AUTHENTICATION_REQUIRED/);
  assert.match(auth, /RATE_LIMITED/);
  assert.match(auth, /complete_public_api_request/);
});

test("API lists use bounded cursor pagination, stable envelopes and tenant predicates", () => {
  assert.match(pagination, /Math\.max\(1, Math\.min\(parsedLimit, 100\)\)/);
  assert.match(pagination, /base64url/);
  assert.match(handler, /\.eq\("empresa_id", context\.empresaId\)/);
  assert.match(handler, /pagination\.limit \+ 1/);
  assert.match(handler, /RESOURCE_QUERY_FAILED/);
  assert.match(handler, /INVALID_CURSOR/);
  assert.match(handler, /completePublicApiRequest/);
});

test("the API foundation includes a durable idempotency ledger for future writes", () => {
  assert.match(migration, /create table if not exists public\.public_api_idempotency/);
  assert.match(migration, /unique \(api_key_id, operation, idempotency_key\)/);
  assert.match(migration, /request_hash text not null/);
  assert.match(migration, /response_body jsonb/);
});
