"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { SALE_STATUSES } from "@/modules/sales/constants";
import { SalesTable } from "@/modules/sales/components/sales-table";
import type { Sale, SaleStatus } from "@/modules/sales/types";

type SalesDatabaseProps = {
  className?: string;
  sales: Sale[];
};

type SaleFilters = {
  creadoPor: string;
  estado: "" | SaleStatus;
  moneda: string;
  q: string;
};

function normalizeText(value: string | number | null | undefined) {
  return String(value ?? "").toLowerCase().trim();
}

function getUniqueOptions(values: Array<string | null>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b),
  );
}

function filterSales(sales: Sale[], filters: SaleFilters) {
  const query = normalizeText(filters.q);

  return sales.filter((sale) => {
    const matchesQuery =
      !query ||
      [
        sale.numero,
        sale.clienteNombre,
        sale.cotizacionNumero,
        sale.estado,
        sale.fechaVenta,
        sale.total,
        sale.moneda,
        sale.creadoPorNombre,
      ].some((value) => normalizeText(value).includes(query));
    const matchesStatus = !filters.estado || sale.estado === filters.estado;
    const matchesCurrency = !filters.moneda || sale.moneda === filters.moneda;
    const matchesCreator =
      !filters.creadoPor || sale.creadoPorNombre === filters.creadoPor;

    return matchesQuery && matchesStatus && matchesCurrency && matchesCreator;
  });
}

export function SalesDatabase({ className, sales }: SalesDatabaseProps) {
  const [filters, setFilters] = useState<SaleFilters>({
    creadoPor: "",
    estado: "",
    moneda: "",
    q: "",
  });
  const currencyOptions = useMemo(
    () => getUniqueOptions(sales.map((sale) => sale.moneda)),
    [sales],
  );
  const creatorOptions = useMemo(
    () => getUniqueOptions(sales.map((sale) => sale.creadoPorNombre)),
    [sales],
  );
  const filteredSales = useMemo(
    () => filterSales(sales, filters),
    [sales, filters],
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
              placeholder="Buscar por numero, cliente, cotizacion, fecha o total"
              type="search"
              value={filters.q}
            />
          </label>

          <select
            className="app-filter-control h-11 rounded-xl px-3 text-sm outline-none transition"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                estado: event.target.value as SaleFilters["estado"],
              }))
            }
            value={filters.estado}
          >
            <option value="">Estado</option>
            {SALE_STATUSES.map((status) => (
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

      {filteredSales.length > 0 ? (
        <SalesTable className="min-h-0 flex-1" sales={filteredSales} />
      ) : (
        <div className="min-h-0 flex-1 rounded-lg border bg-background">
          <EmptyState
            description="Ajusta los filtros para volver a mostrar ventas."
            title="Sin resultados"
          />
        </div>
      )}
    </div>
  );
}
