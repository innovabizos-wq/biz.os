import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CoreResult, JsonRecord, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type AuditMetricRow = {
  accion: string;
  created_at: string;
  datos_despues: JsonRecord | null;
  entidad: string;
  entidad_id: string | null;
  metadata: JsonRecord | null;
};

type BrainTaskMetricMeasure =
  | "task_completed"
  | "task_failed"
  | "task_pending_approval";

type BrainTaskMetricEvent = {
  action: string;
  entity: string;
  id: string;
  measure: BrainTaskMetricMeasure;
  occurredAt: string;
  source: "automation" | "conversation" | "workflow";
  value: number;
};

export type BrainTaskMetricsSummary = {
  events: BrainTaskMetricEvent[];
  failed: number;
  lastEventAt: string | null;
  pendingApproval: number;
  sourceTotals: Record<BrainTaskMetricEvent["source"], number>;
  taskCompleted: number;
  taskFailed: number;
  taskPendingApproval: number;
  totalEvents: number;
};

function readRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function readMetricMeasure(value: unknown): BrainTaskMetricMeasure | null {
  if (
    value === "task_completed" ||
    value === "task_failed" ||
    value === "task_pending_approval"
  ) {
    return value;
  }

  return null;
}

function metricSource(row: AuditMetricRow): BrainTaskMetricEvent["source"] | null {
  if (row.entidad === "brain_workflow") return "workflow";
  if (row.entidad === "brain_automation_job") return "automation";
  if (row.entidad === "brain_action_plan") return "workflow";
  if (row.entidad === "conversation_action") return "conversation";
  return null;
}

function conversationMeasure(action: string): BrainTaskMetricMeasure | null {
  if (action === "ai_conversation.executed" || action === "ai_conversation.confirmed") {
    return "task_completed";
  }

  if (action === "ai_conversation.failed" || action === "ai_conversation.blocked") {
    return "task_failed";
  }

  if (action === "ai_conversation.dry_run") {
    return "task_pending_approval";
  }

  return null;
}

function eventsFromWorkflowRow(row: AuditMetricRow): BrainTaskMetricEvent[] {
  const metricEvents = readRecord(row.datos_despues)?.metricEvents;
  if (!Array.isArray(metricEvents)) return [];

  return metricEvents.flatMap((item) => {
    const metric = readRecord(item);
    const measure = readMetricMeasure(metric?.measure);
    if (!metric || !measure) return [];

    return [
      {
        action: row.accion,
        entity: row.entidad,
        id: String(metric.id ?? row.entidad_id ?? row.accion),
        measure,
        occurredAt: row.created_at,
        source: "workflow" as const,
        value: Number(metric.value ?? 0),
      },
    ];
  });
}

function eventFromAutomationRow(row: AuditMetricRow): BrainTaskMetricEvent | null {
  const metric = readRecord(readRecord(row.datos_despues)?.metric);
  const measure = readMetricMeasure(metric?.measure);
  if (!metric || !measure) return null;

  return {
    action: row.accion,
    entity: row.entidad,
    id: String(metric.id ?? row.entidad_id ?? row.accion),
    measure,
    occurredAt: row.created_at,
    source: "automation",
    value: Number(metric.value ?? 0),
  };
}

function eventFromConversationRow(row: AuditMetricRow): BrainTaskMetricEvent | null {
  const measure = conversationMeasure(row.accion);
  if (!measure) return null;

  const metadata = readRecord(row.metadata);
  const actionId = typeof metadata?.actionId === "string" ? metadata.actionId : row.accion;

  return {
    action: row.accion,
    entity: row.entidad,
    id: `brain.conversation.${actionId}.${measure}`,
    measure,
    occurredAt: row.created_at,
    source: "conversation",
    value: measure === "task_pending_approval" ? 0 : 1,
  };
}

function eventFromActionPlanRow(row: AuditMetricRow): BrainTaskMetricEvent | null {
  const measure = row.accion === "brain.action_plan.completed"
    ? "task_completed"
    : row.accion === "brain.action_plan.failed"
      ? "task_failed"
      : row.accion === "brain.action_plan.pending_confirmation"
        ? "task_pending_approval"
        : null;

  if (!measure) return null;

  const after = readRecord(row.datos_despues);
  return {
    action: row.accion,
    entity: row.entidad,
    id: `brain.action_plan.${row.entidad_id ?? row.accion}.${measure}`,
    measure,
    occurredAt: row.created_at,
    source: "workflow",
    value: measure === "task_pending_approval" ? 0 : Number(after?.completed ?? 1),
  };
}

function eventsFromRow(row: AuditMetricRow): BrainTaskMetricEvent[] {
  const source = metricSource(row);
  if (!source) return [];
  if (row.entidad === "brain_action_plan") {
    const event = eventFromActionPlanRow(row);
    return event ? [event] : [];
  }
  if (source === "workflow") return eventsFromWorkflowRow(row);
  if (source === "automation") {
    const event = eventFromAutomationRow(row);
    return event ? [event] : [];
  }

  const event = eventFromConversationRow(row);
  return event ? [event] : [];
}

export async function getBrainTaskMetrics(
  tenant: TenantContext,
  input?: { limit?: number },
): Promise<CoreResult<BrainTaskMetricsSummary>> {
  const supabase = await createClient();
  const limit = Math.min(Math.max(Math.trunc(Number(input?.limit ?? 100)), 1), 500);
  const { data, error } = await supabase
    .from("auditoria_eventos")
    .select("entidad, entidad_id, accion, datos_despues, metadata, created_at")
    .eq("empresa_id", tenant.empresaId)
    .in("entidad", [
      "brain_action_plan",
      "brain_workflow",
      "brain_automation_job",
      "conversation_action",
    ])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return fail(
      "PERMISSION_DENIED",
      "No se pudieron consultar metricas de tareas Brain.",
      error,
    );
  }

  const events = ((data ?? []) as AuditMetricRow[]).flatMap(eventsFromRow);
  const summary: BrainTaskMetricsSummary = {
    events,
    failed: events.filter((event) => event.measure === "task_failed").length,
    lastEventAt: events[0]?.occurredAt ?? null,
    pendingApproval: events.filter((event) => event.measure === "task_pending_approval").length,
    sourceTotals: {
      automation: events.filter((event) => event.source === "automation").length,
      conversation: events.filter((event) => event.source === "conversation").length,
      workflow: events.filter((event) => event.source === "workflow").length,
    },
    taskCompleted: events
      .filter((event) => event.measure === "task_completed")
      .reduce((total, event) => total + event.value, 0),
    taskFailed: events
      .filter((event) => event.measure === "task_failed")
      .reduce((total, event) => total + event.value, 0),
    taskPendingApproval: events
      .filter((event) => event.measure === "task_pending_approval")
      .reduce((total, event) => total + event.value, 0),
    totalEvents: events.length,
  };

  return ok(summary);
}
