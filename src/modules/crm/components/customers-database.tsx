"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { normalizeCrmIdentification } from "@/modules/crm/identification";
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
  conDocumento: "" | "con-documento" | "sin-documento";
  estado: "" | CrmClienteEstado;
  origen: string;
  q: string;
  segmento: "" | CustomerSegment;
  tipo: "" | CrmClienteTipo;
};

type CustomerSegment =
  | "con-ventas"
  | "cotizando"
  | "seguimiento-pendiente"
  | "sin-actividad"
  | "sin-documento";

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

function getOriginFilterOptions(customers: CrmCustomer[]) {
  return Array.from(
    new Set(
      customers
        .map((customer) => customer.origen?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function getCustomerSegment(customer: CrmCustomer): CustomerSegment | null {
  if (!customer.identificacion) {
    return "sin-documento";
  }

  if (customer.salesCount > 0) {
    return "con-ventas";
  }

  if (customer.pendingFollowupsCount > 0) {
    return "seguimiento-pendiente";
  }

  if (customer.quotesCount > 0) {
    return "cotizando";
  }

  if (
    customer.interactionsCount === 0 &&
    customer.followupsCount === 0 &&
    customer.quotesCount === 0 &&
    customer.salesCount === 0
  ) {
    return "sin-actividad";
  }

  return null;
}

function getSegmentOptions(customers: CrmCustomer[]) {
  const counts: Record<CustomerSegment, number> = {
    "con-ventas": 0,
    cotizando: 0,
    "seguimiento-pendiente": 0,
    "sin-actividad": 0,
    "sin-documento": 0,
  };

  customers.forEach((customer) => {
    const segment = getCustomerSegment(customer);
    if (segment) counts[segment] += 1;
  });

  return [
    { key: "con-ventas" as const, label: "Con ventas", count: counts["con-ventas"] },
    { key: "cotizando" as const, label: "Cotizando", count: counts.cotizando },
    {
      key: "seguimiento-pendiente" as const,
      label: "Seguimiento pendiente",
      count: counts["seguimiento-pendiente"],
    },
    { key: "sin-actividad" as const, label: "Sin actividad", count: counts["sin-actividad"] },
    { key: "sin-documento" as const, label: "Sin documento", count: counts["sin-documento"] },
  ];
}

function filterCustomers(customers: CrmCustomer[], filters: CustomerFilters) {
  const query = normalizeText(filters.q);
  const normalizedDocumentQuery = normalizeCrmIdentification(filters.q);

  return customers.filter((customer) => {
    const matchesQuery =
      !query ||
      [
        customer.nombre,
        customer.identificacion,
        customer.correo,
        customer.telefono,
        customer.whatsapp,
        customer.origen,
        customer.asignadoNombre,
      ].some((value) => normalizeText(value).includes(query)) ||
      (normalizedDocumentQuery.length >= 3 &&
        normalizeCrmIdentification(customer.identificacion).includes(
          normalizedDocumentQuery,
        ));
    const matchesType = !filters.tipo || customer.tipo === filters.tipo;
    const matchesStatus = !filters.estado || customer.estado === filters.estado;
    const matchesOrigin =
      !filters.origen || normalizeText(customer.origen) === normalizeText(filters.origen);
    const matchesSegment =
      !filters.segmento || getCustomerSegment(customer) === filters.segmento;
    const matchesAssignment =
      !filters.asignado ||
      (filters.asignado === "sin-asignar"
        ? !customer.asignadoA
        : customer.asignadoA === filters.asignado);
    const matchesDocumentState =
      !filters.conDocumento ||
      (filters.conDocumento === "con-documento"
        ? Boolean(customer.identificacion)
        : !customer.identificacion);

    return (
      matchesQuery &&
      matchesType &&
      matchesStatus &&
      matchesOrigin &&
      matchesSegment &&
      matchesAssignment &&
      matchesDocumentState
    );
  });
}

export function CustomersDatabase({ className, customers }: CustomersDatabaseProps) {
  const [filters, setFilters] = useState<CustomerFilters>({
    asignado: "",
    conDocumento: "",
    estado: "",
    origen: "",
    q: "",
    segmento: "",
    tipo: "",
  });
  const assignableOptions = useMemo(
    () => getAssignableFilterOptions(customers),
    [customers],
  );
  const originOptions = useMemo(() => getOriginFilterOptions(customers), [customers]);
  const segmentOptions = useMemo(() => getSegmentOptions(customers), [customers]);
  const filteredCustomers = useMemo(
    () => filterCustomers(customers, filters),
    [customers, filters],
  );
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3 pt-5", className)}>
      <div className="grid gap-3 md:grid-cols-5">
        {segmentOptions.map((segment) => (
          <button
            className={cn(
              "rounded-xl border bg-background px-4 py-3 text-left transition hover:border-emerald-300",
              filters.segmento === segment.key ? "border-emerald-500 ring-1 ring-emerald-200" : "",
            )}
            key={segment.key}
            onClick={() =>
              setFilters((current) => ({
                ...current,
                segmento: current.segmento === segment.key ? "" : segment.key,
              }))
            }
            type="button"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Segmento
            </p>
            <p className="mt-1 text-sm font-semibold">{segment.label}</p>
            <p className="mt-1 text-2xl font-black">{segment.count}</p>
          </button>
        ))}
      </div>

      <div className="app-filter-shell p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_140px_150px_180px_170px_160px_160px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-blue-500" />
            <input
              className="app-filter-control h-11 w-full rounded-xl pl-9 pr-3 text-sm outline-none transition"
              onChange={(event) =>
                setFilters((current) => ({ ...current, q: event.target.value }))
              }
              placeholder="Buscar por nombre, documento, correo o telefono"
              type="search"
              value={filters.q}
            />
          </label>

          <select
            className="app-filter-control h-11 rounded-xl px-3 text-sm outline-none transition"
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
            className="app-filter-control h-11 rounded-xl px-3 text-sm outline-none transition"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                segmento: event.target.value as CustomerFilters["segmento"],
              }))
            }
            value={filters.segmento}
          >
            <option value="">Segmento</option>
            {segmentOptions.map((segment) => (
              <option key={segment.key} value={segment.key}>
                {segment.label}
              </option>
            ))}
          </select>

          <select
            className="app-filter-control h-11 rounded-xl px-3 text-sm outline-none transition"
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
            className="app-filter-control h-11 rounded-xl px-3 text-sm outline-none transition"
            onChange={(event) =>
              setFilters((current) => ({ ...current, origen: event.target.value }))
            }
            value={filters.origen}
          >
            <option value="">Origen</option>
            {originOptions.map((origin) => (
              <option key={origin} value={origin}>
                {origin}
              </option>
            ))}
          </select>

          <select
            className="app-filter-control h-11 rounded-xl px-3 text-sm outline-none transition"
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

          <select
            className="app-filter-control h-11 rounded-xl px-3 text-sm outline-none transition"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                conDocumento: event.target.value as CustomerFilters["conDocumento"],
              }))
            }
            value={filters.conDocumento}
          >
            <option value="">Documento</option>
            <option value="con-documento">Con documento</option>
            <option value="sin-documento">Sin documento</option>
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
