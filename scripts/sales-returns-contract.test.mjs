import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");

const migration = source("supabase/migrations/20260921110302_sales_returns.sql");
const fiscalCatalogs = source(
  "supabase/migrations/20260921110826_seed_fiscal_transaction_catalogs.sql",
);
const actions = source("src/modules/sales-returns/actions.ts");
const schemas = source("src/modules/sales-returns/schemas.ts");
const queries = source("src/modules/sales-returns/queries.ts");
const panel = source(
  "src/modules/sales-returns/components/sale-returns-panel.tsx",
);
const salePage = source("src/app/(app)/ventas/[ventaId]/page.tsx");

test("sales returns preserve independent financial, inventory and fiscal effects", () => {
  assert.match(migration, /create table if not exists public\.sales_returns/);
  assert.match(migration, /financial_status text not null default 'pending'/);
  assert.match(migration, /inventory_status text not null default 'pending'/);
  assert.match(migration, /fiscal_status text not null default 'not_required'/);
  assert.match(migration, /create table if not exists public\.sales_return_items/);
  assert.match(migration, /create table if not exists public\.payment_refunds/);
  assert.doesNotMatch(migration, /drop\s+(table|column)/i);
});

test("return operations are tenant-scoped, permission checked and idempotent", () => {
  assert.match(migration, /sales_returns_empresa_creation_operation_unique/);
  assert.match(migration, /sales_returns_empresa_financial_operation_unique/);
  assert.match(migration, /sales_returns_empresa_inventory_operation_unique/);
  assert.match(migration, /pg_catalog\.pg_advisory_xact_lock/g);
  assert.match(migration, /La clave idempotente ya fue usada con otros datos/);
  assert.match(migration, /La cantidad devuelta supera la cantidad vendida/);
  assert.match(migration, /current_user_has_permission\('sales\.orders\.edit'\)/);
  assert.match(migration, /current_user_has_permission\('payments\.accounts\.manage'\)/);
  assert.match(migration, /current_user_has_permission\('inventory\.stock\.adjust'\)/);
  assert.match(migration, /current_user_has_permission\('billing\.credit_note'\)/);
  assert.match(
    migration,
    /revoke all on function public\.create_sales_return[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.prepare_sales_return_credit_note[\s\S]*to authenticated/,
  );
});

test("financial, physical and fiscal operations reuse the frozen return snapshot", () => {
  assert.match(migration, /v_new_total := v_account\.total - v_return\.total_amount/);
  assert.match(migration, /v_refund := greatest\(v_return\.total_amount - v_account\.saldo, 0\)/);
  assert.match(migration, /referencia_tipo, referencia_id[\s\S]*'sales_return', v_return\.id/);
  assert.match(migration, /document_type_code[\s\S]*'03'/);
  assert.match(migration, /v_original\.issuer_snapshot, v_original\.receiver_snapshot/);
  assert.match(migration, /reference_clave[\s\S]*v_original\.clave/);
  assert.match(migration, /source_type = 'sales_return'/);
});

test("the sale UI exposes recoverable return operations and visible query failures", () => {
  assert.match(actions, /create_sales_return/);
  assert.match(actions, /settle_sales_return_financial/);
  assert.match(actions, /apply_sales_return_inventory/);
  assert.match(actions, /prepare_sales_return_credit_note/);
  assert.match(schemas, /operationId: uuidSchema/g);
  assert.match(panel, /name="operationId"[\s\S]*randomUUID\(\)/);
  assert.match(panel, /Aplicar crédito y reembolso/);
  assert.match(panel, /Reintegrar inventario/);
  assert.match(panel, /Preparar nota de crédito/);
  assert.match(panel, /La creación queda bloqueada hasta recuperar el historial/);
  assert.match(queries, /No se pudieron consultar las devoluciones/);
  assert.match(salePage, /<SaleReturnsPanel/);
});

test("XML 4.4 transaction catalogs contain the codes used by billing and POS", () => {
  for (const code of ["01", "02", "03", "04", "05", "06", "07", "99"]) {
    assert.match(fiscalCatalogs, new RegExp(`\\('${code}',`));
  }
  assert.match(fiscalCatalogs, /'06', 'SINPE Movil'/);
  assert.match(fiscalCatalogs, /insert into public\.fiscal_sale_conditions/);
  assert.match(fiscalCatalogs, /insert into public\.fiscal_payment_methods/);
});
