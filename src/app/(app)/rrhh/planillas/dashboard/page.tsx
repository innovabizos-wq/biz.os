import { Coffee, Download, TriangleAlert, UserCheck, Users } from "lucide-react";
import { redirect } from "next/navigation";

import { PremiumKpiCard } from "@/components/kpi/premium-kpi-card";
import { PremiumKpiGrid } from "@/components/kpi/premium-kpi-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { Button } from "@/components/ui/button";
import { getCurrentTenantContext } from "@/lib/auth/session";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { getTimesheetDashboard } from "@/modules/hr-timesheets/queries";
import type { TimesheetDashboardRow } from "@/modules/hr-timesheets/types";

const PAUSED_STATES = new Set(["Almuerzo", "Pausa", "Break 1", "Break 2"]);
const CLOSED_STATES = new Set(["Sin estado", "Salida", "Jornada cerrada"]);

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMinutes(value: number | null) {
  if (typeof value !== "number") {
    return "-";
  }

  if (value < 60) {
    return `${value} min`;
  }

  return `${Math.floor(value / 60)} h ${value % 60} min`;
}

function getPauseTime(row: TimesheetDashboardRow) {
  return PAUSED_STATES.has(row.currentState) ? formatMinutes(row.minutesInState) : "-";
}

function getStatusBadgeClass(row: TimesheetDashboardRow) {
  if (row.alert) {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (PAUSED_STATES.has(row.currentState)) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  if (CLOSED_STATES.has(row.currentState)) {
    return "bg-slate-100 text-slate-600 ring-slate-200";
  }

  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

export default async function TimesheetDashboardPage() {
  const tenantResult = await getCurrentTenantContext();

  if (!tenantResult.ok) {
    redirect("/login");
  }

  if (!tenantResult.data) {
    redirect("/onboarding");
  }

  if (
    !hasAnyPermission(tenantResult.data.permissions, [
      "hr.timesheets.dashboard",
      "hr.timesheets.view",
      "hr.timesheets.manage",
    ])
  ) {
    return (
      <section className="space-y-6">
        <EmptyState
          description="No tienes permisos para ver el dashboard de planillas."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const dashboard = await getTimesheetDashboard();
  const rows = dashboard.ok ? dashboard.data : [];
  const activeRows = rows.filter((row) => !CLOSED_STATES.has(row.currentState));
  const pausedRows = rows.filter((row) => PAUSED_STATES.has(row.currentState));
  const alertRows = rows.filter((row) => Boolean(row.alert));
  const kpis = [
    {
      icon: Users,
      label: "Colaboradores",
      value: rows.length,
      variant: "blue" as const,
    },
    {
      icon: UserCheck,
      label: "Conectados",
      value: activeRows.length,
      variant: "green" as const,
    },
    {
      icon: Coffee,
      label: "En pausa",
      value: pausedRows.length,
      variant: "gold" as const,
    },
    {
      icon: TriangleAlert,
      label: "Alertas",
      value: alertRows.length,
      variant: "red" as const,
    },
  ];

  return (
    <section className="space-y-5">
      <SectionHeader
        action={
          <Button disabled type="button">
            <Download size={14} />
            Descargar
          </Button>
        }
        description="Seguimiento general de la operacion por empresa."
        eyebrow="RRHH / PLANILLAS"
        title="CONTROL EN TIEMPO REAL DE COLABORADORES"
      />

      <PremiumKpiGrid>
        {kpis.map((kpi) => {
          const Icon = kpi.icon;

          return (
            <PremiumKpiCard
              footerLeftLabel="Hoy"
              footerLeftValue={kpi.value}
              footerRightLabel="Operacion"
              footerRightValue={kpi.label}
              icon={<Icon />}
              key={kpi.label}
              title={kpi.label}
              trendLabel="planillas"
              trendTone={kpi.label === "Alertas" && alertRows.length > 0 ? "negative" : "neutral"}
              trendValue={`${kpi.value}`}
              value={kpi.value}
              variant={kpi.variant}
            />
          );
        })}
      </PremiumKpiGrid>

      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <div className="border-b px-4 py-4">
            <h3 className="text-base font-semibold">Estado en vivo por colaborador</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Seguimiento general de la operacion por empresa.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Colaborador</th>
                  <th className="px-4 py-3 font-semibold">Sucursal o Proyecto</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Tiempo en estado</th>
                  <th className="px-4 py-3 font-semibold">Pausa acumulada</th>
                  <th className="px-4 py-3 font-semibold">Exceso</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="border-t" key={row.profileId}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">Sin asignar</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusBadgeClass(row)}`}
                      >
                        {row.currentState}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>{formatMinutes(row.minutesInState)}</div>
                      <div className="text-xs text-muted-foreground">
                        Desde {formatDateTime(row.since)}
                      </div>
                    </td>
                    <td className="px-4 py-3">{getPauseTime(row)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.alert ?? "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          description="No hay colaboradores activos o eventos para mostrar."
          title="Sin datos"
        />
      )}
    </section>
  );
}
