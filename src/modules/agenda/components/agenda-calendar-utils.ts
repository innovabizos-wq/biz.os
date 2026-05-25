import type { AgendaFollowup } from "@/modules/agenda/types";

export const agendaDayLabels = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
export const agendaHourLabels = [
  "7 am",
  "8 am",
  "9 am",
  "10 am",
  "11 am",
  "12 pm",
  "1 pm",
  "2 pm",
  "3 pm",
  "4 pm",
  "5 pm",
  "6 pm",
  "7 pm",
];

export const agendaEventStyles = [
  "border-sky-100 bg-sky-100 text-sky-950",
  "border-violet-100 bg-violet-100 text-violet-950",
  "border-emerald-100 bg-emerald-100 text-emerald-950",
  "border-amber-100 bg-amber-100 text-amber-950",
  "border-rose-100 bg-rose-100 text-rose-950",
  "border-slate-200 bg-slate-100 text-slate-800",
];

export function startOfAgendaWeek(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);

  return value;
}

export function startOfAgendaMonth(date = new Date()) {
  const value = new Date(date.getFullYear(), date.getMonth(), 1);
  value.setHours(0, 0, 0, 0);

  return value;
}

export function addAgendaDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);

  return value;
}

export function isSameAgendaDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function formatAgendaTime(value: string) {
  return new Date(value).toLocaleTimeString("es-CR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAgendaMonth(value: Date) {
  return value.toLocaleDateString("es-CR", {
    month: "long",
    year: "numeric",
  });
}

export function formatAgendaShortMonth(value: Date) {
  return value.toLocaleDateString("es-CR", {
    month: "short",
  });
}

export function getAgendaEventClass(followup: AgendaFollowup, index: number) {
  if (followup.estado === "completado") {
    return "border-emerald-100 bg-emerald-100 text-emerald-950";
  }

  if (followup.estado === "cancelado") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  const dueDate = new Date(followup.fechaProgramada);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dueDate < today) {
    return "border-rose-100 bg-rose-100 text-rose-950";
  }

  return agendaEventStyles[index % agendaEventStyles.length];
}

export function getAgendaEventPosition(value: string, index: number) {
  const date = new Date(value);
  const hour = date.getHours() + date.getMinutes() / 60;
  const startHour = 7;
  const endHour = 19.75;
  const rowPercent = 100 / agendaHourLabels.length;
  const clampedHour = Math.min(Math.max(hour, startHour), endHour);
  const top = (clampedHour - startHour) * rowPercent + (index % 2) * 0.85;

  return {
    height: "4.25rem",
    top: `${top}%`,
  };
}

export function getAgendaWeekDays(followups: AgendaFollowup[]) {
  const weekStart = startOfAgendaWeek();

  return getAgendaWeekDaysForDate(followups, weekStart);
}

export function getAgendaWeekDaysForDate(
  followups: AgendaFollowup[],
  selectedDate: Date,
) {
  const weekStart = startOfAgendaWeek(selectedDate);

  return agendaDayLabels.map((label, index) => {
    const date = addAgendaDays(weekStart, index);

    return {
      date,
      followups: followups.filter((followup) =>
        isSameAgendaDay(new Date(followup.fechaProgramada), date),
      ),
      label,
    };
  });
}

export function formatAgendaDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function parseAgendaDateParam(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return new Date();
  }

  return date;
}
