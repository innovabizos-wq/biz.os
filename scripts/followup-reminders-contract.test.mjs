import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const migration = read(
  "supabase/migrations/20260914213017_server_followup_reminders.sql",
);
const poll = read("src/app/api/notifications/poll/route.ts");
const interactive = read("src/modules/notifications/followup-reminders.ts");
const job = read("src/modules/notifications/followup-reminder-job.ts");
const route = read("src/app/api/notifications/reminders/run/route.ts");
const vercel = read("vercel.json");

test("agenda reminders have a protected server schedule independent from browser polling", () => {
  assert.equal(
    existsSync(new URL("src/app/api/notifications/reminders/run/route.ts", root)),
    true,
  );
  assert.match(vercel, /\/api\/notifications\/reminders\/run/);
  assert.match(vercel, /"schedule": "\* \* \* \* \*"/);
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /process\.env\.REMINDER_WORKER_SECRET/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(job, /enqueue_due_followup_reminders/);
});

test("server and interactive reminders share the same database operation", () => {
  assert.match(interactive, /enqueue_my_due_followup_reminders/);
  assert.match(poll, /createDueFollowupReminderNotifications/);
  assert.doesNotMatch(interactive, /\.from\("crm_seguimientos"\)/);
  assert.doesNotMatch(interactive, /crear_notificacion_propia/);
});

test("the reminder ledger is tenant-safe and idempotent under concurrent runs", () => {
  assert.match(migration, /create table if not exists public\.followup_reminder_deliveries/);
  assert.match(
    migration,
    /unique \(empresa_id, followup_id, recipient_profile_id, reminder_kind, scheduled_at\)/,
  );
  assert.match(
    migration,
    /on conflict on constraint followup_reminder_deliveries_unique do nothing/,
  );
  assert.match(migration, /alter table public\.followup_reminder_deliveries enable row level security/);
  assert.match(
    migration,
    /revoke all on public\.followup_reminder_deliveries from public, anon, authenticated/,
  );
  assert.match(migration, /company\.estado = 'activa'/);
  assert.match(migration, /profile\.estado = 'activo'/);
});

test("privileged reminder functions expose only the intended callers", () => {
  assert.match(migration, /create schema if not exists private/);
  assert.match(migration, /set search_path = ''/);
  assert.match(
    migration,
    /revoke all on function private\.enqueue_followup_reminders[\s\S]+from public, anon, authenticated, service_role/,
  );
  assert.match(
    migration,
    /grant execute on function public\.enqueue_due_followup_reminders\(integer\)[\s\S]+to service_role/,
  );
  assert.match(
    migration,
    /grant execute on function public\.enqueue_my_due_followup_reminders\(integer,integer\)[\s\S]+to authenticated/,
  );
  assert.match(migration, /current_user_has_permission\('crm\.followups\.view'\)/);
});

test("reminder scans use a bounded partial due-date index", () => {
  assert.match(migration, /crm_seguimientos_pending_due_idx/);
  assert.match(migration, /where estado = 'pendiente' and asignado_a is not null/);
  assert.match(migration, /p_limit < 1 or p_limit > 1000/);
  assert.match(migration, /order by followup\.fecha_programada, followup\.id/);
});
