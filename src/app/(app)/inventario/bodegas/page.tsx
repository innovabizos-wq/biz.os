import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { WarehouseForm } from "@/modules/inventory/components/warehouse-form";
import { WarehousesTable } from "@/modules/inventory/components/warehouses-table";
import { getWarehouses } from "@/modules/inventory/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type InventoryWarehousesPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function InventoryWarehousesPage({
  searchParams,
}: InventoryWarehousesPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canView =
    hasPermission(access.tenant.permissions, "inventory.warehouses.view") ||
    hasPermission(access.tenant.permissions, "inventory.warehouses.manage");
  const canManage = hasPermission(
    access.tenant.permissions,
    "inventory.warehouses.manage",
  );

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta sección."
          eyebrow="Inventario"
          title="Bodegas"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const warehouses = await getWarehouses(access.tenant);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Bodegas simples para manejar stock manual por empresa."
        eyebrow="Inventario"
        title="Bodegas"
      />

      <EphemeralPageAlert error={params?.error} />

      {canManage ? <WarehouseForm mode="create" /> : null}

      {!warehouses.ok ? (
        <EmptyState
          description={warehouses.error.message}
          title="No se pudo cargar"
        />
      ) : warehouses.data.length > 0 ? (
        <WarehousesTable canManage={canManage} warehouses={warehouses.data} />
      ) : (
        <EmptyState
          description="Crea la primera bodega para registrar stock."
          title="Sin bodegas"
        />
      )}
    </section>
  );
}
