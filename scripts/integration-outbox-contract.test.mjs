import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);

function source(path) {
  return readFileSync(new URL(path, root), "utf8");
}

test("integration outbox leases work and records every external result", () => {
  const baseMigration = source("supabase/migrations/20260913121000_integration_outbox.sql");
  const processor = source("src/modules/integrations/outbox/processor.ts");

  assert.match(baseMigration, /for update skip locked/);
  assert.match(baseMigration, /locked_until = now\(\) \+ make_interval/);
  assert.match(baseMigration, /unique \(empresa_id, topic, idempotency_key\)/);
  assert.match(baseMigration, /o\.lease_token = p_lease_token/g);
  assert.match(processor, /claimIntegrationOutboxJobs/);
  assert.match(processor, /completeIntegrationOutboxJob/);
  assert.match(processor, /failIntegrationOutboxJob/);
  assert.match(processor, /deadLetterIntegrationOutboxJob/);
  assert.doesNotMatch(processor, /switch.*provider|fallback.*provider/is);
});

test("worker bridges require service role, active lease and original user permission", () => {
  const migration = source("supabase/migrations/20260913125000_integration_outbox_operations.sql");

  assert.match(migration, /auth\.jwt\(\)->>'role'.*service_role/);
  assert.match(migration, /job\.status = 'processing'/g);
  assert.match(migration, /job\.lease_token = p_lease_token/g);
  assert.match(migration, /profile\.id = v_job\.created_by/);
  assert.match(migration, /permission\.codigo in \('billing\.issue', 'billing\.invoices\.create'\)/);
  assert.match(migration, /grant execute on function public\.prepare_fiscal_document_from_outbox.*to service_role/);
  assert.doesNotMatch(migration, /grant execute on function public\.prepare_fiscal_document_from_outbox.*to authenticated/);
});

test("outbox is scheduled through Workflow and has a protected operator retry", () => {
  const config = JSON.parse(source("vercel.json"));
  const deploymentStatus = source("docs/estado-implementacion-plan-integral-2026-09-21.md");
  const route = source("src/app/api/integrations/outbox/run/route.ts");
  const workflow = source("src/modules/integrations/outbox/workflow.ts");
  const action = source("src/modules/integrations/outbox/actions.ts");

  assert.ok(config.crons.some((cron) => cron.path === "/api/integrations/outbox/run" && cron.schedule === "0 5 * * *"));
  assert.match(deploymentStatus, /criterio comercial de activación dentro de un minuto/);
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /await start\(integrationOutboxWorkflow/);
  assert.match(workflow, /"use workflow"/);
  assert.match(workflow, /"use step"/);
  assert.match(action, /billing\.fiscal\.manage/);
  assert.match(action, /rpc\("retry_integration_outbox_job"/);
});
