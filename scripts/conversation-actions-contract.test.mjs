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
    "src/app/api/brain/agents/route.ts",
    "src/app/api/brain/jobs/route.ts",
    "src/app/api/brain/jobs/run/route.ts",
    "src/app/api/brain/metrics/route.ts",
  ]) {
    const source = read(path);
    assert.match(source, /NextResponse/);
  }
});

test("conversation actions endpoint exposes Brain Runtime catalog", () => {
  const source = read("src/app/api/ai/conversation/actions/route.ts");

  assert.match(source, /businessSkillRegistry/);
  assert.match(source, /capabilityRegistry/);
  assert.match(source, /getAvailable\(context\.tenant\)/);
  assert.match(source, /capabilities:/);
  assert.match(source, /skills:/);
  assert.match(source, /actions:\s*listConversationActionsForTenant/);
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
  assert.match(source, /resolveActiveWarehouse/);
  assert.match(source, /registrar_movimiento_inventario/);
  assert.match(source, /Stock inicial registrado desde Biz\.Brain/);
  assert.doesNotMatch(source, /stockRowsInitialized/);
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
