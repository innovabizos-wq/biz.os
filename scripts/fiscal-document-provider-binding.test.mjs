import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path) => readFileSync(path, "utf8");

test("fiscal documents persist an immutable tenant-scoped provider binding", () => {
  const migration = source(
    "supabase/migrations/20260914140000_fiscal_document_provider_binding.sql",
  );

  for (const column of [
    "fiscal_connection_id",
    "provider_code",
    "provider_environment",
    "provider_document_id",
    "provider_reference",
    "provider_status",
    "provider_bound_at",
    "provider_last_response_at",
  ]) {
    assert.match(migration, new RegExp(`add column if not exists ${column}`));
  }
  assert.match(migration, /foreign key \(fiscal_connection_id, empresa_id\)/);
  assert.match(migration, /references public\.company_fiscal_connections\(id, empresa_id\)/);
  assert.match(migration, /protect_fiscal_document_provider_binding/);
  assert.match(migration, /La conexión fiscal asignada al documento es inmutable/);
  assert.match(migration, /protect_bound_fiscal_connection_identity/);
  assert.match(migration, /fiscal_documents_provider_document_unique/);
  assert.doesNotMatch(migration, /\bdrop\s+(table|column)\b/i);
});

test("binding is authorized and never guesses a provider for an old submitted document", () => {
  const migration = source(
    "supabase/migrations/20260914140000_fiscal_document_provider_binding.sql",
  );

  assert.match(migration, /bind_fiscal_document_connection_internal/);
  assert.match(migration, /bind_fiscal_document_connection_from_outbox/);
  assert.match(migration, /job\.lease_token = p_lease_token/);
  assert.match(migration, /job\.lock_expires_at > now\(\)/);
  assert.match(migration, /v_document\.status not in \('validated', 'xml_generated'\)/);
  assert.match(migration, /requiere conciliación manual/);
  assert.match(migration, /connection\.status = 'active'/);
  assert.match(migration, /connection\.environment = v_document\.environment/);
  assert.match(migration, /current_user_has_permission\('billing\.issue'\)/);
  assert.match(migration, /grant execute on function public\.bind_fiscal_document_connection\(uuid\) to authenticated/);
  assert.match(migration, /grant execute on function public\.bind_fiscal_document_connection_from_outbox\(uuid, uuid, uuid\) to service_role/);
});

test("signing, submission, status and recovery use the document's exact connection", () => {
  const issuance = source("src/modules/billing/issuance.ts");
  const actions = source("src/modules/billing/actions.ts");
  const client = source("src/modules/billing/hacienda/client.ts");
  const signer = source("src/modules/billing/signing/signer.ts");
  const recovery = source("src/modules/billing/recovery.ts");
  const processor = source("src/modules/integrations/outbox/processor.ts");

  assert.match(issuance, /bind_fiscal_document_connection_from_outbox/);
  assert.match(issuance, /bind_fiscal_document_connection/);
  assert.match(issuance, /getHaciendaClientForConnection/);
  assert.match(issuance, /provider_document_id: document\.clave/);
  assert.match(issuance, /provider_status: statusResult\.status/);
  assert.match(actions, /requireHaciendaDocumentConnection/);
  assert.match(actions, /getHaciendaClientForConnection/);
  assert.doesNotMatch(actions, /getHaciendaClientForCompany/);
  assert.match(client, /export async function getHaciendaClientForConnection/);
  assert.match(client, /\.eq\("id", connectionId\)/);
  assert.match(client, /data\.environment !== expectedEnvironment/);
  assert.match(signer, /getSignerSecrets\(input\.empresaId, input\.connectionId\)/);
  assert.match(signer, /\.eq\("id", connectionId\)/);
  assert.match(recovery, /getHaciendaClientForConnection/);
  assert.match(recovery, /document\.fiscal_connection_id/);
  assert.match(processor, /getFiscalDocumentDetail/);
  assert.match(processor, /loadBoundFiscalDocument/);
  assert.doesNotMatch(processor, /activeFiscalProvider/);
});

test("document detail exposes the immutable provider identity", () => {
  const queries = source("src/modules/billing/queries.ts");
  for (const field of [
    "providerBoundAt",
    "providerCode",
    "providerConnectionId",
    "providerDocumentId",
    "providerEnvironment",
    "providerReference",
    "providerStatus",
  ]) {
    assert.match(queries, new RegExp(`${field}:`));
  }
  assert.match(queries, /fiscal_connection_id, provider_code, provider_environment/);
});
