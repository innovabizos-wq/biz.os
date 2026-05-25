"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { QUOTE_STATUSES } from "@/modules/quotes/constants";
import { QuotesTable } from "@/modules/quotes/components/quotes-table";
import type { Quote, QuoteStatus } from "@/modules/quotes/types";

type QuotesDatabaseProps = {
  className?: string;
  quotes: Quote[];
};

type QuoteFilters = {
  creadoPor: string;
  estado: "" | QuoteStatus;
  moneda: string;
  q: string;
};

function normalizeText(value: string | number | null | undefined) {
  return String(value ?? "").toLowerCase().trim();
}

function filterQuotes(quotes: Quote[], filters: QuoteFilters) {
  const query = normalizeText(filters.q);

  return quotes.filter((quote) => {
    const matchesQuery =
      !query ||
      [
        quote.numero,
        quote.clienteNombre,
        quote.estado,
        quote.fechaEmision,
        quote.fechaVencimiento,
        quote.total,
        quote.moneda,
        quote.creadoPorNombre,
      ].some((value) => normalizeText(value).includes(query));
    const matchesStatus = !filters.estado || quote.estado === filters.estado;
    const matchesCurrency = !filters.moneda || quote.moneda === filters.moneda;
    const matchesCreator =
      !filters.creadoPor || quote.creadoPorNombre === filters.creadoPor;

    return matchesQuery && matchesStatus && matchesCurrency && matchesCreator;
  });
}

function getUniqueOptions(values: Array<string | null>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b),
  );
}

export function QuotesDatabase({ className, quotes }: QuotesDatabaseProps) {
  const [filters, setFilters] = useState<QuoteFilters>({
    creadoPor: "",
    estado: "",
    moneda: "",
    q: "",
  });
  const currencyOptions = useMemo(
    () => getUniqueOptions(quotes.map((quote) => quote.moneda)),
    [quotes],
  );
  const creatorOptions = useMemo(
    () => getUniqueOptions(quotes.map((quote) => quote.creadoPorNombre)),
    [quotes],
  );
  const filteredQuotes = useMemo(
    () => filterQuotes(quotes, filters),
    [quotes, filters],
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3 pt-5", className)}>
      <div className="rounded-2xl border border-[rgba(var(--kpi-theme-accent-rgb),0.34)] bg-white p-4 shadow-[0_14px_30px_rgba(var(--kpi-theme-accent-rgb),0.14)]">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_160px_160px_190px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm shadow-inner outline-none transition focus:border-[rgba(var(--kpi-theme-accent-rgb),0.7)] focus:bg-white focus:ring-2 focus:ring-[rgba(var(--kpi-theme-accent-rgb),0.18)]"
              onChange={(event) =>
                setFilters((current) => ({ ...current, q: event.target.value }))
              }
              placeholder="Buscar por numero, cliente, estado, fecha o total"
              type="search"
              value={filters.q}
            />
          </label>

          <select
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm shadow-inner outline-none transition focus:border-[rgba(var(--kpi-theme-accent-rgb),0.7)] focus:bg-white focus:ring-2 focus:ring-[rgba(var(--kpi-theme-accent-rgb),0.18)]"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                estado: event.target.value as QuoteFilters["estado"],
              }))
            }
            value={filters.estado}
          >
            <option value="">Estado</option>
            {QUOTE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm shadow-inner outline-none transition focus:border-[rgba(var(--kpi-theme-accent-rgb),0.7)] focus:bg-white focus:ring-2 focus:ring-[rgba(var(--kpi-theme-accent-rgb),0.18)]"
            onChange={(event) =>
              setFilters((current) => ({ ...current, moneda: event.target.value }))
            }
            value={filters.moneda}
          >
            <option value="">Moneda</option>
            {currencyOptions.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>

          <select
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm shadow-inner outline-none transition focus:border-[rgba(var(--kpi-theme-accent-rgb),0.7)] focus:bg-white focus:ring-2 focus:ring-[rgba(var(--kpi-theme-accent-rgb),0.18)]"
            onChange={(event) =>
              setFilters((current) => ({ ...current, creadoPor: event.target.value }))
            }
            value={filters.creadoPor}
          >
            <option value="">Creado por</option>
            {creatorOptions.map((creator) => (
              <option key={creator} value={creator}>
                {creator}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredQuotes.length > 0 ? (
        <QuotesTable className="min-h-0 flex-1" quotes={filteredQuotes} />
      ) : (
        <div className="min-h-0 flex-1 rounded-lg border bg-background">
          <EmptyState
            description="Ajusta los filtros para volver a mostrar cotizaciones."
            title="Sin resultados"
          />
        </div>
      )}
    </div>
  );
}
