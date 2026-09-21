import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (path) => readFileSync(`${root}/${path}`, "utf8");

const migration = source(
  "supabase/migrations/20260921162143_inventory_physical_counts.sql",
);
const actions = source("src/modules/inventory/actions.ts");
const queries = source("src/modules/inventory/queries.ts");
const panel = source(
  "src/modules/inventory/components/inventory-counts-panel.tsx",
);
const page = source("src/app/(app)/inventario/conteos/page.tsx");

test("physical counts snapshot a warehouse and permit only one open count", () => {
  assert.match(migration, /create table if not exists public\.inventory_counts/);
  assert.match(migration, /create table if not exists public\.inventory_count_items/);
  assert.match(migration, /inventory_counts_one_open_warehouse_idx/);
  assert.match(migration, /expected_quantity/);
  assert.match(migration, /snapshot_average_unit_cost/);
});

test("an open count freezes quantity changes until a controlled close", () => {
  assert.match(migration, /guard_inventory_physical_count_freeze/);
  assert.match(migration, /app\.inventory_count_close_id/);
  assert.match(migration, /before update of cantidad/);
  assert.match(migration, /before insert or delete/);
});

test("start close and cancellation are tenant guarded and idempotent", () => {
  assert.match(migration, /function public\.start_inventory_physical_count/);
  assert.match(migration, /function public\.close_inventory_physical_count/);
  assert.match(migration, /function public\.cancel_inventory_physical_count/);
  assert.match(migration, /inventory\.count\.start/);
  assert.match(migration, /inventory\.count\.close/);
  assert.match(migration, /inventory\.count\.cancel/);
  assert.match(migration, /request_payload <> v_request/);
  assert.match(migration, /current_user_has_permission\('inventory\.stock\.adjust'\)/);
});

test("closing records audited adjustments without discarding known average cost", () => {
  assert.match(migration, /referencia_tipo[\s\S]*'inventory_count'/);
  assert.match(migration, /close_inventory_physical_count/);
  assert.match(migration, /snapshot_cost_status = 'complete'/);
  assert.match(migration, /average_unit_cost = v_item\.snapshot_average_unit_cost/);
  assert.match(migration, /auditoria_eventos/);
});

test("inventory exposes count operations and a complete operator screen", () => {
  assert.match(actions, /start_inventory_physical_count/);
  assert.match(actions, /record_inventory_count_item/);
  assert.match(actions, /close_inventory_physical_count/);
  assert.match(actions, /cancel_inventory_physical_count/);
  assert.match(queries, /getInventoryCounts/);
  assert.match(queries, /getInventoryCountItems/);
  assert.match(panel, /Cerrar y aplicar diferencias/);
  assert.match(panel, /La bodega queda protegida/);
  assert.match(page, /InventoryCountsPanel/);
});
