import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);

function source(path) {
  return readFileSync(new URL(path, root), "utf8");
}

test("purchase order RPC fix qualifies ambiguous estado references", () => {
  const migration = source("supabase/migrations/20260712165214_fix_stage1_operations.sql");

  assert.match(migration, /create or replace function public\.crear_orden_compra_completa/);
  assert.match(migration, /returns table \(order_id uuid, numero text, estado text, total numeric\)/);
  assert.match(migration, /return query\s+select\s+v_order\.id,\s+v_order\.numero,\s+v_order\.estado,\s+v_order\.total;/s);
  assert.doesNotMatch(migration, /return query select v_order\.id, v_order\.numero, estado, v_order\.total/);
});

test("manual catalog product creation initializes inventory stock rows", () => {
  const catalogActions = source("src/modules/catalog/actions.ts");

  assert.match(catalogActions, /function initializeProductStockRows/);
  assert.match(catalogActions, /function registerInitialProductStock/);
  assert.match(catalogActions, /from\("inventario_bodegas"\)/);
  assert.match(catalogActions, /rpc\("actualizar_stock_minimos"/);
  assert.match(catalogActions, /rpc\("registrar_movimiento_inventario"/);
  assert.match(catalogActions, /isModuleActive\(access\.tenant\.activeModules, "inventory"\)/);
  assert.match(catalogActions, /hasPermission\(access\.tenant\.permissions, "inventory\.stock\.adjust"\)/);
  assert.match(catalogActions, /revalidatePath\("\/inventario"\)/);
  assert.match(source("src/modules/catalog/schemas.ts"), /cantidadInicial/);
  assert.match(source("src/modules/catalog/components/product-form.tsx"), /name="bodegaId"/);
  assert.match(source("src/modules/catalog/components/product-form.tsx"), /name="cantidadInicial"/);
});

test("purchase order form ignores optional empty item rows", () => {
  const purchasesActions = source("src/modules/purchases/actions.ts");

  assert.match(purchasesActions, /function getPurchaseItemsFromForm/);
  assert.match(
    purchasesActions,
    /\.filter\(\(item\) => item\.productoId \|\| item\.cantidad \|\| item\.costoUnitario\)/,
  );
  assert.match(purchasesActions, /items:\s*getPurchaseItemsFromForm\(formData\)/);
});

test("confirming a quote sale synchronizes receivables and revalidates payments", () => {
  const quoteActions = source("src/modules/quotes/actions.ts");

  assert.match(quoteActions, /function syncReceivablesAfterSaleConfirmation/);
  assert.match(quoteActions, /isModuleActive\(access\.tenant\.activeModules, "payments"\)/);
  assert.match(quoteActions, /payments\.accounts\.view/);
  assert.match(quoteActions, /payments\.accounts\.manage/);
  assert.match(quoteActions, /rpc\("sincronizar_cuentas_cobrar_ventas_actual"\)/);
  assert.match(quoteActions, /await syncReceivablesAfterSaleConfirmation\(supabase, access\)/);
  assert.match(quoteActions, /revalidatePath\("\/pagos"\)/);
});

test("core standard roles are repaired additively for operational flow", () => {
  const migration = source(
    "supabase/migrations/20260718120000_repair_core_standard_role_permissions.sql",
  );

  assert.match(migration, /insert into public\.rol_permisos/);
  assert.match(migration, /on conflict on constraint rol_permisos_empresa_rol_permiso_unique do nothing/);
  assert.doesNotMatch(migration, /\bdelete\s+from\b/i);
  assert.match(migration, /when 'administrador' then true/);
  assert.match(migration, /'catalog\.products\.view'/);
  assert.match(migration, /'inventory\.stock\.view'/);
  assert.match(migration, /'sales\.orders\.status\.change'/);
  assert.match(migration, /'dispatch\.orders\.status\.change'/);
  assert.match(migration, /'payments\.accounts\.manage'/);
});

test("dispatch delivery synchronizes sale completion and revalidates the sale page", () => {
  const migration = source(
    "supabase/migrations/20260718121000_sync_sale_status_from_dispatch_delivery.sql",
  );
  const dispatchActions = source("src/modules/dispatch/actions.ts");
  const dispatchStatusActions = source(
    "src/modules/dispatch/components/dispatch-status-actions.tsx",
  );

  assert.match(migration, /create or replace function public\.cambiar_estado_despacho/);
  assert.match(migration, /when p_estado = 'entregado'/);
  assert.match(migration, /then 'completada'/);
  assert.match(migration, /sincronizar_estado_venta_desde_despacho/);
  assert.match(dispatchStatusActions, /name="ventaId"/);
  assert.match(
    dispatchActions,
    /revalidateDispatchPaths\(parsed\.data\.despachoId, parsed\.data\.ventaId\)/,
  );
});
