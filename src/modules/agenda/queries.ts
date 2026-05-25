import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import {
  DEFAULT_AGENDA_ESTADO,
  DEFAULT_AGENDA_RANGE,
  DEFAULT_AGENDA_SCOPE,
} from "@/modules/agenda/constants";
import { agendaSearchParamsSchema } from "@/modules/agenda/schemas";
import type {
  AgendaAssignableUser,
  AgendaFilters,
  AgendaFollowup,
  AgendaRange,
  AgendaSummary,
} from "@/modules/agenda/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type AgendaFollowupRow = {
  asignado_a: string | null;
  asignado_nombre: string | null;
  asunto: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_telefono: string | null;
  cliente_whatsapp: string | null;
  created_at: string;
  descripcion: string | null;
  estado: AgendaFollowup["estado"];
  fecha_programada: string;
  seguimiento_id: string;
};

type AssignableUserRow = {
  id: string;
  nombre: string;
};

type QueryError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

type AgendaQuerySource = "agenda" | "dashboard";

type AgendaQueryOptions = {
  source?: AgendaQuerySource;
  tolerateErrors?: boolean;
};

function mapAgendaFollowup(row: AgendaFollowupRow): AgendaFollowup {
  return {
    asignadoA: row.asignado_a,
    asignadoNombre: row.asignado_nombre,
    asunto: row.asunto,
    clienteId: row.cliente_id,
    clienteNombre: row.cliente_nombre,
    clienteTelefono: row.cliente_telefono,
    clienteWhatsapp: row.cliente_whatsapp,
    createdAt: row.created_at,
    descripcion: row.descripcion,
    estado: row.estado,
    fechaProgramada: row.fecha_programada,
    seguimientoId: row.seguimiento_id,
  };
}

function logAgendaQueryError(
  queryName: string,
  error: QueryError,
  context: Record<string, unknown> = {},
) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[${queryName}] Supabase query failed`, {
      code: error.code,
      context,
      details: error.details,
      hint: error.hint,
      message: error.message,
      queryName,
    });
  }
}

function assertCanViewAgenda(tenant: TenantContext): CoreResult<true> {
  if (!isModuleActive(tenant.activeModules, "crm")) {
    return fail("MODULE_INACTIVE", "El modulo CRM no esta activo.");
  }

  if (!hasPermission(tenant.permissions, "crm.followups.view")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver la agenda.");
  }

  return ok(true);
}

function assertCanEditAgenda(tenant: TenantContext): CoreResult<true> {
  const viewResult = assertCanViewAgenda(tenant);

  if (!viewResult.ok) {
    return viewResult;
  }

  if (!hasPermission(tenant.permissions, "crm.followups.edit")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para editar seguimientos.");
  }

  return ok(true);
}

function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function startOfWeek(date = new Date()) {
  const value = startOfDay(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  return addDays(value, diff);
}

export function getAgendaDateRange(range: AgendaRange): {
  desde?: string;
  hasta?: string;
} {
  const todayStart = startOfDay();

  if (range === "hoy") {
    return {
      desde: todayStart.toISOString(),
      hasta: endOfDay(todayStart).toISOString(),
    };
  }

  if (range === "vencidos") {
    return {
      hasta: new Date(todayStart.getTime() - 1).toISOString(),
    };
  }

  if (range === "proximos7") {
    const tomorrow = startOfDay(addDays(todayStart, 1));

    return {
      desde: tomorrow.toISOString(),
      hasta: endOfDay(addDays(todayStart, 7)).toISOString(),
    };
  }

  return {};
}

export function parseAgendaSearchParams(input: unknown) {
  const parsed = agendaSearchParamsSchema.safeParse(input);

  if (!parsed.success) {
    const rangeDates = getAgendaDateRange(DEFAULT_AGENDA_RANGE);

    return {
      filters: {
        estado: DEFAULT_AGENDA_ESTADO,
        scope: DEFAULT_AGENDA_SCOPE,
        ...rangeDates,
      },
      range: DEFAULT_AGENDA_RANGE,
    };
  }

  const rangeDates = getAgendaDateRange(parsed.data.range);

  return {
    filters: {
      desde: parsed.data.desde ?? rangeDates.desde,
      estado: parsed.data.estado,
      hasta: parsed.data.hasta ?? rangeDates.hasta,
      scope: parsed.data.scope,
    },
    range: parsed.data.range,
  };
}

export async function getAgendaFollowups(
  tenant: TenantContext,
  filters: AgendaFilters,
  options: AgendaQueryOptions = {},
): Promise<CoreResult<AgendaFollowup[]>> {
  const access = assertCanViewAgenda(tenant);

  if (!access.ok) {
    return access;
  }

  const supabase = await createClient();
  const rpcParams = {
    p_desde: filters.desde ?? null,
    p_estado: filters.estado,
    p_hasta: filters.hasta ?? null,
    p_scope: filters.scope,
  };
  const { data, error } = await supabase.rpc(
    "obtener_agenda_seguimientos",
    rpcParams,
  );

  if (error) {
    logAgendaQueryError("getAgendaFollowups", error, {
      filters,
      rpc: "obtener_agenda_seguimientos",
      rpcParams,
      source: options.source ?? "agenda",
    });
    return fail("PERMISSION_DENIED", "No se pudo consultar la agenda.", error);
  }

  return ok(((data ?? []) as AgendaFollowupRow[]).map(mapAgendaFollowup));
}

export async function getTodayFollowups(
  tenant: TenantContext,
  options: AgendaQueryOptions = {},
): Promise<CoreResult<AgendaFollowup[]>> {
  return getAgendaFollowups(tenant, {
    estado: "pendiente",
    scope: DEFAULT_AGENDA_SCOPE,
    ...getAgendaDateRange("hoy"),
  }, options);
}

export async function getOverdueFollowups(
  tenant: TenantContext,
  options: AgendaQueryOptions = {},
): Promise<CoreResult<AgendaFollowup[]>> {
  return getAgendaFollowups(tenant, {
    estado: "pendiente",
    scope: DEFAULT_AGENDA_SCOPE,
    ...getAgendaDateRange("vencidos"),
  }, options);
}

export async function getUpcomingFollowups(
  tenant: TenantContext,
  options: AgendaQueryOptions = {},
): Promise<CoreResult<AgendaFollowup[]>> {
  return getAgendaFollowups(tenant, {
    estado: "pendiente",
    scope: DEFAULT_AGENDA_SCOPE,
    ...getAgendaDateRange("proximos7"),
  }, options);
}

export async function getRecentCompletedFollowups(
  tenant: TenantContext,
  options: AgendaQueryOptions = {},
): Promise<CoreResult<AgendaFollowup[]>> {
  return getAgendaFollowups(tenant, {
    desde: addDays(new Date(), -7).toISOString(),
    estado: "completado",
    hasta: new Date().toISOString(),
    scope: DEFAULT_AGENDA_SCOPE,
  }, options);
}

export async function getCurrentWeekFollowups(
  tenant: TenantContext,
): Promise<CoreResult<AgendaFollowup[]>> {
  return getWeekFollowups(tenant, new Date());
}

export async function getWeekFollowups(
  tenant: TenantContext,
  selectedDate: Date,
): Promise<CoreResult<AgendaFollowup[]>> {
  const weekStart = startOfWeek(selectedDate);

  return getAgendaFollowups(tenant, {
    desde: weekStart.toISOString(),
    estado: "todos",
    hasta: endOfDay(addDays(weekStart, 6)).toISOString(),
    scope: DEFAULT_AGENDA_SCOPE,
  });
}

export async function getAgendaSummary(
  tenant: TenantContext,
  options: AgendaQueryOptions = {},
): Promise<CoreResult<AgendaSummary>> {
  const [hoy, vencidos, proximos, completadosRecientes] = await Promise.all([
    getTodayFollowups(tenant, options),
    getOverdueFollowups(tenant, options),
    getUpcomingFollowups(tenant, options),
    getRecentCompletedFollowups(tenant, options),
  ]);

  const failed = [hoy, vencidos, proximos, completadosRecientes].find(
    (result) => !result.ok,
  );

  if (failed && !failed.ok) {
    if (options.tolerateErrors) {
      return ok({
        completadosRecientes: completadosRecientes.ok
          ? completadosRecientes.data
          : [],
        hoy: hoy.ok ? hoy.data : [],
        proximos: proximos.ok ? proximos.data : [],
        vencidos: vencidos.ok ? vencidos.data : [],
      });
    }

    return fail(failed.error.code, failed.error.message, failed.error.cause);
  }

  return ok({
    completadosRecientes: completadosRecientes.ok
      ? completadosRecientes.data
      : [],
    hoy: hoy.ok ? hoy.data : [],
    proximos: proximos.ok ? proximos.data : [],
    vencidos: vencidos.ok ? vencidos.data : [],
  });
}

export async function getAssignableUsersForAgenda(
  tenant: TenantContext,
): Promise<CoreResult<AgendaAssignableUser[]>> {
  const access = assertCanEditAgenda(tenant);

  if (!access.ok) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre")
    .eq("empresa_id", tenant.empresaId)
    .eq("estado", "activo")
    .order("nombre", { ascending: true });

  if (error) {
    logAgendaQueryError("getAssignableUsersForAgenda", error);
    return ok([]);
  }

  return ok(((data ?? []) as AssignableUserRow[]).map((user) => user));
}
