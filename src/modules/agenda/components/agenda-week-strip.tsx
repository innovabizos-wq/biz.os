import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  formatAgendaShortMonth,
  isSameAgendaDay,
} from "@/modules/agenda/components/agenda-calendar-utils";
import type { getAgendaWeekDays } from "@/modules/agenda/components/agenda-calendar-utils";

type AgendaWeekDay = ReturnType<typeof getAgendaWeekDays>[number];

type AgendaWeekStripProps = {
  days: AgendaWeekDay[];
};

export function AgendaWeekStrip({ days }: AgendaWeekStripProps) {
  const today = new Date();

  return (
    <div className="flex items-stretch gap-2">
      <button
        aria-label="Semana anterior"
        className="flex w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"
        type="button"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="grid min-w-0 flex-1 grid-cols-7 gap-2">
        {days.map((day) => {
          const active = isSameAgendaDay(day.date, today);

          return (
            <button
              className={`min-w-0 rounded-2xl border px-3 py-2 text-left transition ${
                active
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
              key={day.label}
              type="button"
            >
              <span className="block text-xs font-semibold">{day.label}</span>
              <span className="mt-1 flex items-end justify-between gap-1">
                <span className="text-2xl font-black leading-none">
                  {day.date.getDate()}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${
                    active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {formatAgendaShortMonth(day.date)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        aria-label="Semana siguiente"
        className="flex w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"
        type="button"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
