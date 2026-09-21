import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path) => readFileSync(path, "utf8");

test("REST fiscal profile is declarative, bounded and requires recoverable idempotency", () => {
  const profile = source("src/modules/billing/connectors/rest-profile.ts");
  const registry = source("src/modules/billing/connectors/registry.ts");
  const http = source("src/modules/billing/connectors/connector-http.ts");
  const allowlist = source("src/modules/billing/connectors/host-allowlist.ts");

  assert.match(profile, /z\.literal\("bizos-fiscal-v1"\)/);
  assert.match(profile, /statusPathTemplate\.match\(\/\\\{reference\\\}\/g\)/);
  assert.match(profile, /Un estado REST no puede pertenecer a más de un resultado/);
  assert.match(profile, /responseField/);
  assert.match(registry, /requiredCapabilities = \["issue", "status", "idempotency"\]/);
  assert.match(registry, /activatable: true/);
  assert.match(registry, /Servicio REST verificado y activado/);
  assert.match(http, /MAX_CONNECTOR_RESPONSE_BYTES = 1_000_000/);
  assert.match(allowlist, /BILLING_REST_ALLOWED_HOSTS/);
  assert.doesNotMatch(profile, /eval\(|new Function|javascript/i);
});

test("REST runtime uses the exact connection and a stable idempotency reference", () => {
  const client = source("src/modules/billing/connectors/rest-client.ts");
  const issuance = source("src/modules/billing/connectors/rest-issuance.ts");
  const processor = source("src/modules/integrations/outbox/processor.ts");

  assert.match(client, /\.eq\("id", connectionId\)/);
  assert.match(client, /data\.environment !== expectedEnvironment/);
  assert.match(client, /"Idempotency-Key": idempotencyKey/);
  assert.match(client, /echoedReference !== idempotencyKey/);
  assert.match(client, /safeExternalFetch/);
  assert.match(issuance, /contractVersion: "bizos-fiscal-v1"/);
  assert.match(issuance, /`bizos-fiscal-\$\{document\.id\}`/);
  assert.match(issuance, /provider_reference: idempotencyKey/);
  assert.match(issuance, /provider_document_id/);
  assert.match(issuance, /artifact_type: "provider_response"/);
  assert.match(processor, /document\.providerCode === "rest"/);
  assert.match(processor, /runRestFiscalIssuance/);
});

test("REST connector UI and schema declare the full executable contract", () => {
  const manager = source("src/modules/billing/connectors/components/connections-manager.tsx");
  const migration = source("supabase/migrations/20260914141000_rest_fiscal_contract.sql");

  for (const field of [
    "issuePath",
    "statusPathTemplate",
    "statusField",
    "documentIdField",
    "referenceField",
    "acceptedValues",
    "processingValues",
    "rejectedValues",
  ]) {
    assert.match(manager, new RegExp(`name=\\"${field}\\"`));
  }
  assert.match(migration, /provider_response/);
  assert.match(migration, /"issue_invoice","status","artifacts","idempotency"/);
  assert.doesNotMatch(migration, /drop\s+(table|column)/i);
  assert.match(source("docs/modules/billing-rest-connector.md"), /bizos-fiscal-v1/);
});
