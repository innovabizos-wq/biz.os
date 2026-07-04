import { createHash } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { getHaciendaClient } from "@/modules/billing/hacienda/client";
import type { HaciendaStatusResult } from "@/modules/billing/hacienda/types";
import { getFiscalDocumentDetail, type FiscalDocumentDetail } from "@/modules/billing/queries";
import { generateFiscalClave } from "@/modules/billing/sequences";
import { getBillingXmlSigner } from "@/modules/billing/signing/signer";
import { validateFiscalDocumentReadyForXml } from "@/modules/billing/validation/validate-document";
import { buildUnsignedXmlFromFiscalDocument } from "@/modules/billing/xml/document";
import { validateFiscalXmlAgainstOfficialXsd } from "@/modules/billing/xml/validation";
import type { JsonRecord, TenantContext } from "@/types/core";

export type FiscalIssuanceStep =
  | "identity"
  | "validation"
  | "xml"
  | "signing"
  | "hacienda_send"
  | "hacienda_status";

export type ImmediateFiscalIssuanceResult = {
  documentId: string;
  finalStatus: string | null;
  message: string;
  ok: boolean;
  steps: {
    detail: string;
    status: "completed" | "blocked" | "failed" | "skipped";
    step: FiscalIssuanceStep;
  }[];
};

function textFromRecord(record: JsonRecord, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasXmlSignature(xml: string) {
  return /<(?:[\w-]+:)?Signature\b/.test(xml);
}

function safeJsonText(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return JSON.stringify({ error: "Respuesta no serializable." });
  }
}

function safeMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function loadDocument(tenant: TenantContext, documentId: string) {
  const document = await getFiscalDocumentDetail(tenant, documentId);

  return document.ok ? document.data : null;
}

async function ensureFiscalIdentity(
  tenant: TenantContext,
  document: FiscalDocumentDetail,
): Promise<FiscalDocumentDetail> {
  if (document.status !== "validated" || (document.clave && document.consecutivo)) {
    return document;
  }

  const identificationNumber = textFromRecord(document.issuerSnapshot, "identificationNumber");

  if (!identificationNumber) {
    throw new Error("Falta identificacion fiscal del emisor para generar clave numerica.");
  }

  const supabase = await createClient();
  const { data: sequenceData, error: sequenceError } = await supabase.rpc(
    "reserve_fiscal_sequence_for_current_company",
    {
      p_branch_code: document.branchCode,
      p_document_type_code: document.documentTypeCode,
      p_environment: document.environment,
      p_terminal_code: document.terminalCode,
    },
  );

  if (sequenceError) {
    throw new Error(`No se pudo reservar consecutivo fiscal: ${sequenceError.message}`);
  }

  const reservation = (sequenceData as
    | { consecutivo?: string; reservation_id?: string; sequence_number?: number }[]
    | null)?.[0];

  if (!reservation?.consecutivo || !reservation.reservation_id) {
    throw new Error("La reserva fiscal no retorno consecutivo.");
  }

  const clave = generateFiscalClave({
    consecutivo: reservation.consecutivo,
    identificationNumber,
    issueDate: document.issueDatetime ?? document.createdAt,
  });
  const metadata = {
    ...document.metadata,
    fiscalIdentityAssignedAt: new Date().toISOString(),
    fiscalSequenceNumber: reservation.sequence_number ?? null,
    fiscalSequenceReservationId: reservation.reservation_id,
  };

  const { data: updatedDocument, error: updateError } = await supabase
    .from("fiscal_documents")
    .update({
      clave,
      consecutivo: reservation.consecutivo,
      last_error: null,
      metadata,
    })
    .select("id")
    .eq("empresa_id", tenant.empresaId)
    .eq("id", document.id)
    .eq("status", "validated")
    .is("clave", null)
    .is("consecutivo", null)
    .maybeSingle<{ id: string }>();

  if (updateError || !updatedDocument) {
    throw new Error(
      "Se reservo consecutivo, pero no se pudo asignar clave al documento. Recarga e intenta de nuevo.",
    );
  }

  await supabase
    .from("fiscal_sequence_reservations")
    .update({
      clave,
      fiscal_document_id: document.id,
      status: "used",
      used_at: new Date().toISOString(),
    })
    .eq("empresa_id", tenant.empresaId)
    .eq("id", reservation.reservation_id);

  const refreshed = await loadDocument(tenant, document.id);

  if (!refreshed) {
    throw new Error("No se pudo recargar el documento fiscal.");
  }

  return refreshed;
}

async function generateUnsignedXml(tenant: TenantContext, document: FiscalDocumentDetail) {
  const documentValidation = await validateFiscalDocumentReadyForXml(tenant, document);
  const supabase = await createClient();

  if (!documentValidation.ok) {
    const firstIssue = documentValidation.issues[0];
    await supabase
      .from("fiscal_documents")
      .update({
        last_error: firstIssue?.message ?? "Documento fiscal invalido para XML.",
        status: "error_validation",
        validation_errors: documentValidation.issues,
      })
      .eq("empresa_id", tenant.empresaId)
      .eq("id", document.id)
      .eq("status", "validated");

    throw new Error(firstIssue?.message ?? "Documento fiscal invalido para XML.");
  }

  const unsignedXml = buildUnsignedXmlFromFiscalDocument(document);
  const xmlValidation = await validateFiscalXmlAgainstOfficialXsd(unsignedXml.xml);

  if (xmlValidation.enabled && !xmlValidation.ok) {
    const message = xmlValidation.errors[0] ?? "XML no valido contra XSD oficial.";
    await supabase
      .from("fiscal_documents")
      .update({
        last_error: message,
        status: "error_xml",
        validation_errors: xmlValidation.errors.map((validationError) => ({
          code: "xsd_validation_error",
          group: "XML",
          message: validationError,
        })),
      })
      .eq("empresa_id", tenant.empresaId)
      .eq("id", document.id)
      .eq("status", "validated");

    throw new Error(message);
  }

  const storagePath = [
    "billing",
    tenant.empresaId,
    "fiscal-documents",
    document.id,
    "unsigned.xml",
  ].join("/");
  const metadata = {
    generatedAt: new Date().toISOString(),
    generatedBy: "runImmediateFiscalIssuance",
    pendingXsdValidation: xmlValidation.pendingXsdValidation,
    xsdValidation: {
      enabled: xmlValidation.enabled,
      errors: xmlValidation.errors,
      ok: xmlValidation.ok,
      validator: xmlValidation.validator,
      xsdVersion: xmlValidation.xsdVersion,
    },
  };

  const { error: artifactError } = await supabase.from("fiscal_document_artifacts").insert({
    artifact_type: "xml_unsigned",
    content_mime_type: "application/xml",
    content_text: unsignedXml.xml,
    empresa_id: tenant.empresaId,
    fiscal_document_id: document.id,
    metadata,
    sha256: createHash("sha256").update(unsignedXml.xml).digest("hex"),
    status: "generated",
    storage_path: storagePath,
  });

  if (artifactError) {
    throw new Error("No se pudo guardar el artefacto XML interno.");
  }

  const { error: updateError } = await supabase
    .from("fiscal_documents")
    .update({
      last_error: null,
      metadata: { ...document.metadata, ...metadata },
      status: "xml_generated",
      xml_unsigned_storage_path: storagePath,
    })
    .eq("empresa_id", tenant.empresaId)
    .eq("id", document.id)
    .eq("status", "validated");

  if (updateError) {
    throw new Error("El XML se guardo, pero no se pudo actualizar el documento.");
  }
}

async function signXml(tenant: TenantContext, document: FiscalDocumentDetail) {
  const supabase = await createClient();
  const { data: unsignedArtifact, error: artifactError } = await supabase
    .from("fiscal_document_artifacts")
    .select("content_text")
    .eq("empresa_id", tenant.empresaId)
    .eq("fiscal_document_id", document.id)
    .eq("artifact_type", "xml_unsigned")
    .eq("status", "generated")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ content_text: string | null }>();

  if (artifactError || !unsignedArtifact?.content_text) {
    throw new Error("No se encontro el XML sin firmar archivado.");
  }

  const result = await getBillingXmlSigner().sign({
    certificateSecretRef: `company:${tenant.empresaId}:billing:fiscal:p12`,
    pinSecretRef: `company:${tenant.empresaId}:billing:fiscal:pin`,
    unsignedXml: unsignedArtifact.content_text,
  });

  if (!hasXmlSignature(result.signedXml)) {
    throw new Error("La firma XML no contiene Signature; no se marca como firmado.");
  }

  const storagePath = [
    "billing",
    tenant.empresaId,
    "fiscal-documents",
    document.id,
    "signed.xml",
  ].join("/");
  const metadata = {
    algorithm: result.algorithm,
    generatedAt: new Date().toISOString(),
    generatedBy: "runImmediateFiscalIssuance",
    signer: "BillingXmlSigner",
  };

  const { error: signedArtifactError } = await supabase.from("fiscal_document_artifacts").insert({
    artifact_type: "xml_signed",
    content_mime_type: "application/xml",
    content_text: result.signedXml,
    empresa_id: tenant.empresaId,
    fiscal_document_id: document.id,
    metadata,
    sha256: createHash("sha256").update(result.signedXml).digest("hex"),
    status: "generated",
    storage_path: storagePath,
  });

  if (signedArtifactError) {
    throw new Error("No se pudo guardar el XML firmado.");
  }

  const { error: updateError } = await supabase
    .from("fiscal_documents")
    .update({
      last_error: null,
      signed_at: new Date().toISOString(),
      status: "signed",
      xml_signed_storage_path: storagePath,
    })
    .eq("empresa_id", tenant.empresaId)
    .eq("id", document.id)
    .eq("status", "xml_generated");

  if (updateError) {
    throw new Error("El XML firmado se archivo, pero no se pudo actualizar el documento.");
  }
}

async function sendToHacienda(tenant: TenantContext, document: FiscalDocumentDetail) {
  if (!document.clave) {
    throw new Error("Falta clave numerica para enviar a Hacienda.");
  }

  const supabase = await createClient();
  const { data: signedArtifact, error: artifactError } = await supabase
    .from("fiscal_document_artifacts")
    .select("content_text")
    .eq("empresa_id", tenant.empresaId)
    .eq("fiscal_document_id", document.id)
    .eq("artifact_type", "xml_signed")
    .eq("status", "generated")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ content_text: string | null }>();

  if (artifactError || !signedArtifact?.content_text || !hasXmlSignature(signedArtifact.content_text)) {
    throw new Error("No se encontro un XML firmado valido para enviar.");
  }

  const sendResult = await getHaciendaClient().sendSignedXml({
    clave: document.clave,
    signedXml: signedArtifact.content_text,
  });
  const responseText = safeJsonText(sendResult.rawResponse);
  const responseStoragePath = [
    "billing",
    tenant.empresaId,
    "fiscal-documents",
    document.id,
    "hacienda-send-response.json",
  ].join("/");

  await supabase.from("fiscal_document_artifacts").insert({
    artifact_type: "hacienda_response",
    content_mime_type: "application/json",
    content_text: responseText,
    empresa_id: tenant.empresaId,
    fiscal_document_id: document.id,
    metadata: {
      generatedAt: new Date().toISOString(),
      generatedBy: "runImmediateFiscalIssuance",
      phase: "send",
    },
    sha256: createHash("sha256").update(responseText).digest("hex"),
    status: sendResult.status === "error" ? "error" : "stored",
    storage_path: responseStoragePath,
  });

  const nextStatus = sendResult.status === "error" ? "error_sending" : "sent";
  await supabase
    .from("fiscal_documents")
    .update({
      hacienda_response_storage_path: responseStoragePath,
      hacienda_status: sendResult.status,
      last_error: sendResult.status === "error" ? "Hacienda retorno error en envio." : null,
      sent_at: sendResult.status === "error" ? null : new Date().toISOString(),
      status: nextStatus,
    })
    .eq("empresa_id", tenant.empresaId)
    .eq("id", document.id)
    .eq("status", "signed");

  return sendResult.status;
}

async function queryHaciendaStatus(tenant: TenantContext, document: FiscalDocumentDetail) {
  if (!document.clave) {
    throw new Error("Falta clave numerica para consultar Hacienda.");
  }

  const statusResult = await getHaciendaClient().queryStatus(document.clave);
  const supabase = await createClient();
  const responseText = safeJsonText(statusResult.rawResponse);
  const responseStoragePath = [
    "billing",
    tenant.empresaId,
    "fiscal-documents",
    document.id,
    "hacienda-status-response.json",
  ].join("/");

  await supabase.from("fiscal_document_artifacts").insert({
    artifact_type: "hacienda_response",
    content_mime_type: "application/json",
    content_text: responseText,
    empresa_id: tenant.empresaId,
    fiscal_document_id: document.id,
    metadata: {
      generatedAt: new Date().toISOString(),
      generatedBy: "runImmediateFiscalIssuance",
      phase: "status",
    },
    sha256: createHash("sha256").update(responseText).digest("hex"),
    status: statusResult.status === "error" ? "error" : "stored",
    storage_path: responseStoragePath,
  });

  const now = new Date().toISOString();
  const documentStatusByHaciendaStatus: Record<HaciendaStatusResult["status"], string> = {
    aceptado: "accepted",
    desconocido: "processing",
    error: "error_sending",
    procesando: "processing",
    rechazado: "rejected",
  };

  await supabase
    .from("fiscal_documents")
    .update({
      accepted_at: statusResult.status === "aceptado" ? now : null,
      hacienda_response_storage_path: responseStoragePath,
      hacienda_status: statusResult.status,
      last_error: statusResult.status === "error" ? "Hacienda retorno error en consulta." : null,
      rejected_at: statusResult.status === "rechazado" ? now : null,
      status: documentStatusByHaciendaStatus[statusResult.status],
    })
    .eq("empresa_id", tenant.empresaId)
    .eq("id", document.id)
    .in("status", ["sent", "processing"]);

  return statusResult.status;
}

export async function runImmediateFiscalIssuance(
  tenant: TenantContext,
  documentId: string,
): Promise<ImmediateFiscalIssuanceResult> {
  const steps: ImmediateFiscalIssuanceResult["steps"] = [];
  let document = await loadDocument(tenant, documentId);

  if (!document) {
    return {
      documentId,
      finalStatus: null,
      message: "Documento fiscal no encontrado.",
      ok: false,
      steps,
    };
  }

  if (["accepted", "rejected"].includes(document.status)) {
    return {
      documentId,
      finalStatus: document.status,
      message: "Documento fiscal ya tiene respuesta oficial final.",
      ok: true,
      steps: [
        ...steps,
        { detail: "No se reprocesan documentos aceptados o rechazados.", status: "skipped", step: "hacienda_status" },
      ],
    };
  }

  if (
    !["validated", "xml_generated", "signed", "sent", "processing"].includes(document.status) &&
    !["recibido", "procesando"].includes(document.haciendaStatus)
  ) {
    return {
      documentId,
      finalStatus: document.status,
      message:
        document.lastError ??
        `Documento fiscal en estado ${document.status}; no hay paso de emision inmediata disponible.`,
      ok: false,
      steps: [
        ...steps,
        {
          detail: "El flujo inmediato solo procesa documentos validados o pendientes ante Hacienda.",
          status: "blocked",
          step: "validation",
        },
      ],
    };
  }

  try {
    document = await ensureFiscalIdentity(tenant, document);
    steps.push({ detail: "Clave y consecutivo fiscal listos.", status: "completed", step: "identity" });
  } catch (error) {
    return {
      documentId,
      finalStatus: document.status,
      message: safeMessage(error, "No se pudo preparar identidad fiscal."),
      ok: false,
      steps: [...steps, { detail: "No se pudo reservar clave/consecutivo.", status: "failed", step: "identity" }],
    };
  }

  if (document.status === "validated") {
    try {
      await generateUnsignedXml(tenant, document);
      steps.push({ detail: "Validacion fiscal y XML 4.4 interno generados.", status: "completed", step: "xml" });
      document = (await loadDocument(tenant, documentId)) ?? document;
    } catch (error) {
      return {
        documentId,
        finalStatus: (await loadDocument(tenant, documentId))?.status ?? document.status,
        message: safeMessage(error, "No se pudo generar XML fiscal."),
        ok: false,
        steps: [
          ...steps,
          { detail: "La validacion o generacion XML detuvo la emision.", status: "failed", step: "validation" },
        ],
      };
    }
  }

  if (document.status === "xml_generated") {
    try {
      await signXml(tenant, document);
      steps.push({ detail: "XML firmado con firmador server-side.", status: "completed", step: "signing" });
      document = (await loadDocument(tenant, documentId)) ?? document;
    } catch (error) {
      await (await createClient())
        .from("fiscal_documents")
        .update({ last_error: safeMessage(error, "Firma XAdES-EPES no configurada.") })
        .eq("empresa_id", tenant.empresaId)
        .eq("id", document.id)
        .eq("status", "xml_generated");

      return {
        documentId,
        finalStatus: "xml_generated",
        message: safeMessage(error, "Firma XAdES-EPES no configurada."),
        ok: false,
        steps: [...steps, { detail: "No se marca como firmado sin Signature real.", status: "blocked", step: "signing" }],
      };
    }
  }

  if (document.status === "signed") {
    try {
      const sendStatus = await sendToHacienda(tenant, document);
      steps.push({
        detail: `Envio Hacienda registrado con estado ${sendStatus}.`,
        status: sendStatus === "error" ? "failed" : "completed",
        step: "hacienda_send",
      });
      document = (await loadDocument(tenant, documentId)) ?? document;
    } catch (error) {
      await (await createClient())
        .from("fiscal_documents")
        .update({ last_error: safeMessage(error, "Cliente Hacienda no configurado.") })
        .eq("empresa_id", tenant.empresaId)
        .eq("id", document.id)
        .eq("status", "signed");

      return {
        documentId,
        finalStatus: "signed",
        message: safeMessage(error, "Cliente Hacienda no configurado."),
        ok: false,
        steps: [...steps, { detail: "No se envia sin cliente Hacienda real.", status: "blocked", step: "hacienda_send" }],
      };
    }
  }

  if (
    ["sent", "processing"].includes(document.status) ||
    ["recibido", "procesando"].includes(document.haciendaStatus)
  ) {
    try {
      const haciendaStatus = await queryHaciendaStatus(tenant, document);
      steps.push({
        detail: `Consulta Hacienda archivada con estado ${haciendaStatus}.`,
        status: haciendaStatus === "error" ? "failed" : "completed",
        step: "hacienda_status",
      });
      document = (await loadDocument(tenant, documentId)) ?? document;
    } catch (error) {
      await (await createClient())
        .from("fiscal_documents")
        .update({ last_error: safeMessage(error, "Consulta Hacienda no configurada.") })
        .eq("empresa_id", tenant.empresaId)
        .eq("id", document.id)
        .in("status", ["sent", "processing"]);

      return {
        documentId,
        finalStatus: document.status,
        message: safeMessage(error, "Consulta Hacienda no configurada."),
        ok: false,
        steps: [
          ...steps,
          { detail: "No se marca aceptado/rechazado sin respuesta oficial.", status: "blocked", step: "hacienda_status" },
        ],
      };
    }
  }

  return {
    documentId,
    finalStatus: document.status,
    message: "Flujo fiscal inmediato ejecutado hasta el ultimo paso disponible.",
    ok: true,
    steps,
  };
}
