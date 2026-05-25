"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { DISPATCH_STATUSES } from "@/modules/dispatch/constants";
import { DispatchTable } from "@/modules/dispatch/components/dispatch-table";
import type { DispatchOrder, DispatchStatus } from "@/modules/dispatch/types";

type DispatchDatabaseProps = {
  className?: string;
  dispatches: DispatchOrder[];
};

type DispatchFilters = {
  estado: "" | DispatchStatus;
  fecha: string;
  q: string;
  responsable: string;
};

function normalizeText(value: string | number | null | undefined) {
  return String(value ?? "").toLowerCase().trim();
}

function getUniqueOptions(values: Array<string | null>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b),
  );
}

function filterDispatches(
  dispatches: DispatchOrder[],
  filters: DispatchFilters,
) {
  const query = normalizeText(filters.q);

  return dispatches.filter((dispatch) => {
    const matchesQuery =
      !query ||
      [
        dispatch.numero,
        dispatch.clienteNombre,
        dispatch.ventaNumero,
        dispatch.estado,
        dispatch.fechaProgramada,
        dispatch.responsableNombre,
        dispatch.contactoEntrega,
        dispatch.telefonoEntrega,
      ].some((value) => normalizeText(value).includes(query));
    const matchesStatus = !filters.estado || dispatch.estado === filters.estado;
    const matchesResponsible =
      !filters.responsable || dispatch.responsableNombre === filters.responsable;
    const matchesDate = !filters.fecha || dispatch.fechaProgramada === filters.fecha;

    return matchesQuery && matchesStatus && matchesResponsible && matchesDate;
  });
}

export function DispatchDatabase({
  className,
  dispatches,
}: DispatchDatabaseProps) {
  const [filters, setFilters] = useState<DispatchFilters>({
    estado: "",
    fecha: "",
    q: "",
    responsable: "",
  });
  const responsibleOptions = useMemo(
    () => getUniqueOptions(dispatches.map((dispatch) => dispatch.responsableNombre)),
    [dispatches],
  );
  const dateOptions = useMemo(
    () => getUniqueOptions(dispatches.map((dispatch) => dispatch.fechaProgramada)),
    [dispatches],
  );
  const filteredDispatches = useMemo(
    () => filterDispatches(dispatches, filters),
    [dispatches, filters],
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3 pt-5", className)}>
      <div className="rounded-2xl border border-[rgba(var(--kpi-theme-accent-rgb),0.34)] bg-white p-4 shadow-[0_14px_30px_rgba(var(--kpi-theme-accent-rgb),0.14)]">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_160px_190px_190px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm shadow-inner outline-none transition focus:border-[rgba(var(--kpi-theme-accent-rgb),0.7)] focus:bg-white focus:ring-2 focus:ring-[rgba(var(--kpi-theme-accent-rgb),0.18)]"
              onChange={(event) =>
                setFilters((current) => ({ ...current, q: event.target.value }))
              }
              placeholder="Buscar por numero, cliente, venta, contacto o telefono"
              type="search"
              value={filters.q}
            />
          </label>

          <select
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm shadow-inner outline-none transition focus:border-[rgba(var(--kpi-theme-accent-rgb),0.7)] focus:bg-white focus:ring-2 focus:ring-[rgba(var(--kpi-theme-accent-rgb),0.18)]"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                estado: event.target.value as DispatchFilters["estado"],
              }))
            }
            value={filters.estado}
          >
            <option value="">Estado</option>
            {DISPATCH_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm shadow-inner outline-none transition focus:border-[rgba(var(--kpi-theme-accent-rgb),0.7)] focus:bg-white focus:ring-2 focus:ring-[rgba(var(--kpi-theme-accent-rgb),0.18)]"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                responsable: event.target.value,
              }))
            }
            value={filters.responsable}
          >
            <option value="">Responsable</option>
            {responsibleOptions.map((responsible) => (
              <option key={responsible} value={responsible}>
                {responsible}
              </option>
            ))}
          </select>

          <select
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm shadow-inner outline-none transition focus:border-[rgba(var(--kpi-theme-accent-rgb),0.7)] focus:bg-white focus:ring-2 focus:ring-[rgba(var(--kpi-theme-accent-rgb),0.18)]"
            onChange={(event) =>
              setFilters((current) => ({ ...current, fecha: event.target.value }))
            }
            value={filters.fecha}
          >
            <option value="">Fecha</option>
            {dateOptions.map((date) => (
              <option key={date} value={date}>
                {date}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredDispatches.length > 0 ? (
        <DispatchTable
          className="min-h-0 flex-1"
          dispatches={filteredDispatches}
        />
      ) : (
        <div className="min-h-0 flex-1 rounded-lg border bg-background">
          <EmptyState
            description="Ajusta los filtros para volver a mostrar despachos."
            title="Sin resultados"
          />
        </div>
      )}
    </div>
  );
}
