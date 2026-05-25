"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { CustomersTable } from "@/modules/crm/components/customers-table";
import type { CrmClienteEstado, CrmClienteTipo, CrmCustomer } from "@/modules/crm/types";

const CUSTOMER_TYPES = ["cliente", "prospecto"] as const;
const CUSTOMER_STATUSES = [
  "nuevo",
  "contactado",
  "calificado",
  "cotizado",
  "ganado",
  "perdido",
  "inactivo",
] as const;

type CustomersDatabaseProps = {
  className?: string;
  customers: CrmCustomer[];
};

type CustomerFilters = {
  asignado: string;
  estado: "" | CrmClienteEstado;
  q: string;
  tipo: "" | CrmClienteTipo;
};

function normalizeText(value: string | null | undefined) {
  return value?.toLowerCase().trim() ?? "";
}

function getAssignableFilterOptions(customers: CrmCustomer[]) {
  const options = new Map<string, string>();

  customers.forEach((customer) => {
    if (customer.asignadoA && customer.asignadoNombre) {
      options.set(customer.asignadoA, customer.asignadoNombre);
    }
  });

  return Array.from(options, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function filterCustomers(customers: CrmCustomer[], filters: CustomerFilters) {
  const query = normalizeText(filters.q);

  return customers.filter((customer) => {
    const matchesQuery =
      !query ||
      [
        customer.nombre,
        customer.correo,
        customer.telefono,
        customer.whatsapp,
        customer.origen,
        customer.asignadoNombre,
      ].some((value) => normalizeText(value).includes(query));
    const matchesType = !filters.tipo || customer.tipo === filters.tipo;
    const matchesStatus = !filters.estado || customer.estado === filters.estado;
    const matchesAssignment =
      !filters.asignado ||
      (filters.asignado === "sin-asignar"
        ? !customer.asignadoA
        : customer.asignadoA === filters.asignado);

    return matchesQuery && matchesType && matchesStatus && matchesAssignment;
  });
}

export function CustomersDatabase({ className, customers }: CustomersDatabaseProps) {
  const [filters, setFilters] = useState<CustomerFilters>({
    asignado: "",
    estado: "",
    q: "",
    tipo: "",
  });
  const assignableOptions = useMemo(
    () => getAssignableFilterOptions(customers),
    [customers],
  );
  const filteredCustomers = useMemo(
    () => filterCustomers(customers, filters),
    [customers, filters],
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
              placeholder="Buscar por nombre, correo, telefono u origen"
              type="search"
              value={filters.q}
            />
          </label>

          <select
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm shadow-inner outline-none transition focus:border-[rgba(var(--kpi-theme-accent-rgb),0.7)] focus:bg-white focus:ring-2 focus:ring-[rgba(var(--kpi-theme-accent-rgb),0.18)]"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                tipo: event.target.value as CustomerFilters["tipo"],
              }))
            }
            value={filters.tipo}
          >
            <option value="">Tipo</option>
            {CUSTOMER_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm shadow-inner outline-none transition focus:border-[rgba(var(--kpi-theme-accent-rgb),0.7)] focus:bg-white focus:ring-2 focus:ring-[rgba(var(--kpi-theme-accent-rgb),0.18)]"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                estado: event.target.value as CustomerFilters["estado"],
              }))
            }
            value={filters.estado}
          >
            <option value="">Estado</option>
            {CUSTOMER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm shadow-inner outline-none transition focus:border-[rgba(var(--kpi-theme-accent-rgb),0.7)] focus:bg-white focus:ring-2 focus:ring-[rgba(var(--kpi-theme-accent-rgb),0.18)]"
            onChange={(event) =>
              setFilters((current) => ({ ...current, asignado: event.target.value }))
            }
            value={filters.asignado}
          >
            <option value="">Asignado</option>
            <option value="sin-asignar">Sin asignar</option>
            {assignableOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredCustomers.length > 0 ? (
        <CustomersTable className="min-h-0 flex-1" customers={filteredCustomers} />
      ) : (
        <div className="min-h-0 flex-1 rounded-lg border bg-background">
          <EmptyState
            description="Ajusta los filtros para volver a mostrar clientes."
            title="Sin resultados"
          />
        </div>
      )}
    </div>
  );
}
