import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants, Button } from "@/components/ui/button";
import { hasPermission } from "@/lib/permissions/permission-checks";
import {
  DEFAULT_PRODUCT_STATUS_FILTER,
  DEFAULT_PRODUCT_TYPE_FILTER,
} from "@/modules/catalog/constants";
import { ProductsTable } from "@/modules/catalog/components/products-table";
import {
  catalogProductStatusFilterSchema,
  catalogProductTypeFilterSchema,
} from "@/modules/catalog/schemas";
import { getProducts } from "@/modules/catalog/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type CatalogProductsPageProps = {
  searchParams?: Promise<{ estado?: string; error?: string; tipo?: string }>;
};

export default async function CatalogProductsPage({
  searchParams,
}: CatalogProductsPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canView = hasPermission(access.tenant.permissions, "catalog.products.view");
  const canCreate = hasPermission(
    access.tenant.permissions,
    "catalog.products.create",
  );
  const type =
    catalogProductTypeFilterSchema.safeParse(params?.tipo).data ??
    DEFAULT_PRODUCT_TYPE_FILTER;
  const status =
    catalogProductStatusFilterSchema.safeParse(params?.estado).data ??
    DEFAULT_PRODUCT_STATUS_FILTER;

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta sección."
          eyebrow="Catálogo"
          title="Productos y servicios"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const products = await getProducts(access.tenant, type, status);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description="Catálogo comercial básico conectado a cotizaciones."
          eyebrow="Catálogo"
          title="Productos y servicios"
        />
        {canCreate ? (
          <Link className={buttonVariants()} href="/catalogo/productos/nuevo">
            Nuevo producto/servicio
          </Link>
        ) : null}
      </div>

      {params?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </p>
      ) : null}

      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-background p-4" method="get">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Tipo</span>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            defaultValue={type}
            name="tipo"
          >
            <option value="todos">Todos</option>
            <option value="producto">Producto</option>
            <option value="servicio">Servicio</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Estado</span>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            defaultValue={status}
            name="estado"
          >
            <option value="todos">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </label>
        <Button type="submit">Filtrar</Button>
      </form>

      {!products.ok ? (
        <EmptyState description={products.error.message} title="No se pudo cargar" />
      ) : products.data.length > 0 ? (
        <ProductsTable products={products.data} />
      ) : (
        <EmptyState
          description="Aun no hay productos o servicios visibles."
          title="Sin productos"
        />
      )}
    </section>
  );
}
