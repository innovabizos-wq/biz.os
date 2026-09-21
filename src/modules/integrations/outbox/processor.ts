import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { runWithServiceRoleSupabase } from "@/lib/supabase/service-role-context";
import { runRestFiscalIssuance } from "@/modules/billing/connectors/rest-issuance";
import {
  ensureFiscalDocumentConnection,
  runImmediateFiscalIssuance,
} from "@/modules/billing/issuance";
import { getFiscalDocumentDetail, type FiscalDocumentDetail } from "@/modules/billing/queries";
import {
  claimIntegrationOutboxJobs,
  completeIntegrationOutboxJob,
  deadLetterIntegrationOutboxJob,
  failIntegrationOutboxJob,
} from "@/modules/integrations/outbox/repository";
import type { IntegrationOutboxBatchResult, IntegrationOutboxJob } from "@/modules/integrations/outbox/types";
import type { JsonRecord, TenantContext } from "@/types/core";

class PermanentIntegrationError extends Error {}

type PreparedFiscalDocument = {
  document_id: string;
  status: string;
  validation_errors: unknown[] | null;
};

function permanentFiscalFailure(message: string) {
  return /no configurad|no hay una conexi[oó]n fiscal activa|falta\b|invalid|permiso|no encontr|no tiene|detuvo|bloquead/i.test(message);
}

function fiscalWorkerTenant(job: IntegrationOutboxJob): TenantContext {
  if (!job.createdBy) throw new PermanentIntegrationError("La tarea fiscal no conserva el usuario que origino la venta.");
  return {
    activeModules: ["billing"],
    empresaId: job.empresaId,
    permissions: ["billing.issue", "billing.invoices.create"],
    profileId: job.createdBy,
  };
}

async function prepareFiscalDocument(job: IntegrationOutboxJob) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("prepare_fiscal_document_from_outbox", {
    p_document_type_code: typeof job.payload.document_type_code === "string" ? job.payload.document_type_code : "01",
    p_job_id: job.id,
    p_lease_token: job.leaseToken,
  });
  if (error) throw new Error(`No se pudo preparar el documento fiscal: ${error.message}`);
  const prepared = ((data ?? []) as PreparedFiscalDocument[])[0];
  if (!prepared?.document_id) throw new Error("La preparacion fiscal no retorno un documento.");
  if (prepared.status === "error_validation") {
    throw new PermanentIntegrationError("El documento fiscal tiene errores de validacion. Corrige los datos y reintenta la incidencia.");
  }
  return prepared.document_id;
}

async function loadBoundFiscalDocument(job: IntegrationOutboxJob, documentId: string) {
  return runWithServiceRoleSupabase(async () => {
    const tenant = fiscalWorkerTenant(job);
    const loaded = await getFiscalDocumentDetail(tenant, documentId);
    if (!loaded.ok || !loaded.data) {
      throw new PermanentIntegrationError("El documento de la tarea fiscal no existe.");
    }
    return ensureFiscalDocumentConnection(tenant, loaded.data, {
      leaseToken: job.leaseToken,
      outboxJobId: job.id,
    });
  });
}

async function enqueueFiscalStatus(job: IntegrationOutboxJob, documentId: string) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("integration_outbox").upsert({
    aggregate_id: documentId,
    aggregate_type: "fiscal_documents",
    created_by: job.createdBy,
    empresa_id: job.empresaId,
    idempotency_key: `fiscal-status:${documentId}`,
    payload: { document_id: documentId },
    topic: "fiscal.status",
  }, { ignoreDuplicates: true, onConflict: "empresa_id,topic,idempotency_key" });
  if (error) throw new Error(`No se pudo programar la consulta fiscal: ${error.message}`);
}

async function runHaciendaIssuance(job: IntegrationOutboxJob, documentId: string): Promise<JsonRecord> {
  const result = await runWithServiceRoleSupabase(() => runImmediateFiscalIssuance(
    fiscalWorkerTenant(job),
    documentId,
    { leaseToken: job.leaseToken, outboxJobId: job.id },
  ));
  if (!result.ok) {
    if (permanentFiscalFailure(result.message)) throw new PermanentIntegrationError(result.message);
    throw new Error(result.message);
  }
  if (["sent", "processing"].includes(result.finalStatus ?? "")) {
    await enqueueFiscalStatus(job, documentId);
  }
  return {
    documentId,
    finalStatus: result.finalStatus,
    message: result.message,
    steps: result.steps,
  };
}

async function runRestIssuance(
  job: IntegrationOutboxJob,
  document: FiscalDocumentDetail,
): Promise<JsonRecord> {
  const result = await runWithServiceRoleSupabase(() => runRestFiscalIssuance(
    fiscalWorkerTenant(job),
    document,
  ));
  if (!result.ok) throw new Error(result.message);
  if (["sent", "processing"].includes(result.finalStatus)) {
    await enqueueFiscalStatus(job, document.id);
  }
  return {
    documentId: document.id,
    finalStatus: result.finalStatus,
    message: result.message,
    provider: "rest",
  };
}

async function runProviderIssuance(
  job: IntegrationOutboxJob,
  document: FiscalDocumentDetail,
) {
  if (document.providerCode === "hacienda") return runHaciendaIssuance(job, document.id);
  if (document.providerCode === "rest") return runRestIssuance(job, document);
  throw new PermanentIntegrationError(
    `La conexión ${document.providerCode ?? "desconocida"} no tiene un adaptador de emisión instalado.`,
  );
}

async function processFiscalIssue(job: IntegrationOutboxJob) {
  const documentId = await prepareFiscalDocument(job);
  const document = await loadBoundFiscalDocument(job, documentId);
  return runProviderIssuance(job, document);
}

async function processFiscalStatus(job: IntegrationOutboxJob) {
  const documentId = job.aggregateId ?? (typeof job.payload.document_id === "string" ? job.payload.document_id : null);
  if (!documentId) throw new PermanentIntegrationError("La tarea de consulta fiscal no identifica el documento.");
  const document = await loadBoundFiscalDocument(job, documentId);
  const result = await runProviderIssuance(job, document);
  if (result.finalStatus === "processing" || result.finalStatus === "sent") {
    throw new Error("El proveedor fiscal aún está procesando el documento.");
  }
  return result;
}

async function dispatchIntegrationJob(job: IntegrationOutboxJob) {
  if (job.topic === "fiscal.issue") return processFiscalIssue(job);
  if (job.topic === "fiscal.status") return processFiscalStatus(job);
  throw new PermanentIntegrationError(`No existe un procesador registrado para ${job.topic}.`);
}

async function settleJob(job: IntegrationOutboxJob) {
  try {
    const result = await dispatchIntegrationJob(job);
    await completeIntegrationOutboxJob(job, result);
    return "succeeded" as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fallo desconocido al procesar la integracion.";
    if (error instanceof PermanentIntegrationError) {
      await deadLetterIntegrationOutboxJob(job, message);
      return "dead" as const;
    }
    return failIntegrationOutboxJob(job, message);
  }
}

export async function processIntegrationOutboxBatch(limit = 10): Promise<IntegrationOutboxBatchResult> {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 25));
  const jobs = await claimIntegrationOutboxJobs(safeLimit);
  const settled = await Promise.all(jobs.map(settleJob));
  return {
    claimed: jobs.length,
    dead: settled.filter((status) => status === "dead").length,
    retried: settled.filter((status) => status === "retry").length,
    succeeded: settled.filter((status) => status === "succeeded").length,
  };
}
