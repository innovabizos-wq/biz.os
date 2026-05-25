import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { InventoryMovementForm } from "@/modules/inventory/components/inventory-movement-form";
import { InventoryStockTable } from "@/modules/inventory/components/inventory-stock-table";
import {
  getInventoryStock,
  getProductsForInventory,
  getWarehouses,
} from "@/modules/inventory/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type InventoryProductsPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function InventoryProductsPage({
  searchParams,
}: InventoryProductsPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canView =
    hasPermission(access.tenant.permissions, "inventory.stock.view") ||
    hasPermission(access.tenant.permissions, "inventory.stock.adjust");
  const canAdjust = hasPermission(
    access.tenant.permissions,
    "inventory.stock.adjust",
  );

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta sección."
          eyebrow="Inventario"
          title="Stock por producto"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [stock, products, warehouses] = await Promise.all([
    getInventoryStock(access.tenant),
    getProductsForInventory(access.tenant),
    getWarehouses(access.tenant),
  ]);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Usa esta pantalla para registrar entradas, salidas o ajustes manuales."
        eyebrow="Inventario"
        title="Stock por producto"
      />

      {params?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </p>
      ) : null}

      <InventoryMovementForm
        canAdjust={canAdjust}
        products={products.ok ? products.data : []}
        warehouses={warehouses.ok ? warehouses.data : []}
      />

      {!stock.ok ? (
        <EmptyState description={stock.error.message} title="No se pudo cargar" />
      ) : stock.data.length > 0 ? (
        <InventoryStockTable canAdjust={canAdjust} stock={stock.data} />
      ) : (
        <EmptyState
          description="Registra una entrada o ajuste para crear la primera fila de stock."
          title="Sin stock registrado"
        />
      )}
    </section>
  );
}
