"use client";

import { Maximize2, Minimize2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type ExpandedPanelBounds = {
  height: number;
  left: number;
  top: number;
  width: number;
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
  const slotRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [expandedBounds, setExpandedBounds] = useState<ExpandedPanelBounds | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
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

  const measureExpandedBounds = useCallback((): ExpandedPanelBounds | null => {
    const chartsRegion = document.querySelector<HTMLElement>(
      "[data-crm-charts-region]",
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
        aria-label={isExpanded ? "Restaurar vista de clientes" : "Ampliar vista de clientes"}
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
          "flex min-h-0 flex-1 flex-col gap-3",
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
        <div className="app-filter-shell p-4" style={{ boxShadow: "none" }}>
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
    </div>
  );
}
