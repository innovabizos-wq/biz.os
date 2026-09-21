"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { parseCabysImportText } from "@/modules/billing/cabys/import";
import { encryptSecret } from "@/modules/billing/crypto";
import { getHaciendaClientForConnection } from "@/modules/billing/hacienda/client";
import { archiveOfficialHaciendaResponseXml } from "@/modules/billing/hacienda/artifacts";
import {
  ensureFiscalDocumentConnection,
  runImmediateFiscalIssuance,
} from "@/modules/billing/issuance";
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
import {
  getFiscalConfiguration,
  getFiscalDocumentDetail,
  type FiscalDocumentDetail,
} from "@/modules/billing/queries";
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
    barrio: value.barrio,
    canton: value.canton,
    condicionVenta: value.condicionVenta,
    correoEmisor: value.correoEmisor,
    distrito: value.distrito,
    identificacion: value.identificacion,
    identificacionProveedorSistema: value.identificacionProveedorSistema,
    medioPago: value.medioPago,
    otrasSenas: value.otrasSenas,
    provincia: value.provincia,
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

async function requireHaciendaDocumentConnection(
  tenant: TenantContext,
  document: FiscalDocumentDetail,
  redirectPath: string,
): Promise<{
  connectionId: string;
  document: FiscalDocumentDetail;
  environment: "testing" | "production";
}> {
  let boundDocument: FiscalDocumentDetail;
  try {
    boundDocument = await ensureFiscalDocumentConnection(tenant, document);
  } catch (error) {
    redirectWithError(
      redirectPath,
      error instanceof Error ? error.message : "No se pudo fijar la conexión fiscal.",
    );
  }

  if (
    boundDocument.providerCode !== "hacienda" ||
    !boundDocument.providerConnectionId ||
    (boundDocument.providerEnvironment !== "testing" &&
      boundDocument.providerEnvironment !== "production")
  ) {
    redirectWithError(
      redirectPath,
      "El documento no tiene una conexión Hacienda directa válida y fija.",
    );
  }

  const environment = boundDocument.providerEnvironment;
  return {
    connectionId: boundDocument.providerConnectionId,
    document: boundDocument,
    environment,
  };
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

  const { document: fiscalDocument } = await requireHaciendaDocumentConnection(
    tenant,
    document.data,
    redirectPath,
  );

  if (fiscalDocument.status !== "validated") {
    return fiscalDocument;
  }

  if (fiscalDocument.clave && fiscalDocument.consecutivo) {
    return fiscalDocument;
  }

  const identificationNumber = textFromRecord(fiscalDocument.issuerSnapshot, "identificationNumber");

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
      p_branch_code: fiscalDocument.branchCode,
      p_document_type_code: fiscalDocument.documentTypeCode,
      p_environment: fiscalDocument.environment,
      p_terminal_code: fiscalDocument.terminalCode,
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
      issueDate: fiscalDocument.issueDatetime ?? fiscalDocument.createdAt,
    });
  } catch (error) {
    redirectWithError(
      redirectPath,
      error instanceof Error ? error.message : "No se pudo generar clave numerica.",
    );
  }

  const identityMetadata = {
    ...fiscalDocument.metadata,
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
    .eq("id", fiscalDocument.id)
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
      fiscal_document_id: fiscalDocument.id,
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
      parsed.data.identificacionProveedorSistema &&
      parsed.data.provincia &&
      parsed.data.canton &&
      parsed.data.distrito &&
      parsed.data.otrasSenas &&
      parsed.data.sucursal &&
      parsed.data.terminal &&
      haciendaUsernameRef &&
      haciendaPasswordRef &&
      certificateRef &&
      certificatePinRef,
  );

  const { error: structuredError } = await supabase.from("company_fiscal_settings").upsert(
    {
      address_line: parsed.data.otrasSenas,
      branch_code: parsed.data.sucursal,
      canton_code: parsed.data.canton,
      certificate_pin_secret_ref: certificatePinRef,
      certificate_secret_ref: certificateRef,
      certificate_uploaded_at: parsed.data.p12Base64 ? new Date().toISOString() : undefined,
      default_currency: "CRC",
      default_payment_method_code: parsed.data.medioPago,
      default_sale_condition_code: parsed.data.condicionVenta,
      district_code: parsed.data.distrito,
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
      neighborhood: parsed.data.barrio || null,
      province_code: parsed.data.provincia,
      software_provider_identification: parsed.data.identificacionProveedorSistema,
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
    pendingXsdValidation: true,
    xsdValidation: {
      enabled: true,
      errors: [],
      ok: false,
      validator: "awaiting-xades-signature",
      xsdVersion: "4.4",
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

  const binding = await requireHaciendaDocumentConnection(
    access.tenant,
    document.data,
    redirectPath,
  );

  if (binding.document.status !== "xml_generated" || !binding.document.xmlUnsignedStoragePath) {
    redirectWithError(redirectPath, "Primero debes generar el XML sin firmar.");
  }

  const supabase = await createClient();
  const { data: unsignedArtifact, error: artifactError } = await supabase
    .from("fiscal_document_artifacts")
    .select("content_text")
    .eq("empresa_id", access.tenant.empresaId)
    .eq("fiscal_document_id", binding.document.id)
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
  let certificateExpiresAt: string | undefined;
  let certificateSerialLast4: string | undefined;
  try {
    const result = await getBillingXmlSigner().sign({
      connectionId: binding.connectionId,
      empresaId: access.tenant.empresaId,
      unsignedXml: unsignedArtifact.content_text,
    });
    signedXml = result.signedXml;
    algorithm = result.algorithm;
    certificateExpiresAt = result.certificateExpiresAt;
    certificateSerialLast4 = result.certificateSerialLast4;
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

  let xsdValidation;
  try {
    xsdValidation = await validateFiscalXmlAgainstOfficialXsd(signedXml);
  } catch (error) {
    redirectWithError(
      redirectPath,
      error instanceof Error ? error.message : "No se pudo ejecutar la validacion XSD oficial.",
    );
  }
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
      .eq("empresa_id", access.tenant.empresaId)
      .eq("id", binding.document.id)
      .eq("status", "xml_generated");
    revalidatePath(redirectPath);
    redirectWithError(redirectPath, message);
  }

  const storagePath = [
    "billing",
    access.tenant.empresaId,
    "fiscal-documents",
    binding.document.id,
    "signed.xml",
  ].join("/");
  const signedHash = createHash("sha256").update(signedXml).digest("hex");
  const metadata = {
    algorithm,
    certificateExpiresAt,
    certificateSerialLast4,
    generatedAt: new Date().toISOString(),
    generatedBy: "signFiscalDocumentXmlAction",
    signer: "BillingXmlSigner",
    xsdValidation,
  };

  const { error: signedArtifactError } = await supabase.from("fiscal_document_artifacts").insert({
    artifact_type: "xml_signed",
    content_mime_type: "application/xml",
    content_text: signedXml,
    empresa_id: access.tenant.empresaId,
    fiscal_document_id: binding.document.id,
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
      metadata: { ...binding.document.metadata, ...metadata },
      status: "signed",
      xml_signed_storage_path: storagePath,
    })
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", binding.document.id)
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

  const binding = await requireHaciendaDocumentConnection(
    access.tenant,
    document.data,
    redirectPath,
  );

  if (binding.document.status !== "signed") {
    redirectWithError(redirectPath, "Solo se puede enviar a Hacienda un XML firmado realmente.");
  }

  if (!binding.document.clave) {
    redirectWithError(redirectPath, "Falta clave numerica para enviar a Hacienda.");
  }

  const supabase = await createClient();
  const { data: signedArtifact, error: artifactError } = await supabase
    .from("fiscal_document_artifacts")
    .select("content_text")
    .eq("empresa_id", access.tenant.empresaId)
    .eq("fiscal_document_id", binding.document.id)
    .eq("artifact_type", "xml_signed")
    .eq("status", "generated")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ content_text: string | null }>();

  if (artifactError || !signedArtifact?.content_text || !hasXmlSignature(signedArtifact.content_text)) {
    redirectWithError(redirectPath, "No se encontro un XML firmado valido para enviar.");
  }

  let xsdValidation;
  try {
    xsdValidation = await validateFiscalXmlAgainstOfficialXsd(signedArtifact.content_text);
  } catch (error) {
    redirectWithError(
      redirectPath,
      error instanceof Error ? error.message : "No se pudo ejecutar la validacion XSD oficial.",
    );
  }
  if (!xsdValidation.ok) {
    redirectWithError(
      redirectPath,
      xsdValidation.errors[0] ?? "El XML firmado no supera el XSD oficial 4.4.",
    );
  }

  let sendResult;
  try {
    const issuerType = textFromRecord(binding.document.issuerSnapshot, "identificationType");
    const issuerNumber = textFromRecord(binding.document.issuerSnapshot, "identificationNumber");
    if (!issuerType || !issuerNumber) {
      redirectWithError(redirectPath, "Falta identificacion completa del emisor para Hacienda.");
    }
    const receiverNumber = textFromRecord(binding.document.receiverSnapshot, "identificationNumber");
    sendResult = await (
      await getHaciendaClientForConnection(
        access.tenant.empresaId,
        binding.connectionId,
        binding.environment,
      )
    ).sendSignedXml({
      clave: binding.document.clave,
      emisor: { numeroIdentificacion: issuerNumber, tipoIdentificacion: issuerType },
      fecha: new Date(binding.document.issueDatetime ?? binding.document.createdAt).toISOString(),
      ...(binding.document.receiverIdentificationType && receiverNumber
        ? { receptor: { numeroIdentificacion: receiverNumber, tipoIdentificacion: binding.document.receiverIdentificationType } }
        : {}),
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
    binding.document.id,
    "hacienda-send-response.json",
  ].join("/");

  const { error: responseArtifactError } = await supabase.from("fiscal_document_artifacts").insert({
    artifact_type: "hacienda_response",
    content_mime_type: "application/json",
    content_text: responseText,
    empresa_id: access.tenant.empresaId,
    fiscal_document_id: binding.document.id,
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
  const respondedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("fiscal_documents")
    .update({
      hacienda_response_storage_path: responseStoragePath,
      hacienda_status: sendResult.status,
      last_error: sendResult.status === "error" ? "Hacienda retorno error en envio." : null,
      provider_document_id: binding.document.clave,
      provider_last_response_at: respondedAt,
      provider_reference: binding.document.clave,
      provider_status: sendResult.status,
      sent_at: sendResult.status === "error" ? null : respondedAt,
      status: nextStatus,
    })
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", binding.document.id)
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

  const binding = await requireHaciendaDocumentConnection(
    access.tenant,
    document.data,
    redirectPath,
  );

  if (!binding.document.clave) {
    redirectWithError(redirectPath, "Falta clave numerica para consultar Hacienda.");
  }

  if (
    !["sent", "processing"].includes(binding.document.status) &&
    !["recibido", "procesando"].includes(binding.document.haciendaStatus)
  ) {
    redirectWithError(redirectPath, "Solo se consulta Hacienda despues de enviar un XML firmado.");
  }

  let statusResult;
  try {
    statusResult = await (
      await getHaciendaClientForConnection(
        access.tenant.empresaId,
        binding.connectionId,
        binding.environment,
      )
    ).queryStatus(binding.document.clave);
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
    binding.document.id,
    "hacienda-status-response.json",
  ].join("/");
  const supabase = await createClient();

  const { error: responseArtifactError } = await supabase.from("fiscal_document_artifacts").insert({
    artifact_type: "hacienda_response",
    content_mime_type: "application/json",
    content_text: responseText,
    empresa_id: access.tenant.empresaId,
    fiscal_document_id: binding.document.id,
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

  let officialResponsePath: string | null;
  try {
    officialResponsePath = await archiveOfficialHaciendaResponseXml({
      empresaId: access.tenant.empresaId,
      fiscalDocumentId: binding.document.id,
      generatedBy: "queryFiscalDocumentHaciendaStatusAction",
      responseXmlBase64: statusResult.responseXmlBase64,
    });
  } catch (error) {
    redirectWithError(redirectPath, error instanceof Error ? error.message : "No se pudo archivar el XML oficial de Hacienda.");
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
      hacienda_response_storage_path: officialResponsePath ?? responseStoragePath,
      hacienda_status: statusResult.status,
      last_error: statusResult.status === "error" ? "Hacienda retorno error en consulta." : null,
      provider_last_response_at: now,
      provider_status: statusResult.status,
      rejected_at: statusResult.status === "rechazado" ? now : null,
      status: nextStatus,
    })
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", binding.document.id)
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
  const supabase = await createClient();

  let xsdErrors: string[] = [];
  let xsdValid = false;
  try {
    const result = await validateFiscalXmlAgainstOfficialXsd(xmlText);
    xsdErrors = result.errors;
    xsdValid = result.ok;
  } catch (error) {
    xsdErrors = [
      error instanceof Error ? error.message : "No se pudo validar el XML contra el XSD oficial.",
    ];
  }

  const { data: companyFiscalSettings, error: settingsError } = await supabase
    .from("company_fiscal_settings")
    .select("identificacion")
    .eq("empresa_id", access.tenant.empresaId)
    .maybeSingle<{ identificacion: string | null }>();

  if (settingsError) {
    redirectWithError(
      "/facturacion/recepcion",
      "No se pudo comprobar la identidad fiscal de la empresa.",
    );
  }

  const normalizeIdentification = (value: string | null | undefined) =>
    value?.replace(/[^0-9A-Za-z]/g, "").toUpperCase() ?? "";
  const companyIdentification = normalizeIdentification(companyFiscalSettings?.identificacion);
  const validationErrors = [...parsedXml.validationErrors];

  if (!companyIdentification) {
    validationErrors.push({
      code: "missing_company_fiscal_identity",
      group: "Empresa",
      message: "Configura la identificacion fiscal de la empresa antes de importar XML.",
    });
  } else if (parsed.data.documentDirection === "incoming") {
    if (!parsedXml.receiverIdentification) {
      validationErrors.push({
        code: "missing_receiver_identification",
        group: "Receptor",
        message: "El XML entrante no identifica a la empresa receptora.",
      });
    } else if (
      normalizeIdentification(parsedXml.receiverIdentification) !== companyIdentification
    ) {
      validationErrors.push({
        code: "receiver_company_mismatch",
        group: "Receptor",
        message: "La identificacion del receptor no coincide con esta empresa.",
      });
    }
  } else if (normalizeIdentification(parsedXml.issuerIdentification) !== companyIdentification) {
    validationErrors.push({
      code: "issuer_company_mismatch",
      group: "Emisor",
      message: "La identificacion del emisor no coincide con esta empresa.",
    });
  }

  const findExistingDocument = async () => {
    const byHash = await supabase
      .from("fiscal_received_documents")
      .select("id")
      .eq("empresa_id", access.tenant.empresaId)
      .eq("xml_sha256", xmlHash)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (byHash.error) throw byHash.error;
    if (byHash.data) return byHash.data.id;
    if (!parsedXml.clave) return null;
    const byKey = await supabase
      .from("fiscal_received_documents")
      .select("id")
      .eq("empresa_id", access.tenant.empresaId)
      .eq("clave", parsedXml.clave)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (byKey.error) throw byKey.error;
    return byKey.data?.id ?? null;
  };

  let existingDocumentId: string | null = null;
  try {
    existingDocumentId = await findExistingDocument();
  } catch {
    redirectWithError("/facturacion/recepcion", "No se pudo comprobar si el XML ya existe.");
  }

  let suggestedSaleId: string | null = null;
  if (
    parsed.data.documentDirection === "outgoing" &&
    parsedXml.issueDatetime &&
    parsedXml.currencyCode &&
    parsedXml.totalAmount !== null
  ) {
    const { data: sales } = await supabase
      .from("ventas")
      .select("id")
      .eq("empresa_id", access.tenant.empresaId)
      .eq("fecha_venta", parsedXml.issueDatetime.slice(0, 10))
      .eq("moneda", parsedXml.currencyCode)
      .eq("total", parsedXml.totalAmount)
      .limit(2);
    if (sales?.length === 1) suggestedSaleId = (sales[0] as { id: string }).id;
  }

  const batchRecord = {
    clave: parsedXml.clave,
    consecutivo: parsedXml.consecutivo,
    created_by: access.tenant.profileId,
    currency_code: parsedXml.currencyCode,
    document_direction: parsed.data.documentDirection,
    document_root: parsedXml.documentRoot,
    document_type_code: parsedXml.documentTypeCode,
    duplicate_document_id: existingDocumentId,
    empresa_id: access.tenant.empresaId,
    import_source: parsed.data.importSource,
    issue_datetime: parsedXml.issueDatetime,
    issuer_identification: parsedXml.issuerIdentification,
    issuer_name: parsedXml.issuerName,
    receiver_identification: parsedXml.receiverIdentification,
    receiver_name: parsedXml.receiverName,
    source_name: parsed.data.sourceName || null,
    suggested_sale_id: suggestedSaleId,
    total_amount: parsedXml.totalAmount,
    validation_errors: validationErrors,
    xml_sha256: xmlHash,
    xsd_errors: xsdErrors,
    xsd_valid: xsdValid,
  };
  const adminSupabase = createServiceRoleClient();

  if (existingDocumentId) {
    const { error: duplicateBatchError } = await adminSupabase
      .from("fiscal_xml_import_batches")
      .insert({ ...batchRecord, status: "duplicate" });
    if (duplicateBatchError) {
      redirectWithError("/facturacion/recepcion", "El XML ya existe y no se pudo registrar el intento.");
    }
    revalidatePath("/facturacion/recepcion");
    redirectWithSuccess(
      "/facturacion/recepcion",
      "XML duplicado detectado por clave o huella. No se creo otro documento.",
    );
  }

  if (parsed.data.importMode === "preview" || validationErrors.length > 0 || !xsdValid) {
    const { error: batchError } = await adminSupabase.from("fiscal_xml_import_batches").insert({
      ...batchRecord,
      status: validationErrors.length > 0 || !xsdValid ? "rejected" : "previewed",
    });
    if (batchError) {
      redirectWithError("/facturacion/recepcion", "No se pudo guardar la vista previa del XML.");
    }
    revalidatePath("/facturacion/recepcion");
    redirectWithSuccess(
      "/facturacion/recepcion",
      validationErrors.length > 0 || !xsdValid
        ? `Vista previa rechazada: ${validationErrors.length + xsdErrors.length} error(es).`
        : suggestedSaleId
          ? "Vista previa valida. Se encontro una venta candidata; revisala y confirma la vinculacion."
          : "Vista previa valida. Ya puedes importar el XML.",
    );
  }

  const documentPayload = {
    clave: parsedXml.clave,
    consecutivo: parsedXml.consecutivo,
    currencyCode: parsedXml.currencyCode,
    documentRoot: parsedXml.documentRoot,
    documentTypeCode: parsedXml.documentTypeCode,
    issueDatetime: parsedXml.issueDatetime,
    issuerIdentification: parsedXml.issuerIdentification,
    issuerName: parsedXml.issuerName,
    parsedData: parsedXml.parsedData,
    receiverIdentification: parsedXml.receiverIdentification,
    receiverName: parsedXml.receiverName,
    totalAmount: parsedXml.totalAmount,
  };
  const { data: importResult, error: importError } = await adminSupabase.rpc(
    "import_fiscal_external_xml",
    {
      p_actor_id: access.tenant.profileId,
      p_document: documentPayload,
      p_document_direction: parsed.data.documentDirection,
      p_empresa_id: access.tenant.empresaId,
      p_import_source: parsed.data.importSource,
      p_linked_sale_id: parsed.data.linkedSaleId || null,
      p_source_name: parsed.data.sourceName || null,
      p_suggested_sale_id: suggestedSaleId,
      p_validation_errors: validationErrors,
      p_xml_content: xmlText,
      p_xml_sha256: xmlHash,
      p_xsd_errors: xsdErrors,
    },
  );

  if (importError) {
    redirectWithError(
      "/facturacion/recepcion",
      `No se pudo importar el XML: ${safeErrorMessage(importError)}.`,
    );
  }

  const result = importResult as { status?: string } | null;
  revalidatePath("/facturacion");
  revalidatePath("/facturacion/recepcion");
  redirectWithSuccess(
    "/facturacion/recepcion",
    result?.status === "duplicate"
      ? "XML duplicado detectado durante la importacion. No se reprodujo ningun efecto."
      : parsed.data.documentDirection === "incoming"
        ? "XML entrante validado e importado. El mensaje receptor sigue pendiente."
        : parsed.data.linkedSaleId
          ? "XML externo validado, importado y vinculado con la venta seleccionada."
          : "XML externo validado e importado sin vincularlo automaticamente.",
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
    .select("id, clave, consecutivo, document_direction, issuer_identification, parsed_data, total_amount, receiver_response_status, validation_errors, xsd_valid")
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", parsed.data.receivedDocumentId)
    .maybeSingle<{
      clave: string | null;
      consecutivo: string | null;
      document_direction: string;
      id: string;
      issuer_identification: string | null;
      parsed_data: JsonRecord | null;
      receiver_response_status: string;
      total_amount: number | null;
      validation_errors: unknown[] | null;
      xsd_valid: boolean | null;
    }>();

  if (documentError || !receivedDocument) {
    redirectWithError("/facturacion/recepcion", "Documento recibido no encontrado.");
  }

  if (receivedDocument.document_direction !== "incoming") {
    redirectWithError(
      "/facturacion/recepcion",
      "Los comprobantes salientes importados no generan mensaje receptor.",
    );
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

  if (receivedDocument.xsd_valid !== true) {
    redirectWithError(
      "/facturacion/recepcion",
      "El XML debe superar el XSD oficial antes de preparar el mensaje receptor.",
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
