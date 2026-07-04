"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { parseCabysImportText } from "@/modules/billing/cabys/import";
import { encryptSecret } from "@/modules/billing/crypto";
import { getHaciendaClient } from "@/modules/billing/hacienda/client";
import { runImmediateFiscalIssuance } from "@/modules/billing/issuance";
import { buildFiscalPrintableRepresentation } from "@/modules/billing/pdf/representation";
import { buildReceiverMessageXml } from "@/modules/billing/received/receiver-message";
import { parseReceivedFiscalXml } from "@/modules/billing/received/xml";
import { recoverPendingFiscalDocuments } from "@/modules/billing/recovery";
import { generateFiscalClave } from "@/modules/billing/sequences";
import { getBillingXmlSigner } from "@/modules/billing/signing/signer";
import { validateFiscalDocumentReadyForXml } from "@/modules/billing/validation/validate-document";
import {
  assignProductCabysSchema,
  fiscalConfigurationSchema,
  generateFiscalPdfRepresentationSchema,
  generateFiscalDocumentXmlSchema,
  importCabysCatalogSchema,
  issueFiscalDocumentNowSchema,
  issueInvoiceSchema,
  prepareFiscalDocumentFromSaleSchema,
  prepareReceiverMessageSchema,
  queryFiscalDocumentHaciendaStatusSchema,
  recoverPendingFiscalDocumentsSchema,
  registerReceivedFiscalXmlSchema,
  registerFiscalDocumentDeliverySchema,
  sendFiscalDocumentToHaciendaSchema,
  signFiscalDocumentXmlSchema,
} from "@/modules/billing/schemas";
import { getFiscalConfiguration, getFiscalDocumentDetail } from "@/modules/billing/queries";
import { buildUnsignedXmlFromFiscalDocument } from "@/modules/billing/xml/document";
import { validateFiscalXmlAgainstOfficialXsd } from "@/modules/billing/xml/validation";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import type { JsonRecord, TenantContext } from "@/types/core";

type RpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function redirectWithSuccess(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

function safeErrorMessage(error: RpcError) {
  return error.message?.replace(/\s+/g, " ").trim() ?? "No se pudo completar la accion.";
}

function buildFiscalValuePatch(value: JsonRecord, encrypted: JsonRecord) {
  const patch: JsonRecord = {
    actividadEconomica: value.actividadEconomica,
    ambiente: value.ambiente,
    correoEmisor: value.correoEmisor,
    identificacion: value.identificacion,
    razonSocial: value.razonSocial,
    sucursal: value.sucursal,
    terminal: value.terminal,
    tipoIdentificacion: value.tipoIdentificacion,
  };

  for (const key of [
    "haciendaPasswordEnc",
    "haciendaUsuarioEnc",
    "p12Base64Enc",
    "pinEnc",
  ]) {
    if (typeof encrypted[key] === "string" && encrypted[key]) {
      patch[key] = encrypted[key];
    }
  }

  return patch;
}

function normalizeFiscalEnvironment(value: "pruebas" | "produccion") {
  return value === "produccion" ? "production" : "testing";
}

function normalizeIdentification(value: string) {
  return value.replace(/\D/g, "") || value.trim();
}

function fiscalSecretRef(empresaId: string, name: "hacienda:password" | "hacienda:username" | "p12" | "pin") {
  return `company:${empresaId}:billing:fiscal:${name}`;
}

function textFromRecord(record: JsonRecord, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function boolFromRecord(record: JsonRecord, key: string) {
  return record[key] === true;
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

async function ensureFiscalIdentityForDocument(
  tenant: TenantContext,
  documentId: string,
  redirectPath: string,
) {
  const document = await getFiscalDocumentDetail(tenant, documentId);

  if (!document.ok || !document.data) {
    redirectWithError(redirectPath, "Documento fiscal no encontrado.");
  }

  if (document.data.status !== "validated") {
    return document.data;
  }

  if (document.data.clave && document.data.consecutivo) {
    return document.data;
  }

  const identificationNumber = textFromRecord(document.data.issuerSnapshot, "identificationNumber");

  if (!identificationNumber) {
    redirectWithError(
      redirectPath,
      "Falta identificacion fiscal del emisor para generar clave numerica.",
    );
  }

  const supabase = await createClient();
  const { data: sequenceData, error: sequenceError } = await supabase.rpc(
    "reserve_fiscal_sequence_for_current_company",
    {
      p_branch_code: document.data.branchCode,
      p_document_type_code: document.data.documentTypeCode,
      p_environment: document.data.environment,
      p_terminal_code: document.data.terminalCode,
    },
  );

  if (sequenceError) {
    redirectWithError(
      redirectPath,
      `No se pudo reservar consecutivo fiscal: ${safeErrorMessage(sequenceError)}`,
    );
  }

  const reservation = (sequenceData as
    | { consecutivo?: string; reservation_id?: string; sequence_number?: number }[]
    | null)?.[0];

  if (!reservation?.consecutivo || !reservation.reservation_id) {
    redirectWithError(redirectPath, "La reserva fiscal no retorno consecutivo.");
  }

  let clave: string;
  try {
    clave = generateFiscalClave({
      consecutivo: reservation.consecutivo,
      identificationNumber,
      issueDate: document.data.issueDatetime ?? document.data.createdAt,
    });
  } catch (error) {
    redirectWithError(
      redirectPath,
      error instanceof Error ? error.message : "No se pudo generar clave numerica.",
    );
  }

  const identityMetadata = {
    ...document.data.metadata,
    fiscalIdentityAssignedAt: new Date().toISOString(),
    fiscalSequenceReservationId: reservation.reservation_id,
    fiscalSequenceNumber: reservation.sequence_number ?? null,
  };

  const { data: updatedDocument, error: updateError } = await supabase
    .from("fiscal_documents")
    .update({
      clave,
      consecutivo: reservation.consecutivo,
      last_error: null,
      metadata: identityMetadata,
    })
    .select("id")
    .eq("empresa_id", tenant.empresaId)
    .eq("id", document.data.id)
    .eq("status", "validated")
    .is("clave", null)
    .is("consecutivo", null)
    .maybeSingle();

  if (updateError || !updatedDocument) {
    redirectWithError(
      redirectPath,
      "Se reservo consecutivo, pero no se pudo asignar clave al documento. Recarga e intenta de nuevo.",
    );
  }

  await supabase
    .from("fiscal_sequence_reservations")
    .update({
      clave,
      fiscal_document_id: document.data.id,
      status: "used",
      used_at: new Date().toISOString(),
    })
    .eq("empresa_id", tenant.empresaId)
    .eq("id", reservation.reservation_id);

  const refreshedDocument = await getFiscalDocumentDetail(tenant, documentId);

  if (!refreshedDocument.ok || !refreshedDocument.data) {
    redirectWithError(redirectPath, "No se pudo recargar el documento fiscal.");
  }

  return refreshedDocument.data;
}

export async function saveFiscalConfigurationAction(formData: FormData) {
  const parsed = fiscalConfigurationSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/admin/fiscal", "Completa la configuracion fiscal requerida.");
  }

  const access = await requireAdminAccess();

  if (!isModuleActive(access.tenant.activeModules, "billing")) {
    redirectWithError("/admin/fiscal", "El modulo Facturacion no esta activo.");
  }

  if (
    !hasAnyPermission(access.tenant.permissions, [
      "admin.settings.manage",
      "billing.fiscal.manage",
    ])
  ) {
    redirectWithError("/admin/fiscal", "No tienes permiso para guardar configuracion fiscal.");
  }

  let encrypted: JsonRecord;
  try {
    encrypted = {
      haciendaPasswordEnc: parsed.data.haciendaPassword
        ? encryptSecret(parsed.data.haciendaPassword)
        : undefined,
      haciendaUsuarioEnc: parsed.data.haciendaUsuario
        ? encryptSecret(parsed.data.haciendaUsuario)
        : undefined,
      p12Base64Enc: parsed.data.p12Base64 ? encryptSecret(parsed.data.p12Base64) : undefined,
      pinEnc: parsed.data.pin ? encryptSecret(parsed.data.pin) : undefined,
    };
  } catch {
    redirectWithError(
      "/admin/fiscal",
      "Falta FISCAL_CONFIG_ENCRYPTION_KEY para guardar secretos fiscales.",
    );
  }

  const supabase = await createClient();
  const { data: existingSettings } = await supabase
    .from("company_fiscal_settings")
    .select("hacienda_username_secret_ref, hacienda_password_secret_ref, certificate_secret_ref, certificate_pin_secret_ref")
    .eq("empresa_id", access.tenant.empresaId)
    .maybeSingle<{
      certificate_pin_secret_ref: string | null;
      certificate_secret_ref: string | null;
      hacienda_password_secret_ref: string | null;
      hacienda_username_secret_ref: string | null;
    }>();
  const value = buildFiscalValuePatch(parsed.data as unknown as JsonRecord, encrypted);
  const { data: savedFiscalConfig, error } = await supabase.rpc("guardar_configuracion_fiscal", {
    p_valor: value,
  });

  if (error) {
    redirectWithError("/admin/fiscal", "No se pudo guardar la configuracion fiscal.");
  }

  const redactedConfig = (savedFiscalConfig ?? {}) as JsonRecord;
  const haciendaUsernameRef =
    parsed.data.haciendaUsuario || boolFromRecord(redactedConfig, "hasHaciendaUsuario")
      ? fiscalSecretRef(access.tenant.empresaId, "hacienda:username")
      : existingSettings?.hacienda_username_secret_ref ?? null;
  const haciendaPasswordRef =
    parsed.data.haciendaPassword || boolFromRecord(redactedConfig, "hasHaciendaPassword")
      ? fiscalSecretRef(access.tenant.empresaId, "hacienda:password")
      : existingSettings?.hacienda_password_secret_ref ?? null;
  const certificateRef =
    parsed.data.p12Base64 || boolFromRecord(redactedConfig, "hasP12")
      ? fiscalSecretRef(access.tenant.empresaId, "p12")
      : existingSettings?.certificate_secret_ref ?? null;
  const certificatePinRef =
    parsed.data.pin || boolFromRecord(redactedConfig, "hasPin")
      ? fiscalSecretRef(access.tenant.empresaId, "pin")
      : existingSettings?.certificate_pin_secret_ref ?? null;
  const isComplete = Boolean(
    parsed.data.razonSocial &&
      parsed.data.identificacion &&
      parsed.data.correoEmisor &&
      parsed.data.actividadEconomica &&
      parsed.data.sucursal &&
      parsed.data.terminal &&
      haciendaUsernameRef &&
      haciendaPasswordRef &&
      certificateRef &&
      certificatePinRef,
  );

  const { error: structuredError } = await supabase.from("company_fiscal_settings").upsert(
    {
      branch_code: parsed.data.sucursal,
      certificate_pin_secret_ref: certificatePinRef,
      certificate_secret_ref: certificateRef,
      certificate_uploaded_at: parsed.data.p12Base64 ? new Date().toISOString() : undefined,
      default_currency: "CRC",
      email: parsed.data.correoEmisor,
      empresa_id: access.tenant.empresaId,
      environment: normalizeFiscalEnvironment(parsed.data.ambiente),
      hacienda_password_secret_ref: haciendaPasswordRef,
      hacienda_username_secret_ref: haciendaUsernameRef,
      identification_normalized: normalizeIdentification(parsed.data.identificacion),
      identification_number: parsed.data.identificacion,
      identification_type: parsed.data.tipoIdentificacion,
      is_complete: isComplete,
      last_error: null,
      last_validated_at: new Date().toISOString(),
      legal_name: parsed.data.razonSocial,
      main_activity_code: parsed.data.actividadEconomica,
      terminal_code: parsed.data.terminal,
    },
    {
      onConflict: "empresa_id",
    },
  );

  if (structuredError) {
    redirectWithError(
      "/admin/fiscal",
      "La configuracion fiscal se guardo, pero no se pudo sincronizar la base fiscal estructurada.",
    );
  }

  await supabase.rpc("recalcular_salud_modulos_empresa_actual");
  revalidatePath("/admin/fiscal");
  redirectWithSuccess("/admin/fiscal", "Configuracion fiscal guardada.");
}

export async function issueInvoiceFromSaleAction(formData: FormData) {
  const parsed = issueInvoiceSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/cotizaciones", "Completa los datos fiscales antes de emitir.");
  }

  const access = await requireAdminAccess();

  if (!isModuleActive(access.tenant.activeModules, "billing")) {
    redirectWithError("/cotizaciones", "El modulo Facturacion no esta activo.");
  }

  if (
    !hasAnyPermission(access.tenant.permissions, [
      "billing.issue",
      "billing.invoices.create",
    ])
  ) {
    redirectWithError("/cotizaciones", "No tienes permiso para emitir facturas.");
  }

  const fiscal = await getFiscalConfiguration(access.tenant);

  if (!fiscal.ok || !fiscal.data.listoParaEmitir) {
    redirectWithError(
      "/cotizaciones",
      "La configuracion fiscal esta incompleta. Revisa Admin > Fiscal.",
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("prepare_fiscal_document_from_sale", {
    p_document_type_code: "01",
    p_sale_id: parsed.data.ventaId,
  });

  if (error) {
    redirectWithError("/cotizaciones", `No se pudo preparar la factura: ${safeErrorMessage(error)}`);
  }

  const documentId = (data as { document_id?: string }[] | null)?.[0]?.document_id;

  if (!documentId) {
    redirectWithError("/cotizaciones", "La preparacion fiscal no retorno documento.");
  }

  const result = await runImmediateFiscalIssuance(access.tenant, documentId);
  const redirectPath = `/facturacion/documentos/${documentId}`;
  console.info("[billing-fiscal-issuance]", {
    documentId,
    empresaId: access.tenant.empresaId,
    finalStatus: result.finalStatus,
    ok: result.ok,
    source: "issueInvoiceFromSaleAction",
    steps: result.steps,
  });

  revalidatePath("/cotizaciones");
  revalidatePath("/ventas");
  revalidatePath("/facturacion");
  revalidatePath("/facturacion/documentos");
  revalidatePath(redirectPath);

  if (!result.ok) {
    redirectWithError(redirectPath, result.message);
  }

  redirectWithSuccess(redirectPath, result.message);
}

export async function prepareFiscalDocumentFromSaleAction(formData: FormData) {
  const parsed = prepareFiscalDocumentFromSaleSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/ventas", "Datos fiscales de venta invalidos.");
  }

  const access = await requireAdminAccess();
  const redirectPath = `/ventas/${parsed.data.ventaId}`;

  if (!isModuleActive(access.tenant.activeModules, "billing")) {
    redirectWithError(redirectPath, "El modulo Facturacion no esta activo.");
  }

  if (
    !hasAnyPermission(access.tenant.permissions, [
      "billing.issue",
      "billing.invoices.create",
    ])
  ) {
    redirectWithError(redirectPath, "No tienes permiso para preparar documentos fiscales.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("prepare_fiscal_document_from_sale", {
    p_document_type_code: parsed.data.documentTypeCode,
    p_sale_id: parsed.data.ventaId,
  });

  if (error) {
    redirectWithError(
      redirectPath,
      `No se pudo preparar el documento fiscal: ${safeErrorMessage(error)}`,
    );
  }

  const documentId = (data as { document_id?: string }[] | null)?.[0]?.document_id;

  revalidatePath(redirectPath);
  revalidatePath("/facturacion");
  revalidatePath("/facturacion/documentos");

  if (documentId) {
    redirect(`/facturacion/documentos/${documentId}`);
  }

  redirectWithSuccess(redirectPath, "Documento fiscal interno preparado.");
}

export async function generateFiscalDocumentXmlAction(formData: FormData) {
  const parsed = generateFiscalDocumentXmlSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/facturacion/documentos", "Documento fiscal invalido.");
  }

  const access = await requireAdminAccess();
  const redirectPath = `/facturacion/documentos/${parsed.data.documentId}`;

  if (!isModuleActive(access.tenant.activeModules, "billing")) {
    redirectWithError(redirectPath, "El modulo Facturacion no esta activo.");
  }

  if (
    !hasAnyPermission(access.tenant.permissions, [
      "billing.issue",
      "billing.invoices.create",
    ])
  ) {
    redirectWithError(redirectPath, "No tienes permiso para generar XML fiscal.");
  }

  const document = await ensureFiscalIdentityForDocument(
    access.tenant,
    parsed.data.documentId,
    redirectPath,
  );

  let unsignedXml;
  const documentValidation = await validateFiscalDocumentReadyForXml(access.tenant, document);

  if (!documentValidation.ok) {
    const firstIssue = documentValidation.issues[0];
    await (await createClient())
      .from("fiscal_documents")
      .update({
        last_error: firstIssue?.message ?? "Documento fiscal invalido para XML.",
        status: "error_validation",
        validation_errors: documentValidation.issues,
      })
      .eq("empresa_id", access.tenant.empresaId)
      .eq("id", document.id)
      .eq("status", "validated");
    revalidatePath(redirectPath);
    redirectWithError(redirectPath, firstIssue?.message ?? "Documento fiscal invalido para XML.");
  }

  try {
    unsignedXml = buildUnsignedXmlFromFiscalDocument(document);
  } catch (error) {
    redirectWithError(
      redirectPath,
      error instanceof Error ? error.message : "No se pudo generar el XML fiscal.",
    );
  }

  let xmlValidation;
  try {
    xmlValidation = await validateFiscalXmlAgainstOfficialXsd(unsignedXml.xml);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Validacion XSD XML 4.4 no configurada.";
    await (await createClient())
      .from("fiscal_documents")
      .update({
        last_error: message,
        status: "error_xml",
        validation_errors: [{ code: "xsd_validator_not_configured", group: "XML", message }],
      })
      .eq("empresa_id", access.tenant.empresaId)
      .eq("id", document.id)
      .eq("status", "validated");
    revalidatePath(redirectPath);
    redirectWithError(redirectPath, message);
  }

  if (xmlValidation.enabled && !xmlValidation.ok) {
    const message = xmlValidation.errors[0] ?? "XML no valido contra XSD oficial.";
    await (await createClient())
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
      .eq("empresa_id", access.tenant.empresaId)
      .eq("id", document.id)
      .eq("status", "validated");
    revalidatePath(redirectPath);
    redirectWithError(redirectPath, message);
  }

  const storagePath = [
    "billing",
    access.tenant.empresaId,
    "fiscal-documents",
    document.id,
    "unsigned.xml",
  ].join("/");
  const xmlHash = createHash("sha256").update(unsignedXml.xml).digest("hex");
  const metadata = {
    generatedBy: "generateFiscalDocumentXmlAction",
    generatedAt: new Date().toISOString(),
    pendingXsdValidation: xmlValidation.pendingXsdValidation,
    xsdValidation: {
      enabled: xmlValidation.enabled,
      errors: xmlValidation.errors,
      ok: xmlValidation.ok,
      validator: xmlValidation.validator,
      xsdVersion: xmlValidation.xsdVersion,
    },
  };

  const supabase = await createClient();
  const { error: artifactError } = await supabase.from("fiscal_document_artifacts").insert({
    artifact_type: "xml_unsigned",
    content_mime_type: "application/xml",
    content_text: unsignedXml.xml,
    empresa_id: access.tenant.empresaId,
    fiscal_document_id: document.id,
    metadata,
    sha256: xmlHash,
    status: "generated",
    storage_path: storagePath,
  });

  if (artifactError) {
    redirectWithError(redirectPath, "No se pudo guardar el artefacto XML interno.");
  }

  const { error: updateError } = await supabase
    .from("fiscal_documents")
    .update({
      last_error: null,
      metadata: { ...document.metadata, ...metadata },
      status: "xml_generated",
      xml_unsigned_storage_path: storagePath,
    })
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", document.id)
    .eq("status", "validated");

  if (updateError) {
    redirectWithError(redirectPath, "El XML se guardo, pero no se pudo actualizar el documento.");
  }

  revalidatePath("/facturacion");
  revalidatePath("/facturacion/documentos");
  revalidatePath(redirectPath);
  redirectWithSuccess(redirectPath, "XML sin firmar generado como artefacto interno.");
}

export async function signFiscalDocumentXmlAction(formData: FormData) {
  const parsed = signFiscalDocumentXmlSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/facturacion/documentos", "Documento fiscal invalido.");
  }

  const access = await requireAdminAccess();
  const redirectPath = `/facturacion/documentos/${parsed.data.documentId}`;

  if (!isModuleActive(access.tenant.activeModules, "billing")) {
    redirectWithError(redirectPath, "El modulo Facturacion no esta activo.");
  }

  if (
    !hasAnyPermission(access.tenant.permissions, [
      "billing.issue",
      "billing.invoices.create",
    ])
  ) {
    redirectWithError(redirectPath, "No tienes permiso para firmar XML fiscal.");
  }

  const document = await getFiscalDocumentDetail(access.tenant, parsed.data.documentId);

  if (!document.ok || !document.data) {
    redirectWithError(redirectPath, "Documento fiscal no encontrado.");
  }

  if (document.data.status !== "xml_generated" || !document.data.xmlUnsignedStoragePath) {
    redirectWithError(redirectPath, "Primero debes generar el XML sin firmar.");
  }

  const supabase = await createClient();
  const { data: unsignedArtifact, error: artifactError } = await supabase
    .from("fiscal_document_artifacts")
    .select("content_text")
    .eq("empresa_id", access.tenant.empresaId)
    .eq("fiscal_document_id", document.data.id)
    .eq("artifact_type", "xml_unsigned")
    .eq("status", "generated")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ content_text: string | null }>();

  if (artifactError || !unsignedArtifact?.content_text) {
    redirectWithError(redirectPath, "No se encontro el XML sin firmar archivado.");
  }

  let signedXml: string;
  let algorithm: string;
  try {
    const result = await getBillingXmlSigner().sign({
      certificateSecretRef: `company:${access.tenant.empresaId}:billing:fiscal:p12`,
      pinSecretRef: `company:${access.tenant.empresaId}:billing:fiscal:pin`,
      unsignedXml: unsignedArtifact.content_text,
    });
    signedXml = result.signedXml;
    algorithm = result.algorithm;
  } catch (error) {
    redirectWithError(
      redirectPath,
      error instanceof Error
        ? error.message
        : "Firma XAdES-EPES no configurada: no se puede marcar XML como firmado sin una firma real.",
    );
  }

  if (!hasXmlSignature(signedXml)) {
    redirectWithError(redirectPath, "La firma XML no contiene Signature; no se marca como firmado.");
  }

  const storagePath = [
    "billing",
    access.tenant.empresaId,
    "fiscal-documents",
    document.data.id,
    "signed.xml",
  ].join("/");
  const signedHash = createHash("sha256").update(signedXml).digest("hex");
  const metadata = {
    algorithm,
    generatedAt: new Date().toISOString(),
    generatedBy: "signFiscalDocumentXmlAction",
    signer: "BillingXmlSigner",
  };

  const { error: signedArtifactError } = await supabase.from("fiscal_document_artifacts").insert({
    artifact_type: "xml_signed",
    content_mime_type: "application/xml",
    content_text: signedXml,
    empresa_id: access.tenant.empresaId,
    fiscal_document_id: document.data.id,
    metadata,
    sha256: signedHash,
    status: "generated",
    storage_path: storagePath,
  });

  if (signedArtifactError) {
    redirectWithError(redirectPath, "No se pudo archivar el XML firmado.");
  }

  const { error: updateError } = await supabase
    .from("fiscal_documents")
    .update({
      last_error: null,
      metadata: { ...document.data.metadata, ...metadata },
      status: "signed",
      xml_signed_storage_path: storagePath,
    })
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", document.data.id)
    .eq("status", "xml_generated");

  if (updateError) {
    redirectWithError(redirectPath, "El XML firmado se archivo, pero no se pudo actualizar el documento.");
  }

  revalidatePath("/facturacion");
  revalidatePath("/facturacion/documentos");
  revalidatePath(redirectPath);
  redirectWithSuccess(redirectPath, "XML firmado archivado. Pendiente envio a Hacienda.");
}

export async function sendFiscalDocumentToHaciendaAction(formData: FormData) {
  const parsed = sendFiscalDocumentToHaciendaSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/facturacion/documentos", "Documento fiscal invalido.");
  }

  const access = await requireAdminAccess();
  const redirectPath = `/facturacion/documentos/${parsed.data.documentId}`;

  if (!isModuleActive(access.tenant.activeModules, "billing")) {
    redirectWithError(redirectPath, "El modulo Facturacion no esta activo.");
  }

  if (
    !hasAnyPermission(access.tenant.permissions, [
      "billing.issue",
      "billing.invoices.create",
    ])
  ) {
    redirectWithError(redirectPath, "No tienes permiso para enviar XML a Hacienda.");
  }

  const document = await getFiscalDocumentDetail(access.tenant, parsed.data.documentId);

  if (!document.ok || !document.data) {
    redirectWithError(redirectPath, "Documento fiscal no encontrado.");
  }

  if (document.data.status !== "signed") {
    redirectWithError(redirectPath, "Solo se puede enviar a Hacienda un XML firmado realmente.");
  }

  if (!document.data.clave) {
    redirectWithError(redirectPath, "Falta clave numerica para enviar a Hacienda.");
  }

  const supabase = await createClient();
  const { data: signedArtifact, error: artifactError } = await supabase
    .from("fiscal_document_artifacts")
    .select("content_text")
    .eq("empresa_id", access.tenant.empresaId)
    .eq("fiscal_document_id", document.data.id)
    .eq("artifact_type", "xml_signed")
    .eq("status", "generated")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ content_text: string | null }>();

  if (artifactError || !signedArtifact?.content_text || !hasXmlSignature(signedArtifact.content_text)) {
    redirectWithError(redirectPath, "No se encontro un XML firmado valido para enviar.");
  }

  let sendResult;
  try {
    sendResult = await getHaciendaClient().sendSignedXml({
      clave: document.data.clave,
      signedXml: signedArtifact.content_text,
    });
  } catch (error) {
    redirectWithError(
      redirectPath,
      error instanceof Error
        ? error.message
        : "Cliente Hacienda no configurado: no se puede enviar XML sin OAuth y endpoint real.",
    );
  }

  const responseText = safeJsonText(sendResult.rawResponse);
  const responseHash = createHash("sha256").update(responseText).digest("hex");
  const responseStoragePath = [
    "billing",
    access.tenant.empresaId,
    "fiscal-documents",
    document.data.id,
    "hacienda-send-response.json",
  ].join("/");

  const { error: responseArtifactError } = await supabase.from("fiscal_document_artifacts").insert({
    artifact_type: "hacienda_response",
    content_mime_type: "application/json",
    content_text: responseText,
    empresa_id: access.tenant.empresaId,
    fiscal_document_id: document.data.id,
    metadata: {
      generatedAt: new Date().toISOString(),
      generatedBy: "sendFiscalDocumentToHaciendaAction",
      phase: "send",
    },
    sha256: responseHash,
    status: sendResult.status === "error" ? "error" : "stored",
    storage_path: responseStoragePath,
  });

  if (responseArtifactError) {
    redirectWithError(redirectPath, "Hacienda respondio, pero no se pudo archivar la respuesta.");
  }

  const nextStatus = sendResult.status === "error" ? "error_sending" : "sent";
  const { error: updateError } = await supabase
    .from("fiscal_documents")
    .update({
      hacienda_response_storage_path: responseStoragePath,
      hacienda_status: sendResult.status,
      last_error: sendResult.status === "error" ? "Hacienda retorno error en envio." : null,
      sent_at: sendResult.status === "error" ? null : new Date().toISOString(),
      status: nextStatus,
    })
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", document.data.id)
    .eq("status", "signed");

  if (updateError) {
    redirectWithError(redirectPath, "La respuesta se archivo, pero no se pudo actualizar el documento.");
  }

  revalidatePath("/facturacion");
  revalidatePath("/facturacion/documentos");
  revalidatePath(redirectPath);
  redirectWithSuccess(
    redirectPath,
    sendResult.status === "error"
      ? "Hacienda retorno error. No se marca como aceptado."
      : "XML firmado enviado a Hacienda. Aceptacion oficial queda pendiente de consulta.",
  );
}

export async function queryFiscalDocumentHaciendaStatusAction(formData: FormData) {
  const parsed = queryFiscalDocumentHaciendaStatusSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/facturacion/documentos", "Documento fiscal invalido.");
  }

  const access = await requireAdminAccess();
  const redirectPath = `/facturacion/documentos/${parsed.data.documentId}`;

  if (!isModuleActive(access.tenant.activeModules, "billing")) {
    redirectWithError(redirectPath, "El modulo Facturacion no esta activo.");
  }

  if (
    !hasAnyPermission(access.tenant.permissions, [
      "billing.issue",
      "billing.invoices.create",
    ])
  ) {
    redirectWithError(redirectPath, "No tienes permiso para consultar Hacienda.");
  }

  const document = await getFiscalDocumentDetail(access.tenant, parsed.data.documentId);

  if (!document.ok || !document.data) {
    redirectWithError(redirectPath, "Documento fiscal no encontrado.");
  }

  if (!document.data.clave) {
    redirectWithError(redirectPath, "Falta clave numerica para consultar Hacienda.");
  }

  if (
    !["sent", "processing"].includes(document.data.status) &&
    !["recibido", "procesando"].includes(document.data.haciendaStatus)
  ) {
    redirectWithError(redirectPath, "Solo se consulta Hacienda despues de enviar un XML firmado.");
  }

  let statusResult;
  try {
    statusResult = await getHaciendaClient().queryStatus(document.data.clave);
  } catch (error) {
    redirectWithError(
      redirectPath,
      error instanceof Error
        ? error.message
        : "Cliente Hacienda no configurado: no se puede consultar estado sin integracion real.",
    );
  }

  const responseText = safeJsonText(statusResult.rawResponse);
  const responseHash = createHash("sha256").update(responseText).digest("hex");
  const responseStoragePath = [
    "billing",
    access.tenant.empresaId,
    "fiscal-documents",
    document.data.id,
    "hacienda-status-response.json",
  ].join("/");
  const supabase = await createClient();

  const { error: responseArtifactError } = await supabase.from("fiscal_document_artifacts").insert({
    artifact_type: "hacienda_response",
    content_mime_type: "application/json",
    content_text: responseText,
    empresa_id: access.tenant.empresaId,
    fiscal_document_id: document.data.id,
    metadata: {
      generatedAt: new Date().toISOString(),
      generatedBy: "queryFiscalDocumentHaciendaStatusAction",
      phase: "status",
    },
    sha256: responseHash,
    status: statusResult.status === "error" ? "error" : "stored",
    storage_path: responseStoragePath,
  });

  if (responseArtifactError) {
    redirectWithError(redirectPath, "Hacienda respondio, pero no se pudo archivar la consulta.");
  }

  const documentStatusByHaciendaStatus: Record<typeof statusResult.status, string> = {
    aceptado: "accepted",
    desconocido: "processing",
    error: "error_sending",
    procesando: "processing",
    rechazado: "rejected",
  };
  const nextStatus = documentStatusByHaciendaStatus[statusResult.status];
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("fiscal_documents")
    .update({
      accepted_at: statusResult.status === "aceptado" ? now : null,
      hacienda_response_storage_path: responseStoragePath,
      hacienda_status: statusResult.status,
      last_error: statusResult.status === "error" ? "Hacienda retorno error en consulta." : null,
      rejected_at: statusResult.status === "rechazado" ? now : null,
      status: nextStatus,
    })
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", document.data.id)
    .in("status", ["sent", "processing"]);

  if (updateError) {
    redirectWithError(redirectPath, "La consulta se archivo, pero no se pudo actualizar el documento.");
  }

  revalidatePath("/facturacion");
  revalidatePath("/facturacion/documentos");
  revalidatePath(redirectPath);
  redirectWithSuccess(
    redirectPath,
    statusResult.status === "aceptado"
      ? "Hacienda acepto el documento fiscal."
      : statusResult.status === "rechazado"
        ? "Hacienda rechazo el documento fiscal. Revisa la respuesta archivada."
        : "Consulta Hacienda archivada. El documento sigue pendiente o con error.",
  );
}

export async function issueFiscalDocumentNowAction(formData: FormData) {
  const parsed = issueFiscalDocumentNowSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/facturacion/documentos", "Documento fiscal invalido.");
  }

  const access = await requireAdminAccess();
  const redirectPath = `/facturacion/documentos/${parsed.data.documentId}`;

  if (!isModuleActive(access.tenant.activeModules, "billing")) {
    redirectWithError(redirectPath, "El modulo Facturacion no esta activo.");
  }

  if (
    !hasAnyPermission(access.tenant.permissions, [
      "billing.issue",
      "billing.invoices.create",
    ])
  ) {
    redirectWithError(redirectPath, "No tienes permiso para emitir documentos fiscales.");
  }

  const result = await runImmediateFiscalIssuance(access.tenant, parsed.data.documentId);
  console.info("[billing-fiscal-issuance]", {
    documentId: parsed.data.documentId,
    empresaId: access.tenant.empresaId,
    finalStatus: result.finalStatus,
    ok: result.ok,
    steps: result.steps,
  });

  revalidatePath("/facturacion");
  revalidatePath("/facturacion/documentos");
  revalidatePath(redirectPath);

  if (!result.ok) {
    redirectWithError(redirectPath, result.message);
  }

  redirectWithSuccess(redirectPath, result.message);
}

export async function recoverPendingFiscalDocumentsAction(formData: FormData) {
  const parsed = recoverPendingFiscalDocumentsSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/facturacion/reportes", "Solicitud de recuperacion fiscal invalida.");
  }

  const access = await requireAdminAccess();

  if (!isModuleActive(access.tenant.activeModules, "billing")) {
    redirectWithError("/facturacion/reportes", "El modulo Facturacion no esta activo.");
  }

  if (
    !hasAnyPermission(access.tenant.permissions, [
      "billing.issue",
      "billing.invoices.create",
      "billing.reports.view",
    ])
  ) {
    redirectWithError("/facturacion/reportes", "No tienes permiso para recuperar documentos fiscales.");
  }

  const summary = await recoverPendingFiscalDocuments(access.tenant, parsed.data.limit);
  console.info("[billing-fiscal-recovery]", {
    empresaId: access.tenant.empresaId,
    ...summary,
  });

  revalidatePath("/facturacion");
  revalidatePath("/facturacion/documentos");
  revalidatePath("/facturacion/reportes");

  if (summary.errors.length) {
    redirectWithError(
      "/facturacion/reportes",
      `Recuperacion reviso ${summary.reviewed} documento(s), actualizo ${summary.updated} y tuvo ${summary.errors.length} error(es).`,
    );
  }

  redirectWithSuccess(
    "/facturacion/reportes",
    `Recuperacion fiscal: ${summary.reviewed} revisado(s), ${summary.updated} actualizado(s), ${summary.skipped} omitido(s).`,
  );
}

export async function generateFiscalPdfRepresentationAction(formData: FormData) {
  const parsed = generateFiscalPdfRepresentationSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/facturacion/documentos", "Documento fiscal invalido.");
  }

  const access = await requireAdminAccess();
  const redirectPath = `/facturacion/documentos/${parsed.data.documentId}`;

  if (!isModuleActive(access.tenant.activeModules, "billing")) {
    redirectWithError(redirectPath, "El modulo Facturacion no esta activo.");
  }

  if (
    !hasAnyPermission(access.tenant.permissions, [
      "billing.issue",
      "billing.invoices.create",
      "billing.view",
      "billing.invoices.view",
    ])
  ) {
    redirectWithError(redirectPath, "No tienes permiso para preparar representacion fiscal.");
  }

  const document = await getFiscalDocumentDetail(access.tenant, parsed.data.documentId);

  if (!document.ok || !document.data) {
    redirectWithError(redirectPath, "Documento fiscal no encontrado.");
  }

  if (!document.data.clave || !document.data.consecutivo) {
    redirectWithError(
      redirectPath,
      "Primero debes generar clave y consecutivo antes de preparar representacion grafica.",
    );
  }

  const html = buildFiscalPrintableRepresentation(document.data);
  const storagePath = [
    "billing",
    access.tenant.empresaId,
    "fiscal-documents",
    document.data.id,
    "representacion-grafica.html",
  ].join("/");
  const hash = createHash("sha256").update(html).digest("hex");
  const metadata = {
    generatedAt: new Date().toISOString(),
    generatedBy: "generateFiscalPdfRepresentationAction",
    notOfficialInvoice: true,
    pendingPdfEngine: true,
  };

  const supabase = await createClient();
  const { error } = await supabase.from("fiscal_document_artifacts").insert({
    artifact_type: "pdf_representation",
    content_mime_type: "text/html",
    content_text: html,
    empresa_id: access.tenant.empresaId,
    fiscal_document_id: document.data.id,
    metadata,
    sha256: hash,
    status: "generated",
    storage_path: storagePath,
  });

  if (error) {
    redirectWithError(redirectPath, "No se pudo archivar la representacion grafica fiscal.");
  }

  revalidatePath("/facturacion");
  revalidatePath("/facturacion/documentos");
  revalidatePath(redirectPath);
  redirectWithSuccess(redirectPath, "Representacion grafica fiscal archivada.");
}

export async function registerFiscalDocumentDeliveryAction(formData: FormData) {
  const parsed = registerFiscalDocumentDeliverySchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/facturacion/documentos", "Datos de entrega fiscal invalidos.");
  }

  const access = await requireAdminAccess();
  const redirectPath = `/facturacion/documentos/${parsed.data.documentId}`;

  if (!isModuleActive(access.tenant.activeModules, "billing")) {
    redirectWithError(redirectPath, "El modulo Facturacion no esta activo.");
  }

  if (
    !hasAnyPermission(access.tenant.permissions, [
      "billing.issue",
      "billing.invoices.create",
      "billing.view",
      "billing.invoices.view",
    ])
  ) {
    redirectWithError(redirectPath, "No tienes permiso para registrar entrega fiscal.");
  }

  const document = await getFiscalDocumentDetail(access.tenant, parsed.data.documentId);

  if (!document.ok || !document.data) {
    redirectWithError(redirectPath, "Documento fiscal no encontrado.");
  }

  const recipientEmail =
    parsed.data.recipientEmail || document.data.receiverEmail || "sin-correo@local.invalid";

  const supabase = await createClient();
  const { error } = await supabase.from("fiscal_document_deliveries").insert({
    delivery_type: parsed.data.deliveryType,
    empresa_id: access.tenant.empresaId,
    fiscal_document_id: document.data.id,
    metadata: {
      registeredAt: new Date().toISOString(),
      registeredBy: "registerFiscalDocumentDeliveryAction",
      sendsEmail: false,
    },
    recipient_email: recipientEmail,
    sent_at: parsed.data.deliveryType === "download" ? new Date().toISOString() : null,
    status: parsed.data.deliveryType === "download" ? "sent" : "pending",
  });

  if (error) {
    redirectWithError(redirectPath, "No se pudo registrar la entrega fiscal.");
  }

  revalidatePath(redirectPath);
  redirectWithSuccess(redirectPath, "Entrega fiscal registrada sin envio automatico.");
}

export async function registerReceivedFiscalXmlAction(formData: FormData) {
  const parsed = registerReceivedFiscalXmlSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/facturacion/recepcion", "Pega un XML fiscal valido para registrar.");
  }

  const access = await requireAdminAccess();

  if (!isModuleActive(access.tenant.activeModules, "billing")) {
    redirectWithError("/facturacion/recepcion", "El modulo Facturacion no esta activo.");
  }

  if (
    !hasAnyPermission(access.tenant.permissions, [
      "billing.receive",
      "billing.issue",
      "billing.invoices.create",
    ])
  ) {
    redirectWithError("/facturacion/recepcion", "No tienes permiso para registrar XML recibido.");
  }

  const xmlText = parsed.data.xmlText;
  const parsedXml = parseReceivedFiscalXml(xmlText);
  const xmlHash = createHash("sha256").update(xmlText).digest("hex");
  const status = parsedXml.validationErrors.length ? "error" : "pending";
  const storagePath = [
    "billing",
    access.tenant.empresaId,
    "received-documents",
    parsedXml.clave ?? xmlHash,
    "received.xml",
  ].join("/");

  const supabase = await createClient();
  const { data: receivedDocument, error: insertError } = await supabase
    .from("fiscal_received_documents")
    .insert({
      clave: parsedXml.clave,
      consecutivo: parsedXml.consecutivo,
      currency_code: parsedXml.currencyCode ?? "CRC",
      empresa_id: access.tenant.empresaId,
      hacienda_status: parsedXml.haciendaStatus,
      issuer_identification: parsedXml.issuerIdentification,
      issuer_name: parsedXml.issuerName,
      issue_datetime: parsedXml.issueDatetime,
      parsed_data: {
        ...parsedXml.parsedData,
        sha256: xmlHash,
        xmlStoragePath: storagePath,
      },
      receiver_response_status: status,
      total_amount: parsedXml.totalAmount,
      validation_errors: parsedXml.validationErrors,
      xml_storage_path: storagePath,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (insertError || !receivedDocument) {
    redirectWithError(
      "/facturacion/recepcion",
      "No se pudo registrar el XML recibido. Verifica si la clave ya existe.",
    );
  }

  const { error: artifactError } = await supabase
    .from("fiscal_received_document_artifacts")
    .insert({
      artifact_type: "xml_received",
      content_mime_type: "application/xml",
      content_text: xmlText,
      empresa_id: access.tenant.empresaId,
      fiscal_received_document_id: receivedDocument.id,
      metadata: {
        registeredAt: new Date().toISOString(),
        registeredBy: "registerReceivedFiscalXmlAction",
        pendingReceiverMessage: true,
        pendingXsdValidation: true,
      },
      sha256: xmlHash,
      status: "stored",
      storage_path: storagePath,
    });

  if (artifactError) {
    redirectWithError(
      "/facturacion/recepcion",
      "El XML recibido se registro, pero no se pudo archivar el artefacto.",
    );
  }

  revalidatePath("/facturacion");
  revalidatePath("/facturacion/recepcion");
  redirectWithSuccess(
    "/facturacion/recepcion",
    status === "pending"
      ? "XML recibido registrado. Mensaje receptor a Hacienda queda pendiente."
      : "XML recibido registrado con errores de validacion.",
  );
}

export async function prepareReceiverMessageAction(formData: FormData) {
  const parsed = prepareReceiverMessageSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/facturacion/recepcion", "Datos de mensaje receptor invalidos.");
  }

  const access = await requireAdminAccess();

  if (!isModuleActive(access.tenant.activeModules, "billing")) {
    redirectWithError("/facturacion/recepcion", "El modulo Facturacion no esta activo.");
  }

  if (
    !hasAnyPermission(access.tenant.permissions, [
      "billing.receive",
      "billing.issue",
      "billing.invoices.create",
    ])
  ) {
    redirectWithError("/facturacion/recepcion", "No tienes permiso para preparar mensaje receptor.");
  }

  const supabase = await createClient();
  const { data: receivedDocument, error: documentError } = await supabase
    .from("fiscal_received_documents")
    .select("id, clave, consecutivo, issuer_identification, parsed_data, total_amount, receiver_response_status, validation_errors")
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", parsed.data.receivedDocumentId)
    .maybeSingle<{
      clave: string | null;
      consecutivo: string | null;
      id: string;
      issuer_identification: string | null;
      parsed_data: JsonRecord | null;
      receiver_response_status: string;
      total_amount: number | null;
      validation_errors: unknown[] | null;
    }>();

  if (documentError || !receivedDocument) {
    redirectWithError("/facturacion/recepcion", "Documento recibido no encontrado.");
  }

  if (!receivedDocument.clave || !/^\d{50}$/.test(receivedDocument.clave)) {
    redirectWithError("/facturacion/recepcion", "Falta clave valida para preparar mensaje receptor.");
  }

  if (receivedDocument.validation_errors?.length) {
    redirectWithError(
      "/facturacion/recepcion",
      "No se prepara mensaje receptor para XML recibido con errores de validacion.",
    );
  }

  if (receivedDocument.receiver_response_status === "sent") {
    redirectWithError("/facturacion/recepcion", "El mensaje receptor ya fue marcado como enviado.");
  }

  const { data: existingMessage } = await supabase
    .from("fiscal_received_document_artifacts")
    .select("id")
    .eq("empresa_id", access.tenant.empresaId)
    .eq("fiscal_received_document_id", receivedDocument.id)
    .eq("artifact_type", "receiver_message")
    .eq("status", "generated")
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingMessage) {
    redirectWithError("/facturacion/recepcion", "Ya existe un mensaje receptor preparado.");
  }

  const generatedAt = new Date().toISOString();
  const receiverMessageXml = buildReceiverMessageXml({
    clave: receivedDocument.clave,
    consecutive: receivedDocument.consecutivo,
    detail: parsed.data.detail ?? "Mensaje receptor preparado internamente. Envio real pendiente.",
    generatedAt,
    issuerIdentification: receivedDocument.issuer_identification,
    status: parsed.data.responseStatus,
    totalAmount: receivedDocument.total_amount,
  });
  const hash = createHash("sha256").update(receiverMessageXml).digest("hex");
  const storagePath = [
    "billing",
    access.tenant.empresaId,
    "received-documents",
    receivedDocument.clave,
    "receiver-message.xml",
  ].join("/");

  const { error: artifactError } = await supabase
    .from("fiscal_received_document_artifacts")
    .insert({
      artifact_type: "receiver_message",
      content_mime_type: "application/xml",
      content_text: receiverMessageXml,
      empresa_id: access.tenant.empresaId,
      fiscal_received_document_id: receivedDocument.id,
      metadata: {
        generatedAt,
        generatedBy: "prepareReceiverMessageAction",
        pendingHaciendaSend: true,
        pendingSignature: true,
      },
      sha256: hash,
      status: "generated",
      storage_path: storagePath,
    });

  if (artifactError) {
    redirectWithError("/facturacion/recepcion", "No se pudo archivar el mensaje receptor.");
  }

  const { error: updateError } = await supabase
    .from("fiscal_received_documents")
    .update({
      parsed_data: {
        ...(receivedDocument.parsed_data ?? {}),
        receiverMessagePreparedAt: generatedAt,
        receiverMessageStoragePath: storagePath,
        receiverMessageStatus: parsed.data.responseStatus,
      },
      receiver_response_status: parsed.data.responseStatus,
    })
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", receivedDocument.id)
    .neq("receiver_response_status", "sent");

  if (updateError) {
    redirectWithError(
      "/facturacion/recepcion",
      "El mensaje receptor se archivo, pero no se pudo actualizar el documento.",
    );
  }

  revalidatePath("/facturacion");
  revalidatePath("/facturacion/recepcion");
  redirectWithSuccess(
    "/facturacion/recepcion",
    "Mensaje receptor preparado como artefacto interno. Envio a Hacienda pendiente.",
  );
}

export async function assignProductCabysAction(formData: FormData) {
  const parsed = assignProductCabysSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/facturacion/cabys", "Datos CABYS invalidos.");
  }

  const access = await requireAdminAccess();

  if (!isModuleActive(access.tenant.activeModules, "billing")) {
    redirectWithError("/facturacion/cabys", "El modulo Facturacion no esta activo.");
  }

  if (!hasAnyPermission(access.tenant.permissions, ["billing.cabys.manage"])) {
    redirectWithError("/facturacion/cabys", "No tienes permiso para gestionar CABYS.");
  }

  const supabase = await createClient();
  const [{ data: product }, { data: cabys }] = await Promise.all([
    supabase
      .from("catalogo_productos")
      .select("id")
      .eq("empresa_id", access.tenant.empresaId)
      .eq("id", parsed.data.productId)
      .maybeSingle<{ id: string }>(),
    supabase
      .from("cabys_catalog")
      .select("code")
      .eq("code", parsed.data.cabysCode)
      .maybeSingle<{ code: string }>(),
  ]);

  if (!product) {
    redirectWithError("/facturacion/cabys", "Producto no encontrado en la empresa actual.");
  }

  if (!cabys) {
    redirectWithError(
      "/facturacion/cabys",
      "Codigo CABYS no existe en el catalogo importado. No se crean codigos falsos.",
    );
  }

  const { error } = await supabase.from("catalog_product_fiscal_profile").upsert(
    {
      cabys_code: parsed.data.cabysCode,
      empresa_id: access.tenant.empresaId,
      fiscal_notes: parsed.data.fiscalNotes ?? null,
      fiscal_unit_code: parsed.data.fiscalUnitCode ?? null,
      product_id: parsed.data.productId,
    },
    {
      onConflict: "empresa_id,product_id",
    },
  );

  if (error) {
    redirectWithError("/facturacion/cabys", "No se pudo guardar el perfil fiscal del producto.");
  }

  revalidatePath("/facturacion/cabys");
  revalidatePath(`/catalogo/productos/${parsed.data.productId}`);
  redirectWithSuccess("/facturacion/cabys", "CABYS asignado al producto.");
}

export async function importCabysCatalogAction(formData: FormData) {
  const parsed = importCabysCatalogSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/facturacion/cabys", "Archivo CABYS invalido.");
  }

  const access = await requireAdminAccess();

  if (!isModuleActive(access.tenant.activeModules, "billing")) {
    redirectWithError("/facturacion/cabys", "El modulo Facturacion no esta activo.");
  }

  if (!hasAnyPermission(access.tenant.permissions, ["billing.cabys.manage"])) {
    redirectWithError("/facturacion/cabys", "No tienes permiso para importar CABYS.");
  }

  const parsedImport = parseCabysImportText(parsed.data.cabysText);
  const fileHash = createHash("sha256").update(parsed.data.cabysText).digest("hex");
  const supabase = await createClient();

  if (parsedImport.rows.length === 0) {
    await supabase.from("cabys_import_batches").insert({
      error_message: parsedImport.errors.join(" | ") || "Sin filas validas.",
      file_hash: fileHash,
      skipped_rows: parsedImport.skippedRows,
      source_name: parsed.data.sourceName ?? "CABYS",
      source_url: parsed.data.sourceUrl ?? null,
      source_version: parsed.data.sourceVersion ?? null,
      status: "failed",
      total_rows: parsedImport.totalRows,
    });
    redirectWithError("/facturacion/cabys", "No se encontraron filas CABYS validas.");
  }

  if (parsed.data.importMode === "dry_run") {
    await supabase.from("cabys_import_batches").insert({
      error_message: parsedImport.errors.slice(0, 10).join(" | ") || null,
      file_hash: fileHash,
      inserted_rows: 0,
      skipped_rows: parsedImport.skippedRows,
      source_name: parsed.data.sourceName ?? "CABYS",
      source_url: parsed.data.sourceUrl ?? null,
      source_version: parsed.data.sourceVersion ?? null,
      status: "dry_run",
      total_rows: parsedImport.totalRows,
      updated_rows: 0,
    });
    redirectWithSuccess(
      "/facturacion/cabys",
      `Dry-run CABYS valido: ${parsedImport.rows.length} fila(s), ${parsedImport.skippedRows} omitida(s).`,
    );
  }

  const codes = parsedImport.rows.map((row) => row.code);
  const { data: existingRows } = await supabase
    .from("cabys_catalog")
    .select("code")
    .in("code", codes);
  const existingCodes = new Set(((existingRows ?? []) as { code: string }[]).map((row) => row.code));

  const { error: upsertError } = await supabase.from("cabys_catalog").upsert(
    parsedImport.rows.map((row) => ({
      code: row.code,
      description: row.description,
      is_good: row.isGood,
      is_service: row.isService,
      metadata: row.metadata,
      normalized_description: row.normalizedDescription,
      source_hash: fileHash,
      source_version: parsed.data.sourceVersion ?? null,
      suggested_tax_rate: row.suggestedTaxRate,
      tax_rate_code: row.taxRateCode,
    })),
    { onConflict: "code" },
  );

  if (upsertError) {
    await supabase.from("cabys_import_batches").insert({
      error_message: safeErrorMessage(upsertError),
      file_hash: fileHash,
      skipped_rows: parsedImport.skippedRows,
      source_name: parsed.data.sourceName ?? "CABYS",
      source_url: parsed.data.sourceUrl ?? null,
      source_version: parsed.data.sourceVersion ?? null,
      status: "failed",
      total_rows: parsedImport.totalRows,
    });
    redirectWithError("/facturacion/cabys", "No se pudo importar CABYS.");
  }

  const insertedRows = parsedImport.rows.filter((row) => !existingCodes.has(row.code)).length;
  const updatedRows = parsedImport.rows.length - insertedRows;
  await supabase.from("cabys_import_batches").insert({
    error_message: parsedImport.errors.slice(0, 10).join(" | ") || null,
    file_hash: fileHash,
    inserted_rows: insertedRows,
    skipped_rows: parsedImport.skippedRows,
    source_name: parsed.data.sourceName ?? "CABYS",
    source_url: parsed.data.sourceUrl ?? null,
    source_version: parsed.data.sourceVersion ?? null,
    status: "imported",
    total_rows: parsedImport.totalRows,
    updated_rows: updatedRows,
  });

  revalidatePath("/facturacion/cabys");
  redirectWithSuccess(
    "/facturacion/cabys",
    `CABYS importado: ${insertedRows} nuevo(s), ${updatedRows} actualizado(s), ${parsedImport.skippedRows} omitido(s).`,
  );
}
