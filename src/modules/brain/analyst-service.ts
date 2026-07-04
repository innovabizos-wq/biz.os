import "server-only";

import { randomUUID } from "node:crypto";

import { getConversationProviderAdapter } from "@/lib/ai/providers";
import { createClient } from "@/lib/supabase/server";
import { collectBrainSignals, type BrainSignalDraft } from "@/modules/brain/connectors";
import { BRAIN_OPERATOR_SYSTEM_PROMPT } from "@/modules/brain/brain-prompts";
import {
  canAccessBrain,
  canManageBrain,
  getBrainActionPlans,
  getBrainMemory,
  getBrainRecommendations,
  getBrainSignals,
  getLatestBrainDailyMetrics,
} from "@/modules/brain/queries";
import { brainAnalystOutputSchema } from "@/modules/brain/schemas";
import type { BrainActionPlan, BrainAnalysisResult, BrainRecommendation } from "@/modules/brain/types";
import { getBrainAiProviderSettings } from "@/modules/ai/conversation-layer-service";
import type { CoreResult, JsonRecord, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type BasicAnalysisRow = {
  insights_created?: number;
  recommendations_created?: number;
  run_id?: string;
};

function signalToInsightType(signal: BrainSignalDraft) {
  if (signal.recommendationType === "data_quality") return "data_quality";
  if (signal.recommendationType === "commercial") return "opportunity";
  if (signal.severity === "high" || signal.severity === "critical") return "risk";
  return "process";
}

function signalToRecommendation(signal: BrainSignalDraft) {
  const output = signalToAnalystOutput(signal);

  return {
    action_id: output.actionId,
    approval_required: output.approvalRequired,
    description: signal.description,
    evidence: output.evidence,
    expected_impact: output.expectedImpact,
    priority_score: output.priorityScore,
    recommendation_type: output.recommendationType,
    risk_level: output.risk,
    source_modules: output.modules,
    title: output.recommendation,
  };
}

function signalToAnalystOutput(signal: BrainSignalDraft) {
  return brainAnalystOutputSchema.parse({
    actionId: signal.actionId ?? null,
    approvalRequired: true,
    evidence: signal.evidence,
    expectedImpact: signal.expectedImpact ?? null,
    modules: signal.sourceModules,
    priorityScore: signal.priorityScore,
    recommendation: signal.recommendationTitle ?? signal.title,
    recommendationType: signal.recommendationType,
    risk: signal.severity,
    severity: signal.severity,
    title: signal.title,
    type: signalToInsightType(signal),
  });
}

async function ensureBusinessContextMemory(tenant: TenantContext) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_context")
    .select("*")
    .eq("empresa_id", tenant.empresaId)
    .limit(1)
    .maybeSingle<JsonRecord>();

  if (!data) return 0;

  const { data: existing } = await supabase
    .from("brain_memory")
    .select("id")
    .eq("empresa_id", tenant.empresaId)
    .eq("memory_type", "business_context")
    .eq("title", "Contexto del negocio")
    .maybeSingle<{ id: string }>();

  if (existing?.id) {
    await supabase
      .from("brain_memory")
      .update({
        content: data,
        source_modules: ["admin", "brain"],
        updated_by: tenant.profileId,
      })
      .eq("empresa_id", tenant.empresaId)
      .eq("id", existing.id);
    return 0;
  }

  const { error } = await supabase.from("brain_memory").insert({
    confidence: 1,
    content: data,
    created_by: tenant.profileId,
    empresa_id: tenant.empresaId,
    memory_type: "business_context",
    source_modules: ["admin", "brain"],
    title: "Contexto del negocio",
    updated_by: tenant.profileId,
  });

  return error ? 0 : 1;
}

async function insertSignalsAndRecommendations(
  tenant: TenantContext,
  runId: string | null,
  signals: BrainSignalDraft[],
) {
  const supabase = await createClient();

  await supabase
    .from("brain_signals")
    .update({ status: "expired" })
    .eq("empresa_id", tenant.empresaId)
    .eq("status", "active");

  if (signals.length === 0) {
    return { recommendationsCreated: 0, signalsCreated: 0 };
  }

  const { error: signalError } = await supabase.from("brain_signals").insert(
    signals.map((signal) => ({
      description: signal.description,
      entity_id: signal.entityId ?? null,
      entity_type: signal.entityType ?? null,
      empresa_id: tenant.empresaId,
      evidence: signal.evidence,
      module_code: signal.moduleCode,
      run_id: runId,
      severity: signal.severity,
      signal_type: signal.signalType,
      title: signal.title,
    })),
  );

  let recommendationsCreated = 0;

  for (const signal of signals) {
    if (!signal.recommendationTitle) continue;

    const { data: existing } = await supabase
      .from("brain_recommendations")
      .select("id")
      .eq("empresa_id", tenant.empresaId)
      .eq("status", "pending")
      .eq("title", signal.recommendationTitle)
      .maybeSingle<{ id: string }>();

    if (existing?.id) continue;

    const output = signalToAnalystOutput(signal);
    const { data: insight } = await supabase
      .from("brain_insights")
      .insert({
        description: signal.description,
        empresa_id: tenant.empresaId,
        evidence: output.evidence,
        insight_type: output.type,
        run_id: runId,
        severity: output.severity,
        source: signal.moduleCode,
        title: output.title,
      })
      .select("id")
      .maybeSingle<{ id: string }>();

    const recommendation = signalToRecommendation(signal);
    const { error } = await supabase.from("brain_recommendations").insert({
      ...recommendation,
      empresa_id: tenant.empresaId,
      insight_id: insight?.id ?? null,
    });

    if (!error) recommendationsCreated += 1;
  }

  return {
    recommendationsCreated,
    signalsCreated: signalError ? 0 : signals.length,
  };
}

export async function runAdvancedBrainAnalysis(
  tenant: TenantContext,
): Promise<CoreResult<BrainAnalysisResult>> {
  if (!canManageBrain(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para analizar Business Brain.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generar_brain_insights_basicos");

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo generar el analisis base.", error);
  }

  const basic = Array.isArray(data) ? data[0] as BasicAnalysisRow | undefined : undefined;
  const runId = basic?.run_id ?? randomUUID();
  const signals = await collectBrainSignals(tenant);
  const [inserted, memoryCreated] = await Promise.all([
    insertSignalsAndRecommendations(tenant, basic?.run_id ?? null, signals),
    ensureBusinessContextMemory(tenant),
  ]);

  return ok({
    actionPlansCreated: 0,
    insightsCreated: Number(basic?.insights_created ?? 0) + inserted.recommendationsCreated,
    recommendationsCreated:
      Number(basic?.recommendations_created ?? 0) + inserted.recommendationsCreated,
    runId,
    signalsCreated: inserted.signalsCreated + memoryCreated,
  });
}

export async function answerBrainQuestion(
  tenant: TenantContext,
  question: string,
): Promise<CoreResult<{ message: string; result: JsonRecord }>> {
  if (!canAccessBrain(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes acceso a Business Brain.");
  }

  // Recoger todo el contexto disponible en paralelo
  const [metrics, signals, recommendations, memories] = await Promise.all([
    getLatestBrainDailyMetrics(tenant),
    getBrainSignals(tenant),
    getBrainRecommendations(tenant),
    getBrainMemory(tenant),
  ]);

  const metric = metrics.ok ? metrics.data : null;
  const signalRows = signals.ok ? signals.data.slice(0, 10) : [];
  const recommendationRows = recommendations.ok ? recommendations.data.slice(0, 5) : [];
  const memoryRows = memories.ok ? memories.data.slice(0, 5) : [];

  // Construir contexto empresarial completo
  const enterpriseContext = {
    fecha_snapshot: metric?.metricDate ?? null,
    metricas: metric
      ? {
          clientes: metric.crmCustomersCount,
          cobros_vencidos: metric.paymentsOverdueCount,
          conversaciones_whatsapp_abiertas: metric.whappOpenConversationsCount,
          cotizaciones_abiertas: metric.quotesOpenCount,
          cotizaciones_vencidas: metric.quotesExpiredCount,
          inventario_bajo_minimo: metric.inventoryLowStockCount,
          prospectos: metric.crmProspectsCount,
          seguimientos_vencidos: metric.followupsOverdueCount,
          ventas_30d_cantidad: metric.sales30dCount,
          ventas_30d_total: metric.sales30dTotal,
        }
      : null,
    memoria: memoryRows.map((m) => ({
      contenido: m.content,
      tipo: m.memoryType,
      titulo: m.title,
    })),
    recomendaciones_pendientes: recommendationRows.map((r) => ({
      descripcion: r.description,
      impacto_esperado: r.expectedImpact,
      riesgo: r.riskLevel,
      tipo: r.recommendationType,
      titulo: r.title,
    })),
    senales_activas: signalRows.map((s) => ({
      descripcion: s.description,
      modulo: s.moduleCode,
      severidad: s.severity,
      titulo: s.title,
    })),
  };

  // Intentar con LLM
  try {
    const providerResult = await getBrainAiProviderSettings();

    // providerResult puede ser CoreResult o ConversationLayerResult — checar ambas formas
    const providerData =
      providerResult && typeof providerResult === "object" && "data" in providerResult
        ? providerResult.data
        : null;

    if (providerData) {
      const adapter = getConversationProviderAdapter(providerData.provider ?? "gemini");

      const contextText = JSON.stringify({
        metricas: enterpriseContext.metricas,
        senales_activas: enterpriseContext.senales_activas.slice(0, 5),
        recomendaciones_pendientes: enterpriseContext.recomendaciones_pendientes.slice(0, 3),
        memoria: enterpriseContext.memoria.slice(0, 3),
      });

      const userPrompt = `Contexto del negocio: ${contextText}\n\nPregunta: ${question}`;

      // Forzar natural_text para evitar que Gemini envuelva en JSON
      const brainSettings = {
        ...providerData,
        maxTokens: 600,
        outputMode: "natural_text" as const,
        temperature: 0.3,
      };

      const llmResult = await adapter.generateJson({
        messages: [
          { content: BRAIN_OPERATOR_SYSTEM_PROMPT, role: "system" },
          { content: userPrompt, role: "user" },
        ],
        settings: brainSettings,
      });

      if (llmResult?.content) {
        // Safety net: si el LLM igual devuelve JSON, extraer el texto
        let cleanMessage = llmResult.content.trim();
        try {
          const parsed = JSON.parse(cleanMessage) as Record<string, unknown>;
          const extracted =
            parsed.respuesta ??
            parsed.message ??
            parsed.mensaje ??
            parsed.response ??
            parsed.text;
          if (typeof extracted === "string" && extracted.trim()) {
            cleanMessage = extracted.trim();
          }
        } catch {
          // No era JSON, usar el texto tal cual — esto es lo esperado
        }

        if (cleanMessage.length > 10) {
          return ok({
            message: cleanMessage,
            result: enterpriseContext as unknown as JsonRecord,
          });
        }
      }
    }
  } catch {
    // Si el LLM falla por cualquier razón, cae al fallback abajo
  }

  // Fallback determinístico
  const topSignals = signalRows.slice(0, 3);
  const topRecommendations = recommendationRows.slice(0, 3);
  let message: string;

  if (!metric) {
    message =
      "No hay snapshot disponible todavía. Ejecuta 'Analizar negocio' en la página del Brain para generar el primer análisis.";
  } else if (topSignals.length > 0 || topRecommendations.length > 0) {
    const items = [
      ...topSignals.map((s) => s.title),
      ...topRecommendations.map((r) => r.title),
    ].slice(0, 4);
    message = `Lo más importante ahora: ${items.join(". ")}.`;
  } else {
    message = `Ventas últimos 30 días: ${metric.sales30dCount} operaciones. Clientes: ${metric.crmCustomersCount}. Seguimientos vencidos: ${metric.followupsOverdueCount}. Sin alertas críticas activas.`;
  }

  return ok({
    message,
    result: enterpriseContext as unknown as JsonRecord,
  });
}

function actionIdForRecommendation(recommendation: BrainRecommendation) {
  if (recommendation.actionId) return recommendation.actionId;

  const byType: Record<string, string> = {
    collections: "pagos.crear_recordatorio_cobro",
    commercial: "agenda.crear_tarea",
    data_quality: "brain.actualizar_contexto",
    inventory: "inventario.consultar_stock",
    management: "brain.responder_pregunta",
    operational: "agenda.crear_tarea",
    service: "inbox.preparar_respuesta",
  };

  return byType[recommendation.recommendationType] ?? "brain.responder_pregunta";
}

export async function approveBrainRecommendation(
  tenant: TenantContext,
  recommendationId: string,
): Promise<CoreResult<BrainActionPlan>> {
  if (!canManageBrain(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para aprobar recomendaciones.");
  }

  const recommendations = await getBrainRecommendations(tenant);
  const recommendation = recommendations.ok
    ? recommendations.data.find((item) => item.id === recommendationId)
    : null;

  if (!recommendation) {
    return fail("VALIDATION_ERROR", "No encontre la recomendacion.");
  }

  const supabase = await createClient();
  await supabase
    .from("brain_recommendations")
    .update({ status: "approved", updated_by: tenant.profileId })
    .eq("empresa_id", tenant.empresaId)
    .eq("id", recommendation.id);

  const { data: existingPlan } = await supabase
    .from("brain_action_plans")
    .select("id")
    .eq("empresa_id", tenant.empresaId)
    .eq("recommendation_id", recommendation.id)
    .maybeSingle<{ id: string }>();

  if (!existingPlan?.id) {
    const { data: plan, error: planError } = await supabase
      .from("brain_action_plans")
      .insert({
        approval_required: true,
        approved_at: new Date().toISOString(),
        approved_by: tenant.profileId,
        created_by: tenant.profileId,
        description: recommendation.description,
        empresa_id: tenant.empresaId,
        expected_impact: recommendation.expectedImpact,
        recommendation_id: recommendation.id,
        risk_level: recommendation.riskLevel,
        source_modules: recommendation.sourceModules,
        status: "approved",
        title: recommendation.title,
      })
      .select("id")
      .maybeSingle<{ id: string }>();

    if (planError || !plan?.id) {
      return fail("VALIDATION_ERROR", "No se pudo crear el plan de accion.", planError);
    }

    await supabase.from("brain_plan_steps").insert({
      action_id: actionIdForRecommendation(recommendation),
      description: recommendation.description,
      empresa_id: tenant.empresaId,
      payload: {
        recommendationId: recommendation.id,
        source: "brain",
        summary: recommendation.title,
      },
      plan_id: plan.id,
      requires_confirmation: recommendation.approvalRequired,
      step_order: 1,
      title: recommendation.title,
    });
  }

  const plans = await getBrainActionPlans(tenant);
  const createdPlan = plans.ok
    ? plans.data.find((plan) => plan.recommendationId === recommendation.id)
    : null;

  if (!createdPlan) {
    return fail("VALIDATION_ERROR", "No se pudo cargar el plan creado.");
  }

  return ok(createdPlan);
}
