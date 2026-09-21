import "server-only";

import { randomUUID } from "node:crypto";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createTenantContext } from "@/lib/tenant/tenant-context";
import {
  brainRuntime,
  businessSkillRegistry,
  capabilityRegistry,
  initialBrainAutomationJobs,
} from "@/modules/brain/runtime";
import type {
  BrainAutomationJobDefinition,
  BrainAutomationJobId,
  BusinessSkillResult,
} from "@/modules/brain/runtime/contracts";
import type {
  CoreResult,
  JsonRecord,
  ModuleCode,
  PermissionCode,
  PlanCode,
  TenantContext,
} from "@/types/core";
import { fail, ok } from "@/types/core";

type ExecuteAutomationJobInput = {
  input?: JsonRecord;
  jobId?: string;
  runId?: string;
};

type AutomationJobExecution = {
  capabilityId: string;
  jobId: BrainAutomationJobId;
  message: string;
  metric: {
    id: string;
    measure: "task_completed" | "task_failed";
    value: number;
  };
  result: BusinessSkillResult;
  runId: string;
  skillId: string;
};

type SystemAutomationTenant = {
  empresaId: string;
  tenant: TenantContext;
};

type SystemAutomationSummary = {
  completed: number;
  failed: number;
  results: Array<{
    empresaId: string;
    error?: string;
    jobId: BrainAutomationJobId;
    runId?: string;
    status: "completed" | "failed" | "skipped";
  }>;
  tenantsReviewed: number;
};

type SystemAutomationJobExecution = {
  capabilityId: string;
  jobId: BrainAutomationJobId;
  message: string;
  metric: AutomationJobExecution["metric"];
  result: BusinessSkillResult;
  runId: string;
  skillId: string;
};

type SupabaseLike = {
  from(table: string): {
    insert(value: unknown): unknown;
  };
};

function isBrainAutomationJobId(value: unknown): value is BrainAutomationJobId {
  return (
    typeof value === "string" &&
    initialBrainAutomationJobs.some((job) => job.id === value)
  );
}

function getAutomationJob(jobId: BrainAutomationJobId) {
  return initialBrainAutomationJobs.find((job) => job.id === jobId) ?? null;
}

function defaultInputForJob(job: BrainAutomationJobDefinition): JsonRecord {
  if (
    job.id === "collections.overdue.scan" ||
    job.id === "inventory.low_stock.scan" ||
    job.id === "quotes.expired.scan" ||
    job.id === "conversations.sla.overdue.scan"
  ) {
    return { limit: 20 };
  }

  return {};
}

async function writeAutomationAuditWithClient(
  supabase: SupabaseLike,
  tenant: TenantContext,
  input: {
    capabilityId: string;
    error?: string;
    jobId: string;
    metric: AutomationJobExecution["metric"];
    result?: JsonRecord;
    runId: string;
    skillId?: string;
    status: "completed" | "failed";
  },
) {
  await supabase.from("auditoria_eventos").insert({
    accion: `brain.automation.${input.status}`,
    datos_antes: null,
    datos_despues: {
      error: input.error ?? null,
      metric: input.metric,
      result: input.result ?? null,
    } satisfies JsonRecord,
    empresa_id: tenant.empresaId,
    entidad: "brain_automation_job",
    entidad_id: input.runId,
    ip: null,
    metadata: {
      capabilityId: input.capabilityId,
      jobId: input.jobId,
      runId: input.runId,
      skillId: input.skillId ?? null,
    } satisfies JsonRecord,
    sucursal_id: tenant.sucursalId ?? null,
    user_agent: null,
    usuario_id: tenant.profileId,
  });
}

async function writeAutomationAudit(
  tenant: TenantContext,
  input: Parameters<typeof writeAutomationAuditWithClient>[2],
) {
  const supabase = await createClient();
  await writeAutomationAuditWithClient(supabase, tenant, input);
}

function relationCode<TCode extends string>(value: unknown): TCode | null {
  if (!value) return null;
  if (Array.isArray(value)) return relationCode<TCode>(value[0]);
  if (typeof value === "object" && "codigo" in value) {
    const code = (value as { codigo?: unknown }).codigo;
    return typeof code === "string" ? code as TCode : null;
  }
  return typeof value === "string" ? value as TCode : null;
}

function rowsToCodes<TCode extends string>(
  rows: unknown[] | null | undefined,
  relationName: string,
) {
  return (rows ?? [])
    .map((row) =>
      relationCode<TCode>((row as Record<string, unknown>)[relationName]),
    )
    .filter((code): code is TCode => Boolean(code));
}

export async function getSystemAutomationTenants(): Promise<
  CoreResult<SystemAutomationTenant[]>
> {
  const supabase = createServiceRoleClient();
  const { data: companies, error: companiesError } = await supabase
    .from("empresas")
    .select("id")
    .eq("estado", "activa")
    .order("created_at", { ascending: true });

  if (companiesError) {
    return fail(
      "VALIDATION_ERROR",
      "No se pudieron consultar empresas para automatizaciones Brain.",
      companiesError,
    );
  }

  const tenants: SystemAutomationTenant[] = [];

  for (const company of companies ?? []) {
    const empresaId = String(company.id);
    const [
      profileResult,
      modulesResult,
      planResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, correo, nombre, rol_id, sucursal_id")
        .eq("empresa_id", empresaId)
        .eq("estado", "activo")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("empresa_modulos")
        .select("modulos(codigo)")
        .eq("empresa_id", empresaId)
        .eq("estado", "activo"),
      supabase
        .from("empresa_plan")
        .select("planes(codigo)")
        .eq("empresa_id", empresaId)
        .eq("estado", "activo")
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileResult.error || modulesResult.error || planResult.error || !profileResult.data) {
      continue;
    }

    const profile = profileResult.data as {
      correo: string | null;
      id: string;
      nombre: string | null;
      rol_id: string | null;
      sucursal_id: string | null;
    };
    const permissionsResult = profile.rol_id
      ? await supabase
          .from("rol_permisos")
          .select("permisos(codigo)")
          .eq("empresa_id", empresaId)
          .eq("rol_id", profile.rol_id)
      : { data: [], error: null };

    if (permissionsResult.error) continue;

    const tenantResult = createTenantContext({
      activeModules: rowsToCodes<ModuleCode>(
        modulesResult.data as unknown[],
        "modulos",
      ),
      empresaId,
      permissions: rowsToCodes<PermissionCode>(
        permissionsResult.data as unknown[],
        "permisos",
      ),
      planCode: relationCode<PlanCode>(
        (planResult.data as Record<string, unknown> | null)?.planes,
      ) ?? undefined,
      profileEmail: profile.correo ?? undefined,
      profileId: profile.id,
      profileName: profile.nombre ?? undefined,
      rolId: profile.rol_id ?? undefined,
      sucursalId: profile.sucursal_id ?? undefined,
    });

    if (tenantResult.ok) {
      tenants.push({ empresaId, tenant: tenantResult.data });
    }
  }

  return ok(tenants);
}

export function listBrainAutomationJobs(tenant: TenantContext) {
  const activeModules = new Set(tenant.activeModules);
  const permissions = new Set(tenant.permissions);

  return initialBrainAutomationJobs.map((job) => {
    const capability = capabilityRegistry.get(job.capabilityId);
    const binding = capability
      ? capabilityRegistry.getImplementedBinding(capability.id)
      : null;
    const skill = binding ? businessSkillRegistry.get(binding.skillId) : null;

    return {
      ...job,
      available:
        Boolean(capability?.enabled && skill?.enabled) &&
        activeModules.has(job.module) &&
        (capability?.requiredPermissions ?? []).every((permission) =>
          permissions.has(permission),
        ),
      skillId: skill?.id ?? null,
      status: capability?.status ?? "blocked",
    };
  });
}

function limitFromInput(input: JsonRecord | undefined) {
  const limit = Number(input?.limit ?? 20);
  if (!Number.isFinite(limit)) return 20;
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

function isJobAvailableForTenant(
  tenant: TenantContext,
  job: BrainAutomationJobDefinition,
) {
  const capability = capabilityRegistry.get(job.capabilityId);
  const binding = capability
    ? capabilityRegistry.getImplementedBinding(capability.id)
    : null;
  const skill = binding ? businessSkillRegistry.get(binding.skillId) : null;
  const activeModules = new Set(tenant.activeModules);
  const permissions = new Set(tenant.permissions);

  if (!capability || !binding || !skill) {
    return {
      available: false,
      capability,
      reason: "La capability del job existe, pero no tiene Skill ejecutable.",
      skill,
    };
  }

  if (!capability.enabled || !skill.enabled) {
    return {
      available: false,
      capability,
      reason: "La capability o Skill del job esta deshabilitada.",
      skill,
    };
  }

  if (!activeModules.has(job.module)) {
    return {
      available: false,
      capability,
      reason: "El modulo del job no esta activo para esta empresa.",
      skill,
    };
  }

  if (
    !capability.requiredPermissions.every((permission) =>
      permissions.has(permission),
    )
  ) {
    return {
      available: false,
      capability,
      reason: "La empresa no tiene permisos para ejecutar este job.",
      skill,
    };
  }

  return { available: true, capability, reason: null, skill };
}

function createSystemSkillResult(input: {
  data: JsonRecord;
  evidenceCount: number;
  evidenceSource: string;
  links: Array<{ href: string; label: string }>;
  message: string;
  skillId: string;
}): BusinessSkillResult {
  return {
    cached: false,
    data: input.data,
    durationMs: 0,
    evidence: [
      {
        count: input.evidenceCount,
        freshnessAt: new Date().toISOString(),
        source: input.evidenceSource,
      },
    ],
    executedAt: new Date().toISOString(),
    invocationId: randomUUID(),
    links: input.links,
    message: input.message,
    skillId: input.skillId,
  };
}

async function runReadOnlySystemJob(
  tenant: TenantContext,
  job: BrainAutomationJobDefinition,
  input: JsonRecord | undefined,
  skillId: string,
): Promise<CoreResult<BusinessSkillResult>> {
  const supabase = createServiceRoleClient();
  const limit = limitFromInput(input);
  const today = new Date().toISOString().slice(0, 10);

  if (job.id === "collections.overdue.scan") {
    const { data, error } = await supabase
      .from("payments_accounts")
      .select(
        "id, numero, descripcion, moneda, saldo, total, estado, fecha_vencimiento, cliente_id, proveedor_id, updated_at",
      )
      .eq("empresa_id", tenant.empresaId)
      .eq("tipo", "receivable")
      .gt("saldo", 0)
      .neq("estado", "anulada")
      .order("fecha_vencimiento", { ascending: true })
      .limit(limit * 2);

    if (error) {
      return fail("PERMISSION_DENIED", "No se pudieron consultar cobros vencidos.", error);
    }

    const accounts = (data ?? [])
      .filter((item) => {
        const row = item as { estado?: string | null; fecha_vencimiento?: string | null };
        return row.estado === "vencida" || Boolean(row.fecha_vencimiento && row.fecha_vencimiento < today);
      })
      .slice(0, limit) as unknown as JsonRecord[];

    return ok(
      createSystemSkillResult({
        data: { accounts, count: accounts.length },
        evidenceCount: accounts.length,
        evidenceSource: "payments_accounts",
        links: [{ href: "/pagos", label: "Abrir pagos" }],
        message: accounts.length
          ? `Encontre ${accounts.length} cobro(s) vencido(s) para revisar.`
          : "No encontre cobros vencidos.",
        skillId,
      }),
    );
  }

  if (job.id === "inventory.low_stock.scan") {
    const { data, error } = await supabase
      .from("inventario_stock")
      .select(
        "id, producto_id, bodega_id, cantidad, stock_minimo, stock_maximo, updated_at",
      )
      .eq("empresa_id", tenant.empresaId)
      .gt("stock_minimo", 0)
      .order("cantidad", { ascending: true })
      .limit(limit * 2);

    if (error) {
      return fail("PERMISSION_DENIED", "No se pudo consultar stock bajo.", error);
    }

    const stock = (data ?? [])
      .filter((item) => {
        const row = item as { cantidad?: number | string | null; stock_minimo?: number | string | null };
        return Number(row.cantidad ?? 0) <= Number(row.stock_minimo ?? 0);
      })
      .slice(0, limit) as unknown as JsonRecord[];

    return ok(
      createSystemSkillResult({
        data: { count: stock.length, stock },
        evidenceCount: stock.length,
        evidenceSource: "inventario_stock",
        links: [{ href: "/inventario", label: "Abrir inventario" }],
        message: stock.length
          ? `Encontre ${stock.length} producto(s) con stock bajo.`
          : "No encontre productos con stock bajo.",
        skillId,
      }),
    );
  }

  if (job.id === "quotes.expired.scan") {
    const { data, error } = await supabase
      .from("cotizaciones")
      .select(
        "id, numero, cliente_id, estado, fecha_vencimiento, moneda, total, updated_at",
      )
      .eq("empresa_id", tenant.empresaId)
      .in("estado", ["borrador", "enviada", "vencida"])
      .order("fecha_vencimiento", { ascending: true })
      .limit(limit * 2);

    if (error) {
      return fail("PERMISSION_DENIED", "No se pudieron consultar cotizaciones vencidas.", error);
    }

    const quotes = (data ?? [])
      .filter((item) => {
        const row = item as { estado?: string | null; fecha_vencimiento?: string | null };
        return row.estado === "vencida" || Boolean(row.fecha_vencimiento && row.fecha_vencimiento < today);
      })
      .slice(0, limit) as unknown as JsonRecord[];

    return ok(
      createSystemSkillResult({
        data: { count: quotes.length, quotes },
        evidenceCount: quotes.length,
        evidenceSource: "cotizaciones",
        links: [{ href: "/cotizaciones", label: "Abrir cotizaciones" }],
        message: quotes.length
          ? `Encontre ${quotes.length} cotizacion(es) vencida(s) o sin respuesta.`
          : "No encontre cotizaciones vencidas o sin respuesta.",
        skillId,
      }),
    );
  }

  if (job.id === "conversations.sla.overdue.scan") {
    const staleLimit = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("inbox_conversaciones")
      .select(
        "id, canal, cliente_id, contacto_nombre, contacto_identificador, estado, prioridad, ultimo_mensaje_at, updated_at",
      )
      .eq("empresa_id", tenant.empresaId)
      .in("estado", ["abierta", "pendiente"])
      .order("ultimo_mensaje_at", { ascending: true })
      .limit(limit * 2);

    if (error) {
      return fail("PERMISSION_DENIED", "No se pudieron consultar conversaciones vencidas.", error);
    }

    const conversations = (data ?? [])
      .filter((item) => {
        const row = item as { ultimo_mensaje_at?: string | null };
        return Boolean(row.ultimo_mensaje_at && row.ultimo_mensaje_at < staleLimit);
      })
      .slice(0, limit) as unknown as JsonRecord[];

    return ok(
      createSystemSkillResult({
        data: { conversations, count: conversations.length },
        evidenceCount: conversations.length,
        evidenceSource: "inbox_conversaciones",
        links: [{ href: "/whapp", label: "Abrir Inbox" }],
        message: conversations.length
          ? `Encontre ${conversations.length} conversacion(es) abiertas con atencion vencida.`
          : "No encontre conversaciones con atencion vencida.",
        skillId,
      }),
    );
  }

  return fail("MODULE_MISCONFIGURED", "Este job automatico no tiene runner de sistema.");
}

export async function executeBrainAutomationJobAsSystem(
  systemTenant: SystemAutomationTenant,
  input: ExecuteAutomationJobInput,
): Promise<CoreResult<SystemAutomationJobExecution>> {
  if (!isBrainAutomationJobId(input.jobId)) {
    return fail("VALIDATION_ERROR", "El job automatico solicitado no existe.");
  }

  const job = getAutomationJob(input.jobId);
  if (!job) return fail("VALIDATION_ERROR", "El job automatico solicitado no existe.");

  const availability = isJobAvailableForTenant(systemTenant.tenant, job);
  const capabilityId = availability.capability?.id ?? job.capabilityId;
  const skillId = availability.skill?.id;
  const runId = input.runId ?? randomUUID();

  if (!availability.available || !skillId) {
    const metric = {
      id: `brain.automation.${job.id}.failed`,
      measure: "task_failed" as const,
      value: 1,
    };
    await writeAutomationAuditWithClient(createServiceRoleClient(), systemTenant.tenant, {
      capabilityId,
      error: availability.reason ?? "El job no esta disponible.",
      jobId: job.id,
      metric,
      runId,
      skillId,
      status: "failed",
    });
    return fail("PERMISSION_DENIED", availability.reason ?? "El job no esta disponible.");
  }

  const result = await runReadOnlySystemJob(
    systemTenant.tenant,
    job,
    {
      ...defaultInputForJob(job),
      ...(input.input ?? {}),
    },
    skillId,
  );

  if (!result.ok) {
    const metric = {
      id: `brain.automation.${job.id}.failed`,
      measure: "task_failed" as const,
      value: 1,
    };
    await writeAutomationAuditWithClient(createServiceRoleClient(), systemTenant.tenant, {
      capabilityId,
      error: result.error.message,
      jobId: job.id,
      metric,
      runId,
      skillId,
      status: "failed",
    });
    return result;
  }

  const metric = {
    id: `brain.automation.${job.id}.completed`,
    measure: "task_completed" as const,
    value: 1,
  };

  await writeAutomationAuditWithClient(createServiceRoleClient(), systemTenant.tenant, {
    capabilityId,
    jobId: job.id,
    metric,
    result: result.data as unknown as JsonRecord,
    runId,
    skillId,
    status: "completed",
  });

  return ok({
    capabilityId,
    jobId: job.id,
    message: result.data.message,
    metric,
    result: result.data,
    runId,
    skillId,
  });
}

export async function executeBrainAutomationJobsForSystem(input?: {
  jobId?: string | null;
}): Promise<CoreResult<SystemAutomationSummary>> {
  const tenantsResult = await getSystemAutomationTenants();
  if (!tenantsResult.ok) return tenantsResult;

  if (input?.jobId && !isBrainAutomationJobId(input.jobId)) {
    return fail("VALIDATION_ERROR", "El job automatico solicitado no existe.");
  }

  const jobs = input?.jobId
    ? initialBrainAutomationJobs.filter((job) => job.id === input.jobId)
    : initialBrainAutomationJobs;
  const summary: SystemAutomationSummary = {
    completed: 0,
    failed: 0,
    results: [],
    tenantsReviewed: tenantsResult.data.length,
  };

  for (const systemTenant of tenantsResult.data) {
    for (const job of jobs) {
      const runId = `cron:${systemTenant.empresaId}:${job.id}:${new Date().toISOString()}`;
      const result = await executeBrainAutomationJobAsSystem(systemTenant, {
        jobId: job.id,
        runId,
      });

      if (result.ok) {
        summary.completed += 1;
        summary.results.push({
          empresaId: systemTenant.empresaId,
          jobId: job.id,
          runId,
          status: "completed",
        });
      } else {
        summary.failed += 1;
        summary.results.push({
          empresaId: systemTenant.empresaId,
          error: result.error.message,
          jobId: job.id,
          runId,
          status: "failed",
        });
      }
    }
  }

  return ok(summary);
}

export async function executeBrainAutomationJob(
  tenant: TenantContext,
  input: ExecuteAutomationJobInput,
): Promise<CoreResult<AutomationJobExecution>> {
  if (!isBrainAutomationJobId(input.jobId)) {
    return fail("VALIDATION_ERROR", "El job automatico solicitado no existe.");
  }

  const job = getAutomationJob(input.jobId);
  if (!job) return fail("VALIDATION_ERROR", "El job automatico solicitado no existe.");

  const capability = capabilityRegistry.get(job.capabilityId);
  if (!capability) {
    return fail("MODULE_MISCONFIGURED", "La capability del job no esta registrada.");
  }

  const binding = capabilityRegistry.getImplementedBinding(capability.id);
  if (!binding) {
    return fail(
      "PLAN_FEATURE_UNAVAILABLE",
      "La capability del job existe, pero no tiene Skill ejecutable.",
    );
  }

  const skill = businessSkillRegistry.get(binding.skillId);
  if (!skill) {
    return fail("MODULE_MISCONFIGURED", "La Skill del job no esta registrada.");
  }

  if (!businessSkillRegistry.getAvailable(tenant).some((item) => item.id === skill.id)) {
    return fail(
      "PERMISSION_DENIED",
      "Este job no esta disponible por permisos o modulo inactivo.",
    );
  }

  const runId = input.runId ?? randomUUID();
  const result = await brainRuntime.invoke({
    idempotencyKey:
      skill.idempotency === "required"
        ? `brain-automation:${job.id}:${runId}`
        : undefined,
    input: {
      ...defaultInputForJob(job),
      ...(input.input ?? {}),
    },
    skillId: skill.id,
    source: {
      channel: "job",
      module: job.module,
      surface: `brain.automation.${job.id}`,
    },
    tenant,
  });

  if (!result.ok) {
    const metric = {
      id: `brain.automation.${job.id}.failed`,
      measure: "task_failed" as const,
      value: 1,
    };
    await writeAutomationAudit(tenant, {
      capabilityId: capability.id,
      error: result.error.message,
      jobId: job.id,
      metric,
      runId,
      skillId: skill.id,
      status: "failed",
    });
    return result;
  }

  const metric = {
    id: `brain.automation.${job.id}.completed`,
    measure: "task_completed" as const,
    value: 1,
  };

  await writeAutomationAudit(tenant, {
    capabilityId: capability.id,
    jobId: job.id,
    metric,
    result: result.data as unknown as JsonRecord,
    runId,
    skillId: skill.id,
    status: "completed",
  });

  return ok({
    capabilityId: capability.id,
    jobId: job.id,
    message: result.data.message,
    metric,
    result: result.data,
    runId,
    skillId: skill.id,
  });
}
