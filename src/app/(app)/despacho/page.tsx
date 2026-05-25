import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { DispatchDatabase } from "@/modules/dispatch/components/dispatch-database";
import { getDispatchOrders } from "@/modules/dispatch/queries";
import { EMPTY_DRIVER_TRACKING_SUMMARY } from "@/modules/driver-tracking/constants";
import {
  getDriverTrackingSummary,
  getLiveDrivers,
} from "@/modules/driver-tracking/queries";
import { LogisticsLivePanel } from "@/modules/logistics/components/logistics-live-panel";
import { buildLogisticsDashboardDataFromDispatches } from "@/modules/logistics/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type DispatchPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function DispatchPage({ searchParams }: DispatchPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canView = hasPermission(access.tenant.permissions, "dispatch.orders.view");

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta seccion."
          eyebrow="Operacion"
          title="Despacho"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [dispatches, liveDrivers, driverSummary] = await Promise.all([
    getDispatchOrders(access.tenant, "todos"),
    getLiveDrivers(),
    getDriverTrackingSummary(),
  ]);
  const dispatchRows = dispatches.ok ? dispatches.data : [];
  const logisticsData = buildLogisticsDashboardDataFromDispatches(dispatchRows);

  return (
    <section className="flex h-[calc(100vh-3rem)] min-h-0 flex-col gap-4 overflow-hidden">
      <SectionHeader
        description="Controla entregas, responsables, estados operativos y actividad logistica del dia."
        title="Despacho"
        titleClassName="app-page-title-compact normal-case"
      />

      {params?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </p>
      ) : null}

      <LogisticsLivePanel
        driverSummary={
          driverSummary.ok ? driverSummary.data : EMPTY_DRIVER_TRACKING_SUMMARY
        }
        liveDrivers={liveDrivers.ok ? liveDrivers.data : []}
        stats={logisticsData.stats}
        summary={logisticsData.summary}
      />

      {!dispatches.ok ? (
        <EmptyState description={dispatches.error.message} title="No se pudo cargar" />
      ) : dispatchRows.length > 0 ? (
        <DispatchDatabase className="pt-0" dispatches={dispatchRows} />
      ) : (
        <EmptyState
          description="Los despachos se crean desde ventas confirmadas, en proceso o completadas."
          title="Sin despachos"
        />
      )}
    </section>
  );
}
