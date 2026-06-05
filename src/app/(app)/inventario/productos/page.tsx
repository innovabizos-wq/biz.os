import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { getActiveCategoriesForProductForm } from "@/modules/catalog/queries";
import { InventoryMovementForm } from "@/modules/inventory/components/inventory-movement-form";
import { InventoryStockTable } from "@/modules/inventory/components/inventory-stock-table";
import { InventoryTransferForm } from "@/modules/inventory/components/inventory-transfer-form";
import { MaterialIntakePanel } from "@/modules/inventory/components/material-intake-panel";
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
  const canCreateProducts = hasPermission(
    access.tenant.permissions,
    "catalog.products.create",
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

  const [stock, products, warehouses, categories] = await Promise.all([
    getInventoryStock(access.tenant),
    getProductsForInventory(access.tenant),
    getWarehouses(access.tenant),
    getActiveCategoriesForProductForm(access.tenant),
  ]);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Crea materiales, importa inventarios, ajusta stock y traslada existencias entre bodegas."
        eyebrow="Inventario"
        title="Stock por producto"
      />

      <EphemeralPageAlert error={params?.error} />

      <MaterialIntakePanel
        canAdjust={canAdjust}
        canCreateProducts={canCreateProducts}
        categories={categories.ok ? categories.data : []}
        warehouses={warehouses.ok ? warehouses.data : []}
      />

      <InventoryMovementForm
        canAdjust={canAdjust}
        products={products.ok ? products.data : []}
        warehouses={warehouses.ok ? warehouses.data : []}
      />

      <InventoryTransferForm
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
