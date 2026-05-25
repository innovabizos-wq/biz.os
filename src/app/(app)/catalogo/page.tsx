import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { CatalogSummaryCard } from "@/modules/catalog/components/catalog-summary-card";
import { canAccessCatalog, getCatalogSummary } from "@/modules/catalog/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function CatalogPage() {
  const access = await requireAdminAccess();

  if (!canAccessCatalog(access.tenant)) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta sección."
          eyebrow="Catálogo"
          title="Catálogo comercial"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const summary = await getCatalogSummary(access.tenant);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Productos y servicios comerciales por empresa."
        eyebrow="Catálogo"
        title="Catálogo comercial"
      />

      <div className="grid gap-4 md:grid-cols-4">
        <CatalogSummaryCard
          label="Productos"
          value={summary.ok ? summary.data.totalProductos : 0}
        />
        <CatalogSummaryCard
          label="Servicios"
          value={summary.ok ? summary.data.totalServicios : 0}
        />
        <CatalogSummaryCard
          label="Categorías activas"
          value={summary.ok ? summary.data.categoriasActivas : 0}
        />
        <CatalogSummaryCard
          label="Productos activos"
          value={summary.ok ? summary.data.productosActivos : 0}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link className={buttonVariants()} href="/catalogo/productos">
          Ver productos y servicios
        </Link>
        <Link
          className={buttonVariants({ variant: "outline" })}
          href="/catalogo/categorias"
        >
          Ver categorías
        </Link>
      </div>
    </section>
  );
}
