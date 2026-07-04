import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(path, "utf8");

test("autoblog AI is wired to the shared conversation provider", () => {
  const source = read("src/modules/autoblog/ai.ts");

  assert.match(source, /getConversationLayerProviderSettings/);
  assert.match(source, /getAutoblogAiStatus/);
  assert.match(source, /getConversationProviderAdapter/);
  assert.match(source, /adapter\.generateJson/);
  assert.match(source, /PROVIDER_CONNECTION_FAILED/);
  assert.match(source, /generateWithFallback/);
  assert.match(source, /plainTextToDraft/);
  assert.match(source, /gemini-2\.0-flash/);
  assert.doesNotMatch(source, /return false;/);
  assert.doesNotMatch(source, /todavia no esta configurada/);
});

test("autoblog generated drafts are persisted through the article RPC", () => {
  const source = read("src/modules/autoblog/actions.ts");

  assert.match(source, /generateAutoblogDraftAction/);
  assert.match(source, /crear_autoblog_article/);
  assert.match(source, /Borrador generado con IA/);
  assert.doesNotMatch(source, /todavia no esta conectada a un flujo de guardado/);
});

test("autoblog is available from the global AI command bar", () => {
  const parser = read("src/modules/ai/conversation-local-parser.ts");
  const registry = read("src/lib/ai/action-registry/registry.ts");

  assert.match(parser, /parseCreateAutoblog/);
  assert.match(parser, /autoblog\.generar_articulo/);
  assert.match(registry, /id:\s*"autoblog\.generar_articulo"/);
  assert.match(registry, /crear_autoblog_article/);
});

test("autoblog article page includes a reader preview", () => {
  const source = read("src/app/(app)/autoblog/[articleId]/page.tsx");

  assert.match(source, /AutoblogReaderPreview/);
  assert.match(source, /autoblog-reader-preview/);
  assert.match(source, /cleanPreviewHtml/);
});

test("autoblog new page exposes the AI generation form", () => {
  const source = read("src/app/(app)/autoblog/nuevo/page.tsx");

  assert.match(source, /generateAutoblogDraftAction/);
  assert.match(source, /aiStatus\.label/);
  assert.match(source, /aiStatus\.detail/);
  assert.match(source, /name="topic"/);
  assert.match(source, /Generar borrador/);
  assert.doesNotMatch(source, /quedara disponible cuando exista un proveedor/);
  assert.doesNotMatch(source, /<button[\s\S]*disabled[\s\S]*Generar borrador/);
});
