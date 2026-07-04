import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { createClient } from "@/lib/supabase/server";
import type {
  BrainActionPlan,
  BrainDailyMetrics,
  BrainInsight,
  BrainMemory,
  BrainPlanStep,
  BrainRecommendation,
  BrainSignal,
} from "@/modules/brain/types";
import type { CoreResult, JsonRecord, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type BrainDailyMetricsRow = {
  business_context_ready: boolean;
  created_at: string;
  crm_customers_count: number;
  crm_prospects_count: number;
  followups_overdue_count: number;
  followups_pending_count: number;
  id: string;
  inventory_low_stock_count: number;
  metric_date: string;
  payments_overdue_count: number;
  quotes_expired_count: number;
  quotes_open_count: number;
  run_id: string | null;
  sales_30d_count: number;
  sales_30d_total: number;
  whapp_open_conversations_count: number;
};

type BrainInsightRow = {
  created_at: string;
  description: string;
  evidence: JsonRecord;
  id: string;
  insight_type: BrainInsight["insightType"];
  resolved_at: string | null;
  run_id: string | null;
  severity: BrainInsight["severity"];
  source: string;
  status: BrainInsight["status"];
  title: string;
};

type BrainRecommendationRow = {
  action_id?: string | null;
  approval_required?: boolean | null;
  created_at: string;
  description: string;
  evidence: JsonRecord;
  expected_impact?: string | null;
  id: string;
  insight_id: string | null;
  priority_score?: number | null;
  recommendation_type: BrainRecommendation["recommendationType"];
  risk_level: BrainRecommendation["riskLevel"];
  source_modules?: string[] | null;
  status: BrainRecommendation["status"];
  title: string;
  updated_at: string;
};

type BrainSignalRow = {
  created_at: string;
  description: string;
  detected_at: string;
  entity_id: string | null;
  entity_type: string | null;
  evidence: JsonRecord;
  expires_at: string | null;
  id: string;
  module_code: string;
  run_id: string | null;
  severity: BrainSignal["severity"];
  signal_type: string;
  status: BrainSignal["status"];
  title: string;
  updated_at: string;
};

type BrainMemoryRow = {
  confidence: number;
  content: JsonRecord;
  created_at: string;
  id: string;
  memory_type: BrainMemory["memoryType"];
  source_modules: string[] | null;
  status: BrainMemory["status"];
  title: string;
  updated_at: string;
};

type BrainActionPlanRow = {
  approval_required: boolean;
  approved_at: string | null;
  created_at: string;
  description: string;
  expected_impact: string | null;
  id: string;
  recommendation_id: string | null;
  risk_level: BrainActionPlan["riskLevel"];
  source_modules: string[] | null;
  status: BrainActionPlan["status"];
  title: string;
  updated_at: string;
};

type BrainPlanStepRow = {
  action_id: string;
  created_at: string;
  description: string | null;
  executed_at: string | null;
  id: string;
  payload: JsonRecord;
  plan_id: string;
  requires_confirmation: boolean;
  result: JsonRecord;
  status: BrainPlanStep["status"];
  step_order: number;
  title: string;
  updated_at: string;
};

function mapMetrics(row: BrainDailyMetricsRow): BrainDailyMetrics {
  return {
    businessContextReady: row.business_context_ready,
    createdAt: row.created_at,
    crmCustomersCount: row.crm_customers_count,
    crmProspectsCount: row.crm_prospects_count,
    followupsOverdueCount: row.followups_overdue_count,
    followupsPendingCount: row.followups_pending_count,
    id: row.id,
    inventoryLowStockCount: row.inventory_low_stock_count,
    metricDate: row.metric_date,
    paymentsOverdueCount: row.payments_overdue_count,
    quotesExpiredCount: row.quotes_expired_count,
    quotesOpenCount: row.quotes_open_count,
    runId: row.run_id,
    sales30dCount: row.sales_30d_count,
    sales30dTotal: row.sales_30d_total,
    whappOpenConversationsCount: row.whapp_open_conversations_count,
  };
}

function mapInsight(row: BrainInsightRow): BrainInsight {
  return {
    createdAt: row.created_at,
    description: row.description,
    evidence: row.evidence,
    id: row.id,
    insightType: row.insight_type,
    resolvedAt: row.resolved_at,
    runId: row.run_id,
    severity: row.severity,
    source: row.source,
    status: row.status,
    title: row.title,
  };
}

function mapRecommendation(row: BrainRecommendationRow): BrainRecommendation {
  return {
    actionId: row.action_id ?? null,
    approvalRequired: row.approval_required ?? true,
    createdAt: row.created_at,
    description: row.description,
    evidence: row.evidence,
    expectedImpact: row.expected_impact ?? null,
    id: row.id,
    insightId: row.insight_id,
    priorityScore: Number(row.priority_score ?? 0),
    recommendationType: row.recommendation_type,
    riskLevel: row.risk_level,
    sourceModules: row.source_modules ?? [],
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function mapSignal(row: BrainSignalRow): BrainSignal {
  return {
    createdAt: row.created_at,
    description: row.description,
    detectedAt: row.detected_at,
    entityId: row.entity_id,
    entityType: row.entity_type,
    evidence: row.evidence,
    expiresAt: row.expires_at,
    id: row.id,
    moduleCode: row.module_code,
    runId: row.run_id,
    severity: row.severity,
    signalType: row.signal_type,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function mapMemory(row: BrainMemoryRow): BrainMemory {
  return {
    confidence: Number(row.confidence),
    content: row.content,
    createdAt: row.created_at,
    id: row.id,
    memoryType: row.memory_type,
    sourceModules: row.source_modules ?? [],
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function mapPlanStep(row: BrainPlanStepRow): BrainPlanStep {
  return {
    actionId: row.action_id,
    createdAt: row.created_at,
    description: row.description,
    executedAt: row.executed_at,
    id: row.id,
    payload: row.payload,
    planId: row.plan_id,
    requiresConfirmation: row.requires_confirmation,
    result: row.result,
    status: row.status,
    stepOrder: row.step_order,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function mapActionPlan(
  row: BrainActionPlanRow,
  steps: BrainPlanStep[] = [],
): BrainActionPlan {
  return {
    approvalRequired: row.approval_required,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    description: row.description,
    expectedImpact: row.expected_impact,
    id: row.id,
    recommendationId: row.recommendation_id,
    riskLevel: row.risk_level,
    sourceModules: row.source_modules ?? [],
    status: row.status,
    steps,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

export function canAccessBrain(tenant: TenantContext) {
  return (
    isModuleActive(tenant.activeModules, "brain") &&
    hasPermission(tenant.permissions, "brain.insights.view")
  );
}

export function canManageBrain(tenant: TenantContext) {
  return (
    canAccessBrain(tenant) &&
    hasAnyPermission(tenant.permissions, [
      "brain.recommendations.manage",
      "brain.settings.manage",
    ])
  );
}

export function canViewBrainRecommendations(tenant: TenantContext) {
  return (
    canAccessBrain(tenant) &&
    hasAnyPermission(tenant.permissions, [
      "brain.recommendations.view",
      "brain.recommendations.manage",
    ])
  );
}

export async function getLatestBrainDailyMetrics(
  tenant: TenantContext,
): Promise<CoreResult<BrainDailyMetrics | null>> {
  if (!canAccessBrain(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes acceso a Business Brain.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brain_daily_metrics")
    .select(
      "id, run_id, metric_date, crm_customers_count, crm_prospects_count, followups_pending_count, followups_overdue_count, quotes_open_count, quotes_expired_count, sales_30d_count, sales_30d_total, inventory_low_stock_count, payments_overdue_count, whapp_open_conversations_count, business_context_ready, created_at",
    )
    .eq("empresa_id", tenant.empresaId)
    .order("metric_date", { ascending: false })
    .limit(1)
    .maybeSingle<BrainDailyMetricsRow>();

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo cargar el snapshot del Brain.", error);
  }

  return ok(data ? mapMetrics(data) : null);
}

export async function getBrainInsights(
  tenant: TenantContext,
): Promise<CoreResult<BrainInsight[]>> {
  if (!canAccessBrain(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes acceso a insights del Brain.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_brain_insights");

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron cargar insights.", error);
  }

  return ok(((data ?? []) as BrainInsightRow[]).map(mapInsight));
}

export async function getBrainRecommendations(
  tenant: TenantContext,
): Promise<CoreResult<BrainRecommendation[]>> {
  if (!canViewBrainRecommendations(tenant)) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_brain_recommendations");

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as BrainRecommendationRow[]).map(mapRecommendation));
}

export async function getBrainSignals(
  tenant: TenantContext,
): Promise<CoreResult<BrainSignal[]>> {
  if (!canAccessBrain(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes acceso a señales del Brain.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brain_signals")
    .select(
      "id, run_id, module_code, signal_type, severity, status, title, description, evidence, entity_type, entity_id, detected_at, expires_at, created_at, updated_at",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("status", "active")
    .order("detected_at", { ascending: false })
    .limit(100);

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as BrainSignalRow[]).map(mapSignal));
}

export async function getBrainMemory(
  tenant: TenantContext,
): Promise<CoreResult<BrainMemory[]>> {
  if (!canAccessBrain(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes acceso a memoria del Brain.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brain_memory")
    .select("id, memory_type, title, content, source_modules, confidence, status, created_at, updated_at")
    .eq("empresa_id", tenant.empresaId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as BrainMemoryRow[]).map(mapMemory));
}

export async function getBrainActionPlans(
  tenant: TenantContext,
): Promise<CoreResult<BrainActionPlan[]>> {
  if (!canViewBrainRecommendations(tenant)) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data: plansData, error: plansError } = await supabase
    .from("brain_action_plans")
    .select(
      "id, recommendation_id, title, description, status, risk_level, expected_impact, source_modules, approval_required, approved_at, created_at, updated_at",
    )
    .eq("empresa_id", tenant.empresaId)
    .in("status", ["pending_approval", "approved", "executing", "failed"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (plansError) {
    return ok([]);
  }

  const planRows = (plansData ?? []) as BrainActionPlanRow[];
  const planIds = planRows.map((plan) => plan.id);

  if (planIds.length === 0) {
    return ok([]);
  }

  const { data: stepsData } = await supabase
    .from("brain_plan_steps")
    .select(
      "id, plan_id, step_order, action_id, title, description, payload, status, requires_confirmation, result, executed_at, created_at, updated_at",
    )
    .eq("empresa_id", tenant.empresaId)
    .in("plan_id", planIds)
    .order("step_order", { ascending: true });

  const steps = ((stepsData ?? []) as BrainPlanStepRow[]).map(mapPlanStep);
  const stepsByPlan = new Map<string, BrainPlanStep[]>();

  for (const step of steps) {
    stepsByPlan.set(step.planId, [...(stepsByPlan.get(step.planId) ?? []), step]);
  }

  return ok(planRows.map((plan) => mapActionPlan(plan, stepsByPlan.get(plan.id) ?? [])));
}
