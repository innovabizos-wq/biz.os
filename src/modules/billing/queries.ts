import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { canUseBilling, canViewBillingConfig } from "@/modules/billing/guards";
import type {
  ElectronicInvoice,
  ElectronicInvoiceStatus,
  FiscalConfiguration,
} from "@/modules/billing/types";
import type { CoreResult, JsonRecord, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type InvoiceRow = {
  ambiente: ElectronicInvoice["ambiente"];
  clave: string | null;
  cliente_id: string | null;
  estado: ElectronicInvoice["estado"];
  id: string;
  numero: string;
  total: number;
  venta_id: string;
};

type FiscalInvoiceRow = {
  clave: string | null;
  consecutivo: string | null;
  customer_id: string | null;
  environment: string;
  hacienda_status: string;
  id: string;
  sale_id: string;
  status: string;
  totals: JsonRecord | null;
};

type CompanyFiscalSettingsRow = {
  address_line: string | null;
  branch_code: string;
  canton_code: string | null;
  certificate_pin_secret_ref: string | null;
  certificate_secret_ref: string | null;
  default_payment_method_code: string | null;
  default_sale_condition_code: string | null;
  district_code: string | null;
  email: string;
  environment: string;
  hacienda_password_secret_ref: string | null;
  hacienda_username_secret_ref: string | null;
  identification_number: string;
  identification_type: string;
  legal_name: string;
  main_activity_code: string | null;
  neighborhood: string | null;
  province_code: string | null;
  software_provider_identification: string | null;
  terminal_code: string;
};

function bool(value: unknown) {
  return value === true;
}

function defaultFiscalConfiguration(): FiscalConfiguration {
  return {
    actividadEconomica: null,
    ambiente: "pruebas",
    barrio: null,
    canton: null,
    condicionVenta: "01",
    correoEmisor: null,
    distrito: null,
    hasHaciendaPassword: false,
    hasHaciendaUsuario: false,
    hasP12: false,
    hasPin: false,
    identificacion: null,
    identificacionProveedorSistema: null,
    listoParaEmitir: false,
    medioPago: "01",
    otrasSenas: null,
    provincia: null,
    razonSocial: null,
    sucursal: "001",
    terminal: "00001",
    tipoIdentificacion: "02",
  };
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function fiscalReady(config: FiscalConfiguration) {
  return Boolean(
    config.razonSocial &&
      config.identificacion &&
      config.actividadEconomica &&
      config.correoEmisor &&
      config.identificacionProveedorSistema &&
      config.provincia &&
      config.canton &&
      config.distrito &&
      config.otrasSenas &&
      config.hasHaciendaUsuario &&
      config.hasHaciendaPassword &&
      config.hasP12 &&
      config.hasPin,
  );
}

function hasSecretRef(value: string | null) {
  return typeof value === "string" && value.trim().length > 0;
}

function mapStructuredFiscalConfiguration(row: CompanyFiscalSettingsRow): FiscalConfiguration {
  const config: FiscalConfiguration = {
    actividadEconomica: text(row.main_activity_code),
    ambiente: row.environment === "production" ? "produccion" : "pruebas",
    barrio: text(row.neighborhood),
    canton: text(row.canton_code),
    condicionVenta: text(row.default_sale_condition_code) ?? "01",
    correoEmisor: text(row.email),
    distrito: text(row.district_code),
    hasHaciendaPassword: hasSecretRef(row.hacienda_password_secret_ref),
    hasHaciendaUsuario: hasSecretRef(row.hacienda_username_secret_ref),
    hasP12: hasSecretRef(row.certificate_secret_ref),
    hasPin: hasSecretRef(row.certificate_pin_secret_ref),
    identificacion: text(row.identification_number),
    identificacionProveedorSistema: text(row.software_provider_identification),
    listoParaEmitir: false,
    medioPago: text(row.default_payment_method_code) ?? "01",
    otrasSenas: text(row.address_line),
    provincia: text(row.province_code),
    razonSocial: text(row.legal_name),
    sucursal: text(row.branch_code) ?? "001",
    terminal: text(row.terminal_code) ?? "00001",
    tipoIdentificacion: text(row.identification_type) ?? "02",
  };

  return { ...config, listoParaEmitir: fiscalReady(config) };
}

function mapInvoice(row: InvoiceRow): ElectronicInvoice {
  return {
    ambiente: row.ambiente,
    clave: row.clave,
    clienteId: row.cliente_id,
    estado: row.estado,
    fiscalDocumentId: null,
    id: row.id,
    numero: row.numero,
    totalComprobante: row.total,
    ventaId: row.venta_id,
  };
}

function mapFiscalDocumentStatus(status: string, haciendaStatus: string): ElectronicInvoiceStatus {
  if (status === "accepted" || haciendaStatus === "aceptado") return "aceptada";
  if (status === "rejected" || haciendaStatus === "rechazado") return "rechazada";
  if (status.startsWith("error") || haciendaStatus === "error") return "error";
  if (["signed", "sent", "processing"].includes(status)) return "enviada";
  if (["validated", "xml_generated"].includes(status)) return "firmando";

  return "borrador";
}

function mapFiscalDocumentInvoice(row: FiscalInvoiceRow): ElectronicInvoice {
  return {
    ambiente: row.environment === "production" ? "produccion" : "pruebas",
    clave: row.clave,
    clienteId: row.customer_id,
    estado: mapFiscalDocumentStatus(row.status, row.hacienda_status),
    fiscalDocumentId: row.id,
    id: row.id,
    numero: row.consecutivo ?? row.id,
    totalComprobante: totalFromJson(row.totals) ?? 0,
    ventaId: row.sale_id,
  };
}

export function canViewFiscalConfiguration(tenant: TenantContext) {
  return (
    canViewBillingConfig(tenant) ||
    hasAnyPermission(tenant.permissions, ["admin.settings.view", "admin.settings.manage"])
  );
}

export async function getFiscalConfiguration(
  tenant: TenantContext,
): Promise<CoreResult<FiscalConfiguration>> {
  if (!canViewFiscalConfiguration(tenant)) {
    return ok(defaultFiscalConfiguration());
  }

  const supabase = await createClient();
  const { data: structuredData, error: structuredError } = await supabase
    .from("company_fiscal_settings")
    .select("legal_name, identification_type, identification_number, email, province_code, canton_code, district_code, neighborhood, address_line, main_activity_code, software_provider_identification, default_sale_condition_code, default_payment_method_code, branch_code, terminal_code, environment, hacienda_username_secret_ref, hacienda_password_secret_ref, certificate_secret_ref, certificate_pin_secret_ref")
    .eq("empresa_id", tenant.empresaId)
    .maybeSingle<CompanyFiscalSettingsRow>();

  if (!structuredError && structuredData) {
    return ok(mapStructuredFiscalConfiguration(structuredData));
  }

  const { data, error } = await supabase.rpc("obtener_configuracion_fiscal");

  if (error) return ok(defaultFiscalConfiguration());

  const raw = (data ?? {}) as JsonRecord;
  const config: FiscalConfiguration = {
    actividadEconomica: text(raw.actividadEconomica),
    ambiente: raw.ambiente === "produccion" ? "produccion" : "pruebas",
    barrio: text(raw.barrio),
    canton: text(raw.canton),
    condicionVenta: text(raw.condicionVenta) ?? "01",
    correoEmisor: text(raw.correoEmisor),
    distrito: text(raw.distrito),
    hasHaciendaPassword: bool(raw.hasHaciendaPassword),
    hasHaciendaUsuario: bool(raw.hasHaciendaUsuario),
    hasP12: bool(raw.hasP12),
    hasPin: bool(raw.hasPin),
    identificacion: text(raw.identificacion),
    identificacionProveedorSistema: text(raw.identificacionProveedorSistema),
    listoParaEmitir: false,
    medioPago: text(raw.medioPago) ?? "01",
    otrasSenas: text(raw.otrasSenas),
    provincia: text(raw.provincia),
    razonSocial: text(raw.razonSocial),
    sucursal: text(raw.sucursal) ?? "001",
    terminal: text(raw.terminal) ?? "00001",
    tipoIdentificacion: text(raw.tipoIdentificacion) ?? "02",
  };

  return ok({ ...config, listoParaEmitir: fiscalReady(config) });
}

export async function getInvoicesForSales(
  tenant: TenantContext,
  ventaIds: string[],
): Promise<CoreResult<Record<string, ElectronicInvoice>>> {
  if (
    !hasAnyPermission(tenant.permissions, [
      "billing.invoices.view",
      "billing.invoices.create",
      "billing.issue",
    ]) ||
    ventaIds.length === 0
  ) {
    return ok({});
  }

  const supabase = await createClient();
  const { data: fiscalRows, error: fiscalError } = await supabase
    .from("fiscal_documents")
    .select("id, sale_id, customer_id, clave, consecutivo, status, hacienda_status, environment, totals")
    .eq("empresa_id", tenant.empresaId)
    .in("sale_id", ventaIds)
    .not("sale_id", "is", null)
    .not("status", "in", "(cancelled_internal,replaced)")
    .order("created_at", { ascending: false });
  const invoicesBySaleId = new Map<string, ElectronicInvoice>();

  if (!fiscalError) {
    for (const row of (fiscalRows ?? []) as FiscalInvoiceRow[]) {
      if (!invoicesBySaleId.has(row.sale_id)) {
        invoicesBySaleId.set(row.sale_id, mapFiscalDocumentInvoice(row));
      }
    }
  }

  const { data, error } = await supabase
    .from("facturas_electronicas")
    .select("id, venta_id, cliente_id, numero, clave, estado, ambiente, total")
    .eq("empresa_id", tenant.empresaId)
    .in("venta_id", ventaIds);

  if (error) return ok(Object.fromEntries(invoicesBySaleId));

  for (const row of (data ?? []) as InvoiceRow[]) {
    if (!invoicesBySaleId.has(row.venta_id)) {
      invoicesBySaleId.set(row.venta_id, mapInvoice(row));
    }
  }

  return ok(Object.fromEntries(invoicesBySaleId));
}

export type BillingConfigStatus =
  | "missing"
  | "incomplete"
  | "ready_for_xml"
  | "ready_for_signing"
  | "ready_for_hacienda"
  | "error";

export type BillingDashboardSummary = {
  acceptedCount: number;
  configStatus: BillingConfigStatus;
  errorCount: number;
  pendingCount: number;
  rejectedCount: number;
  recentDocuments: {
    clave: string | null;
    consecutivo: string | null;
    createdAt: string;
    customerName: string | null;
    documentTypeCode: string;
    haciendaStatus: string;
    id: string;
    status: string;
    total: number | null;
  }[];
};

export type ProductCabysProfile = {
  cabysCode: string | null;
  cabysDescription: string | null;
  fiscalNotes: string | null;
  fiscalUnitCode: string | null;
  productCode: string | null;
  productId: string;
  productName: string;
  productType: string;
};

export type CabysCatalogOption = {
  code: string;
  description: string;
  taxRate: number | null;
};

export type FiscalDocumentDetail = {
  branchCode: string | null;
  clave: string | null;
  consecutivo: string | null;
  createdAt: string;
  creditTermDays: number | null;
  currencyCode: string;
  documentTypeCode: string;
  environment: string;
  exchangeRate: number | null;
  haciendaStatus: string;
  id: string;
  issueDatetime: string | null;
  issuerSnapshot: JsonRecord;
  lastError: string | null;
  lines: FiscalDocumentLine[];
  metadata: JsonRecord;
  payments: FiscalDocumentPayment[];
  providerBoundAt: string | null;
  providerCode: string | null;
  providerConnectionId: string | null;
  providerDocumentId: string | null;
  providerEnvironment: string | null;
  providerReference: string | null;
  providerStatus: string | null;
  receiverName: string | null;
  receiverEmail: string | null;
  receiverIdentificationType: string | null;
  receiverSnapshot: JsonRecord;
  references: FiscalDocumentReference[];
  saleConditionCode: string | null;
  status: string;
  terminalCode: string | null;
  totals: JsonRecord;
  validationErrors: unknown[];
  xmlUnsignedStoragePath: string | null;
};

export type FiscalDocumentPayment = {
  amount: number;
  paymentMethodCode: string;
};

export type FiscalDocumentReference = {
  reason: string | null;
  referenceClave: string | null;
  referenceCode: string | null;
  referenceDocumentTypeCode: string | null;
  referenceIssueDate: string | null;
};

export type FiscalDocumentLineTax = {
  amount: number;
  rate: number | null;
  taxCode: string;
  taxRateCode: string | null;
  taxableBase: number | null;
};

export type FiscalDocumentLine = {
  cabysCode: string | null;
  commercialCode: string | null;
  detail: string;
  discountAmount: number;
  grossAmount: number;
  isExempt: boolean;
  isNonSubject: boolean;
  lineNumber: number;
  quantity: number;
  subtotal: number;
  taxableBase: number | null;
  taxAmount: number;
  taxes: FiscalDocumentLineTax[];
  totalLineAmount: number;
  unitCode: string;
  unitPrice: number;
};

export type FiscalDocumentArtifactSummary = {
  artifactType: string;
  contentMimeType: string;
  createdAt: string;
  id: string;
  sha256: string | null;
  status: string;
};

export type FiscalDocumentArtifactDownload = FiscalDocumentArtifactSummary & {
  contentText: string;
};

export type ReceivedFiscalDocumentSummary = {
  clave: string | null;
  consecutivo: string | null;
  createdAt: string;
  currencyCode: string | null;
  documentDirection: "incoming" | "outgoing";
  documentRoot: string | null;
  haciendaStatus: string | null;
  haciendaStatusVerified: boolean;
  id: string;
  importSource: string;
  issuerIdentification: string | null;
  issuerName: string | null;
  linkedSaleId: string | null;
  linkedSaleNumber: string | null;
  receiverIdentification: string | null;
  receiverName: string | null;
  receiverResponseStatus: string;
  receiverMessageArtifactId: string | null;
  sourceName: string | null;
  totalAmount: number | null;
  validationErrors: unknown[];
  xmlArtifactId: string | null;
  xsdValid: boolean | null;
};

export type FiscalXmlImportBatchSummary = {
  clave: string | null;
  createdAt: string;
  currencyCode: string | null;
  documentDirection: "incoming" | "outgoing";
  duplicateDocumentId: string | null;
  id: string;
  importSource: string;
  importedDocumentId: string | null;
  issuerName: string | null;
  sourceName: string | null;
  status: "previewed" | "processing" | "imported" | "duplicate" | "rejected";
  suggestedSaleId: string | null;
  suggestedSaleNumber: string | null;
  totalAmount: number | null;
  validationErrors: unknown[];
  xsdErrors: unknown[];
  xsdValid: boolean;
};

export type FiscalImportSaleCandidate = {
  currencyCode: string;
  date: string;
  id: string;
  number: string;
  totalAmount: number;
};

export type ReceivedFiscalDocumentArtifactSummary = {
  artifactType: string;
  contentMimeType: string;
  createdAt: string;
  id: string;
  receivedDocumentId: string;
  sha256: string | null;
  status: string;
};

export type ReceivedFiscalDocumentArtifactDownload = ReceivedFiscalDocumentArtifactSummary & {
  contentText: string;
};

type FiscalDocumentSummaryRow = {
  clave: string | null;
  consecutivo: string | null;
  created_at: string;
  document_type_code: string;
  hacienda_status: string;
  id: string;
  receiver_name: string | null;
  status: string;
  totals: JsonRecord | null;
};

type FiscalDocumentDetailRow = {
  branch_code: string | null;
  clave: string | null;
  consecutivo: string | null;
  created_at: string;
  credit_term_days: number | null;
  currency_code: string;
  document_type_code: string;
  environment: string;
  exchange_rate: number | null;
  hacienda_status: string;
  id: string;
  issue_datetime: string | null;
  issuer_snapshot: JsonRecord | null;
  last_error: string | null;
  metadata: JsonRecord | null;
  provider_bound_at: string | null;
  provider_code: string | null;
  provider_document_id: string | null;
  provider_environment: string | null;
  provider_reference: string | null;
  provider_status: string | null;
  fiscal_connection_id: string | null;
  receiver_name: string | null;
  receiver_email: string | null;
  receiver_identification_type: string | null;
  receiver_snapshot: JsonRecord | null;
  sale_condition_code: string | null;
  status: string;
  terminal_code: string | null;
  totals: JsonRecord | null;
  validation_errors: unknown[] | null;
  xml_unsigned_storage_path: string | null;
};

type FiscalDocumentPaymentRow = {
  amount: number;
  payment_method_code: string;
};

type FiscalDocumentReferenceRow = {
  reason: string | null;
  reference_clave: string | null;
  reference_code: string | null;
  reference_document_type_code: string | null;
  reference_issue_date: string | null;
};

type FiscalDocumentLineRow = {
  cabys_code: string | null;
  commercial_code: string | null;
  detail: string;
  discount_amount: number;
  fiscal_document_line_taxes?: FiscalDocumentLineTaxRow[] | null;
  gross_amount: number;
  is_exempt: boolean;
  is_non_subject: boolean;
  line_number: number;
  quantity: number;
  subtotal: number;
  taxable_base: number | null;
  tax_amount: number;
  total_line_amount: number;
  unit_code: string;
  unit_price: number;
};

type FiscalDocumentLineTaxRow = {
  amount: number;
  rate: number | null;
  tax_code: string;
  tax_rate_code: string | null;
  taxable_base: number | null;
};

type ProductCabysProfileRow = {
  codigo: string | null;
  id: string;
  nombre: string;
  tipo: string;
};

type FiscalProfileRow = {
  cabys_code: string | null;
  cabys_catalog?: { description: string | null } | { description: string | null }[] | null;
  fiscal_notes: string | null;
  fiscal_unit_code: string | null;
  product_id: string;
};

type CabysCatalogRow = {
  code: string;
  description: string;
  tax_rate: number | null;
};

type FiscalDocumentArtifactRow = {
  artifact_type: string;
  content_mime_type: string;
  content_text?: string | null;
  created_at: string;
  id: string;
  sha256: string | null;
  status: string;
};

type ReceivedFiscalDocumentSummaryRow = {
  clave: string | null;
  consecutivo: string | null;
  created_at: string;
  currency_code: string | null;
  document_direction: "incoming" | "outgoing";
  document_root: string | null;
  hacienda_status: string | null;
  hacienda_status_verified: boolean;
  id: string;
  import_source: string;
  issuer_identification: string | null;
  issuer_name: string | null;
  linked_sale_id: string | null;
  receiver_identification: string | null;
  receiver_name: string | null;
  receiver_response_status: string;
  source_name: string | null;
  total_amount: number | null;
  validation_errors: unknown[] | null;
  ventas: { numero: string } | { numero: string }[] | null;
  xsd_valid: boolean | null;
};

type FiscalXmlImportBatchSummaryRow = {
  clave: string | null;
  created_at: string;
  currency_code: string | null;
  document_direction: "incoming" | "outgoing";
  duplicate_document_id: string | null;
  id: string;
  import_source: string;
  imported_document_id: string | null;
  issuer_name: string | null;
  source_name: string | null;
  status: FiscalXmlImportBatchSummary["status"];
  suggested_sale_id: string | null;
  total_amount: number | null;
  validation_errors: unknown[] | null;
  ventas: { numero: string } | { numero: string }[] | null;
  xsd_errors: unknown[] | null;
  xsd_valid: boolean;
};

type ReceivedFiscalDocumentArtifactRow = {
  artifact_type: string;
  content_mime_type: string;
  content_text?: string | null;
  created_at: string;
  fiscal_received_document_id: string;
  id: string;
  sha256: string | null;
  status: string;
};

function normalizeBillingConfigStatus(value: unknown): BillingConfigStatus {
  if (
    value === "missing" ||
    value === "incomplete" ||
    value === "ready_for_xml" ||
    value === "ready_for_signing" ||
    value === "ready_for_hacienda" ||
    value === "error"
  ) {
    return value;
  }

  return "missing";
}

function totalFromJson(totals: JsonRecord | null) {
  const value = totals?.totalComprobante ?? totals?.total ?? null;
  return typeof value === "number" ? value : null;
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function fiscalProfileDescription(row: FiscalProfileRow | undefined) {
  return relationOne(row?.cabys_catalog)?.description ?? null;
}

export async function getBillingDashboardSummary(
  tenant: TenantContext,
): Promise<CoreResult<BillingDashboardSummary>> {
  const empty: BillingDashboardSummary = {
    acceptedCount: 0,
    configStatus: "missing",
    errorCount: 0,
    pendingCount: 0,
    recentDocuments: [],
    rejectedCount: 0,
  };

  if (!canUseBilling(tenant)) {
    return ok(empty);
  }

  const supabase = await createClient();
  const { data: statusData } = await supabase.rpc("billing_config_status_for_company", {
    p_empresa_id: tenant.empresaId,
  });

  const { data, error } = await supabase
    .from("fiscal_documents")
    .select("id, document_type_code, status, hacienda_status, clave, consecutivo, receiver_name, totals, created_at")
    .eq("empresa_id", tenant.empresaId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    return ok({
      ...empty,
      configStatus: normalizeBillingConfigStatus(statusData),
    });
  }

  const rows = (data ?? []) as FiscalDocumentSummaryRow[];

  return ok({
    acceptedCount: rows.filter((row) => row.status === "accepted").length,
    configStatus: normalizeBillingConfigStatus(statusData),
    errorCount: rows.filter((row) => row.status.startsWith("error")).length,
    pendingCount: rows.filter((row) =>
      ["draft", "validated", "xml_generated", "signed", "sent", "processing"].includes(row.status),
    ).length,
    recentDocuments: rows.map((row) => ({
      clave: row.clave,
      consecutivo: row.consecutivo,
      createdAt: row.created_at,
      customerName: row.receiver_name,
      documentTypeCode: row.document_type_code,
      haciendaStatus: row.hacienda_status,
      id: row.id,
      status: row.status,
      total: totalFromJson(row.totals),
    })),
    rejectedCount: rows.filter((row) => row.status === "rejected").length,
  });
}

export async function getProductCabysProfiles(
  tenant: TenantContext,
): Promise<CoreResult<ProductCabysProfile[]>> {
  if (!canUseBilling(tenant)) {
    return ok([]);
  }

  const supabase = await createClient();
  const [{ data: products, error: productsError }, { data: profiles }] = await Promise.all([
    supabase
      .from("catalogo_productos")
      .select("id, codigo, nombre, tipo")
      .eq("empresa_id", tenant.empresaId)
      .eq("estado", "activo")
      .order("nombre", { ascending: true })
      .limit(100),
    supabase
      .from("catalog_product_fiscal_profile")
      .select("product_id, cabys_code, fiscal_unit_code, fiscal_notes, cabys_catalog(description)")
      .eq("empresa_id", tenant.empresaId),
  ]);

  if (productsError) {
    return ok([]);
  }

  const profilesByProduct = new Map(
    ((profiles ?? []) as FiscalProfileRow[]).map((profile) => [profile.product_id, profile]),
  );

  return ok(
    ((products ?? []) as ProductCabysProfileRow[]).map((product) => {
      const profile = profilesByProduct.get(product.id);

      return {
        cabysCode: profile?.cabys_code ?? null,
        cabysDescription: fiscalProfileDescription(profile),
        fiscalNotes: profile?.fiscal_notes ?? null,
        fiscalUnitCode: profile?.fiscal_unit_code ?? null,
        productCode: product.codigo,
        productId: product.id,
        productName: product.nombre,
        productType: product.tipo,
      };
    }),
  );
}

export async function searchCabysCatalog(
  tenant: TenantContext,
  query: string | undefined,
): Promise<CoreResult<CabysCatalogOption[]>> {
  if (!canUseBilling(tenant)) {
    return ok([]);
  }

  const search = query?.trim();
  if (!search || search.length < 2) {
    return ok([]);
  }

  const supabase = await createClient();
  let request = supabase
    .from("cabys_catalog")
    .select("code, description, tax_rate")
    .limit(20);

  if (/^\d+$/.test(search)) {
    request = request.ilike("code", `${search}%`);
  } else {
    request = request.ilike("description", `%${search}%`);
  }

  const { data, error } = await request;

  if (error) {
    return ok([]);
  }

  return ok(
    ((data ?? []) as CabysCatalogRow[]).map((row) => ({
      code: row.code,
      description: row.description,
      taxRate: row.tax_rate,
    })),
  );
}

export async function getFiscalDocumentDetail(
  tenant: TenantContext,
  documentId: string,
): Promise<CoreResult<FiscalDocumentDetail | null>> {
  if (!canUseBilling(tenant)) {
    return ok(null);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fiscal_documents")
    .select("id, document_type_code, status, hacienda_status, clave, consecutivo, environment, branch_code, terminal_code, currency_code, exchange_rate, sale_condition_code, credit_term_days, issuer_snapshot, receiver_name, receiver_email, receiver_identification_type, receiver_snapshot, totals, validation_errors, last_error, metadata, issue_datetime, xml_unsigned_storage_path, created_at, fiscal_connection_id, provider_code, provider_environment, provider_document_id, provider_reference, provider_status, provider_bound_at")
    .eq("empresa_id", tenant.empresaId)
    .eq("id", documentId)
    .maybeSingle<FiscalDocumentDetailRow>();

  if (error || !data) {
    return ok(null);
  }

  const [{ data: lines }, { data: payments }, { data: references }] = await Promise.all([
    supabase
      .from("fiscal_document_lines")
      .select("line_number, cabys_code, commercial_code, quantity, unit_code, detail, unit_price, gross_amount, discount_amount, subtotal, taxable_base, tax_amount, total_line_amount, is_exempt, is_non_subject, fiscal_document_line_taxes(tax_code, tax_rate_code, rate, amount, taxable_base)")
      .eq("empresa_id", tenant.empresaId)
      .eq("fiscal_document_id", documentId)
      .order("line_number", { ascending: true }),
    supabase
      .from("fiscal_document_payments")
      .select("payment_method_code, amount")
      .eq("empresa_id", tenant.empresaId)
      .eq("fiscal_document_id", documentId),
    supabase
      .from("fiscal_document_references")
      .select("reference_document_type_code, reference_clave, reference_issue_date, reference_code, reason")
      .eq("empresa_id", tenant.empresaId)
      .eq("fiscal_document_id", documentId),
  ]);

  return ok({
    branchCode: data.branch_code,
    clave: data.clave,
    consecutivo: data.consecutivo,
    createdAt: data.created_at,
    creditTermDays: data.credit_term_days,
    currencyCode: data.currency_code,
    documentTypeCode: data.document_type_code,
    environment: data.environment,
    exchangeRate: data.exchange_rate,
    haciendaStatus: data.hacienda_status,
    id: data.id,
    issueDatetime: data.issue_datetime,
    issuerSnapshot: data.issuer_snapshot ?? {},
    lastError: data.last_error,
    lines: ((lines ?? []) as FiscalDocumentLineRow[]).map((line) => ({
      cabysCode: line.cabys_code,
      commercialCode: line.commercial_code,
      detail: line.detail,
      discountAmount: line.discount_amount,
      grossAmount: line.gross_amount,
      isExempt: line.is_exempt,
      isNonSubject: line.is_non_subject,
      lineNumber: line.line_number,
      quantity: line.quantity,
      subtotal: line.subtotal,
      taxableBase: line.taxable_base,
      taxAmount: line.tax_amount,
      taxes: (line.fiscal_document_line_taxes ?? []).map((tax) => ({
        amount: tax.amount,
        rate: tax.rate,
        taxCode: tax.tax_code,
        taxRateCode: tax.tax_rate_code,
        taxableBase: tax.taxable_base,
      })),
      totalLineAmount: line.total_line_amount,
      unitCode: line.unit_code,
      unitPrice: line.unit_price,
    })),
    metadata: data.metadata ?? {},
    payments: ((payments ?? []) as FiscalDocumentPaymentRow[]).map((payment) => ({
      amount: payment.amount,
      paymentMethodCode: payment.payment_method_code,
    })),
    providerBoundAt: data.provider_bound_at,
    providerCode: data.provider_code,
    providerConnectionId: data.fiscal_connection_id,
    providerDocumentId: data.provider_document_id,
    providerEnvironment: data.provider_environment,
    providerReference: data.provider_reference,
    providerStatus: data.provider_status,
    receiverName: data.receiver_name,
    receiverEmail: data.receiver_email,
    receiverIdentificationType: data.receiver_identification_type,
    receiverSnapshot: data.receiver_snapshot ?? {},
    references: ((references ?? []) as FiscalDocumentReferenceRow[]).map((reference) => ({
      reason: reference.reason,
      referenceClave: reference.reference_clave,
      referenceCode: reference.reference_code,
      referenceDocumentTypeCode: reference.reference_document_type_code,
      referenceIssueDate: reference.reference_issue_date,
    })),
    saleConditionCode: data.sale_condition_code,
    status: data.status,
    terminalCode: data.terminal_code,
    totals: data.totals ?? {},
    validationErrors: data.validation_errors ?? [],
    xmlUnsignedStoragePath: data.xml_unsigned_storage_path,
  });
}

export async function getFiscalDocumentArtifacts(
  tenant: TenantContext,
  documentId: string,
): Promise<CoreResult<FiscalDocumentArtifactSummary[]>> {
  if (!canUseBilling(tenant)) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fiscal_document_artifacts")
    .select("id, artifact_type, content_mime_type, sha256, status, created_at")
    .eq("empresa_id", tenant.empresaId)
    .eq("fiscal_document_id", documentId)
    .order("created_at", { ascending: false });

  if (error) return ok([]);

  return ok(
    ((data ?? []) as FiscalDocumentArtifactRow[]).map((row) => ({
      artifactType: row.artifact_type,
      contentMimeType: row.content_mime_type,
      createdAt: row.created_at,
      id: row.id,
      sha256: row.sha256,
      status: row.status,
    })),
  );
}

export async function getFiscalDocumentArtifactForDownload(
  tenant: TenantContext,
  documentId: string,
  artifactId: string,
): Promise<CoreResult<FiscalDocumentArtifactDownload | null>> {
  if (!canUseBilling(tenant)) {
    return ok(null);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fiscal_document_artifacts")
    .select("id, artifact_type, content_mime_type, content_text, sha256, status, created_at")
    .eq("empresa_id", tenant.empresaId)
    .eq("fiscal_document_id", documentId)
    .eq("id", artifactId)
    .maybeSingle<FiscalDocumentArtifactRow>();

  if (error || !data || typeof data.content_text !== "string") {
    return ok(null);
  }

  return ok({
    artifactType: data.artifact_type,
    contentMimeType: data.content_mime_type,
    contentText: data.content_text,
    createdAt: data.created_at,
    id: data.id,
    sha256: data.sha256,
    status: data.status,
  });
}

export async function getReceivedFiscalDocuments(
  tenant: TenantContext,
): Promise<CoreResult<ReceivedFiscalDocumentSummary[]>> {
  if (!canUseBilling(tenant)) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fiscal_received_documents")
    .select("id, clave, consecutivo, issuer_name, issuer_identification, receiver_name, receiver_identification, total_amount, currency_code, document_direction, document_root, import_source, source_name, linked_sale_id, hacienda_status, hacienda_status_verified, receiver_response_status, validation_errors, xsd_valid, created_at, ventas!fiscal_received_documents_linked_sale_empresa_fkey(numero)")
    .eq("empresa_id", tenant.empresaId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar los XML importados.", error);
  }

  const rows = (data ?? []) as ReceivedFiscalDocumentSummaryRow[];
  const documentIds = rows.map((row) => row.id);
  const { data: artifacts } = documentIds.length
    ? await supabase
        .from("fiscal_received_document_artifacts")
        .select("id, fiscal_received_document_id, artifact_type")
        .eq("empresa_id", tenant.empresaId)
        .in("artifact_type", ["xml_received", "receiver_message"])
        .in("fiscal_received_document_id", documentIds)
    : { data: [] };
  const xmlArtifactByDocument = new Map(
    ((artifacts ?? []) as Pick<
      ReceivedFiscalDocumentArtifactRow,
      "artifact_type" | "fiscal_received_document_id" | "id"
    >[])
      .filter((artifact) => artifact.artifact_type === "xml_received")
      .map((artifact) => [artifact.fiscal_received_document_id, artifact.id]),
  );
  const receiverMessageArtifactByDocument = new Map(
    ((artifacts ?? []) as Pick<
      ReceivedFiscalDocumentArtifactRow,
      "artifact_type" | "fiscal_received_document_id" | "id"
    >[])
      .filter((artifact) => artifact.artifact_type === "receiver_message")
      .map((artifact) => [artifact.fiscal_received_document_id, artifact.id]),
  );

  return ok(
    rows.map((row) => ({
      clave: row.clave,
      consecutivo: row.consecutivo,
      createdAt: row.created_at,
      currencyCode: row.currency_code,
      documentDirection: row.document_direction,
      documentRoot: row.document_root,
      haciendaStatus: row.hacienda_status,
      haciendaStatusVerified: row.hacienda_status_verified,
      id: row.id,
      importSource: row.import_source,
      issuerIdentification: row.issuer_identification,
      issuerName: row.issuer_name,
      linkedSaleId: row.linked_sale_id,
      linkedSaleNumber: relationOne(row.ventas)?.numero ?? null,
      receiverIdentification: row.receiver_identification,
      receiverName: row.receiver_name,
      receiverMessageArtifactId: receiverMessageArtifactByDocument.get(row.id) ?? null,
      receiverResponseStatus: row.receiver_response_status,
      sourceName: row.source_name,
      totalAmount: row.total_amount,
      validationErrors: row.validation_errors ?? [],
      xmlArtifactId: xmlArtifactByDocument.get(row.id) ?? null,
      xsdValid: row.xsd_valid,
    })),
  );
}

export async function getFiscalXmlImportBatches(
  tenant: TenantContext,
): Promise<CoreResult<FiscalXmlImportBatchSummary[]>> {
  if (!canUseBilling(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver importaciones fiscales.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fiscal_xml_import_batches")
    .select("id, import_source, document_direction, source_name, status, clave, issuer_name, total_amount, currency_code, xsd_valid, xsd_errors, validation_errors, duplicate_document_id, suggested_sale_id, imported_document_id, created_at, ventas!fiscal_xml_import_batches_sale_empresa_fkey(numero)")
    .eq("empresa_id", tenant.empresaId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo consultar el historial de importacion.", error);
  }

  return ok(
    ((data ?? []) as FiscalXmlImportBatchSummaryRow[]).map((row) => ({
      clave: row.clave,
      createdAt: row.created_at,
      currencyCode: row.currency_code,
      documentDirection: row.document_direction,
      duplicateDocumentId: row.duplicate_document_id,
      id: row.id,
      importSource: row.import_source,
      importedDocumentId: row.imported_document_id,
      issuerName: row.issuer_name,
      sourceName: row.source_name,
      status: row.status,
      suggestedSaleId: row.suggested_sale_id,
      suggestedSaleNumber: relationOne(row.ventas)?.numero ?? null,
      totalAmount: row.total_amount,
      validationErrors: row.validation_errors ?? [],
      xsdErrors: row.xsd_errors ?? [],
      xsdValid: row.xsd_valid,
    })),
  );
}

export async function getFiscalImportSaleCandidates(
  tenant: TenantContext,
): Promise<CoreResult<FiscalImportSaleCandidate[]>> {
  if (!hasAnyPermission(tenant.permissions, ["sales.orders.view"])) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ventas")
    .select("id, numero, fecha_venta, moneda, total")
    .eq("empresa_id", tenant.empresaId)
    .neq("estado", "cancelada")
    .order("fecha_venta", { ascending: false })
    .limit(100);

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar ventas para vincular.", error);
  }

  return ok(
    ((data ?? []) as {
      fecha_venta: string;
      id: string;
      moneda: string;
      numero: string;
      total: number;
    }[]).map((row) => ({
      currencyCode: row.moneda,
      date: row.fecha_venta,
      id: row.id,
      number: row.numero,
      totalAmount: row.total,
    })),
  );
}

export async function getReceivedFiscalDocumentArtifactForDownload(
  tenant: TenantContext,
  receivedDocumentId: string,
  artifactId: string,
): Promise<CoreResult<ReceivedFiscalDocumentArtifactDownload | null>> {
  if (!canUseBilling(tenant)) {
    return ok(null);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fiscal_received_document_artifacts")
    .select("id, fiscal_received_document_id, artifact_type, content_mime_type, content_text, sha256, status, created_at")
    .eq("empresa_id", tenant.empresaId)
    .eq("fiscal_received_document_id", receivedDocumentId)
    .eq("id", artifactId)
    .maybeSingle<ReceivedFiscalDocumentArtifactRow>();

  if (error || !data || typeof data.content_text !== "string") {
    return ok(null);
  }

  return ok({
    artifactType: data.artifact_type,
    contentMimeType: data.content_mime_type,
    contentText: data.content_text,
    createdAt: data.created_at,
    id: data.id,
    receivedDocumentId: data.fiscal_received_document_id,
    sha256: data.sha256,
    status: data.status,
  });
}
