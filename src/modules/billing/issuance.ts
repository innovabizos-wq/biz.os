import { createHash } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { getHaciendaClientForConnection } from "@/modules/billing/hacienda/client";
import { archiveOfficialHaciendaResponseXml } from "@/modules/billing/hacienda/artifacts";
import type { HaciendaStatusResult } from "@/modules/billing/hacienda/types";
import { getFiscalDocumentDetail, type FiscalDocumentDetail } from "@/modules/billing/queries";
import { generateFiscalClave } from "@/modules/billing/sequences";
import { getBillingXmlSigner } from "@/modules/billing/signing/signer";
import { validateFiscalDocumentReadyForXml } from "@/modules/billing/validation/validate-document";
import { buildUnsignedXmlFromFiscalDocument } from "@/modules/billing/xml/document";
import { validateFiscalXmlAgainstOfficialXsd } from "@/modules/billing/xml/validation";
import type { JsonRecord, TenantContext } from "@/types/core";

export type FiscalIssuanceStep =
  | "connection"
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

export type FiscalIssuanceWorkerContext = {
  leaseToken: string;
  outboxJobId: string;
};

type FiscalConnectionBindingRow = {
  fiscal_connection_id: string;
  provider_code: string;
  provider_environment: "testing" | "production";
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

export async function ensureFiscalDocumentConnection(
  tenant: TenantContext,
  document: FiscalDocumentDetail,
  workerContext?: FiscalIssuanceWorkerContext,
): Promise<FiscalDocumentDetail> {
  if (document.providerConnectionId) {
    if (!document.providerCode || !document.providerEnvironment || !document.providerBoundAt) {
      throw new Error("El documento tiene una asignación fiscal incompleta.");
    }
    if (document.providerEnvironment !== document.environment) {
      throw new Error("El ambiente de la conexión fiscal no coincide con el documento.");
    }
    return document;
  }

  const supabase = await createClient();
  const { data, error } = workerContext
    ? await supabase.rpc("bind_fiscal_document_connection_from_outbox", {
        p_document_id: document.id,
        p_job_id: workerContext.outboxJobId,
        p_lease_token: workerContext.leaseToken,
      })
    : await supabase.rpc("bind_fiscal_document_connection", {
        p_document_id: document.id,
      });
  if (error) throw new Error(`No se pudo fijar la conexión fiscal: ${error.message}`);

  const binding = ((data ?? []) as FiscalConnectionBindingRow[])[0];
  if (!binding?.fiscal_connection_id || !binding.provider_code || !binding.provider_environment) {
    throw new Error("La asignación fiscal no devolvió una conexión completa.");
  }

  const refreshed = await loadDocument(tenant, document.id);
  if (!refreshed || refreshed.providerConnectionId !== binding.fiscal_connection_id) {
    throw new Error("La conexión fiscal se asignó, pero el documento no pudo recargarse.");
  }
  return refreshed;
}

function haciendaBinding(document: FiscalDocumentDetail): {
  connectionId: string;
  environment: "testing" | "production";
} {
  if (document.providerCode !== "hacienda" || !document.providerConnectionId) {
    throw new Error("El proveedor asignado no tiene un adaptador de emisión disponible.");
  }
  if (document.providerEnvironment !== "testing" && document.providerEnvironment !== "production") {
    throw new Error("El documento no conserva un ambiente fiscal válido.");
  }
  const environment = document.providerEnvironment;
  return {
    connectionId: document.providerConnectionId,
    environment,
  };
}

async function ensureFiscalIdentity(
  tenant: TenantContext,
  document: FiscalDocumentDetail,
  workerContext?: FiscalIssuanceWorkerContext,
): Promise<FiscalDocumentDetail> {
  if (document.status !== "validated" || (document.clave && document.consecutivo)) {
    return document;
  }

  const identificationNumber = textFromRecord(document.issuerSnapshot, "identificationNumber");

  if (!identificationNumber) {
    throw new Error("Falta identificacion fiscal del emisor para generar clave numerica.");
  }

  const supabase = await createClient();
  const { data: sequenceData, error: sequenceError } = workerContext
    ? await supabase.rpc("reserve_fiscal_sequence_from_outbox", {
        p_branch_code: document.branchCode,
        p_document_type_code: document.documentTypeCode,
        p_environment: document.environment,
        p_job_id: workerContext.outboxJobId,
        p_lease_token: workerContext.leaseToken,
        p_terminal_code: document.terminalCode,
      })
    : await supabase.rpc("reserve_fiscal_sequence_for_current_company", {
        p_branch_code: document.branchCode,
        p_document_type_code: document.documentTypeCode,
        p_environment: document.environment,
        p_terminal_code: document.terminalCode,
      });

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
    pendingXsdValidation: true,
    xsdValidation: {
      enabled: true,
      errors: [],
      ok: false,
      validator: "awaiting-xades-signature",
      xsdVersion: "4.4",
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
  const binding = haciendaBinding(document);
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
    connectionId: binding.connectionId,
    empresaId: tenant.empresaId,
    unsignedXml: unsignedArtifact.content_text,
  });

  if (!hasXmlSignature(result.signedXml)) {
    throw new Error("La firma XML no contiene Signature; no se marca como firmado.");
  }

  const xsdValidation = await validateFiscalXmlAgainstOfficialXsd(result.signedXml);
  if (!xsdValidation.ok) {
    const message = xsdValidation.errors[0] ?? "XML firmado no valido contra XSD oficial 4.4.";
    await supabase
      .from("fiscal_documents")
      .update({
        last_error: message,
        status: "error_xml",
        validation_errors: xsdValidation.errors.map((validationError) => ({
          code: "signed_xsd_validation_error",
          group: "XML",
          message: validationError,
        })),
      })
      .eq("empresa_id", tenant.empresaId)
      .eq("id", document.id)
      .eq("status", "xml_generated");
    throw new Error(message);
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
    certificateExpiresAt: result.certificateExpiresAt,
    certificateSerialLast4: result.certificateSerialLast4,
    generatedAt: new Date().toISOString(),
    generatedBy: "runImmediateFiscalIssuance",
    signer: "BillingXmlSigner",
    xsdValidation,
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

  const xsdValidation = await validateFiscalXmlAgainstOfficialXsd(signedArtifact.content_text);
  if (!xsdValidation.ok) {
    throw new Error(xsdValidation.errors[0] ?? "El XML firmado no supera el XSD oficial 4.4.");
  }

  const issuerType = textFromRecord(document.issuerSnapshot, "identificationType");
  const issuerNumber = textFromRecord(document.issuerSnapshot, "identificationNumber");
  if (!issuerType || !issuerNumber) throw new Error("Falta identificacion completa del emisor para Hacienda.");
  const receiverType = document.receiverIdentificationType;
  const receiverNumber = textFromRecord(document.receiverSnapshot, "identificationNumber");
  const binding = haciendaBinding(document);
  const client = await getHaciendaClientForConnection(
    tenant.empresaId,
    binding.connectionId,
    binding.environment,
  );
  const sendResult = await client.sendSignedXml({
    clave: document.clave,
    emisor: { numeroIdentificacion: issuerNumber, tipoIdentificacion: issuerType },
    fecha: new Date(document.issueDatetime ?? document.createdAt).toISOString(),
    ...(receiverType && receiverNumber
      ? { receptor: { numeroIdentificacion: receiverNumber, tipoIdentificacion: receiverType } }
      : {}),
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
  const respondedAt = new Date().toISOString();
  await supabase
    .from("fiscal_documents")
    .update({
      hacienda_response_storage_path: responseStoragePath,
      hacienda_status: sendResult.status,
      last_error: sendResult.status === "error" ? "Hacienda retorno error en envio." : null,
      provider_document_id: document.clave,
      provider_last_response_at: respondedAt,
      provider_reference: document.clave,
      provider_status: sendResult.status,
      sent_at: sendResult.status === "error" ? null : respondedAt,
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

  const binding = haciendaBinding(document);
  const statusResult = await (
    await getHaciendaClientForConnection(
      tenant.empresaId,
      binding.connectionId,
      binding.environment,
    )
  ).queryStatus(document.clave);
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

  const officialResponsePath = await archiveOfficialHaciendaResponseXml({
    empresaId: tenant.empresaId,
    fiscalDocumentId: document.id,
    generatedBy: "runImmediateFiscalIssuance",
    responseXmlBase64: statusResult.responseXmlBase64,
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
      hacienda_response_storage_path: officialResponsePath ?? responseStoragePath,
      hacienda_status: statusResult.status,
      last_error: statusResult.status === "error" ? "Hacienda retorno error en consulta." : null,
      provider_last_response_at: now,
      provider_status: statusResult.status,
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
  workerContext?: FiscalIssuanceWorkerContext,
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
    document = await ensureFiscalDocumentConnection(tenant, document, workerContext);
    steps.push({
      detail: `Conexión ${document.providerCode ?? "fiscal"} fijada para este documento.`,
      status: "completed",
      step: "connection",
    });
  } catch (error) {
    return {
      documentId,
      finalStatus: document.status,
      message: safeMessage(error, "No se pudo fijar la conexión fiscal."),
      ok: false,
      steps: [
        ...steps,
        { detail: "La emisión se detuvo antes de usar un proveedor.", status: "blocked", step: "connection" },
      ],
    };
  }

  if (document.providerCode !== "hacienda") {
    return {
      documentId,
      finalStatus: document.status,
      message: `El proveedor ${document.providerCode ?? "desconocido"} no tiene un adaptador de emisión instalado.`,
      ok: false,
      steps: [
        ...steps,
        { detail: "La conexión se conserva sin enviar el documento.", status: "blocked", step: "connection" },
      ],
    };
  }

  try {
    document = await ensureFiscalIdentity(tenant, document, workerContext);
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
