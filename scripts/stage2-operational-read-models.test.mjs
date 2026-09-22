import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");

test("stage 2 read models are tenant-scoped, permission checked and indexed", () => {
  const migration = source(
    "supabase/migrations/20260922143000_stage2_operational_read_models.sql",
  );

  assert.match(migration, /get_inventory_operational_summary/);
  assert.match(migration, /get_purchases_operational_summary/);
  assert.match(migration, /get_dispatch_operational_summary/);
  assert.match(migration, /security definer/gi);
  assert.match(migration, /set search_path = ''/g);
  assert.match(migration, /public\.current_empresa_id\(\)/g);
  assert.match(migration, /public\.current_user_has_permission/g);
  assert.match(migration, /empresa_id, updated_at desc, id desc/);
  assert.match(migration, /empresa_id, created_at desc, id desc/g);
  assert.match(migration, /revoke all on function[\s\S]+from public, anon/);
  assert.match(migration, /grant execute on function[\s\S]+to authenticated/);
});

test("inventory stock and movement screens use stable bounded pages", () => {
  const queries = source("src/modules/inventory/queries.ts");
  const inventoryPage = source("src/app/(app)/inventario/page.tsx");
  const productsPage = source("src/app/(app)/inventario/productos/page.tsx");
  const movementsPage = source("src/app/(app)/inventario/movimientos/page.tsx");

  assert.match(queries, /const OPERATIONAL_PAGE_SIZE = 50/);
  assert.match(queries, /getInventoryStockPage/);
  assert.match(queries, /getInventoryMovementsPage/);
  assert.match(queries, /\.order\("id", \{ ascending: false \}\)/g);
  assert.match(queries, /\.range\(from, from \+ OPERATIONAL_PAGE_SIZE - 1\)/g);
  assert.match(inventoryPage, /getInventoryStockPage/);
  assert.match(productsPage, /getInventoryStockPage/);
  assert.match(movementsPage, /getInventoryMovementsPage/);
  assert.match(inventoryPage, /ServerPagination/);
  assert.match(productsPage, /ServerPagination/);
  assert.match(movementsPage, /ServerPagination/);
});

test("purchases only load items for the current order page", () => {
  const queries = source("src/modules/purchases/queries.ts");
  const page = source("src/app/(app)/compras/page.tsx");

  assert.match(queries, /const PURCHASES_PAGE_SIZE = 50/);
  assert.match(queries, /getPurchaseOrdersPage/);
  assert.match(queries, /query = query\.in\("order_id", orderId\)/);
  assert.match(queries, /get_purchases_operational_summary/);
  assert.match(page, /orders\.map\(\(order\) => order\.id\)/);
  assert.match(page, /getProductsForInventory\(tenant, \{ limit: 100, query: productQuery \}\)/);
  assert.match(page, /ServerPagination/);
});

test("dispatch table uses a bounded page and an independent exact summary", () => {
  const queries = source("src/modules/dispatch/queries.ts");
  const page = source("src/app/(app)/despacho/page.tsx");

  assert.match(queries, /const DISPATCH_PAGE_SIZE = 50/);
  assert.match(queries, /getDispatchOrdersPage/);
  assert.match(queries, /get_dispatch_operational_summary/);
  assert.match(page, /getDispatchOrdersPage/);
  assert.match(page, /getDispatchOperationalSummary/);
  assert.match(page, /ServerPagination/);
});
