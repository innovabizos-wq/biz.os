import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  IntegrationOutboxJob,
  IntegrationOutboxJobSummary,
  IntegrationOutboxStatus,
} from "@/modules/integrations/outbox/types";
import type { JsonRecord } from "@/types/core";

type OutboxRow = {
  aggregate_id: string | null;
  aggregate_type: string | null;
  attempts: number;
  available_at: string;
  completed_at: string | null;
  created_at: string;
  created_by: string | null;
  empresa_id: string;
  id: string;
  last_error: string | null;
  lease_token: string | null;
  max_attempts: number;
  payload: JsonRecord | null;
  result: JsonRecord | null;
  status: IntegrationOutboxStatus;
  topic: string;
  updated_at: string;
};

type OutboxSummaryRow = Omit<OutboxRow, "created_by" | "empresa_id" | "lease_token" | "payload">;

function mapJob(row: OutboxRow): IntegrationOutboxJob {
  if (!row.lease_token) throw new Error(`La tarea ${row.id} no recibio una reserva valida.`);
  return {
    aggregateId: row.aggregate_id,
    aggregateType: row.aggregate_type,
    attempts: row.attempts,
    availableAt: row.available_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
    empresaId: row.empresa_id,
    id: row.id,
    lastError: row.last_error,
    leaseToken: row.lease_token,
    maxAttempts: row.max_attempts,
    payload: row.payload ?? {},
    result: row.result,
    status: row.status,
    topic: row.topic,
    updatedAt: row.updated_at,
  };
}

function mapSummary(row: OutboxSummaryRow): IntegrationOutboxJobSummary {
  return {
    aggregateId: row.aggregate_id,
    aggregateType: row.aggregate_type,
    attempts: row.attempts,
    availableAt: row.available_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    id: row.id,
    lastError: row.last_error,
    maxAttempts: row.max_attempts,
    result: row.result,
    status: row.status,
    topic: row.topic,
    updatedAt: row.updated_at,
  };
}

export async function claimIntegrationOutboxJobs(limit: number) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("claim_integration_outbox", {
    p_lease_seconds: 180,
    p_limit: limit,
  });
  if (error) throw new Error(`No se pudieron reservar tareas de integracion: ${error.message}`);
  return ((data ?? []) as OutboxRow[]).map(mapJob);
}

export async function completeIntegrationOutboxJob(job: IntegrationOutboxJob, result: JsonRecord) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("complete_integration_outbox", {
    p_job_id: job.id,
    p_lease_token: job.leaseToken,
    p_result: result,
  });
  if (error || data !== true) throw new Error(error?.message ?? "La reserva de la tarea vencio antes de completarla.");
}

export async function failIntegrationOutboxJob(job: IntegrationOutboxJob, message: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("fail_integration_outbox", {
    p_error: message,
    p_job_id: job.id,
    p_lease_token: job.leaseToken,
    p_retry_after_seconds: null,
  });
  if (error || (data !== "retry" && data !== "dead")) {
    throw new Error(error?.message ?? "No se pudo registrar el reintento de la tarea.");
  }
  return data as "retry" | "dead";
}

export async function deadLetterIntegrationOutboxJob(job: IntegrationOutboxJob, message: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("dead_letter_integration_outbox", {
    p_error: message,
    p_job_id: job.id,
    p_lease_token: job.leaseToken,
  });
  if (error || data !== true) throw new Error(error?.message ?? "No se pudo registrar la incidencia de integracion.");
}

export async function listIntegrationOutboxJobs(status = "open", limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_integration_outbox_jobs", {
    p_limit: limit,
    p_status: status,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as OutboxSummaryRow[]).map(mapSummary);
}
