import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  FileText,
  X,
  ShoppingCart,
  Users,
} from "lucide-react";

import { PremiumKpiCard } from "@/components/kpi/premium-kpi-card";
import { PremiumKpiGrid } from "@/components/kpi/premium-kpi-grid";
import { SectionHeader } from "@/components/shared/section-header";
import { getCurrentProfile, getCurrentTenantContext } from "@/lib/auth/session";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { getAgendaSummary } from "@/modules/agenda/queries";
import { ConsultationManagementForm } from "@/modules/consultations/components/consultation-management-form";
import { ConsultationResultCard } from "@/modules/consultations/components/consultation-result-card";
import { ConsultationSearchForm } from "@/modules/consultations/components/consultation-search-form";
import { getConsultationSearchResult } from "@/modules/consultations/queries";
import { consultationSearchSchema } from "@/modules/consultations/schemas";
import type { ConsultationSearchResult } from "@/modules/consultations/types";
import { getCrmCustomers } from "@/modules/crm/queries";
import { getDispatchOrders } from "@/modules/dispatch/queries";
import { getQuotes } from "@/modules/quotes/queries";
import { getSales } from "@/modules/sales/queries";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CR", {
    currency: "CRC",
    maximumFractionDigits: 0,
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

type DashboardPageProps = {
  searchParams?: Promise<{
    consulta?: string;
    consulta_estado?: string;
    documento?: string;
    error?: string;
  }>;
};

function getBlankConsultationResult(documento = ""): ConsultationSearchResult {
  return {
    documento,
    message: "Completa la informacion para iniciar una gestion.",
    source: "manual",
  };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const [params, profileResult, tenantResult] = await Promise.all([
    searchParams,
    getCurrentProfile(),
    getCurrentTenantContext(),
  ]);

  if (!profileResult.ok || !tenantResult.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[dashboard] auth context failed", {
        profile: profileResult.ok ? "ok" : profileResult.error.message,
        tenant: tenantResult.ok ? "ok" : tenantResult.error.message,
      });
    }
    redirect("/login");
  }

  if (!profileResult.data) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[dashboard] missing profile; redirect onboarding");
    }
    redirect("/onboarding");
  }

  if (!tenantResult.data) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[dashboard] missing tenant; redirect onboarding");
    }
    redirect("/onboarding");
  }

  const permissions = tenantResult.data.permissions;
  const showConsultationModal = params?.consulta === "nueva";
  let consultationResult: ConsultationSearchResult | null = null;
  let consultationMessage: string | null = null;
  const parsedConsultationDocument = params?.documento
    ? consultationSearchSchema.safeParse({ documento: params.documento })
    : null;

  if (showConsultationModal && parsedConsultationDocument?.success) {
    const searchResult = await getConsultationSearchResult(
      tenantResult.data,
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
      ? getCrmCustomers(tenantResult.data)
      : Promise.resolve(null),
    hasPermission(permissions, "quotes.view")
      ? getQuotes(tenantResult.data, "todos")
      : Promise.resolve(null),
    hasPermission(permissions, "sales.orders.view")
      ? getSales(tenantResult.data, "todos")
      : Promise.resolve(null),
    hasPermission(permissions, "crm.followups.view")
      ? getAgendaSummary(tenantResult.data, {
          source: "dashboard",
          tolerateErrors: true,
        })
      : Promise.resolve(null),
    hasPermission(permissions, "dispatch.orders.view")
      ? getDispatchOrders(tenantResult.data, "todos")
      : Promise.resolve(null),
  ]);
  const [
    dashboardCustomers,
    dashboardQuotes,
    dashboardSales,
    dashboardAgenda,
    dashboardDispatches,
  ] = [
    getSettledValue(dashboardResults[0], null, "getCrmCustomers"),
    getSettledValue(dashboardResults[1], null, "getQuotes"),
    getSettledValue(dashboardResults[2], null, "getSales"),
    getSettledValue(dashboardResults[3], null, "getAgendaSummary"),
    getSettledValue(dashboardResults[4], null, "getDispatchOrders"),
  ];
  const dashboardCustomerRows =
    dashboardCustomers?.ok === true ? dashboardCustomers.data : [];
  const dashboardQuoteRows =
    dashboardQuotes?.ok === true ? dashboardQuotes.data : [];
  const dashboardSaleRows = dashboardSales?.ok === true ? dashboardSales.data : [];
  const dashboardAgendaData =
    dashboardAgenda?.ok === true
      ? dashboardAgenda.data
      : { completadosRecientes: [], hoy: [], proximos: [], vencidos: [] };
  const dashboardAgendaUnavailable =
    hasPermission(permissions, "crm.followups.view") && dashboardAgenda?.ok !== true;
  const dashboardDispatchRows =
    dashboardDispatches?.ok === true ? dashboardDispatches.data : [];
  const dashboardOpenQuotes = dashboardQuoteRows.filter((quote) =>
    ["borrador", "enviada"].includes(quote.estado),
  );
  const dashboardActiveCustomers = dashboardCustomerRows.filter(
    (customer) => !["inactivo", "perdido"].includes(customer.estado),
  );
  const dashboardMonthSales = dashboardSaleRows.filter((sale) =>
    isThisMonth(sale.fechaVenta),
  );
  const dashboardOperationalPending =
    dashboardAgendaData.hoy.length +
    dashboardAgendaData.vencidos.length +
    dashboardDispatchRows.filter((dispatch) =>
      ["pendiente", "preparando", "listo", "en_ruta"].includes(dispatch.estado),
    ).length;
  const quickCards = [
    {
      description: "Gestiona clientes y prospectos.",
      href: "/crm/clientes",
      label: "Clientes",
      show: hasPermission(permissions, "crm.customers.view"),
    },
    {
      description: "Organiza seguimientos del día.",
      href: "/agenda",
      label: "Agenda",
      show: hasPermission(permissions, "crm.followups.view"),
    },
    {
      description: "Crea y revisa propuestas.",
      href: "/cotizaciones",
      label: "Cotizaciones",
      show: hasAnyPermission(permissions, [
        "quotes.view",
        "quotes.create",
        "quotes.edit",
      ]),
    },
    {
      description: "Da seguimiento a órdenes.",
      href: "/ventas",
      label: "Ventas",
      show: hasAnyPermission(permissions, [
        "sales.orders.view",
        "sales.orders.create",
        "sales.orders.edit",
      ]),
    },
    {
      description: "Controla stock y movimientos.",
      href: "/inventario",
      label: "Inventario",
      show: hasAnyPermission(permissions, [
        "inventory.stock.view",
        "inventory.stock.adjust",
        "inventory.movements.view",
      ]),
    },
    {
      description: "Prepara entregas y trabajos.",
      href: "/despacho",
      label: "Despacho",
      show: hasAnyPermission(permissions, [
        "dispatch.orders.view",
        "dispatch.orders.create",
        "dispatch.orders.edit",
      ]),
    },
  ].filter((card) => card.show);
  const unusedQuickActions = [
    {
      href: "/cotizaciones/nueva",
      label: "Nueva cotización",
      show: hasPermission(permissions, "quotes.create"),
    },
    {
      href: "/agenda",
      label: "Ver agenda",
      show: hasPermission(permissions, "crm.followups.view"),
    },
    {
      href: "/ventas",
      label: "Ver ventas",
      show: hasPermission(permissions, "sales.orders.view"),
    },
    {
      href: "/inventario",
      label: "Ver inventario",
      show: hasAnyPermission(permissions, [
        "inventory.stock.view",
        "inventory.stock.adjust",
      ]),
    },
    {
      href: "/despacho",
      label: "Ver despacho",
      show: hasPermission(permissions, "dispatch.orders.view"),
    },
  ].filter((action) => action.show);
  void unusedQuickActions;

  return (
    <section className="flex h-[calc(100vh-3rem)] min-h-0 flex-col gap-6 overflow-hidden">
      <SectionHeader
        title="Dashboard"
        titleClassName="app-page-title-compact normal-case"
      />

      {dashboardAgendaUnavailable ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No se pudo cargar agenda por ahora. El resto del dashboard sigue
          disponible.
        </p>
      ) : null}

      <PremiumKpiGrid>
        <PremiumKpiCard
          footerLeftLabel="Prospectos"
          footerLeftValue={
            dashboardCustomerRows.filter((customer) => customer.tipo === "prospecto")
              .length
          }
          footerRightLabel="Activos"
          footerRightValue={dashboardActiveCustomers.length}
          href="/crm/clientes"
          icon={<Users />}
          sparklineTone="blue"
          title="Clientes activos"
          trendLabel="CRM"
          trendTone="neutral"
          trendValue="Real"
          value={dashboardActiveCustomers.length}
          variant="blue"
        />
        <PremiumKpiCard
          footerLeftLabel="Borradores"
          footerLeftValue={
            dashboardQuoteRows.filter((quote) => quote.estado === "borrador").length
          }
          footerRightLabel="Enviadas"
          footerRightValue={
            dashboardQuoteRows.filter((quote) => quote.estado === "enviada").length
          }
          href="/cotizaciones"
          icon={<FileText />}
          sparklineTone="gold"
          title="Cotizaciones abiertas"
          trendLabel="abiertas"
          trendTone="neutral"
          trendValue={`${dashboardOpenQuotes.length}`}
          value={dashboardOpenQuotes.length}
          variant="red"
        />
        <PremiumKpiCard
          footerLeftLabel="Ordenes mes"
          footerLeftValue={dashboardMonthSales.length}
          footerRightLabel="Total mes"
          footerRightValue={formatCurrency(
            dashboardMonthSales.reduce((sum, sale) => sum + sale.total, 0),
          )}
          href="/ventas"
          icon={<ShoppingCart />}
          sparklineTone="green"
          title="Ventas del mes"
          trendLabel="mes actual"
          trendTone="neutral"
          trendValue="Real"
          value={dashboardMonthSales.length}
          variant="green"
        />
        <PremiumKpiCard
          footerLeftLabel="Agenda"
          footerLeftValue={
            dashboardAgendaData.hoy.length + dashboardAgendaData.vencidos.length
          }
          footerRightLabel="Despacho"
          footerRightValue={
            dashboardDispatchRows.filter((dispatch) =>
              ["pendiente", "preparando", "listo", "en_ruta"].includes(
                dispatch.estado,
              ),
            ).length
          }
          href="/agenda"
          icon={<AlertTriangle />}
          sparklineTone="red"
          title="Pendientes operativos"
          trendLabel="operacion"
          trendTone={dashboardOperationalPending > 0 ? "negative" : "neutral"}
          trendValue={`${dashboardOperationalPending}`}
          value={dashboardOperationalPending}
          variant="gold"
        />
      </PremiumKpiGrid>

      <div className="min-h-0 flex-1 overflow-auto pr-1">
      {quickCards.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {quickCards.map((card) => (
            <Link
              className="rounded-lg border bg-background p-4 transition-colors hover:bg-muted"
              href={card.href}
              key={card.href}
            >
              <p className="text-sm font-semibold">{card.label}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {card.description}
              </p>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-6 rounded-lg border bg-background p-5">
        <p className="font-semibold">Flujo de trabajo</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {["Cliente", "Cotización", "Venta", "Inventario", "Despacho"].map(
            (step, index, steps) => (
              <div className="flex items-center gap-2" key={step}>
                <span className="rounded-md border bg-muted px-3 py-2 font-medium text-foreground">
                  {step}
                </span>
                {index < steps.length - 1 ? <span>→</span> : null}
              </div>
            ),
          )}
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
          Usa CRM para iniciar la relación, cotiza, convierte a venta, controla
          inventario cuando aplique y coordina el despacho operativo.
        </p>
      </div>
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

            {params?.error || consultationMessage ? (
              <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {params?.error ?? consultationMessage}
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
