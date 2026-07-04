import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);

function source(path) {
  return readFileSync(new URL(path, root), "utf8");
}

function exists(path) {
  assert.ok(existsSync(new URL(path, root)), `Missing conversation layer file: ${path}`);
}

test("conversation layer exposes the requested internal endpoints", () => {
  for (const path of [
    "src/app/api/ai/conversation-layer/settings/route.ts",
    "src/app/api/ai/conversation-layer/test/route.ts",
    "src/app/api/ai/conversation-layer/interpret/route.ts",
    "src/app/api/ai/conversation-layer/naturalize/route.ts",
  ]) {
    exists(path);
  }
});

test("conversation layer prompts prohibit direct critical execution", () => {
  const prompts = source("src/modules/ai/conversation-prompts.ts");

  assert.match(prompts, /No ejecutes acciones/);
  assert.match(prompts, /No inventes clientes/);
  assert.match(prompts, /safe_to_execute: false/);
  assert.match(prompts, /facturacion, pagos, inventario, clientes/);
});

test("conversation layer settings never expose full api keys", () => {
  const service = source("src/modules/ai/conversation-layer-service.ts");
  const route = source("src/app/api/ai/conversation-layer/settings/route.ts");

  assert.match(service, /apiKeyLast4/);
  assert.match(service, /apiKeyEncrypted/);
  assert.match(service, /encryptAiSecret/);
  assert.match(service, /decryptAiSecret/);
  assert.match(service, /hasApiKey:\s*Boolean\(stored\.apiKeyEncrypted\)/);
  assert.doesNotMatch(service, /hasApiKey:\s*Boolean\(stored\.apiKeyEncrypted\s*\|\|\s*stored\.hasApiKey\)/);
  assert.doesNotMatch(route, /apiKeyEncrypted/);
});

test("conversation layer validates strict JSON outputs", () => {
  const schemas = source("src/modules/ai/schemas.ts");
  const service = source("src/modules/ai/conversation-layer-service.ts");

  assert.match(schemas, /conversationLayerIntentSchema/);
  assert.match(schemas, /conversationLayerNaturalizedResponseSchema/);
  assert.match(service, /parseJsonObject/);
  assert.match(service, /JSON_PARSE_FAILED/);
  assert.match(service, /INVALID_AI_RESPONSE/);
});

test("conversation layer documents module integration examples", () => {
  const docs = source("docs/conversation-layer.md");

  assert.match(docs, /Facturacion/i);
  assert.match(docs, /Inventario/i);
  assert.match(docs, /WhatsApp/i);
  assert.match(docs, /Reportes/i);
  assert.match(docs, /runConversationLayer/);
  assert.match(docs, /naturalizeResponse/);
});
