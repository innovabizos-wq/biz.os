import { CalendarDays } from "lucide-react";
import Link from "next/link";

import {
  addAgendaDays,
  agendaDayLabels,
  formatAgendaDateParam,
  formatAgendaMonth,
  isSameAgendaDay,
  startOfAgendaMonth,
} from "@/modules/agenda/components/agenda-calendar-utils";

function getMiniCalendarDays(today: Date) {
  const monthStart = startOfAgendaMonth(today);
  const startDay = monthStart.getDay();
  const offset = startDay === 0 ? 6 : startDay - 1;
  const gridStart = addAgendaDays(monthStart, -offset);

  return Array.from({ length: 42 }, (_, index) => addAgendaDays(gridStart, index));
}

type AgendaMiniCalendarProps = {
  selectedDate: Date;
};

export function AgendaMiniCalendar({ selectedDate }: AgendaMiniCalendarProps) {
  const today = new Date();
  const monthDays = getMiniCalendarDays(selectedDate);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Calendario
          </p>
          <h2 className="mt-1 text-lg font-bold capitalize text-slate-950">
            {formatAgendaMonth(selectedDate)}
          </h2>
        </div>
        <CalendarDays className="text-slate-500" size={18} />
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[0.68rem] font-semibold text-slate-400">
        {agendaDayLabels.map((day) => (
          <span key={day}>{day.slice(0, 2)}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs">
        {monthDays.map((date) => {
          const active = isSameAgendaDay(date, selectedDate);
          const isToday = isSameAgendaDay(date, today);
          const muted = date.getMonth() !== selectedDate.getMonth();

          return (
            <Link
              className={`flex aspect-square items-center justify-center rounded-full ${
                active
                  ? "bg-slate-950 font-bold text-white"
                  : isToday
                    ? "bg-sky-100 font-bold text-sky-800"
                  : muted
                    ? "text-slate-300"
                    : "text-slate-700 hover:bg-slate-100"
              }`}
              href={`/agenda?fecha=${formatAgendaDateParam(date)}`}
              key={date.toISOString()}
            >
              {date.getDate()}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
