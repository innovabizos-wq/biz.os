import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { ProductForm } from "@/modules/catalog/components/product-form";
import { getActiveCategoriesForProductForm } from "@/modules/catalog/queries";
import { getWarehouses } from "@/modules/inventory/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type NewCatalogProductPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function NewCatalogProductPage({
  searchParams,
}: NewCatalogProductPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canCreate = hasPermission(
    access.tenant.permissions,
    "catalog.products.create",
  );

  if (!canCreate) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para crear productos o servicios."
          eyebrow="Catálogo"
          title="Nuevo producto/servicio"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const canSetInitialStock =
    isModuleActive(access.tenant.activeModules, "inventory") &&
    hasPermission(access.tenant.permissions, "inventory.stock.adjust");
  const [categories, warehouses] = await Promise.all([
    getActiveCategoriesForProductForm(access.tenant),
    canSetInitialStock ? getWarehouses(access.tenant) : null,
  ]);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Crea un producto o servicio. Si aplica, registra stock inicial en una bodega activa."
        eyebrow="Catálogo"
        title="Nuevo producto/servicio"
      />

      <EphemeralPageAlert error={params?.error} />

      <ProductForm
        canSetInitialStock={canSetInitialStock}
        categories={categories.ok ? categories.data : []}
        mode="create"
        warehouses={warehouses?.ok ? warehouses.data : []}
      />
    </section>
  );
}
