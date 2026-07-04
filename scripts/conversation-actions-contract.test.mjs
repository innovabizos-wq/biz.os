import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(path, "utf8");

test("conversation action endpoints are exposed", () => {
  for (const path of [
    "src/app/api/ai/conversation/actions/route.ts",
    "src/app/api/ai/conversation/dry-run/route.ts",
    "src/app/api/ai/conversation/execute/route.ts",
    "src/app/api/ai/conversation/confirm/route.ts",
  ]) {
    const source = read(path);
    assert.match(source, /NextResponse/);
  }
});

test("conversation registry declares guarded business actions", () => {
  const source = read("src/lib/ai/action-registry/registry.ts");

  for (const actionId of [
    "clientes.buscar_cliente",
    "clientes.crear_cliente",
    "productos.buscar_producto",
    "productos.crear_producto",
    "inventario.consultar_stock",
    "proformas.crear_borrador",
  ]) {
    assert.match(source, new RegExp(actionId.replace(".", "\\.")));
  }

  assert.match(source, /requiredPermissions/);
  assert.match(source, /requiresConfirmation: true/);
  assert.match(source, /initializeProductStockRows/);
  assert.match(source, /actualizar_stock_minimos/);
  assert.match(source, /stockRowsInitialized/);
});

test("conversation execution bridge blocks sensitive actions behind confirmation", () => {
  const source = read("src/modules/ai/conversation-execution-bridge.ts");

  assert.match(source, /createConfirmationToken/);
  assert.match(source, /readConfirmationToken/);
  assert.match(source, /auditoria_eventos/);
  assert.match(source, /confirmation_required/);
});

test("conversation action documentation explains the contract", () => {
  const source = read("docs/conversation-actions.md");

  assert.match(source, /GET \/api\/ai\/conversation\/actions/);
  assert.match(source, /POST \/api\/ai\/conversation\/dry-run/);
  assert.match(source, /POST \/api\/ai\/conversation\/execute/);
  assert.match(source, /POST \/api\/ai\/conversation\/confirm/);
  assert.match(source, /AI_ACTION_CONFIRMATION_SECRET/);
});
