import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { ServerPagination } from "@/components/shared/server-pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { getActiveCategoriesForProductForm } from "@/modules/catalog/queries";
import { InventoryMovementForm } from "@/modules/inventory/components/inventory-movement-form";
import { InventoryStockTable } from "@/modules/inventory/components/inventory-stock-table";
import { InventoryTransferForm } from "@/modules/inventory/components/inventory-transfer-form";
import { MaterialIntakePanel } from "@/modules/inventory/components/material-intake-panel";
import {
  getInventoryStockPage,
  getProductsForInventory,
  getWarehouses,
} from "@/modules/inventory/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type InventoryProductsPageProps = {
  searchParams?: Promise<{ error?: string; page?: string; producto?: string }>;
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
  const requestedPage = Math.max(1, Number.parseInt(params?.page ?? "1", 10) || 1);
  const productQuery = params?.producto?.trim() ?? "";

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
    getInventoryStockPage(access.tenant, requestedPage),
    getProductsForInventory(access.tenant, { limit: 100, query: productQuery }),
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

      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-background p-4" method="get">
        <label className="min-w-64 flex-1 space-y-1 text-sm">
          <span className="font-medium">Producto para operar</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue={productQuery}
            name="producto"
            placeholder="Nombre o codigo"
            type="search"
          />
        </label>
        <Button type="submit">Buscar</Button>
      </form>

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
      ) : stock.data.items.length > 0 ? (
        <>
          <InventoryStockTable canAdjust={canAdjust} stock={stock.data.items} />
          <ServerPagination
            currentPage={stock.data.page}
            pageSize={stock.data.pageSize}
            pathname="/inventario/productos"
            query={{ producto: productQuery || undefined }}
            totalItems={stock.data.total}
          />
        </>
      ) : (
        <EmptyState
          description="Registra una entrada o ajuste para crear la primera fila de stock."
          title="Sin stock registrado"
        />
      )}
    </section>
  );
}
