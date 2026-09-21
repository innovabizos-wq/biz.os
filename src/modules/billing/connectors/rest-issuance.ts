import "server-only";

import { createHash } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import {
  getRestFiscalClientForConnection,
  type RestFiscalResult,
} from "@/modules/billing/connectors/rest-client";
import type { FiscalDocumentDetail } from "@/modules/billing/queries";
import type { JsonRecord, TenantContext } from "@/types/core";

export type RestFiscalIssuanceResult = {
  documentId: string;
  finalStatus: string;
  message: string;
  ok: boolean;
};

function restBinding(document: FiscalDocumentDetail): {
  connectionId: string;
  environment: "testing" | "production";
} {
  if (document.providerCode !== "rest" || !document.providerConnectionId) {
    throw new Error("El documento no está vinculado con un perfil REST.");
  }
  if (document.providerEnvironment !== "testing" && document.providerEnvironment !== "production") {
    throw new Error("El documento no conserva un ambiente REST válido.");
  }
  const environment = document.providerEnvironment;
  return {
    connectionId: document.providerConnectionId,
    environment,
  };
}

function canonicalRestPayload(
  tenant: TenantContext,
  document: FiscalDocumentDetail,
  idempotencyKey: string,
) {
  return {
    contractVersion: "bizos-fiscal-v1",
    document: {
      branchCode: document.branchCode,
      businessDocumentId: document.id,
      currency: {
        code: document.currencyCode,
        exchangeRate: document.exchangeRate,
      },
      documentTypeCode: document.documentTypeCode,
      environment: document.environment,
      issueDatetime: document.issueDatetime ?? document.createdAt,
      issuer: document.issuerSnapshot,
      lines: document.lines,
      payments: document.payments,
      receiver: {
        email: document.receiverEmail,
        identificationType: document.receiverIdentificationType,
        name: document.receiverName,
        ...document.receiverSnapshot,
      },
      references: document.references,
      saleConditionCode: document.saleConditionCode,
      totals: document.totals,
    },
    idempotencyKey,
    tenantReference: tenant.empresaId,
  };
}

function nextDocumentStatus(status: "accepted" | "processing" | "rejected" | "unknown") {
  if (status === "accepted") return "accepted";
  if (status === "rejected") return "rejected";
  return "processing";
}

async function archiveRestResponse(
  tenant: TenantContext,
  document: FiscalDocumentDetail,
  phase: "issue" | "status",
  result: RestFiscalResult,
  idempotencyKey: string,
) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const content = JSON.stringify(result.rawResponse, null, 2);
  const storagePath = [
    "billing",
    tenant.empresaId,
    "fiscal-documents",
    document.id,
    `rest-${phase}-response.json`,
  ].join("/");
  const { error: artifactError } = await supabase.from("fiscal_document_artifacts").insert({
    artifact_type: "provider_response",
    content_mime_type: "application/json",
    content_text: content,
    empresa_id: tenant.empresaId,
    fiscal_document_id: document.id,
    metadata: {
      generatedAt: now,
      generatedBy: "ConfigurableRestFiscalClient",
      phase,
      provider: "rest",
    },
    sha256: createHash("sha256").update(content).digest("hex"),
    status: "stored",
    storage_path: storagePath,
  });
  if (artifactError) {
    throw new Error("El proveedor REST respondió, pero no se pudo archivar la respuesta.");
  }

  const nextStatus = nextDocumentStatus(result.status);
  const update: JsonRecord = {
    accepted_at: result.status === "accepted" ? now : null,
    last_error: result.status === "unknown" ? "El proveedor REST devolvió un estado no reconocido." : null,
    provider_last_response_at: now,
    provider_reference: idempotencyKey,
    provider_status: result.status,
    rejected_at: result.status === "rejected" ? now : null,
    status: nextStatus,
  };
  if (phase === "issue") update.sent_at = now;
  if (result.providerDocumentId) update.provider_document_id = result.providerDocumentId;

  const { data: updatedDocument, error: updateError } = await supabase
    .from("fiscal_documents")
    .update(update)
    .select("id")
    .eq("empresa_id", tenant.empresaId)
    .eq("id", document.id)
    .in("status", phase === "issue" ? ["validated"] : ["sent", "processing"])
    .maybeSingle<{ id: string }>();
  if (updateError || !updatedDocument) {
    throw new Error("La respuesta REST se archivó, pero no se pudo actualizar el documento.");
  }
  return nextStatus;
}

export async function runRestFiscalIssuance(
  tenant: TenantContext,
  document: FiscalDocumentDetail,
): Promise<RestFiscalIssuanceResult> {
  const binding = restBinding(document);
  const client = await getRestFiscalClientForConnection(
    tenant.empresaId,
    binding.connectionId,
    binding.environment,
  );
  const idempotencyKey = `bizos-fiscal-${document.id}`;

  if (["accepted", "rejected"].includes(document.status)) {
    return {
      documentId: document.id,
      finalStatus: document.status,
      message: "El proveedor REST ya devolvió un estado final.",
      ok: true,
    };
  }

  if (document.status === "validated") {
    const result = await client.submit(
      idempotencyKey,
      canonicalRestPayload(tenant, document, idempotencyKey),
    );
    const finalStatus = await archiveRestResponse(
      tenant,
      document,
      "issue",
      result,
      idempotencyKey,
    );
    return {
      documentId: document.id,
      finalStatus,
      message: `Emisión REST registrada con estado ${result.status}.`,
      ok: result.status !== "unknown",
    };
  }

  if (["sent", "processing"].includes(document.status)) {
    const result = await client.queryStatus(document.providerReference ?? idempotencyKey);
    const finalStatus = await archiveRestResponse(
      tenant,
      document,
      "status",
      result,
      idempotencyKey,
    );
    return {
      documentId: document.id,
      finalStatus,
      message: `Consulta REST registrada con estado ${result.status}.`,
      ok: result.status !== "unknown",
    };
  }

  return {
    documentId: document.id,
    finalStatus: document.status,
    message: `El documento ${document.status} no puede enviarse por REST.`,
    ok: false,
  };
}
