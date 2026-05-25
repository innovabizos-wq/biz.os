import type {
  DispatchLogisticsStatus,
  DriverStatus,
} from "@/modules/logistics/types";

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  available: "Disponible",
  finished: "Finalizado",
  incident: "Incidencia",
  lunch: "Almuerzo",
  offline: "Sin conexion",
  on_route: "En ruta",
  paused: "Pausa",
};

export const DRIVER_STATUS_STYLES: Record<
  DriverStatus,
  {
    badge: string;
    dot: string;
    marker: string;
    soft: string;
  }
> = {
  available: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
    marker: "bg-emerald-500 text-white shadow-emerald-500/25",
    soft: "bg-emerald-50 text-emerald-700",
  },
  finished: {
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
    dot: "bg-slate-500",
    marker: "bg-slate-500 text-white shadow-slate-500/20",
    soft: "bg-slate-100 text-slate-700",
  },
  incident: {
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    dot: "bg-rose-500",
    marker: "bg-rose-500 text-white shadow-rose-500/25",
    soft: "bg-rose-50 text-rose-700",
  },
  lunch: {
    badge: "bg-orange-50 text-orange-700 ring-orange-200",
    dot: "bg-orange-500",
    marker: "bg-orange-500 text-white shadow-orange-500/25",
    soft: "bg-orange-50 text-orange-700",
  },
  offline: {
    badge: "bg-slate-100 text-slate-600 ring-slate-200",
    dot: "bg-slate-400",
    marker: "bg-slate-500 text-white shadow-slate-500/20",
    soft: "bg-slate-100 text-slate-600",
  },
  on_route: {
    badge: "bg-blue-50 text-blue-700 ring-blue-200",
    dot: "bg-blue-500",
    marker: "bg-blue-600 text-white shadow-blue-500/25",
    soft: "bg-blue-50 text-blue-700",
  },
  paused: {
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
    marker: "bg-amber-500 text-white shadow-amber-500/25",
    soft: "bg-amber-50 text-amber-700",
  },
};

export const DISPATCH_LOGISTICS_STATUS_LABELS: Record<
  DispatchLogisticsStatus,
  string
> = {
  cancelled: "Cancelado",
  delayed: "Retrasado",
  delivered: "Entregado",
  failed: "Fallido",
  on_route: "En ruta",
  pending: "Pendiente",
  preparing: "Preparando",
  ready: "Listo",
};

export const DISPATCH_STATUS_STYLES: Record<
  string,
  {
    badge: string;
    dot: string;
    label: string;
  }
> = {
  cancelado: {
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
    dot: "bg-slate-500",
    label: "Cancelado",
  },
  cancelled: {
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
    dot: "bg-slate-500",
    label: "Cancelado",
  },
  delayed: {
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
    label: "Retrasado",
  },
  entregado: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
    label: "Entregado",
  },
  delivered: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
    label: "Entregado",
  },
  en_ruta: {
    badge: "bg-blue-50 text-blue-700 ring-blue-200",
    dot: "bg-blue-500",
    label: "En ruta",
  },
  failed: {
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    dot: "bg-rose-500",
    label: "Fallido",
  },
  fallido: {
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    dot: "bg-rose-500",
    label: "Fallido",
  },
  listo: {
    badge: "bg-sky-50 text-sky-700 ring-sky-200",
    dot: "bg-sky-500",
    label: "Listo",
  },
  on_route: {
    badge: "bg-blue-50 text-blue-700 ring-blue-200",
    dot: "bg-blue-500",
    label: "En ruta",
  },
  pendiente: {
    badge: "bg-violet-50 text-violet-700 ring-violet-200",
    dot: "bg-violet-500",
    label: "Pendiente",
  },
  pending: {
    badge: "bg-violet-50 text-violet-700 ring-violet-200",
    dot: "bg-violet-500",
    label: "Pendiente",
  },
  preparando: {
    badge: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    dot: "bg-cyan-500",
    label: "Preparando",
  },
  preparing: {
    badge: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    dot: "bg-cyan-500",
    label: "Preparando",
  },
  ready: {
    badge: "bg-sky-50 text-sky-700 ring-sky-200",
    dot: "bg-sky-500",
    label: "Listo",
  },
};

export const ACTIVE_DISPATCH_STATUSES = [
  "pendiente",
  "preparando",
  "listo",
  "en_ruta",
] as const;

export const PENDING_DISPATCH_STATUSES = [
  "pendiente",
  "preparando",
  "listo",
] as const;

export function getDispatchStatusStyle(status: string) {
  return (
    DISPATCH_STATUS_STYLES[status] ?? {
      badge: "bg-slate-100 text-slate-700 ring-slate-200",
      dot: "bg-slate-500",
      label: status || "Sin estado",
    }
  );
}
