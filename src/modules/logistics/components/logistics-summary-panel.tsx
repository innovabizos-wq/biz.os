import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import type {
  LogisticsDashboardStats,
  LogisticsDaySummary,
} from "@/modules/logistics/types";

type LogisticsSummaryPanelProps = {
  stats: LogisticsDashboardStats;
  summary: LogisticsDaySummary;
};

function buildConicGradient(items: Array<{ color: string; value: number }>) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return "#e2e8f0 0deg 360deg";
  }

  let cursor = 0;

  return items
    .map((item) => {
      const degrees = (item.value / total) * 360;
      const start = cursor;
      const end = cursor + degrees;
      cursor = end;

      return `${item.color} ${start}deg ${end}deg`;
    })
    .join(", ");
}

export function LogisticsSummaryPanel({
  stats,
  summary,
}: LogisticsSummaryPanelProps) {
  const stateItems = [
    { color: "#2563eb", label: "En ruta", value: stats.onRouteDrivers },
    { color: "#7c3aed", label: "Pendientes", value: stats.pendingDispatches },
    { color: "#f97316", label: "Almuerzo", value: stats.lunchDrivers },
    { color: "#16a34a", label: "Disponibles", value: stats.availableDrivers },
    { color: "#0f766e", label: "Entregados", value: stats.deliveredToday },
  ];
  const conicGradient = buildConicGradient(stateItems);

  return (
    <aside className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-black text-slate-950">Resumen del dia</h3>

      <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100">
        <div className="pr-3">
          <p className="text-xs font-semibold text-slate-500">Despachos hoy</p>
          <p className="mt-2 text-2xl font-black text-slate-950">
            {summary.dispatchesToday}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs font-bold text-emerald-600">
            <ArrowUpRight className="size-3" />
            Real
          </p>
        </div>
        <div className="px-3">
          <p className="text-xs font-semibold text-slate-500">Efectividad</p>
          <p className="mt-2 text-2xl font-black text-slate-950">
            {summary.effectiveness}%
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs font-bold text-emerald-600">
            <ArrowUpRight className="size-3" />
            Hoy
          </p>
        </div>
        <div className="pl-3">
          <p className="text-xs font-semibold text-slate-500">Retrasos</p>
          <p className="mt-2 text-2xl font-black text-slate-950">
            {summary.delays}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs font-bold text-slate-500">
            <ArrowDownRight className="size-3" />
            Temporal
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="text-sm font-black text-slate-900">Despachos por estado</p>
        <div className="mt-4 grid grid-cols-[104px_1fr] items-center gap-5">
          <div
            className="relative size-[6.5rem] rounded-full"
            style={{ background: `conic-gradient(${conicGradient})` }}
          >
            <div className="absolute inset-5 rounded-full bg-white shadow-inner" />
          </div>
          <div className="space-y-2.5">
            {stateItems.map((item) => (
              <div className="flex items-center justify-between gap-2" key={item.label}>
                <span className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="text-xs font-bold text-slate-600">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
