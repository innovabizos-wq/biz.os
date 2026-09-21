import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(path, "utf8");

test("Brain Tool Engine exposes the required tool contract", () => {
  const contracts = read("src/modules/brain/core/contracts.ts");

  for (const field of [
    "id",
    "name",
    "description",
    "module",
    "category",
    "version",
    "requiredPermissions",
    "inputSchema",
    "outputSchema",
    "execute",
  ]) {
    assert.match(contracts, new RegExp(`${field}`));
  }

  assert.match(contracts, /BrainToolExecutionRequest/);
  assert.match(contracts, /BrainToolExecutionResponse/);
  assert.match(contracts, /BrainToolExecutionRecord/);
});

test("Brain Tool Registry supports lookup, permissions and enabled state", () => {
  const registry = read("src/modules/brain/core/tool-registry.ts");

  assert.match(registry, /createBrainToolRegistry/);
  assert.match(registry, /register\(tool\)/);
  assert.match(registry, /getByModule\(module\)/);
  assert.match(registry, /getAvailable\(tenant\)/);
  assert.match(registry, /exists\(toolId\)/);
  assert.match(registry, /enable\(toolId\)/);
  assert.match(registry, /disable\(toolId\)/);
  assert.match(registry, /hasEveryPermission/);
  assert.match(registry, /isModuleActive/);
});

test("Brain Tool Executor validates execution through RBAC and schemas", () => {
  const executor = read("src/modules/brain/core/tool-executor.ts");

  assert.match(executor, /registry\.get\(input\.toolId\)/);
  assert.match(executor, /AUTH_NOT_CONNECTED/);
  assert.match(executor, /INVALID_TENANT_CONTEXT/);
  assert.match(executor, /MODULE_INACTIVE/);
  assert.match(executor, /PERMISSION_DENIED/);
  assert.match(executor, /tool\.inputSchema\.safeParse/);
  assert.match(executor, /tool\.outputSchema\.safeParse/);
  assert.match(executor, /tool\.execute/);
  assert.match(executor, /recordExecution/);
  assert.doesNotMatch(executor, /from\(".*"\)/);
});

test("Brain system tools are test-only and cover the requested probes", () => {
  const tools = read("src/modules/brain/core/system-tools.ts");

  for (const id of [
    "system.ping",
    "system.current_date",
    "system.current_time",
    "system.current_user",
    "system.current_company",
    "system.basic_info",
  ]) {
    assert.match(tools, new RegExp(id.replace(".", "\\.")));
  }

  assert.match(tools, /category:\s*"system"/);
  assert.match(tools, /requiredPermissions:\s*\["brain\.insights\.view"\]/);
  assert.doesNotMatch(tools, /crear_|actualizar_|eliminar_|sincronizar_/);
});

test("Brain Tool Engine records execution metrics for future analytics", () => {
  const log = read("src/modules/brain/core/tool-execution-log.ts");
  const contracts = read("src/modules/brain/core/contracts.ts");

  assert.match(log, /createBrainToolExecutionRecorder/);
  assert.match(log, /record\(event\)/);
  assert.match(log, /list\(\)/);
  assert.match(contracts, /durationMs/);
  assert.match(contracts, /companyId/);
  assert.match(contracts, /userId/);
  assert.match(contracts, /toolId/);
  assert.match(contracts, /error: string \| null/);
});
