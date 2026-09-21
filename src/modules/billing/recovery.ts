import { createHash } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { getHaciendaClientForConnection } from "@/modules/billing/hacienda/client";
import { archiveOfficialHaciendaResponseXml } from "@/modules/billing/hacienda/artifacts";
import type { HaciendaStatusResult } from "@/modules/billing/hacienda/types";
import type { TenantContext } from "@/types/core";

type RecoverableFiscalDocumentRow = {
  clave: string | null;
  fiscal_connection_id: string | null;
  hacienda_status: string;
  id: string;
  provider_code: string | null;
  provider_environment: "testing" | "production" | null;
  status: string;
};

export type FiscalRecoverySummary = {
  errors: string[];
  queriedHacienda: number;
  reviewed: number;
  skipped: number;
  updated: number;
};

const RECOVERABLE_STATUSES = [
  "validated",
  "xml_generated",
  "signed",
  "sent",
  "processing",
  "error_xml",
  "error_signing",
  "error_sending",
] as const;

function safeJsonText(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return JSON.stringify({ error: "Respuesta no serializable." });
  }
}

function nextDocumentStatus(status: HaciendaStatusResult["status"]) {
  if (status === "aceptado") return "accepted";
  if (status === "rechazado") return "rejected";
  if (status === "error") return "error_sending";
  return "processing";
}

function shouldQueryHacienda(document: RecoverableFiscalDocumentRow) {
  return (
    Boolean(document.clave) &&
    (["sent", "processing"].includes(document.status) ||
      ["recibido", "procesando"].includes(document.hacienda_status))
  );
}

async function archiveHaciendaRecoveryResponse(
  tenant: TenantContext,
  document: RecoverableFiscalDocumentRow,
  result: HaciendaStatusResult,
) {
  const supabase = await createClient();
  const responseText = safeJsonText(result.rawResponse);
  const responseHash = createHash("sha256").update(responseText).digest("hex");
  const responseStoragePath = [
    "billing",
    tenant.empresaId,
    "fiscal-documents",
    document.id,
    "hacienda-recovery-response.json",
  ].join("/");
  const now = new Date().toISOString();

  const { error: artifactError } = await supabase.from("fiscal_document_artifacts").insert({
    artifact_type: "hacienda_response",
    content_mime_type: "application/json",
    content_text: responseText,
    empresa_id: tenant.empresaId,
    fiscal_document_id: document.id,
    metadata: {
      generatedAt: now,
      generatedBy: "recoverPendingFiscalDocuments",
      phase: "recovery-status",
    },
    sha256: responseHash,
    status: result.status === "error" ? "error" : "stored",
    storage_path: responseStoragePath,
  });

  if (artifactError) {
    throw new Error("Hacienda respondio, pero no se pudo archivar la respuesta de recuperacion.");
  }

  const officialResponsePath = await archiveOfficialHaciendaResponseXml({
    empresaId: tenant.empresaId,
    fiscalDocumentId: document.id,
    generatedBy: "recoverPendingFiscalDocuments",
    responseXmlBase64: result.responseXmlBase64,
  });

  const { error: updateError } = await supabase
    .from("fiscal_documents")
    .update({
      accepted_at: result.status === "aceptado" ? now : null,
      hacienda_response_storage_path: officialResponsePath ?? responseStoragePath,
      hacienda_status: result.status,
      last_error: result.status === "error" ? "Hacienda retorno error en recuperacion." : null,
      provider_last_response_at: now,
      provider_status: result.status,
      rejected_at: result.status === "rechazado" ? now : null,
      status: nextDocumentStatus(result.status),
    })
    .eq("empresa_id", tenant.empresaId)
    .eq("id", document.id)
    .in("status", ["sent", "processing"]);

  if (updateError) {
    throw new Error("La respuesta se archivo, pero no se pudo actualizar el documento fiscal.");
  }
}

export async function recoverPendingFiscalDocuments(
  tenant: TenantContext,
  limit = 10,
): Promise<FiscalRecoverySummary> {
  const normalizedLimit = Math.max(1, Math.min(Math.trunc(limit), 25));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fiscal_documents")
    .select("id, clave, status, hacienda_status, fiscal_connection_id, provider_code, provider_environment")
    .eq("empresa_id", tenant.empresaId)
    .in("status", RECOVERABLE_STATUSES)
    .order("updated_at", { ascending: true })
    .limit(normalizedLimit);

  if (error) {
    return {
      errors: [error.message],
      queriedHacienda: 0,
      reviewed: 0,
      skipped: 0,
      updated: 0,
    };
  }

  const documents = (data ?? []) as RecoverableFiscalDocumentRow[];
  const summary: FiscalRecoverySummary = {
    errors: [],
    queriedHacienda: 0,
    reviewed: documents.length,
    skipped: 0,
    updated: 0,
  };
  const haciendaClients = new Map<
    string,
    Awaited<ReturnType<typeof getHaciendaClientForConnection>>
  >();

  for (const document of documents) {
    if (!shouldQueryHacienda(document)) {
      summary.skipped += 1;
      continue;
    }

    if (
      !document.fiscal_connection_id ||
      document.provider_code !== "hacienda" ||
      !document.provider_environment
    ) {
      summary.errors.push(
        `El documento ${document.id} no conserva una conexión Hacienda válida; requiere conciliación manual.`,
      );
      continue;
    }

    try {
      summary.queriedHacienda += 1;
      let haciendaClient = haciendaClients.get(document.fiscal_connection_id);
      if (!haciendaClient) {
        haciendaClient = await getHaciendaClientForConnection(
          tenant.empresaId,
          document.fiscal_connection_id,
          document.provider_environment,
        );
        haciendaClients.set(document.fiscal_connection_id, haciendaClient);
      }
      const result = await haciendaClient.queryStatus(document.clave as string);
      await archiveHaciendaRecoveryResponse(tenant, document, result);
      summary.updated += 1;
    } catch (error) {
      summary.errors.push(error instanceof Error ? error.message : "Error recuperando documento.");
    }
  }

  return summary;
}
