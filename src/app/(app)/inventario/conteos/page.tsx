import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { InventoryCountsPanel } from "@/modules/inventory/components/inventory-counts-panel";
import {
  getInventoryCountItems,
  getInventoryCounts,
  getWarehouses,
} from "@/modules/inventory/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type InventoryCountsPageProps = {
  searchParams?: Promise<{ conteo?: string; error?: string; success?: string }>;
};

export default async function InventoryCountsPage({
  searchParams,
}: InventoryCountsPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canView = hasAnyPermission(access.tenant.permissions, [
    "inventory.stock.view",
    "inventory.stock.adjust",
  ]);
  const canAdjust = hasPermission(access.tenant.permissions, "inventory.stock.adjust");

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta sección."
          eyebrow="Inventario"
          title="Conteos físicos"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [countsResult, warehousesResult] = await Promise.all([
    getInventoryCounts(access.tenant),
    getWarehouses(access.tenant),
  ]);

  if (!countsResult.ok) {
    return (
      <section className="space-y-6">
        <SectionHeader eyebrow="Inventario" title="Conteos físicos" />
        <EmptyState description={countsResult.error.message} title="No se pudo cargar" />
      </section>
    );
  }

  const selectedCount =
    countsResult.data.find((count) => count.id === params?.conteo) ??
    countsResult.data.find((count) => count.status === "open") ??
    countsResult.data[0] ??
    null;
  const itemsResult = selectedCount
    ? await getInventoryCountItems(access.tenant, selectedCount.id)
    : null;

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Cuenta físicamente una bodega, conserva la fotografía inicial y aplica cada diferencia en una sola transacción auditada."
        eyebrow="Inventario"
        title="Conteos físicos"
      />

      <EphemeralPageAlert error={params?.error} success={params?.success} />

      {itemsResult && !itemsResult.ok ? (
        <EmptyState description={itemsResult.error.message} title="No se pudo cargar el detalle" />
      ) : (
        <InventoryCountsPanel
          canAdjust={canAdjust}
          counts={countsResult.data}
          items={itemsResult?.ok ? itemsResult.data : []}
          selectedCount={selectedCount}
          warehouses={warehousesResult.ok ? warehousesResult.data : []}
        />
      )}
    </section>
  );
}
