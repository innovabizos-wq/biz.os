import { CheckCircle2, PackagePlus, Truck, XCircle } from "lucide-react";

import { getDispatchStatusStyle } from "@/modules/logistics/constants";
import type { LogisticsActivity } from "@/modules/logistics/types";

type ActivityListProps = {
  activities: LogisticsActivity[];
};

function getActivityIcon(type: string) {
  if (type === "entregado") return CheckCircle2;
  if (type === "en_ruta") return Truck;
  if (type === "fallido" || type === "cancelado") return XCircle;

  return PackagePlus;
}

export function ActivityList({ activities }: ActivityListProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        No hay actividad reciente.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {activities.map((activity) => {
        const Icon = getActivityIcon(activity.type);
        const statusStyle = getDispatchStatusStyle(activity.type);

        return (
          <div className="flex gap-3 py-3" key={activity.id}>
            <div
              className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${statusStyle.badge}`}
            >
              <Icon className="size-4" strokeWidth={2.4} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold leading-snug text-slate-900">
                  {activity.title}
                </p>
                <span className="shrink-0 text-xs text-slate-500">
                  {activity.timeLabel}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {activity.dispatchNumber ?? "Despacho"}
                {activity.description ? ` - ${activity.description}` : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
