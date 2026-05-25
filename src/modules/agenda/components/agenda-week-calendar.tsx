import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import {
  addAgendaDays,
  agendaHourLabels,
  formatAgendaDateParam,
  formatAgendaTime,
  getAgendaEventPosition,
} from "@/modules/agenda/components/agenda-calendar-utils";
import type { getAgendaWeekDays } from "@/modules/agenda/components/agenda-calendar-utils";
import type { AgendaFollowup } from "@/modules/agenda/types";

type AgendaWeekDay = ReturnType<typeof getAgendaWeekDays>[number];

type AgendaWeekCalendarProps = {
  days: AgendaWeekDay[];
  weekStart: Date;
};

export function AgendaWeekCalendar({ days, weekStart }: AgendaWeekCalendarProps) {
  const previousWeek = addAgendaDays(weekStart, -7);
  const nextWeek = addAgendaDays(weekStart, 7);

  return (
    <section className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_14px_rgba(15,23,42,0.14)]">
      <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-5">
        <div className="flex items-center gap-2">
          <Link
            aria-label="Semana anterior"
            className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm"
            href={`/agenda?fecha=${formatAgendaDateParam(previousWeek)}`}
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </Link>
          <Link
            className="flex h-9 items-center rounded-lg bg-slate-100 px-5 text-sm font-bold text-slate-700"
            href="/agenda"
          >
            Todos
          </Link>
          <Link
            aria-label="Semana siguiente"
            className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm"
            href={`/agenda?fecha=${formatAgendaDateParam(nextWeek)}`}
          >
            <ChevronRight aria-hidden="true" size={18} />
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="hidden h-9 rounded-lg border-2 border-slate-500 bg-white px-4 text-xs font-black uppercase text-slate-700 shadow-sm sm:inline-flex sm:items-center"
            type="button"
          >
            Ultima sincronizacion
          </button>
          <Link
            className="inline-flex h-9 items-center rounded-lg bg-slate-950 px-4 text-xs font-black uppercase text-white shadow-md"
            href="/agenda/seguimientos"
          >
            Accion rapida
          </Link>
        </div>
      </div>

      <div className="h-[calc(100%-4rem)] min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="grid min-h-full grid-cols-[3.75rem_repeat(7,minmax(0,1fr))] grid-rows-[2.875rem_1fr]">
          <div className="border-b border-r border-slate-200 bg-slate-50" />
          {days.map((day) => (
            <div
              className="border-b border-r border-slate-200 bg-slate-50 px-2 py-3 text-center text-[11px] font-black uppercase text-slate-700 last:border-r-0"
              key={day.label}
            >
              {formatAgendaDayHeader(day.date)}
            </div>
          ))}

          <div
            className="grid border-r border-slate-200 bg-white text-[11px] font-bold text-slate-400"
            style={{
              gridTemplateRows: `repeat(${agendaHourLabels.length}, minmax(4.5rem, 4.5rem))`,
            }}
          >
            {agendaHourLabels.map((hour) => (
              <div
                className="border-b border-slate-100 px-2 pt-2 last:border-b-0"
                key={hour}
              >
                {hour}
              </div>
            ))}
          </div>

          {days.map((day, dayIndex) => (
            <div
              className="relative min-h-[58.5rem] border-r border-slate-200 bg-white last:border-r-0"
              key={day.label}
            >
              <AgendaDaySlots date={day.date} />
              {day.followups.map((followup, index) => (
                <AgendaStackedEvent
                  followup={followup}
                  index={index + dayIndex}
                  key={followup.seguimientoId}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AgendaDaySlots({ date }: { date: Date }) {
  return (
    <div
      className="absolute inset-0 grid"
      style={{
        gridTemplateRows: `repeat(${agendaHourLabels.length}, minmax(4.5rem, 4.5rem))`,
      }}
    >
      {agendaHourLabels.map((hour) => (
        <details
          className="group relative border-b border-slate-100 last:border-b-0"
          key={`${date.toISOString()}-${hour}`}
        >
          <summary className="flex h-full cursor-pointer list-none items-center justify-center border border-transparent bg-white transition hover:border-dashed hover:border-sky-400 hover:bg-sky-50/40 [&::-webkit-details-marker]:hidden">
            <span className="flex size-7 scale-90 items-center justify-center rounded-full text-2xl font-semibold text-sky-600 opacity-0 transition group-hover:scale-100 group-hover:opacity-100">
              +
            </span>
          </summary>
          <div className="absolute left-1/2 top-10 z-30 w-44 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-xl">
            <p className="px-2 pb-1 font-black uppercase text-slate-500">
              Crear evento
            </p>
            <Link
              className="block rounded-md px-2 py-1.5 font-semibold text-slate-800 hover:bg-sky-50"
              href={`/agenda/seguimientos?fecha=${formatAgendaDateParam(date)}`}
            >
              Seguimiento CRM
            </Link>
            <Link
              className="block rounded-md px-2 py-1.5 font-semibold text-slate-800 hover:bg-sky-50"
              href={`/agenda/seguimientos?fecha=${formatAgendaDateParam(date)}&tipo=llamada`}
            >
              Llamada
            </Link>
            <Link
              className="block rounded-md px-2 py-1.5 font-semibold text-slate-800 hover:bg-sky-50"
              href={`/agenda/seguimientos?fecha=${formatAgendaDateParam(date)}&tipo=tarea`}
            >
              Tarea
            </Link>
          </div>
        </details>
      ))}
    </div>
  );
}

function formatAgendaDayHeader(date: Date) {
  const weekday = date
    .toLocaleDateString("es-CR", { weekday: "long" })
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  const month = date
    .toLocaleDateString("es-CR", { month: "short" })
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(".", "")
    .toUpperCase();

  return `${weekday} ${date.getDate()} ${month}`;
}

function AgendaStackedEvent({
  followup,
  index,
}: {
  followup: AgendaFollowup;
  index: number;
}) {
  return (
    <Link
      className={`absolute left-1.5 right-1.5 z-20 block overflow-hidden rounded-md border border-slate-200 p-2 pl-3 text-[10px] shadow-[0_2px_8px_rgba(15,23,42,0.14)] transition before:absolute before:bottom-2 before:left-0 before:top-2 before:w-1 before:rounded-r before:bg-slate-950 hover:-translate-y-0.5 hover:shadow-[0_6px_14px_rgba(15,23,42,0.16)] ${getAgendaCardClass(
        followup,
        index,
      )}`}
      href={`/crm/clientes/${followup.clienteId}`}
      style={getAgendaEventPosition(followup.fechaProgramada, index)}
    >
      <p className="line-clamp-1 font-black uppercase leading-tight text-slate-950">
        {followup.asunto}
      </p>
      <p className="mt-0.5 line-clamp-1 font-black text-slate-800">
        {formatAgendaTime(followup.fechaProgramada)} - {followup.clienteNombre}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {getAgendaPills(followup).map((pill) => (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase ${pill.className}`}
            key={pill.label}
          >
            {pill.label}
          </span>
        ))}
      </div>
    </Link>
  );
}

function getAgendaCardClass(followup: AgendaFollowup, index: number) {
  if (followup.estado === "completado") {
    return "bg-emerald-50 text-emerald-950";
  }

  if (followup.estado === "cancelado") {
    return "bg-slate-50 text-slate-700";
  }

  const dueDate = new Date(followup.fechaProgramada);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dueDate < today) {
    return "bg-rose-50 text-rose-950";
  }

  return index % 3 === 0
    ? "bg-sky-50 text-sky-950"
    : index % 3 === 1
      ? "bg-cyan-50 text-cyan-950"
      : "bg-indigo-50 text-indigo-950";
}

function getAgendaPills(followup: AgendaFollowup) {
  const dueDate = new Date(followup.fechaProgramada);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (followup.estado === "completado") {
    return [
      { className: "bg-emerald-100 text-emerald-800", label: "Completado" },
    ];
  }

  if (followup.estado === "cancelado") {
    return [{ className: "bg-slate-100 text-slate-700", label: "Cancelado" }];
  }

  if (dueDate < today) {
    return [
      { className: "bg-rose-100 text-rose-800", label: "Urgente" },
      { className: "bg-amber-100 text-amber-800", label: "Pendiente" },
    ];
  }

  return [{ className: "bg-sky-100 text-sky-800", label: "Programado" }];
}
