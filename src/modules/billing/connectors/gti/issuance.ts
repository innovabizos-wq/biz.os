import "server-only";

import { createHash } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import {
  getGtiFiscalClientForConnection,
  GtiAmbiguousSubmissionError,
} from "@/modules/billing/connectors/gti/client";
import { buildGtiDocumentPayload } from "@/modules/billing/connectors/gti/payload";
import type { FiscalDocumentDetail } from "@/modules/billing/queries";
import type { JsonRecord, TenantContext } from "@/types/core";

export type GtiFiscalIssuanceResult = {
  documentId: string;
  finalStatus: string;
  message: string;
  ok: boolean;
};

function binding(document: FiscalDocumentDetail): {
  connectionId: string;
  environment: "testing" | "production";
} {
  if (document.providerCode !== "gti" || !document.providerConnectionId) {
    throw new Error("El documento no está vinculado con GTI.");
  }
  const environment = document.providerEnvironment;
  if (environment !== "testing" && environment !== "production") {
    throw new Error("El documento no conserva un ambiente GTI válido.");
  }
  return { connectionId: document.providerConnectionId, environment };
}

async function archive(
  tenant: TenantContext,
  document: FiscalDocumentDetail,
  phase: "request" | "response",
  value: unknown,
  status: "stored" | "error" = "stored",
) {
  const content = JSON.stringify(value, null, 2);
  const storagePath = [
    "billing", tenant.empresaId, "fiscal-documents", document.id, `gti-${phase}.json`,
  ].join("/");
  const { error } = await (await createClient()).from("fiscal_document_artifacts").insert({
    artifact_type: phase === "request" ? "provider_request" : "provider_response",
    content_mime_type: "application/json",
    content_text: content,
    empresa_id: tenant.empresaId,
    fiscal_document_id: document.id,
    metadata: { generatedAt: new Date().toISOString(), generatedBy: "GtiFiscalClient", phase, provider: "gti" },
    sha256: createHash("sha256").update(content).digest("hex"),
    status,
    storage_path: storagePath,
  });
  if (error) throw new Error(`No se pudo archivar la ${phase === "request" ? "solicitud" : "respuesta"} de GTI.`);
}

export async function runGtiFiscalIssuance(
  tenant: TenantContext,
  document: FiscalDocumentDetail,
): Promise<GtiFiscalIssuanceResult> {
  const assigned = binding(document);
  if (["accepted", "rejected"].includes(document.status)) {
    return { documentId: document.id, finalStatus: document.status, message: "GTI ya devolvió un resultado final.", ok: true };
  }
  if (document.status !== "validated") {
    return {
      documentId: document.id,
      finalStatus: document.status,
      message: document.status === "processing"
        ? "El documento GTI está por confirmar. No se reenvía automáticamente para evitar un duplicado fiscal."
        : `El documento ${document.status} no puede enviarse por GTI.`,
      ok: document.status === "processing",
    };
  }

  const { accountNumber, client } = await getGtiFiscalClientForConnection(
    tenant.empresaId,
    assigned.connectionId,
    assigned.environment,
  );
  const reference = `bizos-${document.id}`;
  const payload = buildGtiDocumentPayload(document, accountNumber);
  await archive(tenant, document, "request", { idPedido: reference, payload });
  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await (await createClient())
    .from("fiscal_documents")
    .update({
      last_error: null,
      provider_reference: reference,
      provider_status: "submission_started",
      sent_at: now,
      status: "processing",
    })
    .select("id")
    .eq("empresa_id", tenant.empresaId)
    .eq("id", document.id)
    .eq("status", "validated")
    .is("provider_reference", null)
    .maybeSingle<{ id: string }>();
  if (claimError || !claimed) {
    throw new Error("La emisión GTI ya fue iniciada o cambió de estado; no se repite el envío.");
  }

  try {
    const result = await client.submit(reference, payload as unknown as Record<string, unknown>);
    await archive(tenant, document, "response", result.rawResponse);
    const update: JsonRecord = {
      last_error: null,
      provider_last_response_at: new Date().toISOString(),
      provider_status: result.status,
    };
    if (result.providerDocumentId) update.provider_document_id = result.providerDocumentId;
    await (await createClient()).from("fiscal_documents").update(update)
      .eq("empresa_id", tenant.empresaId).eq("id", document.id).eq("provider_reference", reference);
    return {
      documentId: document.id,
      finalStatus: "processing",
      message: "GTI recibió el documento. La aceptación fiscal continúa por confirmar.",
      ok: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "GTI no devolvió una respuesta concluyente.";
    await archive(
      tenant,
      document,
      "response",
      { error: message, ambiguous: error instanceof GtiAmbiguousSubmissionError },
      "error",
    );
    await (await createClient()).from("fiscal_documents").update({
      last_error: message,
      provider_last_response_at: new Date().toISOString(),
      provider_status: "unknown",
    }).eq("empresa_id", tenant.empresaId).eq("id", document.id).eq("provider_reference", reference);
    return { documentId: document.id, finalStatus: "processing", message, ok: false };
  }
}
