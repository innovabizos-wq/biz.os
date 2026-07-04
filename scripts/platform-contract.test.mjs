import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const catalogSource = readFileSync(
  new URL("../src/modules/platform-modules/module-catalog.ts", import.meta.url),
  "utf8",
);
const coreSource = readFileSync(
  new URL("../src/types/core.ts", import.meta.url),
  "utf8",
);
const migration0035 = readFileSync(
  new URL("../database/migrations/0035_rpc_grants_and_rls_policies.sql", import.meta.url),
  "utf8",
);
const migration0036 = readFileSync(
  new URL("../database/migrations/0036_module_config_health_and_secret_refs.sql", import.meta.url),
  "utf8",
);
const migration0037 = readFileSync(
  new URL("../database/migrations/0037_fk_indexes_and_duplicate_index_cleanup.sql", import.meta.url),
  "utf8",
);
const migration0038 = readFileSync(
  new URL("../database/migrations/0038_remaining_fk_indexes.sql", import.meta.url),
  "utf8",
);
const migration0039 = readFileSync(
  new URL("../database/migrations/0039_rls_initplan_cleanup.sql", import.meta.url),
  "utf8",
);
const migration0040 = readFileSync(
  new URL("../database/migrations/0040_production_hardening_vault_health_rpc.sql", import.meta.url),
  "utf8",
);
const migration0041 = readFileSync(
  new URL("../database/migrations/0041_revoke_legacy_whatsapp_send_config_grant.sql", import.meta.url),
  "utf8",
);
const migration0042 = readFileSync(
  new URL("../database/migrations/0042_operational_modules_payments_purchases_ai_mobile.sql", import.meta.url),
  "utf8",
);
const migration0044 = readFileSync(
  new URL("../database/migrations/0044_emergency_unassign_operational_future_permissions.sql", import.meta.url),
  "utf8",
);
const migration0045 = readFileSync(
  new URL("../database/migrations/0045_auto_assign_optional_module_permissions.sql", import.meta.url),
  "utf8",
);
const migration0046 = readFileSync(
  new URL("../database/migrations/0046_revoke_unused_module_health_writer.sql", import.meta.url),
  "utf8",
);
const migration0047 = readFileSync(
  new URL("../database/migrations/0047_meta_secret_writes_server_only.sql", import.meta.url),
  "utf8",
);
const migration0048 = readFileSync(
  new URL("../database/migrations/0048_purchases_payments_full_flow.sql", import.meta.url),
  "utf8",
);
const migration0049 = readFileSync(
  new URL("../database/migrations/0049_block_payment_overpayments.sql", import.meta.url),
  "utf8",
);
const migration0052 = readFileSync(
  new URL("../database/migrations/0052_crm_identification_normalization_and_timeline.sql", import.meta.url),
  "utf8",
);

const expectedCoreModules = [
  "admin",
  "crm",
  "agenda",
  "quotes",
  "catalog",
  "sales",
  "inventory",
  "dispatch",
  "hr",
];

const expectedOptionalModules = [
  "billing",
  "whapp",
  "reports",
  "autoblog",
  "ai",
  "purchases",
  "payments",
  "mobile",
];

function moduleBlock(code) {
  const match = catalogSource.match(
    new RegExp(String.raw`\{[\s\S]*?code: "${code}"[\s\S]*?\n  \}`, "m"),
  );

  assert.ok(match, `Missing module contract for ${code}`);
  return match[0];
}

test("platform contract declares every expected module in ModuleCode", () => {
  for (const code of [...expectedCoreModules, ...expectedOptionalModules]) {
    assert.match(coreSource, new RegExp(String.raw`\| "${code}"`));
  }
});

test("core modules are locked in the central module catalog", () => {
  for (const code of expectedCoreModules) {
    assert.match(moduleBlock(code), /kind: "core"/, `${code} must be core`);
  }
});

test("optional modules stay toggleable in the central module catalog", () => {
  for (const code of expectedOptionalModules) {
    assert.match(
      moduleBlock(code),
      /kind: "optional"/,
      `${code} must be optional`,
    );
  }
});

test("future operational modules expose their minimum permissions", () => {
  assert.match(moduleBlock("purchases"), /purchases\.orders\.view/);
  assert.match(moduleBlock("payments"), /payments\.accounts\.view/);
  assert.match(moduleBlock("mobile"), /mobile\.access/);
});

test("supabase hardening migration closes public rpc grants", () => {
  assert.match(migration0035, /revoke all on function %s from anon/);
  assert.match(migration0035, /grant execute on function %s to service_role/);
  assert.match(migration0035, /configuraciones_empresa_no_direct_access/);
  assert.match(migration0035, /inbox_canal_secretos_no_direct_access/);
});

test("module health migration keeps meta secrets non-destructive", () => {
  assert.match(migration0036, /create table if not exists public\.empresa_modulo_health/);
  assert.match(migration0036, /access_token_secret_id uuid/);
  assert.match(migration0036, /secret_storage in \('inline', 'vault', 'mixed'\)/);
});

test("performance migration only drops confirmed duplicate indexes", () => {
  const droppedIndexes = [...migration0037.matchAll(/drop index if exists public\.([a-z0-9_]+)/g)].map(
    (match) => match[1],
  );

  assert.deepEqual(droppedIndexes.sort(), [
    "rrhh_planilla_estados_id_empresa_unique_idx",
    "rrhh_planilla_eventos_empresa_registrado_idx",
  ]);
});

test("remaining FK performance migration is additive", () => {
  assert.match(migration0038, /create index if not exists ventas_cliente_empresa_idx/);
  assert.match(migration0038, /create index if not exists venta_items_venta_empresa_idx/);
  assert.match(migration0038, /create index if not exists inbox_mensajes_conversacion_empresa_idx/);
  assert.doesNotMatch(migration0038, /drop\s+(index|table|column|constraint)/i);
});

test("RLS initplan cleanup wraps auth helpers in select", () => {
  assert.match(migration0039, /profile_id = \(select auth\.uid\(\)\)/);
  assert.match(migration0039, /empresa_id = \(select public\.current_empresa_id\(\)\)/);
  assert.match(migration0039, /\(select public\.current_user_has_permission\('admin\.users\.view'\)\)/);
});

test("production hardening moves Meta secrets behind Vault and service-only RPC", () => {
  assert.match(migration0040, /vault\.create_secret/);
  assert.match(migration0040, /vault\.update_secret/);
  assert.match(migration0040, /migrate_inbox_meta_secrets_to_vault/);
  assert.match(migration0040, /access_token = case when coalesce\(v_access_id/);
  assert.match(migration0040, /obtener_inbox_whatsapp_send_config_server/);
  assert.match(
    migration0040,
    /grant execute on function public\.obtener_inbox_whatsapp_send_config_server\(uuid, uuid, uuid\) to service_role/,
  );
  assert.doesNotMatch(
    migration0040,
    /grant execute on function public\.obtener_inbox_whatsapp_send_config\(uuid\) to authenticated/,
  );
});

test("legacy WhatsApp send config RPC is not executable by authenticated users", () => {
  assert.match(
    migration0041,
    /revoke all on function public\.obtener_inbox_whatsapp_send_config\(uuid\)\s+from anon, authenticated, public;/,
  );
  assert.match(
    migration0041,
    /grant execute on function public\.obtener_inbox_whatsapp_send_config_server\(uuid, uuid, uuid\)\s+to service_role;/,
  );
});

test("production hardening recalculates module health from real module state", () => {
  assert.match(migration0040, /create or replace function public\.recalcular_salud_modulos_empresa_actual/);
  assert.match(migration0040, /create or replace function public\.recalcular_salud_modulos_empresa/);
  assert.match(migration0040, /when 'billing' then exists/);
  assert.match(migration0040, /when 'whapp' then exists/);
  assert.match(migration0040, /meta_secret_storage/);
});

test("operational modules have additive schema and guarded RPC contracts", () => {
  assert.match(migration0042, /create table if not exists public\.payments_accounts/);
  assert.match(migration0042, /create table if not exists public\.purchases_suppliers/);
  assert.match(migration0042, /create table if not exists public\.purchases_orders/);
  assert.match(migration0042, /create table if not exists public\.ai_usage_events/);
  assert.match(migration0042, /sincronizar_cuentas_cobrar_ventas_actual/);
  assert.match(migration0042, /registrar_pago_cuenta_cobrar/);
  assert.match(migration0042, /recibir_orden_compra/);
  assert.match(migration0042, /registrar_ai_usage_event/);
  assert.doesNotMatch(migration0042, /drop\s+(table|column|constraint)/i);
});

test("AI module declares its administration route in the platform catalog", () => {
  assert.match(moduleBlock("ai"), /routes: \["\/admin\/ia"\]/);
});

test("optional module activation restores admin access after emergency permission unassignment", () => {
  assert.match(migration0044, /delete from public\.rol_permisos rp/);
  assert.match(migration0044, /purchases\.orders\.view/);
  assert.match(migration0044, /payments\.accounts\.view/);
  assert.match(migration0044, /ai\.reports\.use/);
  assert.match(migration0044, /mobile\.access/);

  assert.match(migration0045, /create or replace function public\.cambiar_estado_modulo_empresa_actual/);
  assert.match(migration0045, /insert into public\.rol_permisos \(empresa_id, rol_id, permiso_id\)/);
  assert.match(migration0045, /p\.modulo_codigo = v_modulo\.codigo/);
  assert.match(migration0045, /r\.es_sistema = true/);
  assert.match(migration0045, /r\.nombre in \('Administrador', 'Super Admin'\)/);
  assert.match(migration0045, /em\.estado = 'activo'/);
  assert.match(migration0045, /m\.codigo not in \(/);
  assert.doesNotMatch(migration0045, /delete from public\.rol_permisos/i);
});

test("unused module health writer is not exposed to authenticated users", () => {
  assert.match(
    migration0046,
    /revoke all on function public\.registrar_estado_salud_modulo\(text, text, boolean, boolean, text, jsonb\)\s+from anon, authenticated, public;/,
  );
  assert.match(
    migration0046,
    /grant execute on function public\.registrar_estado_salud_modulo\(text, text, boolean, boolean, text, jsonb\)\s+to service_role;/,
  );
  assert.doesNotMatch(
    migration0046,
    /to authenticated/i,
  );
});

test("Meta secret write RPCs are service-role only", () => {
  assert.match(
    migration0047,
    /create or replace function public\.guardar_inbox_canal_meta_secretos_server/,
  );
  assert.match(
    migration0047,
    /create or replace function public\.regenerar_inbox_canal_verify_token_server/,
  );
  assert.match(migration0047, /public\.profile_has_permission\(v_user_id, v_empresa_id, 'inbox\.channels\.manage'\)/);
  assert.match(
    migration0047,
    /revoke all on function public\.guardar_inbox_canal_meta_secretos\(uuid, text, text, text, timestamptz\)\s+from anon, authenticated, public;/,
  );
  assert.match(
    migration0047,
    /revoke all on function public\.regenerar_inbox_canal_verify_token\(uuid\)\s+from anon, authenticated, public;/,
  );
  assert.match(
    migration0047,
    /grant execute on function public\.guardar_inbox_canal_meta_secretos_server\(uuid, uuid, uuid, text, text, text, timestamptz\)\s+to service_role;/,
  );
  assert.match(
    migration0047,
    /grant execute on function public\.regenerar_inbox_canal_verify_token_server\(uuid, uuid, uuid\)\s+to service_role;/,
  );
});

test("purchases and payments full flow supports partial receipts and payables", () => {
  assert.match(migration0048, /add column if not exists cantidad_recibida/);
  assert.match(migration0048, /check \(estado in \('borrador', 'emitida', 'parcial', 'recibida', 'cancelada'\)\)/);
  assert.match(migration0048, /create table if not exists public\.purchases_receipts/);
  assert.match(migration0048, /create table if not exists public\.purchases_receipt_items/);
  assert.match(migration0048, /references public\.purchases_orders\(id, empresa_id\)/);
  assert.match(migration0048, /payments_accounts_compra_empresa_fkey/);
  assert.match(migration0048, /payments_accounts_proveedor_empresa_fkey/);
  assert.match(migration0048, /crear_orden_compra_completa/);
  assert.match(migration0048, /recibir_orden_compra_parcial/);
  assert.match(migration0048, /sincronizar_cuentas_pagar_compras_actual/);
  assert.match(migration0048, /registrar_movimiento_cuenta/);
  assert.match(migration0048, /anular_cuenta_pago/);
  assert.match(migration0048, /current_user_has_permission\('inventory\.stock\.adjust'\)/);
  assert.doesNotMatch(migration0048, /drop\s+(table|column)/i);
});

test("payments block overpayments instead of silently clipping amounts", () => {
  const paymentsActions = readFileSync(
    new URL("../src/modules/payments/actions.ts", import.meta.url),
    "utf8",
  );

  assert.match(paymentsActions, /El monto no puede superar el saldo pendiente/);
  assert.match(paymentsActions, /\.eq\("empresa_id", access\.tenant\.empresaId\)/);
  assert.match(migration0049, /p_monto > v_account\.saldo/);
  assert.match(migration0049, /El monto no puede superar el saldo pendiente/);
  assert.doesNotMatch(migration0049, /least\(p_monto, v_account\.saldo\)/);
  assert.doesNotMatch(migration0049, /drop\s+(table|column|index)/i);
});

test("CRM document normalization is enforced at database level", () => {
  assert.match(migration0052, /create or replace function public\.normalize_crm_identificacion/);
  assert.match(migration0052, /add column if not exists identificacion_normalizada text/);
  assert.match(migration0052, /create unique index if not exists crm_clientes_empresa_identificacion_normalizada_unique/);
  assert.match(migration0052, /Ya existe un cliente con esa identificacion en la empresa actual/);
  assert.match(migration0052, /before insert or update of identificacion/);
});
