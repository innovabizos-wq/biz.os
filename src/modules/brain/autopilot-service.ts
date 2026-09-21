import "server-only";

import { hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import {
  brainRuntime,
  businessSkillRegistry,
  capabilityRegistry,
} from "@/modules/brain/runtime/default-runtime";
import { requiresBrainApproval } from "@/modules/brain/runtime/policy-engine";
import type { JsonRecord, TenantContext } from "@/types/core";

export type BrainAutonomyMode = "approve" | "auto" | "suggest";

type AutonomyRuleRow = {
  allowed_channels: string[];
  amount_limit: number | null;
  capability_id: string;
  daily_limit: number;
  failure_threshold: number;
  id: string;
  mode: BrainAutonomyMode;
  name: string;
  responsible_profile_id: string | null;
  rollout_percentage: number;
  shadow_mode: boolean;
  timezone: string;
  trigger_type: string;
  window_end: string | null;
  window_start: string | null;
};

function assertAutonomyPermission(tenant: TenantContext, manage = false) {
  const code = manage ? "brain.settings.manage" : "brain.insights.view";
  if (!hasPermission(tenant.permissions, code)) {
    throw new Error(manage ? "No puedes administrar la autonomia de Brain." : "No puedes consultar el autopiloto de Brain.");
  }
}

function localTime(timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date());
}

function insideWindow(rule: AutonomyRuleRow) {
  if (!rule.window_start || !rule.window_end) return true;
  const current = localTime(rule.timezone);
  const start = rule.window_start.slice(0, 5);
  const end = rule.window_end.slice(0, 5);
  return start <= end
    ? current >= start && current <= end
    : current >= start || current <= end;
}

function insideRollout(rule: AutonomyRuleRow, dedupeKey: string) {
  let hash = 2166136261;
  for (const character of `${rule.id}:${dedupeKey}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100 < rule.rollout_percentage;
}

function recommendationType(skillModule: string) {
  if (["inventory", "purchases"].includes(skillModule)) return "inventory";
  if (["payments", "billing"].includes(skillModule)) return "collections";
  if (["whapp"].includes(skillModule)) return "service";
  if (["crm", "quotes", "sales"].includes(skillModule)) return "commercial";
  return "operational";
}

export async function listBrainAutonomyRules(tenant: TenantContext) {
  assertAutonomyPermission(tenant);
  const supabase = await createClient();
  const result = await supabase
    .from("brain_autonomy_rules")
    .select("id, name, trigger_type, capability_id, mode, shadow_mode, rollout_percentage, enabled, daily_limit, amount_limit, allowed_channels, window_start, window_end, timezone, responsible_profile_id, success_criteria, failure_threshold, created_at, updated_at")
    .eq("empresa_id", tenant.empresaId)
    .order("created_at", { ascending: false });
  if (result.error) throw new Error(`No se pudieron consultar las reglas: ${result.error.message}`);
  return result.data ?? [];
}

export async function createBrainAutonomyRule(input: {
  allowedChannels?: string[];
  amountLimit?: number | null;
  capabilityId: string;
  dailyLimit?: number;
  failureThreshold?: number;
  mode: BrainAutonomyMode;
  name: string;
  responsibleProfileId?: string | null;
  rolloutPercentage?: number;
  shadowMode?: boolean;
  successCriteria?: JsonRecord;
  tenant: TenantContext;
  timezone?: string;
  triggerType: string;
  windowEnd?: string | null;
  windowStart?: string | null;
}) {
  assertAutonomyPermission(input.tenant, true);
  const capability = capabilityRegistry.get(input.capabilityId);
  const binding = capabilityRegistry.getImplementedBinding(input.capabilityId);
  const skill = binding ? businessSkillRegistry.get(binding.skillId) : null;
  if (!capability || !skill) throw new Error("La capacidad elegida no esta implementada.");
  if (input.mode === "auto" && !input.shadowMode && (skill.risk !== "low" || requiresBrainApproval(skill))) {
    throw new Error("El modo automatico solo admite habilidades de riesgo bajo que no requieren aprobacion.");
  }
  const supabase = await createClient();
  const result = await supabase
    .from("brain_autonomy_rules")
    .insert({
      allowed_channels: input.allowedChannels ?? [],
      amount_limit: input.amountLimit ?? null,
      capability_id: input.capabilityId,
      created_by: input.tenant.profileId,
      daily_limit: input.dailyLimit ?? 10,
      empresa_id: input.tenant.empresaId,
      failure_threshold: input.failureThreshold ?? 3,
      mode: input.mode,
      name: input.name,
      responsible_profile_id: input.responsibleProfileId ?? null,
      rollout_percentage: input.rolloutPercentage ?? 100,
      shadow_mode: input.shadowMode ?? false,
      success_criteria: input.successCriteria ?? {},
      timezone: input.timezone ?? "America/Costa_Rica",
      trigger_type: input.triggerType,
      window_end: input.windowEnd ?? null,
      window_start: input.windowStart ?? null,
    })
    .select("id, name, trigger_type, capability_id, mode, shadow_mode, rollout_percentage, enabled")
    .single();
  if (result.error || !result.data) throw new Error(`No se pudo crear la regla: ${result.error?.message ?? "sin resultado"}`);
  await supabase.from("brain_skill_health").upsert({
    empresa_id: input.tenant.empresaId,
    error_threshold: input.failureThreshold ?? 3,
    skill_id: skill.id,
    status: "enabled",
  }, { onConflict: "empresa_id,skill_id" });
  return result.data;
}

async function createActionableRecommendation(input: {
  payload: JsonRecord;
  rule: AutonomyRuleRow;
  skillId: string;
  tenant: TenantContext;
  triggerId: string;
}) {
  const skill = businessSkillRegistry.get(input.skillId);
  if (!skill) throw new Error("La habilidad de la regla ya no existe.");
  const supabase = await createClient();
  const result = await supabase
    .from("brain_recommendations")
    .insert({
      created_by: input.tenant.profileId,
      description: `El evento ${input.rule.trigger_type} activo la regla ${input.rule.name}.`,
      empresa_id: input.tenant.empresaId,
      evidence: {
        capabilityId: input.rule.capability_id,
        input: input.payload,
        ruleId: input.rule.id,
        skillId: input.skillId,
        triggerId: input.triggerId,
      },
      recommendation_type: recommendationType(skill.module),
      risk_level: skill.risk,
      status: "pending",
      title: input.rule.mode === "approve" ? `Aprobacion requerida: ${skill.name}` : `Sugerencia: ${skill.name}`,
    })
    .select("id, status, title")
    .single();
  if (result.error || !result.data) throw new Error(`No se pudo crear la recomendacion: ${result.error?.message ?? "sin resultado"}`);
  return result.data;
}

export async function processBrainTrigger(input: {
  channel?: string;
  dedupeKey: string;
  eventType: string;
  payload?: JsonRecord;
  tenant: TenantContext;
}) {
  assertAutonomyPermission(input.tenant);
  const supabase = await createClient();
  const trigger = await supabase
    .from("brain_runtime_triggers")
    .insert({
      dedupe_key: input.dedupeKey,
      empresa_id: input.tenant.empresaId,
      event_type: input.eventType,
      payload: input.payload ?? {},
      status: "received",
    })
    .select("id")
    .single<{ id: string }>();
  if (trigger.error?.code === "23505") {
    return { deduplicated: true, eventType: input.eventType, status: "ignored" as const };
  }
  if (trigger.error || !trigger.data) throw new Error(`No se pudo registrar el evento: ${trigger.error?.message ?? "sin resultado"}`);

  const rules = await supabase
    .from("brain_autonomy_rules")
    .select("id, name, trigger_type, capability_id, mode, shadow_mode, rollout_percentage, daily_limit, amount_limit, allowed_channels, window_start, window_end, timezone, responsible_profile_id, failure_threshold")
    .eq("empresa_id", input.tenant.empresaId)
    .eq("trigger_type", input.eventType)
    .eq("enabled", true)
    .returns<AutonomyRuleRow[]>();
  if (rules.error) throw new Error(`No se pudieron evaluar las reglas: ${rules.error.message}`);
  const eligible = (rules.data ?? []).filter((rule) =>
    insideWindow(rule) &&
    insideRollout(rule, input.dedupeKey) &&
    (rule.allowed_channels.length === 0 || (input.channel ? rule.allowed_channels.includes(input.channel) : false)) &&
    (rule.amount_limit == null || Number(input.payload?.amount ?? 0) <= rule.amount_limit),
  );
  if (eligible.length === 0) {
    await supabase.from("brain_runtime_triggers").update({ processed_at: new Date().toISOString(), status: "ignored" }).eq("id", trigger.data.id);
    return { actions: [], deduplicated: false, status: "ignored" as const, triggerId: trigger.data.id };
  }

  const actions: JsonRecord[] = [];
  const recordRuleExecution = async (
    ruleId: string,
    status: "blocked" | "completed" | "failed" | "running" | "waiting_approval",
    result: JsonRecord = {},
    error: JsonRecord | null = null,
  ) => {
    await supabase.from("brain_trigger_executions").upsert({
      completed_at: ["blocked", "completed", "failed"].includes(status) ? new Date().toISOString() : null,
      empresa_id: input.tenant.empresaId,
      error,
      result,
      rule_id: ruleId,
      started_at: status === "running" ? new Date().toISOString() : null,
      status,
      trigger_id: trigger.data.id,
    }, { onConflict: "trigger_id,rule_id" });
  };
  for (const rule of eligible) {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const usage = await supabase
      .from("brain_trigger_executions")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", input.tenant.empresaId)
      .eq("rule_id", rule.id)
      .gte("created_at", since.toISOString());
    if ((usage.count ?? 0) >= rule.daily_limit) {
      await recordRuleExecution(rule.id, "blocked", { reason: "daily_limit" });
      actions.push({ mode: rule.mode, reason: "daily_limit", ruleId: rule.id, status: "blocked" });
      continue;
    }
    const binding = capabilityRegistry.getImplementedBinding(rule.capability_id);
    const skill = binding ? businessSkillRegistry.get(binding.skillId) : null;
    if (!binding || !skill) {
      await recordRuleExecution(rule.id, "blocked", { reason: "capability_unavailable" });
      actions.push({ reason: "capability_unavailable", ruleId: rule.id, status: "blocked" });
      continue;
    }
    if (rule.shadow_mode || rule.mode !== "auto") {
      const recommendation = await createActionableRecommendation({
        payload: input.payload ?? {},
        rule,
        skillId: skill.id,
        tenant: input.tenant,
        triggerId: trigger.data.id,
      });
      await recordRuleExecution(rule.id, "waiting_approval", { recommendationId: recommendation.id });
      actions.push({ mode: rule.shadow_mode ? "shadow" : rule.mode, recommendationId: recommendation.id, ruleId: rule.id, status: "waiting_approval" });
      continue;
    }
    if (skill.risk !== "low" || requiresBrainApproval(skill)) {
      await recordRuleExecution(rule.id, "blocked", { reason: "risk_policy" });
      actions.push({ mode: rule.mode, reason: "risk_policy", ruleId: rule.id, status: "blocked" });
      continue;
    }
    await recordRuleExecution(rule.id, "running");
    const skillExecution = await brainRuntime.invoke({
      idempotencyKey: `trigger:${trigger.data.id}:${rule.id}`,
      input: input.payload ?? {},
      skillId: skill.id,
      source: {
        audience: "system",
        channel: "event",
        correlationId: trigger.data.id,
        module: skill.module,
        surface: `trigger:${input.eventType}`,
        timezone: rule.timezone,
      },
      tenant: input.tenant,
    });
    if (skillExecution.ok) {
      await recordRuleExecution(rule.id, "completed", { message: skillExecution.data.message });
      await supabase.from("brain_value_events").insert({
        empresa_id: input.tenant.empresaId,
        metadata: { ruleId: rule.id, skillId: skill.id, triggerId: trigger.data.id },
        metric: "autopilot_task_completed",
        unit: "task",
        value: 1,
      });
      actions.push({ mode: rule.mode, message: skillExecution.data.message, ruleId: rule.id, status: "completed" });
    } else {
      await recordRuleExecution(rule.id, "failed", {}, { code: skillExecution.error.code, message: skillExecution.error.message });
      actions.push({ error: skillExecution.error.message, mode: rule.mode, ruleId: rule.id, status: "failed" });
    }
  }
  const failed = actions.some((action) => action.status === "failed");
  const waiting = actions.some((action) => action.status === "waiting_approval");
  const status = failed ? "failed" : waiting ? "queued" : "completed";
  await supabase
    .from("brain_runtime_triggers")
    .update({ processed_at: new Date().toISOString(), status })
    .eq("id", trigger.data.id)
    .eq("empresa_id", input.tenant.empresaId);
  return { actions, deduplicated: false, status, triggerId: trigger.data.id };
}

export async function executeBrainRecommendation(input: {
  recommendationId: string;
  tenant: TenantContext;
}) {
  if (!hasPermission(input.tenant.permissions, "brain.recommendations.manage")) {
    throw new Error("No tienes permiso para ejecutar recomendaciones.");
  }
  const supabase = await createClient();
  const recommendation = await supabase
    .from("brain_recommendations")
    .select("id, status, evidence")
    .eq("id", input.recommendationId)
    .eq("empresa_id", input.tenant.empresaId)
    .single<{ evidence: JsonRecord; id: string; status: string }>();
  if (recommendation.error || !recommendation.data) throw new Error("La recomendacion no existe.");
  if (!recommendation.data.evidence.skillId || typeof recommendation.data.evidence.skillId !== "string") {
    throw new Error("La recomendacion no contiene una accion ejecutable.");
  }
  if (!["approved", "pending"].includes(recommendation.data.status)) throw new Error("La recomendacion ya fue procesada.");
  await supabase.from("brain_recommendations").update({ status: "executing", updated_by: input.tenant.profileId }).eq("id", input.recommendationId);
  const result = await brainRuntime.invoke({
    approval: { confirmed: true, reference: input.recommendationId },
    idempotencyKey: `recommendation:${input.recommendationId}`,
    input: (recommendation.data.evidence.input as JsonRecord | undefined) ?? {},
    skillId: recommendation.data.evidence.skillId,
    source: { audience: "internal", channel: "automation", correlationId: input.recommendationId, surface: "brain-recommendation" },
    tenant: input.tenant,
  });
  await supabase
    .from("brain_recommendations")
    .update({ status: result.ok ? "completed" : "failed", updated_by: input.tenant.profileId })
    .eq("id", input.recommendationId)
    .eq("empresa_id", input.tenant.empresaId);
  if (
    typeof recommendation.data.evidence.triggerId === "string" &&
    typeof recommendation.data.evidence.ruleId === "string"
  ) {
    await supabase
      .from("brain_trigger_executions")
      .update({
        completed_at: new Date().toISOString(),
        error: result.ok ? null : { code: result.error.code, message: result.error.message },
        result: result.ok ? { message: result.data.message } : {},
        status: result.ok ? "completed" : "failed",
      })
      .eq("trigger_id", recommendation.data.evidence.triggerId)
      .eq("rule_id", recommendation.data.evidence.ruleId)
      .eq("empresa_id", input.tenant.empresaId);
  }
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}

export async function getBrainAutopilotHealth(tenant: TenantContext) {
  assertAutonomyPermission(tenant);
  const supabase = await createClient();
  const [skills, triggers] = await Promise.all([
    supabase.from("brain_skill_health").select("skill_id, status, consecutive_errors, error_threshold, paused_until, last_success_at, last_error_at").eq("empresa_id", tenant.empresaId).order("updated_at", { ascending: false }),
    supabase.from("brain_runtime_triggers").select("status").eq("empresa_id", tenant.empresaId).gte("received_at", new Date(Date.now() - 86_400_000).toISOString()),
  ]);
  if (skills.error || triggers.error) throw new Error(skills.error?.message ?? triggers.error?.message ?? "No se pudo leer la salud del autopiloto.");
  const triggerCounts = (triggers.data ?? []).reduce<Record<string, number>>((counts, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }, {});
  return { skills: skills.data ?? [], triggerCounts, windowHours: 24 };
}
