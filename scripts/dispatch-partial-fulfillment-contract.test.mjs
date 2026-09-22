import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260921221500_dispatch_partial_fulfillment.sql",
  import.meta.url,
);

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("partial dispatch migration keeps line progress and idempotent effects", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /create table if not exists public\.dispatch_items/i);
  assert.match(sql, /delivered_quantity - returned_quantity <= ordered_quantity/i);
  assert.match(sql, /unique \(empresa_id, operation_id\)/i);
  assert.match(sql, /record_dispatch_fulfillment/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /status = 'active'[\s\S]*consumed_quantity < reserved_quantity/i);
  assert.match(sql, /apply_sales_return_inventory/i);
  assert.match(sql, /financial_status[\s\S]*'pending'/i);
  assert.match(sql, /fiscal_status/i);
  assert.match(sql, /business_operation_receipts/i);
  assert.match(sql, /from public, anon, service_role/i);
  assert.match(sql, /to authenticated/i);
});

test("dispatch UI exposes partial delivery and independent physical return", async () => {
  const panel = await source(
    "../src/modules/dispatch/components/dispatch-fulfillment-panel.tsx",
  );
  const action = await source("../src/modules/dispatch/actions.ts");
  const page = await source("../src/app/(app)/despacho/[despachoId]/page.tsx");

  assert.match(panel, /Confirmar entrega parcial o final/);
  assert.match(panel, /Registrar devolución física/);
  assert.match(panel, /deja el reembolso y la nota fiscal pendientes/);
  assert.match(action, /record_dispatch_fulfillment/);
  assert.match(action, /inventory\.stock\.adjust/);
  assert.match(page, /DispatchFulfillmentPanel/);
});

test("mobile full delivery applies remaining line quantities before evidence completion", async () => {
  const route = await source("../src/app/api/mobile/dispatch/route.ts");
  const mobile = await source(
    "../src/modules/dispatch/components/dispatch-mobile-proof-panel.tsx",
  );

  const fulfillmentCall = route.indexOf("record_dispatch_full_delivery");
  const completionCall = route.indexOf("complete_dispatch_mobile_operation");
  assert.ok(fulfillmentCall > 0);
  assert.ok(completionCall > fulfillmentCall);
  assert.match(mobile, /"parcial"/);
});
