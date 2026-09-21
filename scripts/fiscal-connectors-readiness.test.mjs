import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);

function source(path) {
  return readFileSync(new URL(path, root), "utf8");
}

test("fiscal connections activate only adapters with an implemented issuance contract", () => {
  const actions = source("src/modules/billing/connectors/actions.ts");
  const types = source("src/modules/billing/connectors/types.ts");

  assert.match(types, /activatable: boolean/);
  assert.match(actions, /if \(verification\.activatable\)/);
  assert.match(actions, /status: verification\.activatable \? "active" : "verified"/);
});

test("provider verification uses authoritative endpoints and bounded responses", () => {
  const registry = source("src/modules/billing/connectors/registry.ts");
  const allowlist = source("src/modules/billing/connectors/host-allowlist.ts");
  const connectorHttp = source("src/modules/billing/connectors/connector-http.ts");

  assert.match(registry, /https:\/\/api\.alegra\.com\/api\/v1\/company/);
  assert.match(registry, /MAX_VERIFICATION_RESPONSE_BYTES = 250_000/);
  assert.match(registry, /activatable: true[\s\S]*issue_invoice/);
  assert.match(registry, /class ManagedProviderConnector/);
  assert.match(registry, /`\$\{this\.environmentPrefix\}_\$\{suffix\}_API_BASE_URL`/);
  assert.match(registry, /new ManagedProviderConnector\("gti", "GTI", "GTI"\)/);
  assert.match(registry, /FACTURA_PROFESIONAL/);
  assert.match(allowlist, /BILLING_REST_ALLOWED_HOSTS/);
  assert.match(allowlist, /El dominio REST debe ser autorizado primero/);
  assert.match(connectorHttp, /El nombre del header de API key no está permitido/);
  assert.doesNotMatch(registry, /new ConfigurableConnector\("gti", \["issue"/);
});

test("connections UI declares commercial readiness without asking customers for managed-provider URLs", () => {
  const manager = source("src/modules/billing/connectors/components/connections-manager.tsx");

  assert.match(manager, /Hacienda directo", status: "Operativo"/);
  assert.match(manager, /GTI", status: "Requiere contrato"/);
  assert.match(manager, /Alegra", status: "Verificación disponible"/);
  assert.match(manager, /provider === "rest" \? <>[\s\S]*URL base HTTPS/);
  assert.doesNotMatch(manager, /provider === "gti" \|\| provider === "factura_profesional" \|\| provider === "rest" \? <>\s*<label[^>]*>URL base HTTPS/);
  assert.match(manager, /solo activa automáticamente un conector cuyo contrato de emisión esté implementado/);
});

test("connector capability migration removes previously unproved active emission claims", () => {
  const migration = source("supabase/migrations/20260914130000_fiscal_connector_capability_truth.sql");

  assert.match(migration, /when 'hacienda' then '\["issue_invoice","issue_ticket","status","artifacts","credit_note_schema","debit_note_schema"\]'/);
  assert.match(migration, /where provider_code in \('gti', 'factura_profesional', 'alegra', 'rest'\)/);
  assert.match(migration, /set status = 'verified'/);
  assert.doesNotMatch(migration, /delete\s+from|drop\s+(table|column)/i);
});
