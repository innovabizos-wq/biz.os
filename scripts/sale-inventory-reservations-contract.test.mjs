import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (path) => readFileSync(`${root}/${path}`, "utf8");

const migration = source(
  "supabase/migrations/20260921165449_sale_inventory_reservations.sql",
);
const actions = source("src/modules/sales-inventory/actions.ts");
const panel = source(
  "src/modules/sales-inventory/components/apply-sale-inventory-form.tsx",
);
const summary = source("src/modules/sales-inventory/queries.ts");

test("future-delivery sales reserve stock without moving physical quantity", () => {
  assert.match(migration, /create table if not exists public\.inventory_reservations/);
  assert.match(migration, /function public\.reserve_sale_inventory/);
  assert.match(migration, /inventario_estado = 'reservado'/);
  assert.match(migration, /entrega_estado = 'reservado'/);
  assert.doesNotMatch(
    migration.match(/create or replace function public\.reserve_sale_inventory[\s\S]*?\n\$\$;/)?.[0] ?? "",
    /set cantidad =/,
  );
});

test("reservations respect POS allocations and other pending deliveries", () => {
  assert.match(migration, /pos_stock_allocations/);
  assert.match(migration, /inventory_reservations as r/);
  assert.match(migration, /v_available := v_stock\.cantidad - v_pos_reserved - v_sale_reserved/);
  assert.match(migration, /guard_pos_stock_reservations/);
  assert.match(migration, /POS o entregas pendientes/);
});

test("physical exit consumes the reservation atomically and idempotently", () => {
  assert.match(migration, /function public\.apply_sale_inventory_atomic/);
  assert.match(migration, /status = 'consumed'/);
  assert.match(migration, /sale\.inventory\.apply/);
  assert.match(migration, /request_payload <> v_request/);
  assert.match(actions, /apply_sale_inventory_atomic/);
  assert.doesNotMatch(actions, /rpc\("aplicar_salida_inventario_venta"/);
});

test("reservations can be released and sale cancellation releases them", () => {
  assert.match(migration, /function public\.release_sale_inventory_reservation/);
  assert.match(migration, /release_sale_reservations_on_cancel/);
  assert.match(migration, /release_reason = 'Venta cancelada'/);
  assert.match(actions, /release_sale_inventory_reservation/);
});

test("sale UI exposes reserve release and physical-exit actions", () => {
  assert.match(panel, /Reservar para entrega/);
  assert.match(panel, /Liberar reserva/);
  assert.match(panel, /Registrar salida física/);
  assert.match(summary, /bodega_id/);
});
