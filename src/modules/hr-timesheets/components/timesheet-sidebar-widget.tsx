import Link from "next/link";
import { ChevronDown, LayoutDashboard, LogOut } from "lucide-react";

import { signOutAction } from "@/modules/auth/actions";
import { registerTimesheetStatusAction } from "@/modules/hr-timesheets/actions";
import type {
  CurrentTimesheetStatus,
  TimesheetState,
} from "@/modules/hr-timesheets/types";

type TimesheetSidebarWidgetProps = {
  canRegister: boolean;
  canViewDashboard: boolean;
  currentStatus: CurrentTimesheetStatus | null;
  states: TimesheetState[];
  userEmail: string | null;
  userName?: string | null;
};

const PRIORITY_STATE_CODES = [
  "login",
  "entrada",
  "almuerzo",
  "regreso_almuerzo",
  "pausa",
  "regreso_pausa",
  "break_1",
  "regreso_break_1",
  "break_2",
  "regreso_break_2",
  "salida",
  "logout",
];

function sortStatesForMenu(states: TimesheetState[]) {
  const priority = new Map(
    PRIORITY_STATE_CODES.map((code, index) => [code, index]),
  );

  return [...states].sort((a, b) => {
    const priorityA = priority.get(a.code) ?? Number.MAX_SAFE_INTEGER;
    const priorityB = priority.get(b.code) ?? Number.MAX_SAFE_INTEGER;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return a.order - b.order || a.name.localeCompare(b.name, "es");
  });
}

export function TimesheetSidebarWidget({
  canRegister,
  canViewDashboard,
  currentStatus,
  states,
  userEmail,
  userName,
}: TimesheetSidebarWidgetProps) {
  const displayName = userName?.trim() || userEmail || "Usuario";
  const displayInitial = displayName.slice(0, 1).toUpperCase();
  const statusLabel = currentStatus?.stateName ?? "Desconectado";
  const statusTone = !currentStatus?.stateName
    ? "disconnected"
    : currentStatus.stateCode === "salida" || currentStatus.stateCode === "logout"
      ? "closed"
      : "active";
  const menuStates = sortStatesForMenu(states);

  return (
    <section
      className="app-time-clock"
      data-status-tone={statusTone}
      aria-label="Estado laboral diario"
    >
      <details className="group relative">
        <summary
          aria-label="Abrir estado y sesión"
          className="app-time-clock-summary flex list-none items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-2.5 py-2 shadow-sm transition hover:bg-white [&::-webkit-details-marker]:hidden"
        >
          <div className="app-time-clock-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600">
            <span className="app-time-clock-initial">{displayInitial}</span>
          </div>
          <div className="app-time-clock-meta min-w-0">
            <span className="app-time-clock-status inline-flex max-w-full rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase leading-4 text-slate-700">
              <span className="truncate">{statusLabel}</span>
            </span>
          </div>
          <ChevronDown
            className="app-time-clock-menu-icon ml-1 text-slate-500 transition group-open:rotate-180"
            size={15}
          />
        </summary>

        <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[220px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
          <div className="mb-2 rounded-xl bg-slate-50 px-3 py-2">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
              Estado actual
            </p>
            <p className="truncate text-sm font-semibold text-slate-950">{statusLabel}</p>
          </div>

          {canRegister && menuStates.length > 0 ? (
            <div className="space-y-1">
              <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Cambiar estado
              </p>
              {menuStates.map((state) => (
                <form action={registerTimesheetStatusAction} key={state.id}>
                  <input name="estadoCodigo" type="hidden" value={state.code} />
                  <input name="redirectTo" type="hidden" value="/rrhh/planillas" />
                  <button
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    type="submit"
                  >
                    <span className="truncate">{state.name}</span>
                    {state.color ? (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: state.color }}
                      />
                    ) : null}
                  </button>
                </form>
              ))}
            </div>
          ) : null}

          <div className="mt-2 grid grid-cols-2 gap-2">
            {canViewDashboard ? (
              <Link
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                href="/rrhh/planillas/dashboard"
              >
                <LayoutDashboard size={13} />
                Dashboard
              </Link>
            ) : null}
            <form action={signOutAction}>
              <button
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                type="submit"
              >
                <LogOut size={13} />
                Sesion
              </button>
            </form>
          </div>

          {states.length > 0 ? (
            <Link
              className="mt-2 block text-center text-[11px] font-medium text-slate-500 hover:text-slate-800"
              href="/rrhh/planillas"
            >
              Mas estados
            </Link>
          ) : null}
        </div>
      </details>
    </section>
  );
}
