import type { ReactNode } from "react";
import {
  Activity,
  BadgeCheck,
  CalendarClock,
  FileText,
  Mail,
  MapPinned,
  MessageCircle,
  Phone,
  UserRound,
} from "lucide-react";

import type { CrmCustomer } from "@/modules/crm/types";

type CustomerSummaryCardProps = {
  actions?: ReactNode;
  customer: CrmCustomer;
  lastActivityAt?: string | null;
  stats: {
    followups: number;
    interactions: number;
    quotes: number;
    sales: number;
  };
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Sin actividad";
  }

  return new Date(value).toLocaleDateString("es");
}

function statusLabel(value: CrmCustomer["estado"]) {
  const labels: Record<CrmCustomer["estado"], string> = {
    calificado: "Calificado",
    contactado: "Contactado",
    cotizado: "Cotizado",
    ganado: "Ganado",
    inactivo: "Inactivo",
    nuevo: "Nuevo",
    perdido: "Perdido",
  };

  return labels[value];
}

function typeLabel(value: CrmCustomer["tipo"]) {
  return value === "cliente" ? "Cliente" : "Prospecto";
}

function metricLabel(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function CustomerSummaryCard({
  actions,
  customer,
  lastActivityAt,
  stats,
}: CustomerSummaryCardProps) {
  const contactItems = [
    {
      icon: Phone,
      label: "Telefono",
      value: customer.telefono ?? "No registrado",
    },
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: customer.whatsapp ?? "No registrado",
    },
    {
      icon: Mail,
      label: "Correo",
      value: customer.correo ?? "No registrado",
    },
    {
      icon: FileText,
      label: "Documento",
      value: customer.identificacion ?? "Sin documento",
    },
  ];

  const detailItems = [
    {
      icon: UserRound,
      label: "Asignado",
      value: customer.asignadoNombre ?? "Sin asignar",
    },
    {
      icon: MapPinned,
      label: "Origen",
      value: customer.origen ?? "No registrado",
    },
    {
      icon: CalendarClock,
      label: "Creacion",
      value: formatDate(customer.createdAt),
    },
    {
      icon: Activity,
      label: "Ultima actividad",
      value: formatDate(lastActivityAt ?? customer.updatedAt),
    },
  ];

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(209,250,229,0.9),rgba(255,255,255,0.96)_28%,rgba(255,247,205,0.82)_100%)] shadow-[0_24px_70px_-40px_rgba(15,23,42,0.4)]">
      <div className="grid gap-6 p-6 xl:grid-cols-[1.15fr_0.85fr] xl:p-7">
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-3xl bg-slate-950 text-2xl font-black text-white shadow-lg shadow-slate-950/15">
                {customer.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Perfil del cliente
                </p>
                <h1 className="mt-1 truncate text-3xl font-black tracking-tight text-slate-950">
                  {customer.nombre}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  Ficha comercial rapida para entender el estado del cliente, su
                  contacto y el movimiento reciente sin navegar entre formularios.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {typeLabel(customer.tipo)}
              </span>
              <span className="rounded-full border border-slate-300 bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700">
                {statusLabel(customer.estado)}
              </span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {contactItems.map((item) => (
              <div
                className="rounded-2xl border border-white/70 bg-white/70 p-4 backdrop-blur"
                key={item.label}
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <item.icon aria-hidden={true} size={15} />
                  {item.label}
                </div>
                <p className="mt-3 text-base font-semibold text-slate-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {detailItems.map((item) => (
              <div
                className="rounded-2xl border border-slate-200/80 bg-white/75 p-4"
                key={item.label}
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <item.icon aria-hidden={true} size={15} />
                  {item.label}
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {actions ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4">
              <p className="text-sm font-semibold text-slate-900">Siguiente paso</p>
              <p className="mt-1 text-sm text-slate-600">
                Acciones rapidas para mover esta relacion comercial.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">{actions}</div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/20">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
              <BadgeCheck aria-hidden={true} size={15} />
              Salud comercial
            </div>
            <p className="mt-4 text-3xl font-black tracking-tight">
              {metricLabel(stats.sales, "venta", "ventas")}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {metricLabel(stats.quotes, "cotizacion", "cotizaciones")} y{" "}
              {metricLabel(stats.followups, "seguimiento", "seguimientos")} registrados.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Interacciones
              </p>
              <p className="mt-3 text-2xl font-black text-slate-950">
                {stats.interactions}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Registros manuales de llamada, nota, correo o WhatsApp.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Seguimientos
              </p>
              <p className="mt-3 text-2xl font-black text-slate-950">
                {stats.followups}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {metricLabel(customer.pendingFollowupsCount, "pendiente", "pendientes")} por atender.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Cotizaciones
              </p>
              <p className="mt-3 text-2xl font-black text-slate-950">
                {stats.quotes}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Ultimo movimiento: {formatDate(customer.lastQuoteAt)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Ventas
              </p>
              <p className="mt-3 text-2xl font-black text-slate-950">
                {stats.sales}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Ultimo cierre: {formatDate(customer.lastSaleAt)}
              </p>
            </div>
          </div>

          {customer.notas ? (
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 text-amber-950">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                Nota visible
              </p>
              <p className="mt-3 text-sm leading-6">{customer.notas}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
