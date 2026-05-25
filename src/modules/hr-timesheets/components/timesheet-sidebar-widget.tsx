import Link from "next/link";
import { ChevronDown, LayoutDashboard, LogOut, UserRound } from "lucide-react";

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
  const statusLabel = currentStatus?.stateName ?? "Sin estado";
  const menuStates = sortStatesForMenu(states);

  return (
    <section className="app-time-clock" aria-label="Estado laboral diario">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600">
          <UserRound size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-flex max-w-full rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase leading-4 text-slate-700">
            <span className="truncate">{statusLabel}</span>
          </span>
          <p className="mt-1 truncate text-sm font-semibold text-slate-950">
            {displayName}
          </p>
        </div>
      </div>

      {canRegister && menuStates.length > 0 ? (
        <details className="group relative mt-3">
          <summary className="app-theme-button flex w-full cursor-pointer list-none items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-white transition [&::-webkit-details-marker]:hidden">
            Cambiar estado
            <ChevronDown
              className="transition group-open:rotate-180"
              size={15}
            />
          </summary>
          <div className="absolute bottom-full left-0 z-20 mb-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
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
        </details>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
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
            Salir
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
    </section>
  );
}
