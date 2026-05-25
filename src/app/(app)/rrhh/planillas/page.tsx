import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentTenantContext } from "@/lib/auth/session";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { TimesheetStatusActions } from "@/modules/hr-timesheets/components/timesheet-status-actions";
import {
  getActiveTimesheetStates,
  getCurrentTimesheetStatus,
  getTodayTimesheetEvents,
} from "@/modules/hr-timesheets/queries";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatStatusDuration(minutes: number | null | undefined) {
  if (typeof minutes !== "number") {
    return "Sin duracion";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export default async function TimesheetsPage() {
  const tenantResult = await getCurrentTenantContext();

  if (!tenantResult.ok) {
    redirect("/login");
  }

  if (!tenantResult.data) {
    redirect("/onboarding");
  }

  const permissions = tenantResult.data.permissions;
  const canRegister = hasPermission(permissions, "hr.timesheets.register");
  const canViewDashboard = hasAnyPermission(permissions, [
    "hr.timesheets.dashboard",
    "hr.timesheets.view",
  ]);
  const canManageStates = hasPermission(
    permissions,
    "hr.timesheets.states.manage",
  );

  if (
    !hasAnyPermission(permissions, [
      "hr.timesheets.view",
      "hr.timesheets.register",
      "hr.timesheets.dashboard",
      "hr.timesheets.states.manage",
    ])
  ) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="Solicita acceso al administrador de tu empresa."
          eyebrow="RRHH"
          title="Planillas"
        />
        <EmptyState
          description="No tienes permisos para consultar o alimentar planillas."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [currentStatus, states, events] = await Promise.all([
    getCurrentTimesheetStatus(),
    getActiveTimesheetStates(),
    getTodayTimesheetEvents(),
  ]);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Registro diario de estados laborales. Estos eventos alimentan planillas dentro de RRHH."
        eyebrow="RRHH"
        title="Planillas"
      />

      <div className="flex flex-wrap gap-2">
        {canViewDashboard ? (
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/rrhh/planillas/dashboard"
          >
            Dashboard operativo
          </Link>
        ) : null}
        {canManageStates ? (
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/rrhh/planillas/estados"
          >
            Configurar estados
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
        <div className="rounded-lg border bg-background p-5">
          <p className="text-sm font-medium text-muted-foreground">Estado actual</p>
          <h3 className="mt-2 text-2xl font-semibold">
            {currentStatus.ok && currentStatus.data?.stateName
              ? currentStatus.data.stateName
              : "Sin estado"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {currentStatus.ok && currentStatus.data?.registeredAt
              ? `Desde ${formatDateTime(currentStatus.data.registeredAt)} · ${formatStatusDuration(currentStatus.data.durationMinutes)}`
              : "Aun no hay estado registrado para tu usuario."}
          </p>
        </div>

        {canRegister && states.ok && states.data.length > 0 ? (
          <div className="rounded-lg border bg-background p-5">
            <p className="text-sm font-semibold">Registrar estado</p>
            <div className="mt-3">
              <TimesheetStatusActions
                limit={8}
                redirectTo="/rrhh/planillas"
                states={states.data}
              />
            </div>
          </div>
        ) : (
          <EmptyState
            description="Inicializa o activa estados para poder registrar jornada."
            title="Sin estados activos"
          />
        )}
      </div>

      {events.ok && events.data.length > 0 ? (
        <div className="overflow-hidden rounded-lg border bg-background">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Persona</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Hora</th>
                <th className="px-4 py-3 font-semibold">Origen</th>
                <th className="px-4 py-3 font-semibold">Notas</th>
              </tr>
            </thead>
            <tbody>
              {events.data.map((event) => (
                <tr className="border-t" key={event.id}>
                  <td className="px-4 py-3">
                    {event.profileName ?? event.profileId}
                  </td>
                  <td className="px-4 py-3">{event.stateName}</td>
                  <td className="px-4 py-3">{formatDateTime(event.registeredAt)}</td>
                  <td className="px-4 py-3">{event.origin}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {event.notes ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          description="Todavia no hay eventos registrados para hoy."
          title="Sin registros"
        />
      )}
    </section>
  );
}
