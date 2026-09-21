import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

function source(path) {
  return readFileSync(new URL(path, root), "utf8");
}

test("administrative users are created confirmed and forced to change their temporary password", () => {
  const action = source("src/modules/users/actions.ts");
  const migration = source(
    "supabase/migrations/20260712211413_administrative_user_first_password_change.sql",
  );

  assert.match(action, /hasPermission\(access\.tenant\.permissions, "admin\.users\.manage"\)/);
  assert.match(action, /auth\.admin\.createUser\(\{[\s\S]*email_confirm: true,/);
  assert.match(action, /requiere_cambio_contrasena: true/);
  assert.match(action, /auth\.admin\.deleteUser\(authData\.user\.id\)/);
  assert.match(migration, /add column if not exists requiere_cambio_contrasena boolean not null default false/);
});

test("first password change is enforced by login and the application shell", () => {
  const authActions = source("src/modules/auth/actions.ts");
  const appLayout = source("src/app/(app)/layout.tsx");
  const changePasswordPage = source("src/app/(auth)/cambiar-contrasena/page.tsx");

  assert.match(authActions, /redirect\(profileState\.requiresPasswordChange \? "\/cambiar-contrasena" : "\/dashboard"\)/);
  assert.match(authActions, /auth\.updateUser\(\{[\s\S]*password: parsed\.data\.password,/);
  assert.match(authActions, /update\(\{ requiere_cambio_contrasena: false \}\)/);
  assert.match(appLayout, /profileResult\.data\?\.requiereCambioContrasena/);
  assert.match(appLayout, /redirect\("\/cambiar-contrasena"\)/);
  assert.match(changePasswordPage, /completeFirstPasswordChangeAction/);
});
