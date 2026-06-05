import { getCurrentTenantContext } from "@/lib/auth/session";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import type {
  CurrentTimesheetStatus,
  TimesheetDashboardRow,
  TimesheetEvent,
  TimesheetState,
} from "@/modules/hr-timesheets/types";
import type { CoreResult } from "@/types/core";
import { fail, ok } from "@/types/core";

type TimesheetStateRow = {
  activo: boolean;
  codigo: string;
  color: string | null;
  cuenta_como_pausa: boolean;
  cuenta_como_trabajo: boolean;
  created_at: string;
  descripcion: string | null;
  es_estado_final: boolean;
  es_estado_inicial: boolean;
  es_sistema: boolean;
  estado_regreso_codigo: string | null;
  id: string;
  nombre: string;
  orden: number;
  requiere_regreso: boolean;
  tipo: TimesheetState["type"];
  updated_at: string;
};

type CurrentStatusRow = {
  duracion_minutos: number | null;
  estado_codigo: string | null;
  estado_nombre: string | null;
  fecha: string | null;
  profile_id: string;
  puede_registrar: boolean;
  registrado_at: string | null;
};

type ProfileRelation = {
  nombre: string | null;
};

type TimesheetEventRow = {
  created_at: string;
  estado_codigo: string;
  estado_nombre: string;
  fecha: string;
  id: string;
  notas: string | null;
  origen: string;
  profile_id: string;
  profiles: ProfileRelation | ProfileRelation[] | null;
  registrado_at: string;
};

type DashboardRpcRow = {
  alerta: string | null;
  cantidad_eventos: number;
  correo: string;
  desde: string | null;
  estado_actual: string;
  minutos_en_estado: number | null;
  nombre: string;
  primer_login: string | null;
  profile_id: string;
  ultima_salida: string | null;
};

function firstRelation<TRelation>(
  value: TRelation | TRelation[] | null,
): TRelation | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapState(row: TimesheetStateRow): TimesheetState {
  return {
    active: row.activo,
    code: row.codigo,
    color: row.color,
    countsAsBreak: row.cuenta_como_pausa,
    countsAsWork: row.cuenta_como_trabajo,
    createdAt: row.created_at,
    description: row.descripcion,
    id: row.id,
    isFinalState: row.es_estado_final,
    isInitialState: row.es_estado_inicial,
    isSystem: row.es_sistema,
    name: row.nombre,
    order: row.orden,
    requiresReturn: row.requiere_regreso,
    returnStateCode: row.estado_regreso_codigo,
    type: row.tipo,
    updatedAt: row.updated_at,
  };
}

function mapCurrentStatus(row: CurrentStatusRow): CurrentTimesheetStatus {
  return {
    canRegister: row.puede_registrar,
    date: row.fecha,
    durationMinutes: row.duracion_minutos,
    profileId: row.profile_id,
    registeredAt: row.registrado_at,
    stateCode: row.estado_codigo,
    stateName: row.estado_nombre,
  };
}

function mapEvent(row: TimesheetEventRow): TimesheetEvent {
  return {
    createdAt: row.created_at,
    date: row.fecha,
    id: row.id,
    notes: row.notas,
    origin: row.origen,
    profileId: row.profile_id,
    profileName: firstRelation(row.profiles)?.nombre ?? null,
    registeredAt: row.registrado_at,
    stateCode: row.estado_codigo,
    stateName: row.estado_nombre,
  };
}

function mapDashboardRow(row: DashboardRpcRow): TimesheetDashboardRow {
  return {
    alert: row.alerta,
    currentState: row.estado_actual,
    email: row.correo,
    eventsCount: row.cantidad_eventos,
    firstLogin: row.primer_login,
    lastLogout: row.ultima_salida,
    minutesInState: row.minutos_en_estado,
    name: row.nombre,
    profileId: row.profile_id,
    since: row.desde,
  };
}

async function getTenantForTimesheets() {
  const tenantResult = await getCurrentTenantContext();

  if (!tenantResult.ok) {
    return tenantResult;
  }

  if (!tenantResult.data) {
    return fail("INVALID_TENANT_CONTEXT", "No hay empresa activa.");
  }

  return ok(tenantResult.data);
}

export async function getCurrentTimesheetStatus(): Promise<
  CoreResult<CurrentTimesheetStatus | null>
> {
  const tenantResult = await getTenantForTimesheets();

  if (!tenantResult.ok) {
    return tenantResult;
  }

  if (
    !hasAnyPermission(tenantResult.data.permissions, [
      "hr.timesheets.register",
      "hr.timesheets.view",
      "hr.timesheets.dashboard",
      "hr.timesheets.manage",
    ])
  ) {
    return ok(null);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "obtener_rrhh_estado_actual_usuario",
  );

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo consultar el estado actual.", error);
  }

  const row = (data as CurrentStatusRow[] | null)?.[0];

  return ok(row ? mapCurrentStatus(row) : null);
}

export async function getActiveTimesheetStates(): Promise<
  CoreResult<TimesheetState[]>
> {
  const tenantResult = await getTenantForTimesheets();

  if (!tenantResult.ok) {
    return tenantResult;
  }

  if (
    !hasAnyPermission(tenantResult.data.permissions, [
      "hr.timesheets.register",
      "hr.timesheets.view",
      "hr.timesheets.dashboard",
      "hr.timesheets.states.manage",
    ])
  ) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rrhh_planilla_estados")
    .select(
      "id, codigo, nombre, descripcion, tipo, color, orden, requiere_regreso, estado_regreso_codigo, es_estado_inicial, es_estado_final, cuenta_como_trabajo, cuenta_como_pausa, activo, es_sistema, created_at, updated_at",
    )
    .eq("empresa_id", tenantResult.data.empresaId)
    .eq("activo", true)
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar estados.", error);
  }

  return ok(((data ?? []) as TimesheetStateRow[]).map(mapState));
}

export async function getTimesheetStateConfig(): Promise<
  CoreResult<TimesheetState[]>
> {
  const tenantResult = await getTenantForTimesheets();

  if (!tenantResult.ok) {
    return tenantResult;
  }

  if (!hasPermission(tenantResult.data.permissions, "hr.timesheets.states.manage")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para configurar estados.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rrhh_planilla_estados")
    .select(
      "id, codigo, nombre, descripcion, tipo, color, orden, requiere_regreso, estado_regreso_codigo, es_estado_inicial, es_estado_final, cuenta_como_trabajo, cuenta_como_pausa, activo, es_sistema, created_at, updated_at",
    )
    .eq("empresa_id", tenantResult.data.empresaId)
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar estados.", error);
  }

  return ok(((data ?? []) as TimesheetStateRow[]).map(mapState));
}

export async function getTodayTimesheetEvents(): Promise<
  CoreResult<TimesheetEvent[]>
> {
  const tenantResult = await getTenantForTimesheets();

  if (!tenantResult.ok) {
    return tenantResult;
  }

  if (
    !hasAnyPermission(tenantResult.data.permissions, [
      "hr.timesheets.view",
      "hr.timesheets.register",
      "hr.timesheets.dashboard",
      "hr.timesheets.manage",
    ])
  ) {
    return ok([]);
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("rrhh_planilla_eventos")
    .select(
      "id, profile_id, estado_codigo, estado_nombre, fecha, registrado_at, origen, notas, created_at, profiles!rrhh_planilla_eventos_profile_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenantResult.data.empresaId)
    .eq("fecha", today)
    .order("registrado_at", { ascending: false });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar eventos.", error);
  }

  return ok(((data ?? []) as TimesheetEventRow[]).map(mapEvent));
}

export async function getTimesheetDashboard(
  date?: string,
): Promise<CoreResult<TimesheetDashboardRow[]>> {
  const tenantResult = await getTenantForTimesheets();

  if (!tenantResult.ok) {
    return tenantResult;
  }

  if (
    !hasAnyPermission(tenantResult.data.permissions, [
      "hr.timesheets.dashboard",
      "hr.timesheets.view",
      "hr.timesheets.manage",
    ])
  ) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver el dashboard.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obtener_rrhh_planilla_dashboard", {
    p_fecha: date ?? null,
  });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo consultar el dashboard.", error);
  }

  return ok(((data ?? []) as DashboardRpcRow[]).map(mapDashboardRow));
}
