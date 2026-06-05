import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { CategoriesTable } from "@/modules/catalog/components/categories-table";
import { CategoryForm } from "@/modules/catalog/components/category-form";
import { getCategories } from "@/modules/catalog/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type CatalogCategoriesPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function CatalogCategoriesPage({
  searchParams,
}: CatalogCategoriesPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canView = hasPermission(
    access.tenant.permissions,
    "catalog.categories.view",
  );
  const canCreate = hasPermission(
    access.tenant.permissions,
    "catalog.categories.create",
  );
  const canEdit = hasPermission(
    access.tenant.permissions,
    "catalog.categories.edit",
  );

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta sección."
          eyebrow="Catálogo"
          title="Categorías"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const categories = await getCategories(access.tenant);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Categorias simples para organizar productos y servicios."
        eyebrow="Catálogo"
        title="Categorias"
      />

      <EphemeralPageAlert error={params?.error} />

      {canCreate ? <CategoryForm mode="create" /> : null}

      {!categories.ok ? (
        <EmptyState
          description={categories.error.message}
          title="No se pudo cargar"
        />
      ) : categories.data.length > 0 ? (
        <CategoriesTable canEdit={canEdit} categories={categories.data} />
      ) : (
        <EmptyState
          description="Aun no hay categorias visibles."
          title="Sin categorias"
        />
      )}
    </section>
  );
}
