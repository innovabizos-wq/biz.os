"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { InventoryStock } from "@/modules/inventory/types";

type InventoryDatabaseProps = {
  className?: string;
  stock: InventoryStock[];
};

type InventoryFilters = {
  bodega: string;
  estadoBodega: string;
  estadoStock: string;
  q: string;
};

function getStockStatus(item: InventoryStock) {
  if (item.stockMinimo > 0 && item.cantidad < item.stockMinimo) {
    return "bajo minimo";
  }

  if (item.stockMaximo !== null && item.cantidad > item.stockMaximo) {
    return "sobre maximo";
  }

  return "ok";
}

function normalizeText(value: string | number | null | undefined) {
  return String(value ?? "").toLowerCase().trim();
}

function getUniqueOptions(values: Array<string | null>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b),
  );
}

function filterStock(stock: InventoryStock[], filters: InventoryFilters) {
  const query = normalizeText(filters.q);

  return stock.filter((item) => {
    const status = getStockStatus(item);
    const matchesQuery =
      !query ||
      [
        item.productoNombre,
        item.productoCodigo,
        item.bodegaNombre,
        item.cantidad,
        item.stockMinimo,
        item.stockMaximo,
        status,
      ].some((value) => normalizeText(value).includes(query));
    const matchesWarehouse = !filters.bodega || item.bodegaNombre === filters.bodega;
    const matchesStockStatus =
      !filters.estadoStock || status === filters.estadoStock;
    const matchesWarehouseStatus =
      !filters.estadoBodega || item.bodegaEstado === filters.estadoBodega;

    return (
      matchesQuery &&
      matchesWarehouse &&
      matchesStockStatus &&
      matchesWarehouseStatus
    );
  });
}

export function InventoryDatabase({ className, stock }: InventoryDatabaseProps) {
  const [filters, setFilters] = useState<InventoryFilters>({
    bodega: "",
    estadoBodega: "",
    estadoStock: "",
    q: "",
  });
  const warehouseOptions = useMemo(
    () => getUniqueOptions(stock.map((item) => item.bodegaNombre)),
    [stock],
  );
  const filteredStock = useMemo(
    () => filterStock(stock, filters),
    [stock, filters],
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
              placeholder="Buscar por producto, codigo, bodega o cantidad"
              type="search"
              value={filters.q}
            />
          </label>

          <select
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm shadow-inner outline-none transition focus:border-[rgba(var(--kpi-theme-accent-rgb),0.7)] focus:bg-white focus:ring-2 focus:ring-[rgba(var(--kpi-theme-accent-rgb),0.18)]"
            onChange={(event) =>
              setFilters((current) => ({ ...current, bodega: event.target.value }))
            }
            value={filters.bodega}
          >
            <option value="">Bodega</option>
            {warehouseOptions.map((warehouse) => (
              <option key={warehouse} value={warehouse}>
                {warehouse}
              </option>
            ))}
          </select>

          <select
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm shadow-inner outline-none transition focus:border-[rgba(var(--kpi-theme-accent-rgb),0.7)] focus:bg-white focus:ring-2 focus:ring-[rgba(var(--kpi-theme-accent-rgb),0.18)]"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                estadoStock: event.target.value,
              }))
            }
            value={filters.estadoStock}
          >
            <option value="">Estado stock</option>
            <option value="ok">OK</option>
            <option value="bajo minimo">Bajo minimo</option>
            <option value="sobre maximo">Sobre maximo</option>
          </select>

          <select
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm shadow-inner outline-none transition focus:border-[rgba(var(--kpi-theme-accent-rgb),0.7)] focus:bg-white focus:ring-2 focus:ring-[rgba(var(--kpi-theme-accent-rgb),0.18)]"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                estadoBodega: event.target.value,
              }))
            }
            value={filters.estadoBodega}
          >
            <option value="">Estado bodega</option>
            <option value="activa">Activa</option>
            <option value="inactiva">Inactiva</option>
          </select>
        </div>
      </div>

      {filteredStock.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-background">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Codigo</th>
                <th className="px-4 py-3">Bodega</th>
                <th className="px-4 py-3">Cantidad</th>
                <th className="px-4 py-3">Minimo</th>
                <th className="px-4 py-3">Maximo</th>
                <th className="px-4 py-3">Estado stock</th>
                <th className="px-4 py-3">Estado bodega</th>
              </tr>
            </thead>
            <tbody>
              {filteredStock.map((item) => (
                <tr className="border-t" key={item.id}>
                  <td className="px-4 py-3 font-medium">
                    {item.productoNombre ?? "Producto"}
                  </td>
                  <td className="px-4 py-3">{item.productoCodigo ?? "-"}</td>
                  <td className="px-4 py-3">{item.bodegaNombre ?? "Bodega"}</td>
                  <td className="px-4 py-3">{item.cantidad}</td>
                  <td className="px-4 py-3">{item.stockMinimo}</td>
                  <td className="px-4 py-3">{item.stockMaximo ?? "-"}</td>
                  <td className="px-4 py-3">{getStockStatus(item)}</td>
                  <td className="px-4 py-3">{item.bodegaEstado ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="min-h-0 flex-1 rounded-lg border bg-background">
          <EmptyState
            description="Ajusta los filtros para volver a mostrar inventario."
            title="Sin resultados"
          />
        </div>
      )}
    </div>
  );
}
