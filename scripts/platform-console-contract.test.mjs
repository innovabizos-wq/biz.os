import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);

function source(path) {
  return readFileSync(new URL(path, root), "utf8");
}

function exists(path) {
  assert.ok(existsSync(new URL(path, root)), `Missing ${path}`);
}

function srcFiles(dir) {
  const entries = readdirSync(new URL(`${dir}/`, root), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const childPath = `${dir}/${entry.name}`;

    if (entry.isDirectory()) {
      files.push(...srcFiles(childPath));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(childPath);
    }
  }

  return files;
}

test("Platform Console files and routes exist", () => {
  for (const path of [
    "database/migrations/0050_platform_console.sql",
    "src/modules/platform-console/types.ts",
    "src/modules/platform-console/constants.ts",
    "src/modules/platform-console/schemas.ts",
    "src/modules/platform-console/queries.ts",
    "src/modules/platform-console/actions.ts",
    "src/modules/platform-console/guards.ts",
    "src/app/platform/layout.tsx",
    "src/app/platform/page.tsx",
    "src/app/platform/empresas/page.tsx",
    "src/app/platform/empresas/[empresaId]/page.tsx",
    "src/app/platform/whapp/page.tsx",
    "docs/platform-operator-model.md",
    "docs/whapp-provider-model.md",
  ]) {
    exists(path);
  }
});

test("platform_users migration is manual, RLS guarded and non-seeding", () => {
  const migration = source("database/migrations/0050_platform_console.sql");

  assert.match(migration, /create table if not exists public\.platform_users/);
  assert.match(migration, /role in \('owner', 'admin', 'support', 'operator', 'readonly'\)/);
  assert.match(migration, /status in \('active', 'inactive'\)/);
  assert.match(migration, /alter table public\.platform_users enable row level security/);
  assert.match(migration, /current_user_is_platform_user/);
  assert.match(migration, /array\['owner', 'admin'\]/);
  assert.doesNotMatch(migration, /^[^-].*insert into public\.platform_users/im);
  assert.doesNotMatch(migration, /service_role/i);
});

test("requirePlatformAccess is independent from tenant permissions", () => {
  const guard = source("src/modules/platform-console/guards.ts");
  const platformFiles = [
    ...srcFiles("src/modules/platform-console"),
    ...srcFiles("src/app/platform"),
  ];

  assert.match(guard, /getCurrentPlatformUser/);
  assert.match(guard, /requirePlatformAccess/);
  assert.match(guard, /notFound\(\)/);
  assert.doesNotMatch(guard, /requireAdminAccess|TenantContext|current_empresa_id|tenant\.permissions/);

  for (const file of platformFiles) {
    const content = source(file);
    assert.doesNotMatch(content, /@\/lib\/supabase\/admin|createServiceRoleClient|SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(content, /requireAdminAccess|tenant\.permissions/);
  }
});

test("/admin and /platform stay conceptually separated", () => {
  const docs = [
    source("docs/platform-operator-model.md"),
    source("docs/module-contract.md"),
    source("README.md"),
  ].join("\n");

  assert.match(docs, /\/admin` pertenece al cliente|\/admin` sigue siendo administracion del cliente/);
  assert.match(docs, /\/platform` pertenece al operador SaaS|\/platform` es operacion interna/);
  assert.match(docs, /Super Admin.*tenant/i);
});

test("Whapp docs use provider model and do not ask normal clients for Meta API keys", () => {
  const docs = [
    source("docs/platform-operator-model.md"),
    source("docs/whapp-provider-model.md"),
    source("docs/modules/inbox-meta-config.md"),
    source("docs/modules/whapp-core.md"),
  ].join("\n");

  assert.match(docs, /AInovaCR\/biz\.os debe operar como proveedor|Whapp opera como tecnologia administrada/);
  assert.match(docs, /numero nuevo|numero asignado/);
  assert.match(docs, /Tenant Owner ve numero/);

  const tenantOwnerAdminSections = [
    ...docs.matchAll(/Tenant Owner administra:\n([\s\S]*?)(?:\n## |\nPlatform Admin|\nCompany Users|$)/g),
  ].map((match) => match[1]);

  for (const section of tenantOwnerAdminSections) {
    assert.doesNotMatch(section, /Access Token|App Secret|WABA ID|Meta Business ID/);
  }
});
