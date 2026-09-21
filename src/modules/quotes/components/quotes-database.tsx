"use client";

import { Maximize2, Minimize2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type ExpandedPanelBounds = {
  height: number;
  left: number;
  top: number;
  width: number;
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
  const slotRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [expandedBounds, setExpandedBounds] = useState<ExpandedPanelBounds | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
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

  const measureExpandedBounds = useCallback((): ExpandedPanelBounds | null => {
    const chartsRegion = document.querySelector<HTMLElement>(
      "[data-quotes-charts-region]",
    );
    const pageSection = slotRef.current?.closest("section");

    if (!chartsRegion || !pageSection) return null;

    const chartsRect = chartsRegion.getBoundingClientRect();
    const sectionRect = pageSection.getBoundingClientRect();
    const bottom = Math.min(sectionRect.bottom, window.innerHeight - 12);

    return {
      height: Math.max(bottom - chartsRect.top, 320),
      left: chartsRect.left,
      top: chartsRect.top,
      width: chartsRect.width,
    };
  }, []);

  const animatePanel = useCallback(
    (
      startRect: DOMRect,
      endRect: DOMRect,
      direction: "expand" | "collapse",
      onFinish?: () => void,
    ) => {
      const panel = panelRef.current;

      if (!panel || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        onFinish?.();
        return;
      }

      const deltaX = direction === "expand"
        ? startRect.left - endRect.left
        : endRect.left - startRect.left;
      const deltaY = direction === "expand"
        ? startRect.top - endRect.top
        : endRect.top - startRect.top;
      const movingFrame = {
        opacity: 0.98,
        transform: `translate3d(${deltaX}px, ${deltaY}px, 0)`,
      };
      const settledFrame = {
        opacity: 1,
        transform: "translate3d(0, 0, 0)",
      };
      const softLandingFrame = {
        opacity: 1,
        transform: `translate3d(0, ${direction === "expand" ? -3 : 3}px, 0)`,
      };
      const frames =
        direction === "expand"
          ? [
              { ...movingFrame, offset: 0 },
              { ...softLandingFrame, offset: 0.82 },
              { ...settledFrame, offset: 1 },
            ]
          : [
              { ...settledFrame, offset: 0 },
              { ...softLandingFrame, offset: 0.18 },
              { ...movingFrame, offset: 1 },
            ];
      const animation = panel.animate(frames, {
        duration: 420,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "both",
      });

      animation.finished
        .catch(() => undefined)
        .finally(() => {
          onFinish?.();
          requestAnimationFrame(() => animation.cancel());
        });
    },
    [],
  );

  const toggleExpanded = useCallback(() => {
    if (isAnimating) return;

    const panel = panelRef.current;
    const slot = slotRef.current;

    if (!panel || !slot) return;

    if (!isExpanded) {
      const bounds = measureExpandedBounds();

      if (!bounds) return;

      const startRect = panel.getBoundingClientRect();
      setIsAnimating(true);
      setExpandedBounds(bounds);
      setIsExpanded(true);

      requestAnimationFrame(() => {
        const endRect = panelRef.current?.getBoundingClientRect();

        if (!endRect) {
          setIsAnimating(false);
          return;
        }

        animatePanel(startRect, endRect, "expand", () => setIsAnimating(false));
      });
      return;
    }

    const startRect = panel.getBoundingClientRect();
    const endRect = slot.getBoundingClientRect();
    setIsAnimating(true);
    animatePanel(startRect, endRect, "collapse", () => {
      setIsExpanded(false);
      setExpandedBounds(null);
      setIsAnimating(false);
    });
  }, [animatePanel, isAnimating, isExpanded, measureExpandedBounds]);

  useEffect(() => {
    if (!isExpanded) return;

    const updateBounds = () => {
      const bounds = measureExpandedBounds();
      if (bounds) setExpandedBounds(bounds);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") toggleExpanded();
    };

    window.addEventListener("resize", updateBounds);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updateBounds);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded, measureExpandedBounds, toggleExpanded]);

  return (
    <div className={cn("flex min-h-0 flex-1", className)} ref={slotRef}>
      <button
        aria-label={isExpanded ? "Restaurar vista de cotizaciones" : "Ampliar vista de cotizaciones"}
        aria-pressed={isExpanded}
        className="absolute right-2 top-1 z-50 grid size-8 place-items-center rounded-full border border-slate-200/80 bg-white/80 text-slate-500 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 disabled:pointer-events-none disabled:opacity-60"
        disabled={isAnimating}
        onClick={toggleExpanded}
        title={isExpanded ? "Restaurar vista" : "Ampliar lista"}
        type="button"
      >
        <span
          className={cn(
            "grid place-items-center transition-transform duration-500",
            isExpanded ? "rotate-180" : "rotate-0",
          )}
        >
          {isExpanded ? (
            <Minimize2 aria-hidden="true" className="size-4" strokeWidth={1.8} />
          ) : (
            <Maximize2 aria-hidden="true" className="size-4" strokeWidth={1.8} />
          )}
        </span>
      </button>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-3 pt-5",
          isExpanded &&
            "fixed z-40 isolate overflow-hidden rounded-2xl border border-cyan-200/80 bg-white p-3 shadow-[0_24px_64px_rgba(15,23,42,0.18)] will-change-transform [backface-visibility:hidden] [contain:layout_paint]",
        )}
        ref={panelRef}
        style={
          isExpanded && expandedBounds
            ? {
                height: expandedBounds.height,
                left: expandedBounds.left,
                top: expandedBounds.top,
                width: expandedBounds.width,
              }
            : undefined
        }
      >
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
    </div>
  );
}
