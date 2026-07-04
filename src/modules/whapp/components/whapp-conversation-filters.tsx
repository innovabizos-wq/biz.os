import Link from "next/link";

import {
  INBOX_CHANNEL_LABELS,
  INBOX_CHANNELS,
} from "@/modules/inbox/constants";
import type { InboxChannel } from "@/modules/inbox/types";

type WhappConversationFiltersProps = {
  activeChannel: InboxChannel | "todos";
  activeFilter: string;
  query: string;
};

const FILTERS = [
  { label: "Mios", value: "mios" },
  { label: "Sin asignar", value: "sin_asignar" },
  { label: "Todos", value: "todos" },
  { label: "No leidos", value: "no_leidos" },
  { label: "SLA vencido", value: "sla_vencido" },
  { label: "SLA riesgo", value: "sla_riesgo" },
  { label: "Abiertas", value: "abiertas" },
  { label: "Cerradas", value: "cerradas" },
] as const;

function hrefFor(filter: string, query: string, channel: InboxChannel | "todos") {
  const params = new URLSearchParams();

  params.set("vista", filter);
  if (channel !== "todos") params.set("canal", channel);
  if (query.trim()) params.set("q", query.trim());

  return `/whapp/conversaciones?${params.toString()}`;
}

export function WhappConversationFilters({
  activeChannel,
  activeFilter,
  query,
}: WhappConversationFiltersProps) {
  return (
    <div className="space-y-3 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const active = activeFilter === filter.value;

          return (
            <Link
              className={[
                "rounded-md border px-3 py-2 text-sm font-medium",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground",
              ].join(" ")}
              href={hrefFor(filter.value, query, activeChannel)}
              key={filter.value}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          className={[
            "rounded-md border px-3 py-2 text-sm font-medium",
            activeChannel === "todos"
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:text-foreground",
          ].join(" ")}
          href={hrefFor(activeFilter, query, "todos")}
        >
          Todos los canales
        </Link>
        {INBOX_CHANNELS.map((channel) => (
          <Link
            className={[
              "rounded-md border px-3 py-2 text-sm font-medium",
              activeChannel === channel
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:text-foreground",
            ].join(" ")}
            href={hrefFor(activeFilter, query, channel)}
            key={channel}
          >
            {INBOX_CHANNEL_LABELS[channel]}
          </Link>
        ))}
      </div>
      <form className="flex flex-wrap gap-2" action="/whapp/conversaciones">
        <input name="vista" type="hidden" value={activeFilter} />
        <input name="canal" type="hidden" value={activeChannel} />
        <input
          className="h-10 min-w-64 flex-1 rounded-md border bg-background px-3 text-sm"
          defaultValue={query}
          name="q"
          placeholder="Buscar por nombre, telefono o texto"
          type="search"
        />
        <button
          className="h-10 rounded-md border px-4 text-sm font-medium"
          type="submit"
        >
          Buscar
        </button>
      </form>
    </div>
  );
}
