import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);

function source(path) {
  return readFileSync(new URL(path, root), "utf8");
}

function exists(path) {
  assert.ok(existsSync(new URL(path, root)), `${path} must exist`);
}

test("advanced Brain migration adds memory, signals and plans with tenant isolation", () => {
  const migration = source("database/migrations/0062_business_brain_advanced_integration.sql");
  const cleanup = source("database/migrations/0063_brain_policy_and_index_advisor_cleanup.sql");

  for (const table of [
    "brain_memory",
    "brain_signals",
    "brain_action_plans",
    "brain_plan_steps",
  ]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }

  for (const column of [
    "action_id",
    "approval_required",
    "expected_impact",
    "priority_score",
    "source_modules",
  ]) {
    assert.match(migration, new RegExp(`add column if not exists ${column}`));
  }

  assert.match(migration, /brain_recommendations_id_empresa_unique/);
  assert.match(migration, /brain_action_plans_id_empresa_unique/);
  assert.match(migration, /empresa_id = \(select public\.current_empresa_id\(\)\)/);
  assert.match(migration, /current_user_has_permission\('brain\.recommendations\.manage'\)/);
  assert.match(cleanup, /brain_action_plans_recommendation_empresa_fkey_idx/);
  assert.match(cleanup, /brain_plan_steps_plan_empresa_fkey_idx/);
  assert.match(cleanup, /brain_recommendations_update_permission/);
  assert.doesNotMatch(cleanup, /for all/i);
  assert.doesNotMatch(migration, /drop\s+table\b/i);
});

test("Brain API routes expose analysis, context, signals and plan execution", () => {
  for (const route of [
    "src/app/api/brain/analyze/route.ts",
    "src/app/api/brain/context/route.ts",
    "src/app/api/brain/signals/route.ts",
    "src/app/api/brain/recommendations/[id]/approve/route.ts",
    "src/app/api/brain/action-plans/[id]/execute/route.ts",
  ]) {
    exists(route);
    assert.match(source(route), /getCurrentTenantContext/);
  }

  assert.match(source("src/app/api/brain/analyze/route.ts"), /runAdvancedBrainAnalysis/);
  assert.match(source("src/app/api/brain/recommendations/[id]/approve/route.ts"), /approveBrainRecommendation/);
  assert.match(source("src/app/api/brain/action-plans/[id]/execute/route.ts"), /executeBrainActionPlan/);
});

test("Brain services collect cross-module signals and validate analyst output", () => {
  const connectors = source("src/modules/brain/connectors.ts");
  const analyst = source("src/modules/brain/analyst-service.ts");

  for (const moduleCode of [
    "crm",
    "catalog",
    "inventory",
    "quotes",
    "sales",
    "billing",
    "dispatch",
    "whapp",
    "purchases",
    "payments",
  ]) {
    assert.match(connectors, new RegExp(`active\\(tenant, "${moduleCode}"\\)`));
  }

  assert.match(connectors, /business_context/);
  assert.match(connectors, /fiscal_documents/);
  assert.match(connectors, /pagos\.crear_recordatorio_cobro/);
  assert.match(connectors, /inventario\.sugerir_reorden/);
  assert.match(analyst, /brainAnalystOutputSchema\.parse/);
  assert.match(analyst, /approveBrainRecommendation/);
  assert.match(analyst, /brain_action_plans/);
  assert.match(analyst, /brain_plan_steps/);
});

test("Action Registry and local parser connect Brain to the conversation bar", () => {
  const registry = source("src/lib/ai/action-registry/registry.ts");
  const parser = source("src/modules/ai/conversation-local-parser.ts");
  const bridge = source("src/modules/ai/conversation-execution-bridge.ts");

  for (const actionId of [
    "brain.generar_analisis",
    "brain.responder_pregunta",
    "brain.actualizar_contexto",
    "pagos.crear_recordatorio_cobro",
    "compras.preparar_sugerencia_compra",
    "inventario.sugerir_reorden",
    "inbox.preparar_respuesta",
    "facturacion.preparar_borrador",
    "despacho.consultar_pendientes",
    "ventas.buscar_ventas",
  ]) {
    assert.match(registry, new RegExp(actionId.replace(".", "\\.")));
  }

  assert.match(parser, /parseBrainQuestion/);
  assert.match(parser, /brain\.generar_analisis/);
  assert.match(parser, /brain\.responder_pregunta/);
  assert.match(bridge, /brainContext/);
  assert.match(bridge, /recommendationId/);
  assert.match(bridge, /planId/);
});

test("Brain page exposes signals, recommendations approval and plan execution", () => {
  const page = source("src/app/(app)/brain/page.tsx");

  assert.match(page, /SignalsPanel/);
  assert.match(page, /PlansPanel/);
  assert.match(page, /approveBrainRecommendationAction/);
  assert.match(page, /executeBrainActionPlanAction/);
  assert.match(page, /Salud del Brain/);
  assert.match(page, /Action Registry/);
});
