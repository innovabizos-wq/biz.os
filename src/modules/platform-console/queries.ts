import { createClient } from "@/lib/supabase/server";
import { getModuleDefinition } from "@/modules/platform-modules/module-catalog";
import type {
  PlatformActivityItem,
  PlatformBillingHealth,
  PlatformCompanyDetail,
  PlatformCompanyListItem,
  PlatformCompanyModule,
  PlatformCompanyUser,
  PlatformHealthItem,
  PlatformSummary,
  PlatformWhappChannel,
} from "@/modules/platform-console/types";
import type { EmpresaEstado, JsonRecord, ModuleCode } from "@/types/core";
import type { CoreResult } from "@/types/core";
import { fail, ok } from "@/types/core";

type CountResult = { count: number | null };

type CompanyRow = {
  correo: string | null;
  created_at: string;
  estado: EmpresaEstado;
  id: string;
  identificacion_fiscal: string | null;
  nombre: string;
  nombre_comercial: string | null;
  telefono: string | null;
  updated_at: string;
};

type ModuleRelation = {
  codigo: string;
  nombre: string;
};

type CompanyModuleRow = {
  empresa_id: string;
  estado: string;
  modulos: ModuleRelation | ModuleRelation[] | null;
};

type PlanRelation = {
  codigo: string;
  nombre: string;
};

type CompanyPlanRow = {
  empresa_id: string;
  estado: string;
  planes: PlanRelation | PlanRelation[] | null;
};

type ProfileRow = {
  correo: string;
  created_at: string;
  empresa_id: string;
  estado: string;
  id: string;
  nombre: string;
  roles?: { nombre: string | null } | { nombre: string | null }[] | null;
};

type HealthRow = {
  configuration_complete: boolean;
  credentials_present: boolean;
  empresa_id: string;
  empresas?: { nombre: string | null } | { nombre: string | null }[] | null;
  last_error: string | null;
  last_error_at: string | null;
  metadata: JsonRecord | null;
  modulo_codigo: string;
  status: string;
};

type WebhookEventRow = {
  canal_id: string | null;
  empresa_id: string | null;
  error: string | null;
  event_type: string | null;
  received_at: string;
};

type WhappChannelRow = {
  canal: string;
  configuracion_publica: JsonRecord | null;
  conexion_estado: string;
  empresa_id: string;
  empresas?: { nombre: string | null } | { nombre: string | null }[] | null;
  estado: string;
  id: string;
  identificador_externo: string | null;
  nombre: string;
  proveedor: string;
  proveedor_estado: string | null;
  webhook_url: string | null;
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function countValue(result: CountResult) {
  return result.count ?? 0;
}

function companyNameFromHealth(row: HealthRow) {
  return relationOne(row.empresas)?.nombre ?? null;
}

function mapHealth(row: HealthRow): PlatformHealthItem {
  return {
    companyId: row.empresa_id,
    companyName: companyNameFromHealth(row),
    configurationComplete: row.configuration_complete,
    credentialsPresent: row.credentials_present,
    lastError: row.last_error,
    lastErrorAt: row.last_error_at,
    metadata: row.metadata ?? {},
    moduleCode: row.modulo_codigo,
    status: row.status,
  };
}

function moduleDefinition(code: string) {
  try {
    return getModuleDefinition(code as ModuleCode);
  } catch {
    return null;
  }
}

function mapCompanyModule(row: CompanyModuleRow, health?: HealthRow): PlatformCompanyModule {
  const moduleRelation = relationOne(row.modulos);
  const definition = moduleDefinition(moduleRelation?.codigo ?? "");

  return {
    code: moduleRelation?.codigo ?? "unknown",
    healthStatus: health?.status ?? null,
    isCore: definition?.kind === "core",
    name: moduleRelation?.nombre ?? definition?.name ?? "Modulo sin nombre",
    softDependencies: definition?.softDependencies ?? [],
    status: row.estado,
  };
}

function mapCompanyUser(row: ProfileRow): PlatformCompanyUser {
  return {
    email: row.correo,
    id: row.id,
    name: row.nombre,
    roleName: relationOne(row.roles)?.nombre ?? null,
    status: row.estado,
  };
}

function configText(config: JsonRecord | null, keys: string[]) {
  for (const key of keys) {
    const value = config?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return null;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function boolValue(value: unknown) {
  return value === true;
}

function mapPlatformBillingHealth(value: unknown): PlatformBillingHealth | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as JsonRecord;
  const receivedErrors = Array.isArray(record.lastReceivedValidationErrors)
    ? record.lastReceivedValidationErrors
    : [];

  return {
    artifactCounts: asRecord(record.artifactCounts),
    billingConfigStatus: textValue(record.billingConfigStatus),
    certificatePresent: boolValue(record.certificatePresent),
    configurationComplete: boolValue(record.configurationComplete),
    credentialsPresent: boolValue(record.credentialsPresent),
    documentCounts: asRecord(record.documentCounts),
    lastError: textValue(record.lastError),
    lastHaciendaStatus: textValue(record.lastHaciendaStatus),
    lastReceivedValidationErrors: receivedErrors,
    receivedArtifactCounts: asRecord(record.receivedArtifactCounts),
    receivedDocumentCounts: asRecord(record.receivedDocumentCounts),
  };
}

export async function getPlatformSummary(): Promise<CoreResult<PlatformSummary>> {
  const supabase = await createClient();
  const [
    companiesCount,
    activeCompaniesCount,
    suspendedCompaniesCount,
    healthErrorsCount,
    whappPendingCount,
    latestCompaniesResult,
    latestHealthResult,
  ] = await Promise.all([
    supabase.from("empresas").select("id", { count: "exact", head: true }),
    supabase
      .from("empresas")
      .select("id", { count: "exact", head: true })
      .eq("estado", "activa"),
    supabase
      .from("empresas")
      .select("id", { count: "exact", head: true })
      .eq("estado", "suspendida"),
    supabase
      .from("empresa_modulo_health")
      .select("id", { count: "exact", head: true })
      .in("status", ["misconfigured", "unhealthy"]),
    supabase
      .from("inbox_canales")
      .select("id", { count: "exact", head: true })
      .eq("canal", "whatsapp")
      .eq("proveedor", "meta")
      .in("conexion_estado", ["pendiente", "error"]),
    supabase
      .from("empresas")
      .select("id, nombre, estado, created_at, correo, telefono, identificacion_fiscal, nombre_comercial, updated_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("empresa_modulo_health")
      .select("empresa_id, modulo_codigo, status, configuration_complete, credentials_present, last_error, last_error_at, metadata, empresas(nombre)")
      .in("status", ["misconfigured", "unhealthy"])
      .order("last_error_at", { ascending: false, nullsFirst: false })
      .limit(8),
  ]);

  if (companiesCount.error) {
    return fail("PERMISSION_DENIED", "No se pudo cargar Platform Console.", companiesCount.error);
  }

  const latestCompanies = await decorateCompanies(
    ((latestCompaniesResult.data ?? []) as CompanyRow[]),
  );

  return ok({
    activeCompanies: countValue(activeCompaniesCount),
    companies: countValue(companiesCount),
    healthErrors: countValue(healthErrorsCount),
    integrationErrors: countValue(healthErrorsCount),
    latestCompanies,
    latestHealthErrors: ((latestHealthResult.data ?? []) as HealthRow[]).map(mapHealth),
    suspendedCompanies: countValue(suspendedCompaniesCount),
    whappPendingChannels: countValue(whappPendingCount),
  });
}

async function decorateCompanies(rows: CompanyRow[]): Promise<PlatformCompanyListItem[]> {
  if (rows.length === 0) return [];

  const empresaIds = rows.map((row) => row.id);
  const supabase = await createClient();
  const [modulesResult, usersResult, plansResult, healthResult] = await Promise.all([
    supabase
      .from("empresa_modulos")
      .select("empresa_id, estado, modulos(codigo, nombre)")
      .in("empresa_id", empresaIds),
    supabase.from("profiles").select("empresa_id, id").in("empresa_id", empresaIds),
    supabase
      .from("empresa_plan")
      .select("empresa_id, estado, planes(codigo, nombre)")
      .in("empresa_id", empresaIds)
      .eq("estado", "activo"),
    supabase
      .from("empresa_modulo_health")
      .select("empresa_id, status")
      .in("empresa_id", empresaIds),
  ]);

  const modules = (modulesResult.data ?? []) as CompanyModuleRow[];
  const users = (usersResult.data ?? []) as { empresa_id: string; id: string }[];
  const plans = (plansResult.data ?? []) as CompanyPlanRow[];
  const health = (healthResult.data ?? []) as Pick<HealthRow, "empresa_id" | "status">[];

  return rows.map((company) => {
    const companyHealth = health.filter((item) => item.empresa_id === company.id);
    const hasIssues = companyHealth.some((item) =>
      ["misconfigured", "unhealthy"].includes(item.status),
    );

    return {
      activeModules: modules.filter(
        (module) => module.empresa_id === company.id && module.estado === "activo",
      ).length,
      createdAt: company.created_at,
      healthStatus: hasIssues ? "issues" : companyHealth.length > 0 ? "healthy" : "unknown",
      id: company.id,
      name: company.nombre,
      planName: relationOne(plans.find((plan) => plan.empresa_id === company.id)?.planes)?.nombre ?? null,
      status: company.estado,
      users: users.filter((user) => user.empresa_id === company.id).length,
    };
  });
}

export async function getPlatformCompanies(): Promise<CoreResult<PlatformCompanyListItem[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresas")
    .select("id, nombre, estado, created_at, correo, telefono, identificacion_fiscal, nombre_comercial, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron cargar empresas.", error);
  }

  return ok(await decorateCompanies((data ?? []) as CompanyRow[]));
}

export async function getPlatformCompanyDetail(
  empresaId: string,
): Promise<CoreResult<PlatformCompanyDetail | null>> {
  const supabase = await createClient();
  const { data: company, error } = await supabase
    .from("empresas")
    .select("id, nombre, nombre_comercial, identificacion_fiscal, correo, telefono, estado, created_at, updated_at")
    .eq("id", empresaId)
    .maybeSingle<CompanyRow>();

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo cargar la empresa.", error);
  }

  if (!company) return ok(null);

  const [modulesResult, usersResult, healthResult, planResult, webhookResult, billingHealthResult] =
    await Promise.all([
      supabase
        .from("empresa_modulos")
        .select("empresa_id, estado, modulos(codigo, nombre)")
        .eq("empresa_id", empresaId),
      supabase
        .from("profiles")
        .select("id, empresa_id, nombre, correo, estado, created_at, roles(nombre)")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false }),
      supabase
        .from("empresa_modulo_health")
        .select("empresa_id, modulo_codigo, status, configuration_complete, credentials_present, last_error, last_error_at, metadata, empresas(nombre)")
        .eq("empresa_id", empresaId)
        .order("modulo_codigo"),
      supabase
        .from("empresa_plan")
        .select("empresa_id, estado, planes(codigo, nombre)")
        .eq("empresa_id", empresaId)
        .eq("estado", "activo")
        .maybeSingle<CompanyPlanRow>(),
      supabase
        .from("inbox_webhook_eventos")
        .select("empresa_id, canal_id, event_type, error, received_at")
        .eq("empresa_id", empresaId)
        .order("received_at", { ascending: false })
        .limit(5),
      supabase.rpc("get_platform_billing_health", {
        p_empresa_id: empresaId,
      }),
    ]);

  const healthRows = (healthResult.data ?? []) as HealthRow[];
  const healthByModule = new Map(healthRows.map((row) => [row.modulo_codigo, row]));
  const activeModules = ((modulesResult.data ?? []) as CompanyModuleRow[]).map((row) =>
    mapCompanyModule(row, healthByModule.get(relationOne(row.modulos)?.codigo ?? "")),
  );
  const webhookRows = (webhookResult.data ?? []) as WebhookEventRow[];
  const recentActivity: PlatformActivityItem[] = [
    ...((usersResult.data ?? []) as ProfileRow[]).slice(0, 3).map((user) => ({
      createdAt: user.created_at,
      description: `Usuario creado: ${user.nombre}`,
      kind: "usuario",
    })),
    ...webhookRows.map((event) => ({
      createdAt: event.received_at,
      description: event.error
        ? `Webhook ${event.event_type ?? "Meta"} con error`
        : `Webhook ${event.event_type ?? "Meta"} recibido`,
      kind: "webhook",
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  const planRelation = relationOne(planResult.data?.planes ?? null);

  return ok({
    activeModules,
    billingHealth: billingHealthResult.error
      ? null
      : mapPlatformBillingHealth(billingHealthResult.data),
    company: {
      createdAt: company.created_at,
      email: company.correo,
      fiscalId: company.identificacion_fiscal,
      id: company.id,
      name: company.nombre,
      phone: company.telefono,
      status: company.estado,
      tradeName: company.nombre_comercial,
      updatedAt: company.updated_at,
    },
    health: healthRows.map(mapHealth),
    plan: {
      code: planRelation?.codigo ?? null,
      name: planRelation?.nombre ?? null,
      status: planResult.data?.estado ?? null,
    },
    recentActivity,
    users: ((usersResult.data ?? []) as ProfileRow[]).map(mapCompanyUser),
  });
}

export async function getPlatformWhappChannels(): Promise<
  CoreResult<PlatformWhappChannel[]>
> {
  const supabase = await createClient();
  const [{ data: channels, error }, { data: events }] = await Promise.all([
    supabase
      .from("inbox_canales")
      .select("id, empresa_id, canal, proveedor, nombre, identificador_externo, estado, conexion_estado, proveedor_estado, webhook_url, configuracion_publica, empresas(nombre)")
      .eq("canal", "whatsapp")
      .eq("proveedor", "meta")
      .order("updated_at", { ascending: false }),
    supabase
      .from("inbox_webhook_eventos")
      .select("empresa_id, canal_id, event_type, error, received_at")
      .order("received_at", { ascending: false })
      .limit(100),
  ]);

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron cargar canales Whapp.", error);
  }

  const eventRows = (events ?? []) as WebhookEventRow[];

  return ok(
    ((channels ?? []) as WhappChannelRow[]).map((channel) => {
      const latestEvent = eventRows.find((event) => event.canal_id === channel.id);
      const publicConfig = channel.configuracion_publica ?? {};

      return {
        channelId: channel.id,
        companyId: channel.empresa_id,
        companyName: relationOne(channel.empresas)?.nombre ?? null,
        connectionStatus: channel.conexion_estado,
        healthStatus: channel.proveedor_estado,
        lastError: latestEvent?.error ?? null,
        lastEventAt: latestEvent?.received_at ?? null,
        name: channel.nombre,
        phoneNumberId: configText(publicConfig, ["phone_number_id", "phoneNumberId"]) ?? channel.identificador_externo,
        provider: channel.proveedor,
        publicConfig,
        status: channel.estado,
        wabaId: configText(publicConfig, ["waba_id", "wabaId"]),
        webhookUrl: channel.webhook_url,
      };
    }),
  );
}
