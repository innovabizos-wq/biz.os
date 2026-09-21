import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (path) => readFileSync(`${root}/${path}`, "utf8");

const migration = source(
  "supabase/migrations/20260921175023_dispatch_mobile_evidence.sql",
);
const mobileRoute = source("src/app/api/mobile/dispatch/route.ts");
const evidenceRoute = source(
  "src/app/api/mobile/dispatch/evidence/[evidenceId]/route.ts",
);
const mobilePanel = source(
  "src/modules/dispatch/components/dispatch-mobile-proof-panel.tsx",
);
const offlineStore = source("src/modules/dispatch/mobile-offline-store.ts");
const dispatchPage = source("src/app/(app)/despacho/[despachoId]/page.tsx");

test("dispatch evidence is private, tenant scoped and downloadable by permission", () => {
  assert.match(migration, /'dispatch-evidence',[\s\S]*?false/);
  assert.match(migration, /create table if not exists public\.dispatch_delivery_evidence/);
  assert.match(migration, /alter table public\.dispatch_delivery_evidence enable row level security/);
  assert.match(migration, /dispatch_delivery_evidence_select_permission/);
  assert.match(migration, /dispatch_evidence_storage_select/);
  assert.match(evidenceRoute, /dispatch_delivery_evidence/);
  assert.match(evidenceRoute, /\.storage[\s\S]*?\.download/);
  assert.match(evidenceRoute, /Cache-Control.*private, no-store/);
});

test("mobile completion requires receiver and photo or signature evidence", () => {
  assert.match(migration, /La entrega requiere receptor y al menos una foto o firma/);
  assert.match(migration, /tipo in \('photo', 'signature'\)/);
  assert.match(mobileRoute, /EVIDENCE_REQUIRED/);
  assert.match(mobileRoute, /MAX_EVIDENCE_FILE_BYTES = 6 \* 1024 \* 1024/);
  assert.match(mobilePanel, /Persona que recibe/);
  assert.match(mobilePanel, /Fotos de entrega/);
  assert.match(mobilePanel, /Firma/);
});

test("offline dispatch operations persist and synchronize when connectivity returns", () => {
  assert.match(offlineStore, /indexedDB\.open/);
  assert.match(offlineStore, /queueDispatchOperation/);
  assert.match(offlineStore, /getQueuedDispatchOperations/);
  assert.match(mobilePanel, /window\.addEventListener\("online"/);
  assert.match(mobilePanel, /Se enviará al recuperar conexión/);
  assert.match(mobilePanel, /navigator\.serviceWorker/);
  assert.match(mobilePanel, /\{pendingCount\} pendientes/);
});

test("dispatch synchronization is durable and content-idempotent", () => {
  assert.match(migration, /create table if not exists public\.dispatch_mobile_operations/);
  assert.match(migration, /request_hash <> v_hash/);
  assert.match(migration, /business_operation_receipts/);
  assert.match(migration, /dispatch\.mobile\.complete/);
  assert.match(mobileRoute, /prepare_dispatch_mobile_operation/);
  assert.match(mobileRoute, /complete_dispatch_mobile_operation/);
  assert.match(mobileRoute, /upsert: true/);
});

test("location is captured only by an explicit mobile action", () => {
  assert.match(mobilePanel, /onClick=\{captureLocation\}/);
  assert.match(mobilePanel, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(mobilePanel, /No se autorizó la ubicación/);
  assert.match(migration, /accuracy_meters/);
  assert.match(dispatchPage, /DispatchMobileProofPanel/);
  assert.doesNotMatch(mobilePanel, /watchPosition/);
});
