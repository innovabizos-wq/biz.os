import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("offline POS reserves pending quantities and sequences atomically", async () => {
  const store = await source("src/modules/pos/offline-store.ts");

  assert.match(store, /transaction\(\["operations", "catalog", "sessions"\], "readwrite"\)/);
  assert.match(store, /pendingByProduct/);
  assert.match(store, /const requested = \(pendingByProduct\.get\(item\.productId\)[\s\S]*requested > snapshot\.offlineAvailable/);
  assert.match(store, /session\.lastSequence \+ 1[\s\S]*queued\.map\(\(row\) => row\.sequence \+ 1\)/);
  assert.match(store, /operations\.add\(stored\)/);
  assert.match(store, /capturedTime > Date\.parse\(session\.authorizedUntil\)/);
});

test("a synchronized POS operation consumes its cached quota before deletion", async () => {
  const store = await source("src/modules/pos/offline-store.ts");
  const terminal = await source("src/modules/pos/components/pos-terminal.tsx");

  assert.match(store, /export async function completeQueuedPosOperation/);
  assert.match(store, /database\.transaction\(\["operations", "catalog"\], "readwrite"\)/);
  assert.match(store, /const offlineAvailable = Math\.max\(0, snapshot\.offlineAvailable - item\.quantity\)/);
  assert.match(store, /operations\.delete\(stored\.clientOperationId\)/);
  assert.match(terminal, /await completeQueuedPosOperation\(operation\)/);
  assert.match(terminal, /consumeConnectedCatalog\(operation\.items\)/);
});

test("offline recovery page is terminal-aware, expiry-safe and valid JavaScript", async () => {
  const html = await source("public/pos-offline.html");
  const worker = await source("public/sw.js");
  const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];

  assert.ok(script, "offline page must include an executable script");
  new vm.Script(script, { filename: "pos-offline.html" });
  assert.match(html, /URLSearchParams\(location\.search\)\.get\("terminal"\)/);
  assert.match(html, /operationsStore\.add\(operation\)/);
  assert.match(html, /const usage = pendingUsage\(operations\)/);
  assert.match(html, /Date\.now\(\) <= Date\.parse\(session\.authorizedUntil\)/);
  assert.match(html, /escapeHtml\(product\.name\)/);
  assert.match(worker, /bizos-pos-shell-v2/);
});
