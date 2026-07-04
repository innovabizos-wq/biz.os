import Link from "next/link";

import type { CrmFollowup, CrmInteraction } from "@/modules/crm/types";
import type { Quote } from "@/modules/quotes/types";
import type { Sale } from "@/modules/sales/types";

type TimelineEvent =
  | {
      date: string;
      href?: string;
      id: string;
      kind: "followup";
      meta: string;
      title: string;
    }
  | {
      date: string;
      href?: string;
      id: string;
      kind: "interaction";
      meta: string;
      title: string;
    }
  | {
      date: string;
      href: string;
      id: string;
      kind: "quote";
      meta: string;
      title: string;
    }
  | {
      date: string;
      href: string;
      id: string;
      kind: "sale";
      meta: string;
      title: string;
    };

type CustomerTimelineProps = {
  followups: CrmFollowup[];
  interactions: CrmInteraction[];
  quotes: Quote[];
  sales: Sale[];
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", {
    currency,
    style: "currency",
  }).format(value);
}

function buildTimelineEvents(input: CustomerTimelineProps): TimelineEvent[] {
  const interactionEvents: TimelineEvent[] = input.interactions.map((interaction) => ({
    date: interaction.createdAt,
    id: interaction.id,
    kind: "interaction",
    meta: interaction.resultado
      ? `${interaction.tipo} - ${interaction.resultado}`
      : interaction.tipo,
    title: interaction.resumen,
  }));

  const followupEvents: TimelineEvent[] = input.followups.map((followup) => ({
    date: followup.completadoAt ?? followup.fechaProgramada,
    id: followup.id,
    kind: "followup",
    meta: `${followup.estado} - ${followup.asignadoNombre ?? "Sin asignar"}`,
    title: followup.asunto,
  }));

  const quoteEvents: TimelineEvent[] = input.quotes.map((quote) => ({
    date: quote.updatedAt,
    href: `/cotizaciones/${quote.id}`,
    id: quote.id,
    kind: "quote",
    meta: `${quote.estado} - ${formatMoney(quote.total, quote.moneda)}`,
    title: `Cotizacion ${quote.numero}`,
  }));

  const saleEvents: TimelineEvent[] = input.sales.map((sale) => ({
    date: sale.updatedAt,
    href: `/ventas/${sale.id}`,
    id: sale.id,
    kind: "sale",
    meta: `${sale.estado} - ${formatMoney(sale.total, sale.moneda)}`,
    title: `Venta ${sale.numero}`,
  }));

  return [...interactionEvents, ...followupEvents, ...quoteEvents, ...saleEvents].sort(
    (first, second) => second.date.localeCompare(first.date),
  );
}

export function CustomerTimeline({
  followups,
  interactions,
  quotes,
  sales,
}: CustomerTimelineProps) {
  const events = buildTimelineEvents({ followups, interactions, quotes, sales });

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-background p-5 text-sm text-muted-foreground">
        No hay historial registrado todavia.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <article
          className="rounded-lg border bg-background p-4"
          key={`${event.kind}-${event.id}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold">
              {event.kind === "interaction"
                ? "Interaccion"
                : event.kind === "followup"
                  ? "Seguimiento"
                  : event.kind === "quote"
                    ? "Cotizacion"
                    : "Venta"}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(event.date).toLocaleString("es")}
            </p>
          </div>
          {event.href ? (
            <Link
              className="mt-2 inline-flex text-sm font-medium text-emerald-700 underline underline-offset-4"
              href={event.href}
            >
              {event.title}
            </Link>
          ) : (
            <p className="mt-2 text-sm font-medium">{event.title}</p>
          )}
          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
            {event.meta}
          </p>
        </article>
      ))}
    </div>
  );
}
