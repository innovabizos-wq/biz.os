import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (path) => readFileSync(`${root}/${path}`, "utf8");

const migration = source(
  "supabase/migrations/20260921113841_purchase_returns_and_idempotent_receipts.sql",
);
const financialFix = source(
  "supabase/migrations/20260921114129_fix_purchase_return_financial_conflict.sql",
);
const actions = source("src/modules/purchase-returns/actions.ts");
const queries = source("src/modules/purchase-returns/queries.ts");
const panel = source(
  "src/modules/purchase-returns/components/purchase-returns-panel.tsx",
);
const purchaseActions = source("src/modules/purchases/actions.ts");
const purchasePage = source("src/app/(app)/compras/ordenes/[ordenId]/page.tsx");

test("purchase receipts use one durable idempotent operation", () => {
  assert.match(migration, /function public\.receive_purchase_order_atomic/);
  assert.match(migration, /scope = 'purchases\.receipt'/);
  assert.match(migration, /request_payload <> v_request/);
  assert.match(migration, /revoke all on function public\.recibir_orden_compra_parcial/);
  assert.match(purchaseActions, /receive_purchase_order_atomic/);
  assert.match(purchasePage, /name="operationId"[^>]+randomUUID/);
});

test("supplier returns preserve receipt snapshots and cap returned quantities", () => {
  assert.match(migration, /create table if not exists public\.purchase_returns/);
  assert.match(migration, /create table if not exists public\.purchase_return_items/);
  assert.match(migration, /receipt_item_id uuid not null/);
  assert.match(migration, /v_already_returned \+ v_quantity > v_receipt_item\.cantidad/);
  assert.match(migration, /v_receipt_item\.costo_unitario/);
  assert.match(migration, /v_order_item\.impuesto_porcentaje/);
});

test("physical and financial purchase-return effects are separate and idempotent", () => {
  assert.match(migration, /function public\.apply_purchase_return_inventory/);
  assert.match(migration, /function public\.settle_purchase_return_financial/);
  assert.match(migration, /inventory_operation_id/);
  assert.match(migration, /financial_operation_id/);
  assert.match(migration, /referencia_tipo[\s\S]*'purchase_return'/);
  assert.match(migration, /purchase_supplier_credits/);
  assert.match(migration, /greatest\(v_paid - v_new_total, 0\)/);
  assert.match(
    financialFix,
    /on conflict on constraint purchase_supplier_credits_return_unique do nothing/,
  );
});

test("payables reflect received value and confirmed financial returns", () => {
  assert.match(migration, /cantidad_recibida \* poi\.costo_unitario/);
  assert.match(migration, /financial_status = 'processed'/);
  assert.match(migration, /v_target_total := greatest\(v_received_total - v_returned_total, 0\)/);
});

test("purchase-return UI fails visibly and exposes independent confirmations", () => {
  assert.match(queries, /No se pudieron consultar las devoluciones de compra/);
  assert.match(panel, /La creación queda bloqueada hasta recuperar el historial/);
  assert.match(panel, /Confirmar salida física/);
  assert.match(panel, /Ajustar cuenta por pagar/);
  assert.match(actions, /payments\.accounts\.manage/);
  assert.match(actions, /inventory\.stock\.adjust/);
  assert.match(purchasePage, /PurchaseReturnsPanel/);
});
