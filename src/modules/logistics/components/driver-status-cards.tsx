import { Coffee, Radio, Truck, UserCheck } from "lucide-react";
import type { ComponentType } from "react";

import type { DriverTrackingSummary } from "@/modules/driver-tracking/types";
import type { LogisticsDashboardStats } from "@/modules/logistics/types";

type DriverStatusCardsProps = {
  dispatchStats: LogisticsDashboardStats;
  driverSummary: DriverTrackingSummary;
};

type StatusCard = {
  badge: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  iconClassName: string;
  label: string;
  value: number;
};

export function DriverStatusCards({
  dispatchStats,
  driverSummary,
}: DriverStatusCardsProps) {
  const cards: StatusCard[] = [
    {
      badge: "En linea",
      icon: Radio,
      iconClassName: "bg-blue-50 text-blue-600",
      label: "Choferes conectados",
      value: driverSummary.connectedDrivers,
    },
    {
      badge: "Disponible",
      icon: UserCheck,
      iconClassName: "bg-emerald-50 text-emerald-600",
      label: "Disponibles",
      value: driverSummary.availableDrivers,
    },
    {
      badge: "En ruta",
      icon: Truck,
      iconClassName: "bg-sky-50 text-sky-600",
      label: "En ruta",
      value: driverSummary.onRouteDrivers || dispatchStats.onRouteDrivers,
    },
    {
      badge: "Almuerzo",
      icon: Coffee,
      iconClassName: "bg-orange-50 text-orange-600",
      label: "Almuerzo",
      value: driverSummary.lunchDrivers,
    },
  ];

  return (
    <div className="grid h-full grid-rows-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <article
            className="group flex min-h-0 items-center rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            key={card.label}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${card.iconClassName}`}
              >
                <Icon className="size-5" strokeWidth={2.4} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight text-slate-700">
                  {card.label}
                </p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <p className="text-[1.65rem] font-black leading-none text-slate-950">
                    {card.value}
                  </p>
                  <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[0.68rem] font-bold text-slate-600 ring-1 ring-slate-200">
                    {card.badge}
                  </span>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
