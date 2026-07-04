import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);

function source(path) {
  return readFileSync(new URL(path, root), "utf8");
}

function exists(path) {
  return existsSync(new URL(path, root));
}

const migration = source("database/migrations/0061_billing_fiscal_foundation.sql");

test("billing routes exist and are protected by module and permission guards", () => {
  for (const route of [
    "src/app/(app)/facturacion/page.tsx",
    "src/app/(app)/facturacion/documentos/page.tsx",
    "src/app/(app)/facturacion/documentos/[documentoId]/page.tsx",
    "src/app/(app)/facturacion/configuracion/page.tsx",
    "src/app/(app)/facturacion/cabys/page.tsx",
    "src/app/(app)/facturacion/consecutivos/page.tsx",
    "src/app/(app)/facturacion/recepcion/page.tsx",
    "src/app/(app)/facturacion/reportes/page.tsx",
    "src/app/api/facturacion/documentos/[documentoId]/artefactos/[artifactId]/route.ts",
    "src/app/api/facturacion/recepcion/[receivedDocumentId]/artefactos/[artifactId]/route.ts",
  ]) {
    assert.ok(exists(route), `${route} must exist`);
  }

  const guards = source("src/modules/billing/guards.ts");
  assert.match(guards, /isModuleActive\(tenant\.activeModules, "billing"\)/);
  assert.match(guards, /billing\.config\.manage/);
  assert.match(guards, /billing\.invoices\.create/);
});

test("billing module contract declares optional module routes and granular permissions", () => {
  const catalog = source("src/modules/platform-modules/module-catalog.ts");
  const permissions = source("src/modules/permissions/permissions.ts");

  assert.match(catalog, /code: "billing"/);
  assert.match(catalog, /kind: "optional"/);
  assert.match(catalog, /"\/facturacion\/documentos"/);
  assert.match(catalog, /requiredPermissions: \["billing\.view", "billing\.config\.view"\]/);

  for (const code of [
    "billing.view",
    "billing.manage",
    "billing.issue",
    "billing.receive",
    "billing.config.view",
    "billing.config.manage",
    "billing.cabys.manage",
    "billing.reports.view",
  ]) {
    assert.match(permissions, new RegExp(`code: "${code}"`));
  }
});

test("billing migration creates fiscal foundation without destructive operations", () => {
  for (const table of [
    "company_fiscal_settings",
    "cabys_catalog",
    "catalog_product_fiscal_profile",
    "fiscal_documents",
    "fiscal_document_artifacts",
    "fiscal_document_lines",
    "fiscal_document_line_taxes",
    "fiscal_sequence_counters",
    "fiscal_sequence_reservations",
    "fiscal_received_documents",
    "fiscal_received_document_artifacts",
    "fiscal_document_deliveries",
  ]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  }

  assert.match(migration, /alter table public\.fiscal_documents enable row level security/);
  assert.match(migration, /reserve_fiscal_sequence_for_current_company/);
  assert.match(migration, /generate_fiscal_consecutivo/);
  assert.match(migration, /prepare_fiscal_document_from_sale/);
  assert.match(migration, /get_platform_billing_health/);
  assert.match(migration, /receivedDocumentCounts/);
  assert.match(migration, /receivedArtifactCounts/);
  assert.doesNotMatch(migration, /drop\s+(table|column)\b/i);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.(ventas|venta_items|facturas_electronicas)/i);
});

test("billing does not expose service role or secrets in user-facing code", () => {
  const actions = source("src/modules/billing/actions.ts");
  const fiscalPage = source("src/app/(app)/admin/fiscal/page.tsx");

  assert.doesNotMatch(actions, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(fiscalPage, /haciendaPasswordEnc|haciendaUsuarioEnc|p12Base64Enc|pinEnc/);
  assert.match(actions, /FISCAL_CONFIG_ENCRYPTION_KEY/);
  assert.match(actions, /company_fiscal_settings/);
  assert.match(actions, /fiscalSecretRef/);
  assert.match(actions, /certificate_secret_ref/);
  assert.match(actions, /hacienda_username_secret_ref/);
  assert.doesNotMatch(actions, /company_fiscal_settings"[\s\S]*p12Base64:/);
  assert.doesNotMatch(actions, /company_fiscal_settings"[\s\S]*pin:/);
  assert.match(source("src/modules/billing/queries.ts"), /CompanyFiscalSettingsRow/);
  assert.match(source("src/modules/billing/queries.ts"), /mapStructuredFiscalConfiguration/);
  assert.match(source("src/modules/billing/queries.ts"), /certificate_secret_ref/);
  assert.match(source("src/modules/billing/queries.ts"), /obtener_configuracion_fiscal/);
  assert.match(source("src/modules/billing/queries.ts"), /getInvoicesForSales/);
  assert.match(source("src/modules/billing/queries.ts"), /fiscal_documents/);
  assert.match(source("src/modules/billing/queries.ts"), /mapFiscalDocumentInvoice/);
  assert.match(source("src/modules/billing/queries.ts"), /fiscalDocumentId: row\.id/);
  assert.match(source("src/modules/billing/queries.ts"), /facturas_electronicas/);
  assert.match(source("src/modules/quotes/components/quotes-table.tsx"), /\/facturacion\/documentos\/\$\{invoice\.fiscalDocumentId\}/);
  assert.match(actions, /issueInvoiceFromSaleAction/);
  assert.match(actions, /prepare_fiscal_document_from_sale/);
  assert.doesNotMatch(actions, /crear_factura_electronica_desde_venta/);
  assert.match(actions, /prepareFiscalDocumentFromSaleAction/);
  assert.match(actions, /assignProductCabysAction/);
  assert.match(actions, /importCabysCatalogAction/);
  assert.match(actions, /generateFiscalDocumentXmlAction/);
  assert.match(actions, /signFiscalDocumentXmlAction/);
  assert.match(actions, /sendFiscalDocumentToHaciendaAction/);
  assert.match(actions, /issueFiscalDocumentNowAction/);
  assert.match(actions, /isModuleActive\(access\.tenant\.activeModules, "billing"\)/);
  assert.match(actions, /billing\.issue/);
});

test("billing XML, signing and Hacienda interfaces fail explicitly when not real", () => {
  const sequences = source("src/modules/billing/sequences.ts");

  assert.match(sequences, /generateFiscalClave/);
  assert.match(sequences, /COSTA_RICA_COUNTRY_CODE = "506"/);
  assert.match(sequences, /identification\.padStart\(12, "0"\)/);
  assert.match(sequences, /Consecutivo fiscal invalido/);
  assert.match(source("src/modules/billing/xml/document.ts"), /Falta clave numerica y consecutivo fiscal/);
  assert.match(source("src/modules/billing/xml/builders.ts"), /DetalleServicio/);
  assert.match(source("src/modules/billing/xml/builders.ts"), /CodigoCABYS/);
  assert.match(source("src/modules/billing/xml/builders.ts"), /ResumenFactura/);
  assert.match(source("src/modules/billing/xml/validation.ts"), /BILLING_XML_VALIDATION_ENABLED/);
  assert.match(source("src/modules/billing/xml/validation.ts"), /Validacion XSD XML 4\.4 no configurada/);
  assert.match(source("src/modules/billing/queries.ts"), /fiscal_document_line_taxes/);
  assert.match(source("src/modules/billing/actions.ts"), /fiscal_document_artifacts/);
  assert.match(source("src/modules/billing/actions.ts"), /reserve_fiscal_sequence_for_current_company/);
  assert.match(source("src/modules/billing/actions.ts"), /generateFiscalClave/);
  assert.match(source("src/modules/billing/actions.ts"), /pendingXsdValidation/);
  assert.match(source("src/modules/billing/actions.ts"), /validateFiscalXmlAgainstOfficialXsd/);
  assert.match(source("src/modules/billing/actions.ts"), /error_xml/);
  assert.match(source("src/modules/billing/actions.ts"), /validateFiscalDocumentReadyForXml/);
  assert.match(source("src/modules/billing/validation/validate-document.ts"), /missing_line_tax_detail/);
  assert.match(source("src/modules/billing/validation/validate-document.ts"), /calculateFiscalDocumentTotals/);
  assert.match(source("src/modules/billing/validation/validate-document.ts"), /total_tax_mismatch/);
  assert.match(source("src/modules/billing/validation/validate-document.ts"), /document_total_mismatch/);
  assert.match(source("src/modules/billing/validation/validate-document.ts"), /fiscal_document_lines/);
  assert.match(source("src/modules/billing/validation/validate-document.ts"), /fiscal_document_line_taxes/);
  assert.match(source("src/modules/billing/validation/validate-document.ts"), /validationResult/);
  assert.match(source("src/modules/billing/actions.ts"), /Firma XAdES-EPES no configurada/);
  assert.match(source("src/modules/billing/actions.ts"), /getBillingXmlSigner/);
  assert.match(source("src/modules/billing/actions.ts"), /hasXmlSignature/);
  assert.match(source("src/modules/billing/actions.ts"), /xml_signed/);
  assert.match(source("src/modules/billing/actions.ts"), /Cliente Hacienda no configurado/);
  assert.match(source("src/modules/billing/actions.ts"), /getHaciendaClient/);
  assert.match(source("src/modules/billing/actions.ts"), /hacienda_response/);
  assert.match(source("src/modules/billing/actions.ts"), /queryFiscalDocumentHaciendaStatusAction/);
  assert.match(source("src/modules/billing/actions.ts"), /runImmediateFiscalIssuance/);
  assert.match(source("src/modules/billing/issuance.ts"), /runImmediateFiscalIssuance/);
  assert.match(source("src/modules/billing/issuance.ts"), /validateFiscalDocumentReadyForXml/);
  assert.match(source("src/modules/billing/issuance.ts"), /buildUnsignedXmlFromFiscalDocument/);
  assert.match(source("src/modules/billing/issuance.ts"), /getBillingXmlSigner/);
  assert.match(source("src/modules/billing/issuance.ts"), /getHaciendaClient/);
  assert.match(source("src/modules/billing/issuance.ts"), /No se marca como firmado sin Signature real/);
  assert.match(source("src/modules/billing/issuance.ts"), /No se marca aceptado\/rechazado sin respuesta oficial/);
  assert.match(source("src/modules/billing/actions.ts"), /accepted_at/);
  assert.match(source("src/modules/billing/actions.ts"), /rechazado/);
  assert.match(source("src/modules/billing/actions.ts"), /recoverPendingFiscalDocumentsAction/);
  assert.match(source("src/modules/billing/actions.ts"), /\[billing-fiscal-recovery\]/);
  assert.match(source("src/modules/billing/actions.ts"), /No se marca como aceptado/);
  assert.match(source("src/modules/billing/hacienda/config.ts"), /BILLING_HACIENDA_SEND_ENABLED/);
  assert.match(source("src/modules/billing/hacienda/config.ts"), /BILLING_HACIENDA_STATUS_ENABLED/);
  assert.match(source("src/modules/billing/hacienda/client.ts"), /describeHaciendaReadiness/);
  assert.match(source("src/app/(app)/facturacion/documentos/[documentoId]/page.tsx"), /Consultar estado/);
  assert.match(source("src/app/(app)/facturacion/documentos/[documentoId]/page.tsx"), /Emitir ahora/);
  assert.match(source("src/modules/billing/actions.ts"), /generateFiscalPdfRepresentationAction/);
  assert.match(source("src/modules/billing/actions.ts"), /registerFiscalDocumentDeliveryAction/);
  assert.match(source("src/modules/billing/actions.ts"), /registerReceivedFiscalXmlAction/);
  assert.match(source("src/modules/billing/actions.ts"), /prepareReceiverMessageAction/);
  assert.match(source("src/modules/billing/actions.ts"), /receiver_message/);
  assert.match(source("src/modules/billing/actions.ts"), /pendingHaciendaSend/);
  assert.match(source("src/modules/billing/received/receiver-message.ts"), /MensajeReceptor/);
  assert.match(source("src/modules/billing/received/receiver-message.ts"), /partially_accepted/);
  assert.match(source("src/modules/billing/actions.ts"), /Codigo CABYS no existe en el catalogo importado/);
  assert.match(source("src/modules/billing/actions.ts"), /parseCabysImportText/);
  assert.match(source("src/modules/billing/actions.ts"), /cabys_import_batches/);
  assert.match(source("src/modules/billing/actions.ts"), /createHash\("sha256"\)\.update\(parsed\.data\.cabysText\)/);
  assert.match(source("src/modules/billing/actions.ts"), /billing\.cabys\.manage/);
  assert.match(source("src/modules/billing/cabys/import.ts"), /codigo CABYS debe tener 13 digitos/);
  assert.match(source("src/modules/billing/cabys/import.ts"), /MAX_IMPORT_ROWS = 500/);
  assert.match(source("src/app/(app)/facturacion/cabys/page.tsx"), /Productos y perfil fiscal/);
  assert.match(source("src/app/(app)/facturacion/cabys/page.tsx"), /Importar CABYS oficial/);
  assert.match(source("src/app/(app)/facturacion/cabys/page.tsx"), /Dry-run no modifica el catalogo/);
  assert.match(source("src/app/(app)/facturacion/cabys/page.tsx"), /no se crean codigos falsos/);
  assert.match(migration, /cabys_catalog_write_billing/);
  assert.match(source("src/modules/billing/pdf/representation.ts"), /La factura electronica real es el XML firmado y aceptado/);
  assert.match(source("src/modules/billing/received/xml.ts"), /pendingXsdValidation/);
  assert.match(source("src/app/(app)/facturacion/recepcion/page.tsx"), /Registrar XML recibido/);
  assert.match(source("src/app/(app)/facturacion/recepcion/page.tsx"), /prepareReceiverMessageAction/);
  assert.match(source("src/app/(app)/facturacion/recepcion/page.tsx"), /No envia a Hacienda/);
  assert.match(source("src/app/(app)/facturacion/recepcion/page.tsx"), /mensaje receptor a Hacienda queda pendiente/);
  assert.match(source("src/app/(app)/facturacion/documentos/[documentoId]/page.tsx"), /Archivo documental/);
  assert.match(source("src/app/api/facturacion/documentos/[documentoId]/artefactos/[artifactId]/route.ts"), /Content-Disposition/);
  assert.match(source("src/app/api/facturacion/documentos/[documentoId]/artefactos/[artifactId]/route.ts"), /canUseBilling/);
  assert.match(source("src/app/api/facturacion/recepcion/[receivedDocumentId]/artefactos/[artifactId]/route.ts"), /Content-Disposition/);
  assert.match(source("src/app/api/facturacion/recepcion/[receivedDocumentId]/artefactos/[artifactId]/route.ts"), /canUseBilling/);
  assert.match(source("src/app/(app)/facturacion/reportes/page.tsx"), /XML recibidos/);
  assert.match(source("src/app/(app)/facturacion/reportes/page.tsx"), /Recuperacion fiscal manual/);
  assert.match(source("src/modules/platform-console/queries.ts"), /get_platform_billing_health/);
  assert.match(source("src/app/platform/empresas/[empresaId]/page.tsx"), /Diagnostico fiscal seguro/);
  assert.match(source("src/modules/billing/signing/signer.ts"), /no se puede marcar XML como firmado/);
  assert.match(source("src/modules/billing/hacienda/client.ts"), /no se puede enviar XML sin OAuth/);
  assert.match(source("src/modules/billing/xml/builders.ts"), /Tipo documental preparado pero no implementado todavia/);
});

test("billing documentation exists for real invoicing roadmap", () => {
  for (const doc of [
    "docs/modules/billing-overview.md",
    "docs/modules/billing-roadmap-real-invoicing.md",
    "docs/modules/billing-cabys.md",
    "docs/modules/billing-cron.md",
    "docs/modules/billing-fiscal-settings.md",
    "docs/modules/billing-tax-engine.md",
    "docs/modules/billing-xml-44.md",
    "docs/modules/billing-xades-signing.md",
    "docs/modules/billing-hacienda-api.md",
    "docs/modules/billing-received-documents.md",
    "docs/modules/billing-pdf.md",
    "docs/platform-billing-operations.md",
  ]) {
    assert.ok(exists(doc), `${doc} must exist`);
  }

  const billingCron = source("docs/modules/billing-cron.md");
  assert.match(billingCron, /no existe un cron de facturacion/);
  assert.match(billingCron, /\/api\/whapp\/campanas\/despachar/);
  assert.match(billingCron, /dispatchInboxCampaignBatch/);
  assert.match(billingCron, /recoverPendingFiscalDocuments/);
  assert.match(billingCron, /no genera XML, no firma XML y no envia XML automaticamente/);
  assert.match(billingCron, /nunca debe marcar `accepted` sin respuesta real de Hacienda/);
});
