import Link from "next/link";
import { AlertTriangle, Package, TrendingUp, Warehouse } from "lucide-react";

import { PremiumKpiCard } from "@/components/kpi/premium-kpi-card";
import { PremiumKpiGrid } from "@/components/kpi/premium-kpi-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { InventoryDatabase } from "@/modules/inventory/components/inventory-database";
import {
  canAccessInventoryNav,
  getInventoryStock,
  getInventorySummary,
} from "@/modules/inventory/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type InventoryPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);

  if (!canAccessInventoryNav(access.tenant)) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta secciÃ³n."
          eyebrow="OperaciÃ³n"
          title="Inventario"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [summary, stock] = await Promise.all([
    getInventorySummary(access.tenant),
    getInventoryStock(access.tenant),
  ]);

  return (
    <section className="flex h-[calc(100vh-3rem)] min-h-0 flex-col gap-6 overflow-hidden">
      <SectionHeader
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/inventario/productos"
            >
              Stock
            </Link>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/inventario/movimientos"
            >
              Movimientos
            </Link>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/inventario/bodegas"
            >
              Bodegas
            </Link>
          </div>
        }
        title="Inventario"
        titleClassName="app-page-title-compact normal-case"
      />

      {params?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </p>
      ) : null}

      {!summary.ok ? (
        <EmptyState description={summary.error.message} title="No se pudo cargar" />
      ) : (
        <PremiumKpiGrid>
          <PremiumKpiCard
            footerLeftLabel="Con stock"
            footerLeftValue={summary.data.productosConStock}
            footerRightLabel="Bajo minimo"
            footerRightValue={summary.data.productosBajoStock}
            href="/inventario/productos"
            icon={<Package />}
            sparklineTone="blue"
            title="Productos con stock"
            trendLabel="stock"
            trendTone="neutral"
            trendValue="Real"
            value={summary.data.productosConStock}
            variant="blue"
          />
          <PremiumKpiCard
            footerLeftLabel="Bajo minimo"
            footerLeftValue={summary.data.productosBajoStock}
            footerRightLabel="Revision"
            footerRightValue={summary.data.productosBajoStock > 0 ? "Alta" : "OK"}
            href="/inventario/productos"
            icon={<AlertTriangle />}
            sparklineTone="red"
            title="Bajo minimo"
            trendLabel="alertas"
            trendTone={summary.data.productosBajoStock > 0 ? "negative" : "neutral"}
            value={summary.data.productosBajoStock}
            variant="red"
          />
          <PremiumKpiCard
            footerLeftLabel="Recientes"
            footerLeftValue={summary.data.movimientosRecientes}
            footerRightLabel="Auditoria"
            footerRightValue="Manual"
            href="/inventario/movimientos"
            icon={<TrendingUp />}
            sparklineTone="green"
            title="Movimientos recientes"
            trendLabel="ultimos"
            trendTone="neutral"
            trendValue="Real"
            value={summary.data.movimientosRecientes}
            variant="green"
          />
          <PremiumKpiCard
            footerLeftLabel="Activas"
            footerLeftValue={summary.data.bodegasActivas}
            footerRightLabel="Estado"
            footerRightValue={summary.data.bodegasActivas > 0 ? "OK" : "0"}
            href="/inventario/bodegas"
            icon={<Warehouse />}
            sparklineTone="gold"
            title="Bodegas activas"
            trendLabel="bodegas"
            trendTone="neutral"
            trendValue="Real"
            value={summary.data.bodegasActivas}
            variant="gold"
          />
        </PremiumKpiGrid>
      )}

      {!stock.ok ? (
        <EmptyState description={stock.error.message} title="No se pudo cargar" />
      ) : stock.data.length > 0 ? (
        <InventoryDatabase stock={stock.data} />
      ) : (
        <EmptyState
          description="Registra una entrada o ajuste para crear la primera fila de stock."
          title="Sin stock registrado"
        />
      )}
    </section>
  );
}
