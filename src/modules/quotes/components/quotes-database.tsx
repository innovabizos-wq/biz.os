"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { QUOTE_STATUSES } from "@/modules/quotes/constants";
import { QuotesTable } from "@/modules/quotes/components/quotes-table";
import type {
  Quote,
  QuoteCatalogProduct,
  QuoteCustomer,
  QuoteItem,
  QuoteStatus,
} from "@/modules/quotes/types";
import type { ElectronicInvoice, FiscalConfiguration } from "@/modules/billing/types";
import type { Sale } from "@/modules/sales/types";

type QuotesDatabaseProps = {
  canCreateInvoice: boolean;
  canDeleteQuote: boolean;
  canEditQuote: boolean;
  canConfirmSale: boolean;
  className?: string;
  customers: QuoteCustomer[];
  fiscalConfiguration: FiscalConfiguration | null;
  invoicesBySaleId: Record<string, ElectronicInvoice>;
  itemsByQuoteId: Record<string, QuoteItem[]>;
  products: QuoteCatalogProduct[];
  quotes: Quote[];
  salesByQuoteId: Record<string, Sale>;
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

export function QuotesDatabase({
  canCreateInvoice,
  canDeleteQuote,
  canEditQuote,
  canConfirmSale,
  className,
  customers,
  fiscalConfiguration,
  invoicesBySaleId,
  itemsByQuoteId,
  products,
  quotes,
  salesByQuoteId,
}: QuotesDatabaseProps) {
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
      <div className="app-filter-shell p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_160px_160px_190px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-blue-500" />
            <input
              className="app-filter-control h-11 w-full rounded-xl pl-9 pr-3 text-sm outline-none transition"
              onChange={(event) =>
                setFilters((current) => ({ ...current, q: event.target.value }))
              }
              placeholder="Buscar por numero, cliente, estado, fecha o total"
              type="search"
              value={filters.q}
            />
          </label>

          <select
            className="app-filter-control h-11 rounded-xl px-3 text-sm outline-none transition"
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
            className="app-filter-control h-11 rounded-xl px-3 text-sm outline-none transition"
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
            className="app-filter-control h-11 rounded-xl px-3 text-sm outline-none transition"
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
        <QuotesTable
          canConfirmSale={canConfirmSale}
          canCreateInvoice={canCreateInvoice}
          canDeleteQuote={canDeleteQuote}
          canEditQuote={canEditQuote}
          className="min-h-0 flex-1"
          customers={customers}
          fiscalConfiguration={fiscalConfiguration}
          invoicesBySaleId={invoicesBySaleId}
          itemsByQuoteId={itemsByQuoteId}
          products={products}
          quotes={filteredQuotes}
          salesByQuoteId={salesByQuoteId}
        />
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
