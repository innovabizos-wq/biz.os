import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(path, "utf8");

test("global command bar calls the conversation execution endpoint", () => {
  const source = read("src/app/(app)/dashboard/dashboard-ai-search.tsx");

  assert.match(source, /\/api\/ai\/conversation\/execute/);
  assert.match(source, /source:\s*"global_command_bar"/);
  assert.match(source, /\/api\/ai\/conversation\/confirm/);
  assert.match(source, /\/api\/ai\/conversation\/actions/);
  assert.match(source, /productos\.buscar_producto/);
  assert.match(source, /currentPath/);
});

test("basic task fallback is after the conversation engine", () => {
  const source = read("src/app/(app)/dashboard/dashboard-ai-search.tsx");
  const runCommandStart = source.indexOf("function runCommand");
  const runCommandSource = source.slice(runCommandStart);
  const conversationIndex = runCommandSource.indexOf("runConversationCommand(rawCommand)");
  const fallbackIndex = source.indexOf("No encontre una accion conversacional");

  assert.notEqual(conversationIndex, -1);
  assert.notEqual(fallbackIndex, -1);
  assert.match(runCommandSource, /runConversationCommand\(rawCommand\)/);
  assert.doesNotMatch(runCommandSource, /No encontre una tarea basica para eso/);
});

test("local parser supports high-value customer creation phrases", () => {
  const source = read("src/modules/ai/conversation-local-parser.ts");

  for (const phrase of [
    "crear cliente",
    "crea un cliente",
    "registre cliente",
    "agregue cliente",
    "agrega un cliente",
    "nuevo cliente",
    "cliente nuevo",
    "cedula",
    "identificacion",
    "cc",
    "numero",
    "telefono",
    "whatsapp",
  ]) {
    assert.match(source, new RegExp(phrase));
  }

  assert.match(source, /clientes\.crear_cliente/);
  assert.match(source, /Alberto|nombre|llamado|identificacion|telefono/);
  assert.match(source, /parseContextualSearch/);
  assert.match(source, /productos\.buscar_producto/);
  assert.match(source, /inventario\.consultar_stock/);
});

test("local parser routes sales summaries to Brain without provider fallback", () => {
  const source = read("src/modules/ai/conversation-local-parser.ts");

  assert.match(source, /resumen\|resumenn\|reumen\|reumenn\|reporte/);
  assert.match(source, /ventas/);
  assert.match(source, /brain\.responder_pregunta/);
});

test("global command bar keeps shortcut suggestions hidden", () => {
  const source = read("src/app/(app)/dashboard/dashboard-ai-search.tsx");

  assert.match(source, /const showCommandMenu = false/);
  assert.match(source, /showCommandMenu && command\.trim\(\)\.length > 0/);
});

test("confirmation flow clears the input and refreshes current view", () => {
  const source = read("src/app/(app)/dashboard/dashboard-ai-search.tsx");
  const confirmationStart = source.indexOf("if (data.confirmationRequired && data.token)");
  const confirmationBlock = source.slice(confirmationStart, confirmationStart + 500);

  assert.match(confirmationBlock, /setCommand\(""\)/);
  assert.match(confirmationBlock, /inputRef\.current\?\.focus\(\)/);
  assert.match(source, /router\.refresh\(\)/);
});

test("customer conversational action is enabled for direct validated execution", () => {
  const source = read("src/lib/ai/action-registry/registry.ts");
  const customerActionStart = source.indexOf('id: "clientes.crear_cliente"');
  const customerAction = source.slice(customerActionStart, customerActionStart + 1200);

  assert.match(customerAction, /requiresConfirmation:\s*false/);
  assert.match(customerAction, /crm\.customers\.create/);
  assert.match(customerAction, /assertNoDuplicateCustomer/);
  assert.match(customerAction, /crear_crm_cliente/);
});
