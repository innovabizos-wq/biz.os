import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path) => readFileSync(path, "utf8");

test("GTI uses the official 4.4 payload and keeps credentials server-side", () => {
  const payload = source("src/modules/billing/connectors/gti/payload.ts");
  const client = source("src/modules/billing/connectors/gti/client.ts");
  const manager = source("src/modules/billing/connectors/components/connections-manager.tsx");

  for (const field of ["NumCuenta", "Documentos", "Encabezado", "TipoDoc", "CodigoActividad", "MedioPagos", "Lineas", "CodigoTarifa"]) {
    assert.match(payload, new RegExp(field));
  }
  assert.match(payload, /if \(code === "01"\) return "1"/);
  assert.match(payload, /if \(code === "04"\) return "4"/);
  assert.match(payload, /\^\\d\{13\}\$/);
  assert.match(client, /decryptSecret/);
  assert.match(client, /url\.searchParams\.set\("pUsuario"/);
  assert.match(client, /url\.searchParams\.set\("idPedido", idempotencyKey\)/);
  assert.doesNotMatch(manager, /name="documentUrl"/);
});

test("GTI archives the request, claims one submission and never retries an uncertain send", () => {
  const issuance = source("src/modules/billing/connectors/gti/issuance.ts");
  const processor = source("src/modules/integrations/outbox/processor.ts");
  const migration = source("supabase/migrations/20260926120000_gti_fiscal_adapter.sql");

  assert.match(issuance, /artifact_type: phase === "request" \? "provider_request" : "provider_response"/);
  assert.match(issuance, /provider_reference: reference/);
  assert.match(issuance, /\.eq\("status", "validated"\)/);
  assert.match(issuance, /\.is\("provider_reference", null\)/);
  assert.match(issuance, /No se reenvía automáticamente/);
  assert.match(processor, /document\.providerCode === "gti"/);
  assert.match(processor, /runGtiFiscalIssuance/);
  assert.match(migration, /'provider_request'/);
  assert.match(migration, /where provider_code = 'gti'[\s\S]*status = 'active'/);
  assert.doesNotMatch(migration, /delete\s+from/i);
});

test("GTI stays non-active until a real sandbox emission and recovery query are approved", () => {
  const registry = source("src/modules/billing/connectors/registry.ts");
  const config = source("src/modules/billing/connectors/gti/config.ts");

  assert.match(registry, /class GtiConnector[\s\S]*activatable: false/);
  assert.match(registry, /endpoint HTTPS de pruebas/);
  assert.match(config, /environment === "production" \? OFFICIAL_PRODUCTION_DOCUMENT_URL : null/);
  assert.doesNotMatch(config, /http:\/\/pruebas\.cobroenlinea\.com/);
});
