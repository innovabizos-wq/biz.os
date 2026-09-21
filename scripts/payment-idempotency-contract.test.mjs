import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");

const migration = source(
  "supabase/migrations/20260915013555_idempotent_payment_recording.sql",
);
const actions = source("src/modules/payments/actions.ts");
const schemas = source("src/modules/payments/schemas.ts");
const queries = source("src/modules/payments/queries.ts");
const page = source("src/app/(app)/pagos/page.tsx");
const brainSkills = source("src/modules/brain/runtime/skills/read-skills.ts");
const operationIds = source("src/modules/payments/idempotency.ts");

test("payment recording persists an original result behind a tenant idempotency key", () => {
  assert.match(migration, /add column if not exists operation_id uuid/);
  assert.match(migration, /add column if not exists resulting_balance numeric\(14, 2\)/);
  assert.match(migration, /payments_transactions_empresa_operation_unique/);
  assert.match(migration, /pg_catalog\.pg_advisory_xact_lock/);
  assert.match(migration, /La clave idempotente ya fue usada con otros datos/);
  assert.match(migration, /v_existing\.resulting_balance/);
  assert.match(migration, /true;/);
  assert.doesNotMatch(migration, /drop\s+(table|column)/i);
});

test("payment RPC enforces tenant permission, allowed methods and references", () => {
  assert.match(migration, /current_user_has_permission\('payments\.accounts\.manage'\)/);
  assert.match(migration, /'cash', 'card', 'sinpe', 'transfer', 'other'/);
  assert.match(migration, /referencia es requerida para tarjeta, SINPE o transferencia/);
  assert.match(
    migration,
    /revoke all on function public\.registrar_movimiento_cuenta_idempotente[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.registrar_movimiento_cuenta_idempotente[\s\S]*to authenticated/,
  );
});

test("payments UI and Brain share the idempotent payment operation", () => {
  assert.match(actions, /registrar_movimiento_cuenta_idempotente/);
  assert.match(actions, /p_operation_id: parsed\.data\.operationId/);
  assert.match(schemas, /operationId: uuidSchema/);
  assert.match(schemas, /z\.enum\(\["cash", "card", "sinpe", "transfer", "other"\]\)/);
  assert.match(page, /name="operationId"[\s\S]*crypto\.randomUUID\(\)/);
  assert.match(page, /<option value="cash">Efectivo<\/option>/);
  assert.match(page, /<option value="sinpe">SINPE<\/option>/);
  assert.doesNotMatch(page, /cobro_manual|pago_manual/);
  assert.match(brainSkills, /paymentOperationIdFromKey/);
  assert.match(brainSkills, /context\.idempotencyKey/);
  assert.match(brainSkills, /registrar_movimiento_cuenta_idempotente/);
  assert.match(brainSkills, /saldoAnterior: Number\(result\.saldo\) \+ input\.quantity/);
  assert.doesNotMatch(
    brainSkills.match(/const paymentsPaymentRegisterSkill[\s\S]*?const salesReceivableGenerateSkill/)?.[0] ?? "",
    /if \(\["pagada", "anulada"\]\.includes\(account\.estado\)\)/,
  );
  assert.match(operationIds, /createHash\("sha256"\)/);
});

test("payment read failures remain visible", () => {
  assert.match(queries, /No se pudieron cargar los movimientos de pagos/);
  assert.doesNotMatch(
    queries.match(/export async function getPaymentTransactions[\s\S]*?export async function getPaymentsSummary/)?.[0] ?? "",
    /if \(error\) \{\s*return ok\(\[\]\)/,
  );
  assert.match(page, /Los totales de movimientos recientes estan incompletos/);
  assert.match(page, /Los movimientos no estan disponibles en este momento/);
});
