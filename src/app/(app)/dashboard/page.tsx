import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  Inbox,
  Plus,
  ShoppingCart,
  Truck,
  Users,
  X,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { DashboardBoardNavigation } from "@/app/(app)/dashboard/dashboard-board-navigation";
import {
  DashboardTop3Chart,
  type DashboardTop3Option,
} from "@/app/(app)/dashboard/dashboard-top3-chart";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { getCurrentProfile, getCurrentTenantContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { ConsultationManagementForm } from "@/modules/consultations/components/consultation-management-form";
import { ConsultationResultCard } from "@/modules/consultations/components/consultation-result-card";
import { ConsultationSearchForm } from "@/modules/consultations/components/consultation-search-form";
import { getConsultationSearchResult } from "@/modules/consultations/queries";
import { consultationSearchSchema } from "@/modules/consultations/schemas";
import type { ConsultationSearchResult } from "@/modules/consultations/types";
import { getCrmCustomers } from "@/modules/crm/queries";
import type { CrmCustomer } from "@/modules/crm/types";
import { getDispatchOrders } from "@/modules/dispatch/queries";
import { getQuotes } from "@/modules/quotes/queries";
import { getSales } from "@/modules/sales/queries";
import type { Sale } from "@/modules/sales/types";
import { getPaymentsSummary } from "@/modules/payments/queries";
import { getPurchasesSummary } from "@/modules/purchases/queries";

type DashboardPageProps = {
  searchParams?: Promise<{
    consulta?: string;
    consulta_estado?: string;
    documento?: string;
    error?: string;
  }>;
};

type DashboardKpi = {
  accent: "dark" | "amber" | "teal" | "silver";
  href: string;
  title: string;
  value: string;
};

function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat("es-CR", {
    currency: "CRC",
    maximumFractionDigits: compact ? 2 : 0,
    notation: compact ? "compact" : "standard",
    style: "currency",
  }).format(value);
}

function isThisMonth(dateValue: string) {
  const value = new Date(dateValue);
  const today = new Date();

  return (
    value.getFullYear() === today.getFullYear() &&
    value.getMonth() === today.getMonth()
  );
}

function getSettledValue<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  queryName: string,
) {
  if (result.status === "fulfilled") {
    return result.value;
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn("[dashboard] secondary query rejected", {
      queryName,
      reason: result.reason,
      source: "dashboard",
    });
  }

  return fallback;
}

function getBlankConsultationResult(documento = ""): ConsultationSearchResult {
  return {
    documento,
    message: "Completa la informacion para iniciar una gestion.",
    source: "manual",
  };
}

function sumSales(sales: Sale[]) {
  return sales.reduce((sum, sale) => sum + sale.total, 0);
}

function getDateParts(dateValue: string) {
  const [year, month, day] = dateValue.slice(0, 10).split("-").map(Number);

  if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
    return { day, month: month - 1, year };
  }

  const fallback = new Date(dateValue);

  return {
    day: fallback.getDate(),
    month: fallback.getMonth(),
    year: fallback.getFullYear(),
  };
}

function getDayIndex(dateValue: string) {
  return getDateParts(dateValue).day - 1;
}

function isCurrentMonth(dateValue: string) {
  const value = getDateParts(dateValue);
  const today = new Date();

  return value.year === today.getFullYear() && value.month === today.getMonth();
}

function buildTop3Option({
  id,
  label,
  records,
  subtitle,
}: {
  id: string;
  label: string;
  records: Array<{ date: string; group: string; value: number }>;
  subtitle: string;
}): DashboardTop3Option {
  const grouped = new Map<string, { total: number; values: number[] }>();

  records.filter((record) => isCurrentMonth(record.date)).forEach((record) => {
    const dayIndex = getDayIndex(record.date);

    if (dayIndex < 0 || dayIndex > 30) {
      return;
    }

    const current = grouped.get(record.group) ?? {
      total: 0,
      values: Array.from({ length: 31 }, () => 0),
    };

    current.total += record.value;
    current.values[dayIndex] += record.value;
    grouped.set(record.group, current);
  });

  return {
    id,
    label,
    series: Array.from(grouped.entries())
      .map(([seriesLabel, data]) => ({
        label: seriesLabel,
        total: data.total,
        values: data.values,
      }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 3),
    subtitle,
  };
}

function buildDashboardTop3Options({
  customers,
  sales,
}: {
  customers: CrmCustomer[];
  sales: Sale[];
}): DashboardTop3Option[] {
  const crmScore: Record<CrmCustomer["estado"], number> = {
    calificado: 68,
    contactado: 45,
    cotizado: 82,
    ganado: 100,
    inactivo: 10,
    nuevo: 25,
    perdido: 5,
  };

  const options = [
    buildTop3Option({
      id: "sales-branch",
      label: "Ventas por sucursal",
      records: sales.map((sale) => ({
        date: sale.fechaVenta,
        group: sale.creadoPorSucursalNombre ?? "Sucursal sin asignar",
        value: sale.total,
      })),
      subtitle: "Las 3 sucursales que mas vendieron este mes.",
    }),
    buildTop3Option({
      id: "sales-seller",
      label: "Ventas por vendedor",
      records: sales.map((sale) => ({
        date: sale.fechaVenta,
        group: sale.creadoPorNombre ?? "Sin vendedor",
        value: sale.total,
      })),
      subtitle: "Los 3 vendedores con mas ventas este mes.",
    }),
    buildTop3Option({
      id: "crm-evaluated",
      label: "Clientes mejor evaluados",
      records: customers.map((customer) => ({
        date: customer.createdAt,
        group: customer.estado,
        value: crmScore[customer.estado],
      })),
      subtitle: "Los 3 grupos de clientes con mejor avance este mes.",
    }),
  ];

  return options.some((option) => option.series.length > 0)
    ? options
    : [
        {
          id: "empty",
          label: "Top 3 del negocio",
          series: [],
          subtitle: "Los datos apareceran cuando los modulos empiecen a registrar actividad.",
        },
      ];
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const [params, profileResult, tenantResult] = await Promise.all([
    searchParams,
    getCurrentProfile(),
    getCurrentTenantContext(),
  ]);

  if (!profileResult.ok || !tenantResult.ok) {
    redirect("/login");
  }

  if (!profileResult.data || !tenantResult.data) {
    redirect("/onboarding");
  }

  const tenant = tenantResult.data;
  const permissions = tenant.permissions;
  const showConsultationModal = params?.consulta === "nueva";
  let consultationResult: ConsultationSearchResult | null = null;
  let consultationMessage: string | null = null;
  const parsedConsultationDocument = params?.documento
    ? consultationSearchSchema.safeParse({ documento: params.documento })
    : null;

  if (showConsultationModal && parsedConsultationDocument?.success) {
    const searchResult = await getConsultationSearchResult(
      tenant,
      parsedConsultationDocument.data.documento,
    );

    if (searchResult.ok) {
      consultationResult = searchResult.data;
    } else {
      consultationResult = getBlankConsultationResult(
        parsedConsultationDocument.data.documento,
      );
      consultationMessage = "No se pudo completar la busqueda. Completa los datos manualmente.";
    }
  } else if (showConsultationModal) {
    consultationResult = getBlankConsultationResult(params?.documento ?? "");

    if (params?.documento) {
      consultationMessage =
        "La identificacion debe tener entre 9 y 12 digitos numericos.";
    }
  }

  const dashboardResults = await Promise.allSettled([
    hasPermission(permissions, "crm.customers.view")
      ? getCrmCustomers(tenant)
      : Promise.resolve(null),
    hasPermission(permissions, "quotes.view")
      ? getQuotes(tenant, "todos")
      : Promise.resolve(null),
    hasPermission(permissions, "sales.orders.view")
      ? getSales(tenant, "todos")
      : Promise.resolve(null),
    hasPermission(permissions, "dispatch.orders.view")
      ? getDispatchOrders(tenant, "todos")
      : Promise.resolve(null),
    isModuleActive(tenant.activeModules, "payments") &&
    hasPermission(permissions, "payments.accounts.view")
      ? getPaymentsSummary(tenant)
      : Promise.resolve(null),
    isModuleActive(tenant.activeModules, "purchases") &&
    hasPermission(permissions, "purchases.orders.view")
      ? getPurchasesSummary(tenant)
      : Promise.resolve(null),
  ]);
  const [
    dashboardCustomers,
    dashboardQuotes,
    dashboardSales,
    dashboardDispatches,
    dashboardPaymentsSummary,
    dashboardPurchasesSummary,
  ] = [
    getSettledValue(dashboardResults[0], null, "getCrmCustomers"),
    getSettledValue(dashboardResults[1], null, "getQuotes"),
    getSettledValue(dashboardResults[2], null, "getSales"),
    getSettledValue(dashboardResults[3], null, "getDispatchOrders"),
    getSettledValue(dashboardResults[4], null, "getPaymentsSummary"),
    getSettledValue(dashboardResults[5], null, "getPurchasesSummary"),
  ];
  const customerRows = dashboardCustomers?.ok === true ? dashboardCustomers.data : [];
  const quoteRows = dashboardQuotes?.ok === true ? dashboardQuotes.data : [];
  const saleRows = dashboardSales?.ok === true ? dashboardSales.data : [];
  const dispatchRows =
    dashboardDispatches?.ok === true ? dashboardDispatches.data : [];
  const paymentsSummary =
    dashboardPaymentsSummary?.ok === true ? dashboardPaymentsSummary.data : null;
  const purchasesSummary =
    dashboardPurchasesSummary?.ok === true ? dashboardPurchasesSummary.data : null;
  const monthSales = saleRows.filter((sale) => isThisMonth(sale.fechaVenta));
  const monthSalesTotal = sumSales(monthSales);
  const top3Options = buildDashboardTop3Options({
    customers: customerRows,
    sales: saleRows,
  });
  const activeDispatches = dispatchRows.filter((dispatch) =>
    ["pendiente", "preparando", "listo", "en_ruta"].includes(dispatch.estado),
  );
  const recentSales = saleRows.slice(0, 2);
  const recentDispatch = dispatchRows[0];
  const openQuotes = quoteRows.filter((quote) =>
    ["borrador", "enviada", "vencida"].includes(quote.estado),
  );
  const sentQuotes = quoteRows.filter((quote) => quote.estado === "enviada");
  const activeCustomers = customerRows.filter((customer) => customer.tipo === "cliente");
  const kpis: DashboardKpi[] = [
    {
      accent: "dark",
      href: "/ventas",
      title: "Ventas",
      value: formatCurrency(monthSalesTotal, true),
    },
    {
      accent: "amber",
      href: "/crm/clientes",
      title: "Clientes",
      value: activeCustomers.length.toLocaleString("es-CR"),
    },
    {
      accent: "teal",
      href: "/cotizaciones",
      title: "Cotizaciones",
      value: openQuotes.length.toLocaleString("es-CR"),
    },
    {
      accent: "silver",
      href: paymentsSummary ? "/pagos" : "/despacho",
      title: paymentsSummary ? "Cartera neta" : "Despachos",
      value: paymentsSummary
        ? formatCurrency(paymentsSummary.saldoPorCobrar - paymentsSummary.saldoPorPagar, true)
        : activeDispatches.length.toLocaleString("es-CR"),
    },
  ];
  const operationalReportRows = [
    {
      href: "/pagos",
      label: "Cartera",
      value: paymentsSummary
        ? `${formatCurrency(paymentsSummary.saldoPorCobrar)} CxC / ${formatCurrency(paymentsSummary.saldoPorPagar)} CxP`
        : "Sin datos",
    },
    {
      href: "/compras",
      label: "Compras recibidas",
      value: purchasesSummary
        ? formatCurrency(purchasesSummary.totalComprado)
        : "Sin datos",
    },
    {
      href: "/ventas",
      label: "Ventas del mes",
      value: formatCurrency(monthSalesTotal),
    },
  ];

  return (
    <section className="dashboard-screen">
      <DashboardBoardNavigation />

      <div className="dashboard-kpi-row">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </div>

      <div className="dashboard-grid-main">
        <DashboardTop3Chart options={top3Options} />

        <DashboardCard className="dashboard-activity-card">
          <PanelHeader href="/ventas" linkLabel="Ver todas" title="Actividad reciente" />
          <div className="dashboard-activity-list">
            {recentSales.map((sale) => (
              <ActivityRow
                detail={`${sale.clienteNombre ?? "Cliente"} - ${formatCurrency(sale.total)}`}
                icon={Banknote}
                key={sale.id}
                tone="green"
                title="Venta registrada"
                when={formatActivityDate(sale.createdAt)}
              />
            ))}
            {sentQuotes[0] ? (
              <ActivityRow
                detail={`${sentQuotes[0].clienteNombre ?? "Cliente"} - ${formatCurrency(sentQuotes[0].total)}`}
                icon={ShoppingCart}
                tone="blue"
                title="Cotizacion enviada"
                when={formatActivityDate(sentQuotes[0].updatedAt)}
              />
            ) : null}
            {recentDispatch ? (
              <ActivityRow
                detail={`${recentDispatch.numero} - ${recentDispatch.clienteNombre ?? "Cliente"}`}
                icon={Truck}
                tone="purple"
                title="Orden de despacho creada"
                when={formatActivityDate(recentDispatch.createdAt)}
              />
            ) : null}
            {recentSales.length === 0 && !sentQuotes[0] && !recentDispatch ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-500">
                No hay actividad reciente con los permisos actuales.
              </p>
            ) : null}
          </div>
        </DashboardCard>
      </div>

      <div className="dashboard-grid-bottom">
        <DashboardCard className="dashboard-whatsapp-card">
          <PanelHeader href="/inbox/conversaciones" title="Inbox" />
          <div className="dashboard-inbox-list">
            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-500">
              Las conversaciones se muestran en el Inbox cuando hay canales y permisos activos.
            </div>
          </div>
          <Link className="dashboard-card-action dashboard-whatsapp-action" href="/inbox">
            <Inbox aria-hidden="true" size={17} />
            Abrir Inbox
          </Link>
        </DashboardCard>

        <DashboardAppointmentCard />

        <DashboardCard className="dashboard-dispatch-card">
          <PanelHeader href="/despacho" linkLabel="Ver todos" title="Despachos" />
          <div className="dashboard-dispatch">
            <div className="dashboard-ring">
              <strong>{dispatchRows.length}</strong>
              <span>DPO</span>
            </div>
            <div className="dashboard-dispatch-legend">
              {[
                ["Entregados", dispatchRows.filter((item) => item.estado === "entregado").length, "green"],
                ["En transito", dispatchRows.filter((item) => item.estado === "en_ruta").length, "blue"],
                ["Pendientes", activeDispatches.length, "amber"],
              ].map(([label, value, tone]) => (
                <p key={label}>
                  <span data-tone={tone} />
                  {label}
                  <strong>{value}</strong>
                </p>
              ))}
            </div>
          </div>
          <Link className="dashboard-card-action" href="/despacho">
            <Plus aria-hidden="true" size={17} />
            Ver despachos
          </Link>
        </DashboardCard>

        <DashboardCard>
          <PanelHeader href="/admin" linkLabel="Ver permisos" title="Modulos disponibles" />
          <div className="dashboard-status-grid">
            {[
              [
                "CRM",
                hasPermission(permissions, "crm.customers.view") ? "Disponible" : "Sin acceso",
                Users,
                hasPermission(permissions, "crm.customers.view") ? "green" : "amber",
              ],
              [
                "Ventas",
                hasPermission(permissions, "sales.orders.view") ? "Disponible" : "Sin acceso",
                ShoppingCart,
                hasPermission(permissions, "sales.orders.view") ? "green" : "amber",
              ],
              [
                "Inventario",
                hasPermission(permissions, "inventory.stock.view") ? "Disponible" : "Sin acceso",
                CheckCircle2,
                hasPermission(permissions, "inventory.stock.view") ? "green" : "amber",
              ],
              [
                "Despacho",
                hasPermission(permissions, "dispatch.orders.view") ? "Disponible" : "Sin acceso",
                Truck,
                hasPermission(permissions, "dispatch.orders.view") ? "green" : "amber",
              ],
            ].map(([label, state, Icon, tone]) => {
              const StatusIcon = Icon as ComponentType<{ size?: number; strokeWidth?: number }>;

              return (
                <div className="dashboard-status" data-tone={tone} key={label as string}>
                  <StatusIcon aria-hidden="true" size={22} strokeWidth={2.2} />
                  <div>
                    <strong>{label as string}</strong>
                    <span>{state as string}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="dashboard-status-ok">
            <CheckCircle2 aria-hidden="true" size={18} />
            Basado en permisos actuales
          </p>
        </DashboardCard>

        <DashboardCard>
          <PanelHeader href="/dashboard" linkLabel="Actual" title="Reportes operativos" />
          <div className="grid gap-3">
            {operationalReportRows.map((row) => (
              <Link
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm font-semibold"
                href={row.href}
                key={row.label}
              >
                <span className="text-slate-600">{row.label}</span>
                <strong>{row.value}</strong>
              </Link>
            ))}
          </div>
        </DashboardCard>
      </div>

      {showConsultationModal ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/45 p-4 lg:p-8">
          <div className="w-full max-w-5xl rounded-xl border bg-background p-5 shadow-xl">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <SectionHeader
                title="Nueva consulta"
                titleClassName="text-2xl font-semibold normal-case tracking-normal"
              />
              <Link
                aria-label="Cerrar nueva consulta"
                className="inline-flex size-10 items-center justify-center rounded-md border border-red-300 bg-red-50 text-red-700 transition-colors hover:bg-red-100"
                href="/dashboard"
              >
                <X aria-hidden="true" size={22} strokeWidth={2.6} />
              </Link>
            </div>

            {params?.error ? <EphemeralPageAlert error={params.error} /> : null}
            {consultationMessage ? (
              <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {consultationMessage}
              </p>
            ) : null}

            <div className="space-y-5">
              <ConsultationSearchForm
                defaultDocumento={params?.documento ?? ""}
                returnTo="/dashboard"
              />
              <ConsultationResultCard result={consultationResult} />
              <ConsultationManagementForm
                canCreateCustomer={hasPermission(
                  permissions,
                  "crm.customers.create",
                )}
                canCreateQuote={hasPermission(permissions, "quotes.create")}
                canSaveInteraction={hasPermission(
                  permissions,
                  "crm.interactions.create",
                )}
                result={consultationResult}
                returnTo="/dashboard"
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function KpiCard({
  accent,
  href,
  title,
  value,
}: DashboardKpi) {
  return (
    <Link className="dashboard-kpi-card" data-accent={accent} href={href}>
      <div className="dashboard-kpi-title">{title}</div>
      <div className="dashboard-kpi-line" />
      <div className="dashboard-kpi-value">{value}</div>
    </Link>
  );
}

function DashboardCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <article className={`dashboard-card ${className}`}>{children}</article>;
}

function PanelHeader({
  badge,
  href,
  linkLabel = "Ver todas",
  title,
}: {
  badge?: number;
  href: string;
  linkLabel?: string;
  title: string;
}) {
  return (
    <div className="dashboard-panel-header">
      <h2>{title}</h2>
      {typeof badge === "number" ? <span>{badge}</span> : null}
      <Link href={href}>{linkLabel}</Link>
    </div>
  );
}

function formatActivityDate(value: string) {
  return new Date(value).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
  });
}

function ActivityRow({
  detail,
  icon: Icon,
  title,
  tone,
  when,
}: {
  detail: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  title: string;
  tone: string;
  when: string;
}) {
  return (
    <div className="dashboard-activity-row">
      <span data-tone={tone}>
        <Icon aria-hidden="true" size={24} strokeWidth={2.2} />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      <time>{when}</time>
    </div>
  );
}

function DashboardAppointmentCard() {
  return (
    <DashboardCard className="dashboard-appointment-card">
      <div className="dashboard-appointment-header">
        <span>
          <CalendarDays aria-hidden="true" size={18} />
        </span>
        <h2>Agenda</h2>
      </div>
      <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-500">
        Los seguimientos abiertos aparecen en Agenda cuando se registran desde un cliente.
      </div>
      <Link className="dashboard-appointment-submit" href="/agenda">
        Abrir Agenda
      </Link>
    </DashboardCard>
  );
}
