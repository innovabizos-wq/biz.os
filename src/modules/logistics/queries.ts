import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { getDispatchOrders } from "@/modules/dispatch/queries";
import type { DispatchOrder } from "@/modules/dispatch/types";
import {
  ACTIVE_DISPATCH_STATUSES,
  PENDING_DISPATCH_STATUSES,
} from "@/modules/logistics/constants";
import type {
  LogisticsActivity,
  LogisticsDashboardData,
  LogisticsDashboardStats,
  LogisticsDaySummary,
  LogisticsDispatchFilters,
  LogisticsDispatchRow,
  LogisticsResponsibleOption,
} from "@/modules/logistics/types";
import type { TenantContext } from "@/types/core";

const EMPTY_STATS: LogisticsDashboardStats = {
  availableDrivers: 0,
  connectedDrivers: 0,
  deliveredToday: 0,
  incidents: 0,
  lunchDrivers: 0,
  onRouteDrivers: 0,
  pausedDrivers: 0,
  pendingDispatches: 0,
};

const EMPTY_SUMMARY: LogisticsDaySummary = {
  delays: 0,
  dispatchesToday: 0,
  effectiveness: 0,
};

export const EMPTY_LOGISTICS_DASHBOARD_DATA: LogisticsDashboardData = {
  activities: [],
  dispatches: [],
  responsibleOptions: [],
  stats: EMPTY_STATS,
  summary: EMPTY_SUMMARY,
  totalDispatches: 0,
};

function logLogisticsDiagnostic(reason: string, context: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[logistics] ${reason}`, context);
  }
}

function getTodayDateString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

function getDatePrefix(value: string | null | undefined) {
  return value ? value.slice(0, 10) : null;
}

function isToday(value: string | null | undefined, today: string) {
  return getDatePrefix(value) === today;
}

function normalizeText(value: string | number | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function includesText(value: string | number | null | undefined, query: string) {
  return normalizeText(value).includes(query);
}

async function loadDispatchOrders(tenant: TenantContext) {
  try {
    const result = await getDispatchOrders(tenant, "todos");

    if (!result.ok) {
      logLogisticsDiagnostic("dispatch query failed", {
        code: result.error.code,
        message: result.error.message,
      });
      return [];
    }

    return result.data;
  } catch (error) {
    logLogisticsDiagnostic("dispatch query threw", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  }
}

function countResponsibleOrRows(dispatches: DispatchOrder[]) {
  const responsibleIds = new Set(
    dispatches
      .map((dispatch) => dispatch.responsableId)
      .filter((id): id is string => Boolean(id)),
  );

  return responsibleIds.size > 0 ? responsibleIds.size : dispatches.length;
}

function isDispatchToday(dispatch: DispatchOrder, today: string) {
  return (
    isToday(dispatch.fechaProgramada, today) ||
    (!dispatch.fechaProgramada && isToday(dispatch.createdAt, today))
  );
}

function buildStats(dispatches: DispatchOrder[]): LogisticsDashboardStats {
  const today = getTodayDateString();
  const activeDispatches = dispatches.filter((dispatch) =>
    ACTIVE_DISPATCH_STATUSES.includes(
      dispatch.estado as (typeof ACTIVE_DISPATCH_STATUSES)[number],
    ),
  );
  const onRouteDispatches = dispatches.filter(
    (dispatch) => dispatch.estado === "en_ruta",
  );
  const pendingDispatches = dispatches.filter((dispatch) =>
    PENDING_DISPATCH_STATUSES.includes(
      dispatch.estado as (typeof PENDING_DISPATCH_STATUSES)[number],
    ),
  );
  const deliveredToday = dispatches.filter(
    (dispatch) =>
      dispatch.estado === "entregado" &&
      (isToday(dispatch.completadoAt, today) ||
        (!dispatch.completadoAt && isToday(dispatch.updatedAt, today))),
  );
  const incidentDispatches = dispatches.filter(
    (dispatch) => dispatch.estado === "fallido",
  );

  return {
    availableDrivers: 0,
    connectedDrivers: countResponsibleOrRows(activeDispatches),
    deliveredToday: deliveredToday.length,
    incidents: incidentDispatches.length,
    lunchDrivers: 0,
    onRouteDrivers: countResponsibleOrRows(onRouteDispatches),
    pausedDrivers: 0,
    pendingDispatches: pendingDispatches.length,
  };
}

function buildSummary(
  dispatches: DispatchOrder[],
  stats: LogisticsDashboardStats,
): LogisticsDaySummary {
  const today = getTodayDateString();
  const dispatchesToday = dispatches.filter((dispatch) =>
    isDispatchToday(dispatch, today),
  ).length;

  return {
    delays: 0,
    dispatchesToday,
    effectiveness:
      dispatchesToday > 0
        ? Math.round((stats.deliveredToday / dispatchesToday) * 100)
        : 0,
  };
}

function formatActivityTime(value: string | null | undefined) {
  if (!value) return "--:--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("es-CR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getActivityTitle(dispatch: DispatchOrder) {
  if (dispatch.estado === "entregado") {
    return `${dispatch.responsableNombre ?? "Responsable"} entrego despacho`;
  }

  if (dispatch.estado === "en_ruta") {
    return `${dispatch.responsableNombre ?? "Responsable"} inicio ruta`;
  }

  if (dispatch.estado === "fallido") {
    return "Despacho marcado como fallido";
  }

  if (dispatch.estado === "cancelado") {
    return "Despacho cancelado";
  }

  return "Nuevo despacho creado";
}

function buildActivities(dispatches: DispatchOrder[]): LogisticsActivity[] {
  return [...dispatches]
    .sort((a, b) => {
      const left = new Date(a.updatedAt ?? a.createdAt).getTime();
      const right = new Date(b.updatedAt ?? b.createdAt).getTime();

      return right - left;
    })
    .slice(0, 5)
    .map((dispatch) => ({
      description: dispatch.clienteNombre,
      dispatchNumber: dispatch.numero,
      id: dispatch.id,
      timeLabel: formatActivityTime(dispatch.updatedAt ?? dispatch.createdAt),
      title: getActivityTitle(dispatch),
      type: dispatch.estado,
    }));
}

function getResponsibleOptions(
  dispatches: DispatchOrder[],
): LogisticsResponsibleOption[] {
  const options = new Map<string, string>();

  for (const dispatch of dispatches) {
    if (dispatch.responsableId && dispatch.responsableNombre) {
      options.set(dispatch.responsableId, dispatch.responsableNombre);
    }
  }

  return Array.from(options.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function mapDispatchToLogisticsRow(
  dispatch: DispatchOrder,
): LogisticsDispatchRow {
  return {
    clientName: dispatch.clienteNombre ?? "Sin cliente",
    contactName: dispatch.contactoEntrega,
    date: dispatch.fechaProgramada ?? getDatePrefix(dispatch.createdAt),
    id: dispatch.id,
    number: dispatch.numero,
    phone: dispatch.telefonoEntrega,
    responsibleId: dispatch.responsableId,
    responsibleName: dispatch.responsableNombre,
    saleNumber: dispatch.ventaNumero,
    status: dispatch.estado,
  };
}

function applyDispatchFilters(
  dispatches: DispatchOrder[],
  filters: LogisticsDispatchFilters,
) {
  const query = normalizeText(filters.search);

  return dispatches.filter((dispatch) => {
    const matchesQuery =
      !query ||
      [
        dispatch.numero,
        dispatch.clienteNombre,
        dispatch.ventaNumero,
        dispatch.estado,
        dispatch.fechaProgramada,
        dispatch.responsableNombre,
        dispatch.contactoEntrega,
        dispatch.telefonoEntrega,
      ].some((value) => includesText(value, query));
    const matchesStatus = !filters.estado || dispatch.estado === filters.estado;
    const matchesResponsible =
      !filters.responsableId || dispatch.responsableId === filters.responsableId;
    const matchesDate =
      !filters.fecha ||
      getDatePrefix(dispatch.fechaProgramada ?? dispatch.createdAt) ===
        filters.fecha;

    return matchesQuery && matchesStatus && matchesResponsible && matchesDate;
  });
}

export async function getLogisticsDispatches(
  tenant: TenantContext,
  filters: LogisticsDispatchFilters = {},
): Promise<LogisticsDispatchRow[]> {
  if (!hasAnyPermission(tenant.permissions, ["dispatch.orders.view"])) {
    return [];
  }

  const dispatches = await loadDispatchOrders(tenant);

  return applyDispatchFilters(dispatches, filters).map(mapDispatchToLogisticsRow);
}

export function buildLogisticsDashboardDataFromDispatches(
  dispatches: DispatchOrder[],
  filters: LogisticsDispatchFilters = {},
): LogisticsDashboardData {
  const stats = buildStats(dispatches);
  const summary = buildSummary(dispatches, stats);
  const filteredDispatches = applyDispatchFilters(dispatches, filters).map(
    mapDispatchToLogisticsRow,
  );

  return {
    activities: buildActivities(dispatches),
    dispatches: filteredDispatches,
    responsibleOptions: getResponsibleOptions(dispatches),
    stats,
    summary,
    totalDispatches: dispatches.length,
  };
}

export async function getLogisticsDashboardData(
  tenant: TenantContext,
  filters: LogisticsDispatchFilters = {},
): Promise<LogisticsDashboardData> {
  if (
    !hasAnyPermission(tenant.permissions, [
      "dispatch.orders.view",
      "dispatch.orders.edit",
      "dispatch.orders.status.change",
    ])
  ) {
    return EMPTY_LOGISTICS_DASHBOARD_DATA;
  }

  const dispatches = await loadDispatchOrders(tenant);

  return buildLogisticsDashboardDataFromDispatches(dispatches, filters);
}
