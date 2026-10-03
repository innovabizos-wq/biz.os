import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  FileText,
  Handshake,
  Mail,
  MessageCircle,
  Phone,
  ShoppingCart,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import type { CrmFollowup, CrmInteraction } from "@/modules/crm/types";
import type { Quote } from "@/modules/quotes/types";
import type { Sale } from "@/modules/sales/types";

type TimelineKind = "followup" | "interaction" | "quote" | "sale";

type TimelineEvent = {
  accent: string;
  date: string;
  detail?: string;
  href?: string;
  icon: LucideIcon;
  id: string;
  kind: TimelineKind;
  label: string;
  meta: string;
  title: string;
};

type CustomerTimelineProps = {
  followups: CrmFollowup[];
  interactions: CrmInteraction[];
  quotes: Quote[];
  sales: Sale[];
};

const interactionLabels: Record<CrmInteraction["tipo"], string> = {
  correo: "Correo",
  llamada: "Llamada",
  nota: "Nota",
  reunion: "Reunión",
  sistema: "Sistema",
  whatsapp: "WhatsApp",
};

const interactionIcons: Record<CrmInteraction["tipo"], LucideIcon> = {
  correo: Mail,
  llamada: Phone,
  nota: FileText,
  reunion: Handshake,
  sistema: Activity,
  whatsapp: MessageCircle,
};

const followupStatusLabels: Record<CrmFollowup["estado"], string> = {
  cancelado: "Cancelado",
  completado: "Completado",
  pendiente: "Pendiente",
};

const followupStatusIcons: Record<CrmFollowup["estado"], LucideIcon> = {
  cancelado: XCircle,
  completado: CheckCircle2,
  pendiente: CalendarClock,
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", {
    currency,
    style: "currency",
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);

  return {
    day: new Intl.DateTimeFormat("es-CR", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("es-CR", { month: "short" }).format(date),
    time: new Intl.DateTimeFormat("es-CR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date),
    year: new Intl.DateTimeFormat("es-CR", { year: "numeric" }).format(date),
  };
}

function buildTimelineEvents(input: CustomerTimelineProps): TimelineEvent[] {
  const interactionEvents: TimelineEvent[] = input.interactions.map((interaction) => ({
    accent: "border-blue-200 bg-blue-50 text-blue-700",
    date: interaction.createdAt,
    detail: interaction.createdByNombre
      ? `Registrado por ${interaction.createdByNombre}`
      : undefined,
    icon: interactionIcons[interaction.tipo],
    id: interaction.id,
    kind: "interaction",
    label: interactionLabels[interaction.tipo],
    meta: interaction.resultado ?? "Registro de actividad",
    title: interaction.resumen,
  }));

  const followupEvents: TimelineEvent[] = input.followups.map((followup) => ({
    accent:
      followup.estado === "completado"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : followup.estado === "cancelado"
          ? "border-slate-200 bg-slate-100 text-slate-500"
          : "border-amber-200 bg-amber-50 text-amber-700",
    date: followup.completadoAt ?? followup.fechaProgramada,
    detail: followup.asignadoNombre
      ? `Asignado a ${followup.asignadoNombre}`
      : "Sin responsable asignado",
    icon: followupStatusIcons[followup.estado],
    id: followup.id,
    kind: "followup",
    label: "Seguimiento",
    meta: followupStatusLabels[followup.estado],
    title: followup.asunto,
  }));

  const quoteEvents: TimelineEvent[] = input.quotes.map((quote) => ({
    accent: "border-violet-200 bg-violet-50 text-violet-700",
    date: quote.updatedAt,
    href: `/cotizaciones/${quote.id}`,
    icon: FileText,
    id: quote.id,
    kind: "quote",
    label: "Cotización",
    meta: `${quote.estado} · ${formatMoney(quote.total, quote.moneda)}`,
    title: `Cotización ${quote.numero}`,
  }));

  const saleEvents: TimelineEvent[] = input.sales.map((sale) => ({
    accent: "border-cyan-200 bg-cyan-50 text-cyan-700",
    date: sale.updatedAt,
    href: `/ventas/${sale.id}`,
    icon: ShoppingCart,
    id: sale.id,
    kind: "sale",
    label: "Venta",
    meta: `${sale.estado} · ${formatMoney(sale.total, sale.moneda)}`,
    title: `Venta ${sale.numero}`,
  }));

  return [...interactionEvents, ...followupEvents, ...quoteEvents, ...saleEvents].sort(
    (first, second) => second.date.localeCompare(first.date),
  );
}

const summaryItems = [
  { key: "interaction", label: "Interacciones" },
  { key: "followup", label: "Seguimientos" },
  { key: "quote", label: "Cotizaciones" },
  { key: "sale", label: "Ventas" },
] as const;

export function CustomerTimeline({
  followups,
  interactions,
  quotes,
  sales,
}: CustomerTimelineProps) {
  const events = buildTimelineEvents({ followups, interactions, quotes, sales });
  const counts: Record<TimelineKind, number> = {
    followup: followups.length,
    interaction: interactions.length,
    quote: quotes.length,
    sale: sales.length,
  };

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/80 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.5)]">
      <div className="border-b border-slate-200/80 bg-slate-50/70 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
              Actividad comercial
            </p>
            <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
              El recorrido del cliente
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Cotizaciones, ventas, conversaciones y próximos pasos en orden reciente.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">
            <CircleDot aria-hidden={true} className="text-emerald-500" size={14} />
            {events.length} {events.length === 1 ? "evento" : "eventos"}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {summaryItems.map((item) => (
            <span
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500"
              key={item.key}
            >
              <strong className="mr-1 text-slate-900">{counts[item.key]}</strong>
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Activity aria-hidden={true} size={20} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-700">Aún no hay actividad registrada</p>
          <p className="mt-1 text-sm text-slate-500">
            Las nuevas interacciones, seguimientos, cotizaciones y ventas aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="relative px-5 py-6 sm:px-6">
          <div
            aria-hidden={true}
            className="absolute bottom-8 left-[91px] top-8 w-px bg-gradient-to-b from-slate-300 via-slate-200 to-transparent sm:left-[122px]"
          />
          <div className="space-y-5">
            {events.map((event) => {
              const Icon = event.icon;
              const eventDate = formatDate(event.date);

              return (
                <div
                  className="relative grid grid-cols-[68px_30px_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[92px_36px_minmax(0,1fr)] sm:gap-3"
                  key={`${event.kind}-${event.id}`}
                >
                  <time
                    className="pt-1 text-right text-[11px] font-semibold leading-tight text-slate-400"
                    dateTime={event.date}
                  >
                    <span className="block text-xs font-black text-slate-700">
                      {eventDate.day} {eventDate.month}
                    </span>
                    <span className="mt-1 block">{eventDate.year}</span>
                    <span className="mt-1 block text-slate-500">{eventDate.time}</span>
                  </time>
                  <div
                    className={`relative z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border-4 border-white shadow-sm sm:size-9 ${event.accent}`}
                  >
                    <Icon aria-hidden={true} size={16} />
                  </div>
                  <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 transition hover:border-slate-300 hover:shadow-sm">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        {event.label}
                      </p>
                      <span aria-hidden={true} className="text-slate-300">·</span>
                      <p className="text-xs font-semibold text-slate-600">{event.meta}</p>
                    </div>
                    {event.href ? (
                      <Link
                        className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-sm font-bold text-slate-900 transition hover:text-emerald-700"
                        href={event.href}
                      >
                        {event.title}
                        <ArrowUpRight aria-hidden={true} size={14} />
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm font-bold text-slate-900">{event.title}</p>
                    )}
                    {event.detail ? (
                      <p className="mt-2 text-xs text-slate-500">{event.detail}</p>
                    ) : null}
                  </article>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
