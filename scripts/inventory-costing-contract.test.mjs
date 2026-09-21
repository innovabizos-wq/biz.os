import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (path) => readFileSync(`${root}/${path}`, "utf8");

const migration = source(
  "supabase/migrations/20260921120438_inventory_weighted_average_cost.sql",
);
const queries = source("src/modules/inventory/queries.ts");
const stockTable = source(
  "src/modules/inventory/components/inventory-stock-table.tsx",
);
const movementsTable = source(
  "src/modules/inventory/components/inventory-movements-table.tsx",
);
const actions = source("src/modules/inventory/actions.ts");

test("inventory stores a per-warehouse weighted average and immutable movement costs", () => {
  assert.match(migration, /average_unit_cost numeric\(14, 6\)/);
  assert.match(migration, /unit_cost numeric\(14, 6\)/);
  assert.match(migration, /total_cost numeric\(16, 2\)/);
  assert.match(migration, /average_cost_before/);
  assert.match(migration, /average_cost_after/);
  assert.match(migration, /capture_inventory_movement_cost/);
});

test("known purchase and transfer entries use weighted-average valuation", () => {
  assert.match(migration, /referencia_tipo = 'purchase_receipt'/);
  assert.match(migration, /pri\.costo_unitario/);
  assert.match(migration, /referencia_tipo = 'traslado_bodega'/);
  assert.match(
    migration,
    /new\.cantidad_anterior \* v_before_cost[\s\S]*new\.cantidad \* v_unit_cost/,
  );
});

test("unknown historical and manual costs remain explicitly incomplete", () => {
  assert.match(migration, /cantidad = 0 then 'complete' else 'incomplete'/);
  assert.match(migration, /v_after_status := 'incomplete'/);
  assert.match(migration, /average_unit_cost is null/);
});

test("cost reconciliation is audited, tenant guarded and idempotent", () => {
  assert.match(migration, /create table if not exists public\.inventory_cost_reconciliations/);
  assert.match(migration, /function public\.reconcile_inventory_average_cost/);
  assert.match(migration, /current_user_has_permission\('inventory\.stock\.adjust'\)/);
  assert.match(migration, /request_payload <> v_request/);
  assert.match(migration, /reconcile_inventory_average_cost/);
  assert.match(actions, /reconcile_inventory_average_cost/);
});

test("inventory screens distinguish complete values from costs requiring reconciliation", () => {
  assert.match(queries, /average_unit_cost/);
  assert.match(queries, /totalInventoryValue/);
  assert.match(stockTable, /Por conciliar/);
  assert.match(stockTable, /StockCostReconciliationForm/);
  assert.match(movementsTable, /Costo unitario/);
  assert.match(movementsTable, /Costo total/);
});
