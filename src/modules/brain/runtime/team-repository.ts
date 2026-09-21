import "server-only";

import { randomUUID } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { initialBrainAgents } from "@/modules/brain/runtime/orchestration-catalog";
import type { BrainTeamPlan, BrainTeamTaskStatus } from "@/modules/brain/runtime/contracts";
import type { JsonRecord, TenantContext } from "@/types/core";

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {})) as JsonRecord;
}

export async function createBrainTeamRecords(input: {
  idempotencyKey?: string;
  parentRunId?: string | null;
  plan: BrainTeamPlan;
  tenant: TenantContext;
}) {
  const supabase = await createClient();
  const scopedIdempotency = input.idempotencyKey
    ? `brain-team:${input.tenant.profileId}:${input.idempotencyKey}`
    : null;
  if (scopedIdempotency) {
    const existing = await supabase
      .from("brain_runs")
      .select("id, workflow_run_id, status")
      .eq("empresa_id", input.tenant.empresaId)
      .eq("idempotency_key", scopedIdempotency)
      .maybeSingle<{ id: string; status: string; workflow_run_id: string | null }>();
    if (existing.error) throw new Error(`No se pudo validar idempotencia: ${existing.error.message}`);
    if (existing.data) {
      const team = await supabase
        .from("brain_team_runs")
        .select("id")
        .eq("run_id", existing.data.id)
        .eq("empresa_id", input.tenant.empresaId)
        .single<{ id: string }>();
      if (team.error || !team.data) throw new Error("El run idempotente no tiene equipo asociado.");
      return {
        cached: true,
        runId: existing.data.id,
        status: existing.data.status,
        teamRunId: team.data.id,
        workflowRunId: existing.data.workflow_run_id,
      };
    }
  }

  const runId = randomUUID();
  const teamRunId = input.plan.id;
  const run = await supabase.from("brain_runs").insert({
    audience: "agent",
    cost_budget_usd: input.plan.budget.maxCostUsd,
    deadline_at: new Date(Date.now() + input.plan.budget.maxDurationSeconds * 1000).toISOString(),
    empresa_id: input.tenant.empresaId,
    id: runId,
    idempotency_key: scopedIdempotency,
    initiated_by: input.tenant.profileId,
    kind: "team",
    max_concurrency: input.plan.maxConcurrency,
    parent_run_id: input.parentRunId ?? null,
    request: asJson({ objective: input.plan.objective, plan: input.plan }),
    source: "brain",
    status: "queued",
    token_budget: input.plan.budget.maxTokens,
  });
  if (run.error) throw new Error(`No se pudo crear el run del equipo: ${run.error.message}`);

  const team = await supabase.from("brain_team_runs").insert({
    cost_budget_usd: input.plan.budget.maxCostUsd,
    empresa_id: input.tenant.empresaId,
    id: teamRunId,
    max_concurrency: input.plan.maxConcurrency,
    objective: input.plan.objective,
    plan: asJson(input.plan),
    run_id: runId,
    status: "planning",
    supervisor_profile_id: input.tenant.profileId,
    token_budget: input.plan.budget.maxTokens,
  });
  if (team.error) throw new Error(`No se pudo crear el equipo: ${team.error.message}`);

  const members = input.plan.tasks.map((task) => {
    const agent = initialBrainAgents.find((candidate) => candidate.id === task.agentId);
    return {
      agent_id: task.agentId,
      allowed_skills: agent?.capabilityIds ?? [],
      cost_budget_usd: agent?.budget.maxCostUsd ?? 1,
      empresa_id: input.tenant.empresaId,
      instructions: task.description,
      role: task.id,
      status: "pending",
      success_criteria: [task.successCriteria],
      team_run_id: teamRunId,
      token_budget: agent?.budget.maxTokens ?? 10_000,
    };
  });
  const memberResult = await supabase.from("brain_team_members").insert(members);
  if (memberResult.error) {
    throw new Error(`No se pudieron registrar los miembros: ${memberResult.error.message}`);
  }
  return {
    cached: false,
    runId,
    status: "queued",
    teamRunId,
    workflowRunId: null,
  };
}

export async function attachBrainTeamWorkflow(input: {
  runId: string;
  tenant: TenantContext;
  workflowRunId: string;
}) {
  const supabase = await createClient();
  const result = await supabase
    .from("brain_runs")
    .update({
      last_heartbeat_at: new Date().toISOString(),
      status: "running",
      workflow_run_id: input.workflowRunId,
    })
    .eq("id", input.runId)
    .eq("empresa_id", input.tenant.empresaId);
  if (result.error) throw new Error(`No se pudo enlazar el workflow: ${result.error.message}`);
}

export async function updateBrainTeamStatus(input: {
  error?: unknown;
  result?: unknown;
  runId: string;
  status: "cancelled" | "completed" | "failed" | "running" | "verifying" | "waiting_human";
  teamRunId: string;
  tenant: TenantContext;
}) {
  const supabase = await createClient();
  const completed = ["cancelled", "completed", "failed"].includes(input.status);
  const [team, run] = await Promise.all([
    supabase
      .from("brain_team_runs")
      .update({
        completed_at: completed ? new Date().toISOString() : null,
        result: asJson(input.result ?? input.error),
        status: input.status,
      })
      .eq("id", input.teamRunId)
      .eq("empresa_id", input.tenant.empresaId),
    supabase
      .from("brain_runs")
      .update({
        completed_at: completed ? new Date().toISOString() : null,
        last_heartbeat_at: new Date().toISOString(),
        response: asJson(input.result ?? input.error),
        status: input.status === "verifying" || input.status === "waiting_human"
          ? "running"
          : input.status,
      })
      .eq("id", input.runId)
      .eq("empresa_id", input.tenant.empresaId),
  ]);
  if (team.error || run.error) {
    throw new Error(team.error?.message ?? run.error?.message ?? "No se pudo actualizar el equipo.");
  }
  if (input.status === "completed") {
    await supabase.from("brain_value_events").insert({
      empresa_id: input.tenant.empresaId,
      metadata: { teamRunId: input.teamRunId },
      metric: "team_completed",
      run_id: input.runId,
      unit: "team",
      value: 1,
    });
  }
}

export async function updateBrainTeamMember(input: {
  error?: unknown;
  output?: unknown;
  status: BrainTeamTaskStatus;
  taskId: string;
  teamRunId: string;
  tenant: TenantContext;
}) {
  const supabase = await createClient();
  const terminal = ["blocked", "cancelled", "completed", "failed"].includes(input.status);
  const update: Record<string, unknown> = {
    completed_at: terminal ? new Date().toISOString() : null,
    output: asJson(input.output ?? input.error),
    status: input.status === "blocked" ? "failed" : input.status,
  };
  if (input.status === "running") update.started_at = new Date().toISOString();
  const result = await supabase
    .from("brain_team_members")
    .update(update)
    .eq("team_run_id", input.teamRunId)
    .eq("empresa_id", input.tenant.empresaId)
    .eq("role", input.taskId);
  if (result.error) throw new Error(`No se pudo actualizar el agente: ${result.error.message}`);
}

export async function getBrainTeamRun(tenant: TenantContext, teamRunId: string) {
  const supabase = await createClient();
  const [team, members, workItems] = await Promise.all([
    supabase
      .from("brain_team_runs")
      .select("id, run_id, objective, status, max_concurrency, token_budget, cost_budget_usd, plan, result, created_at, updated_at, completed_at")
      .eq("id", teamRunId)
      .eq("empresa_id", tenant.empresaId)
      .single(),
    supabase
      .from("brain_team_members")
      .select("id, agent_id, role, status, output, started_at, completed_at")
      .eq("team_run_id", teamRunId)
      .eq("empresa_id", tenant.empresaId)
      .order("created_at"),
    supabase
      .from("brain_work_items")
      .select("id, title, status, priority, assigned_profile_id, sla_due_at, result")
      .eq("team_run_id", teamRunId)
      .eq("empresa_id", tenant.empresaId)
      .order("created_at"),
  ]);
  if (team.error) throw new Error(`No se pudo consultar el equipo: ${team.error.message}`);
  return { ...team.data, members: members.data ?? [], workItems: workItems.data ?? [] };
}
