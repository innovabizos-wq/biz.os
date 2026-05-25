import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { ProductForm } from "@/modules/catalog/components/product-form";
import { getActiveCategoriesForProductForm } from "@/modules/catalog/queries";
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

  const categories = await getActiveCategoriesForProductForm(access.tenant);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Crea un producto o servicio comercial sin inventario."
        eyebrow="Catálogo"
        title="Nuevo producto/servicio"
      />

      {params?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </p>
      ) : null}

      <ProductForm
        categories={categories.ok ? categories.data : []}
        mode="create"
      />
    </section>
  );
}
