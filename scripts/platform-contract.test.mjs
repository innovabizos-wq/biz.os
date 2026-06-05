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
