import {
  getAgendaWeekDaysForDate,
  startOfAgendaWeek,
} from "@/modules/agenda/components/agenda-calendar-utils";
import { AgendaMiniCalendar } from "@/modules/agenda/components/agenda-mini-calendar";
import { AgendaUpcomingPanel } from "@/modules/agenda/components/agenda-upcoming-panel";
import { AgendaWeekCalendar } from "@/modules/agenda/components/agenda-week-calendar";
import type { AgendaFollowup } from "@/modules/agenda/types";

type WeeklyAgendaViewProps = {
  followups: AgendaFollowup[];
  selectedDate: Date;
};

export function WeeklyAgendaView({
  followups,
  selectedDate,
}: WeeklyAgendaViewProps) {
  const weekStart = startOfAgendaWeek(selectedDate);
  const days = getAgendaWeekDaysForDate(followups, selectedDate);

  return (
    <section className="grid h-full min-h-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="hidden min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 lg:grid">
        <AgendaMiniCalendar selectedDate={selectedDate} />
        <AgendaUpcomingPanel followups={followups} />
      </aside>

      <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Semana actual
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            Semana {getAgendaWeekNumber(weekStart)}
          </h2>
        </div>
        <AgendaWeekCalendar days={days} weekStart={weekStart} />
      </div>
    </section>
  );
}

function getAgendaWeekNumber(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));

  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
