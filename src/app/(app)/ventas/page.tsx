import { CheckCircle2, Clock, ShoppingCart, TrendingUp } from "lucide-react";

import { PremiumKpiCard } from "@/components/kpi/premium-kpi-card";
import { PremiumKpiGrid } from "@/components/kpi/premium-kpi-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { SalesDatabase } from "@/modules/sales/components/sales-database";
import { getSales } from "@/modules/sales/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type SalesPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CR", {
    currency: "CRC",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canView = hasPermission(access.tenant.permissions, "sales.orders.view");

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta secciÃ³n."
          eyebrow="Comercial"
          title="Ventas"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const sales = await getSales(access.tenant, "todos");
  const saleRows = sales.ok ? sales.data : [];
  const activeSales = saleRows.filter((sale) =>
    ["confirmada", "en_proceso"].includes(sale.estado),
  );
  const completedSales = saleRows.filter((sale) => sale.estado === "completada");
  const totalSold = completedSales.reduce((sum, sale) => sum + sale.total, 0);

  return (
    <section className="flex h-[calc(100vh-3rem)] min-h-0 flex-col gap-6 overflow-hidden">
      <SectionHeader
        title="Ventas"
        titleClassName="app-page-title-compact normal-case"
      />

      {params?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </p>
      ) : null}

      <PremiumKpiGrid>
        <PremiumKpiCard
          footerLeftLabel="Visibles"
          footerLeftValue={saleRows.length}
          footerRightLabel="Filtro"
          footerRightValue="todos"
          href="/ventas"
          icon={<ShoppingCart />}
          sparklineTone="blue"
          title="Ventas"
          trendLabel="historico"
          trendTone="neutral"
          trendValue="Real"
          value={saleRows.length}
          variant="blue"
        />
        <PremiumKpiCard
          footerLeftLabel="Confirmadas"
          footerLeftValue={
            saleRows.filter((sale) => sale.estado === "confirmada").length
          }
          footerRightLabel="En proceso"
          footerRightValue={
            saleRows.filter((sale) => sale.estado === "en_proceso").length
          }
          icon={<Clock />}
          sparklineTone="gold"
          title="Confirmadas/en proceso"
          trendLabel="activas"
          trendTone="neutral"
          trendValue={`${activeSales.length}`}
          value={activeSales.length}
          variant="red"
        />
        <PremiumKpiCard
          footerLeftLabel="Completadas"
          footerLeftValue={completedSales.length}
          footerRightLabel="Conversion"
          footerRightValue={
            saleRows.length > 0
              ? `${Math.round((completedSales.length / saleRows.length) * 100)}%`
              : "0%"
          }
          icon={<CheckCircle2 />}
          sparklineTone="green"
          title="Completadas"
          trendLabel="cerradas"
          trendTone="positive"
          trendValue={`${completedSales.length}`}
          value={completedSales.length}
          variant="green"
        />
        <PremiumKpiCard
          footerLeftLabel="Completado"
          footerLeftValue={formatCurrency(totalSold)}
          footerRightLabel="Ordenes"
          footerRightValue={completedSales.length}
          icon={<TrendingUp />}
          sparklineTone="purple"
          title="Total vendido"
          trendLabel="CRC"
          trendTone="neutral"
          trendValue="Real"
          value={formatCurrency(totalSold)}
          variant="gold"
        />
      </PremiumKpiGrid>

      {!sales.ok ? (
        <EmptyState description={sales.error.message} title="No se pudo cargar" />
      ) : saleRows.length > 0 ? (
        <SalesDatabase sales={saleRows} />
      ) : (
        <EmptyState
          description="Aun no hay ventas generadas desde cotizaciones."
          title="Sin ventas"
        />
      )}
    </section>
  );
}
