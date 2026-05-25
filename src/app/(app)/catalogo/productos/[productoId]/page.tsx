import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { ProductForm } from "@/modules/catalog/components/product-form";
import { ProductStatusForm } from "@/modules/catalog/components/product-status-form";
import {
  getActiveCategoriesForProductForm,
  getProductDetail,
} from "@/modules/catalog/queries";
import { getStockForProduct } from "@/modules/inventory/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import Link from "next/link";

type CatalogProductDetailPageProps = {
  params: Promise<{ productoId: string }>;
  searchParams?: Promise<{ error?: string }>;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", {
    currency,
    style: "currency",
  }).format(value);
}

export default async function CatalogProductDetailPage({
  params,
  searchParams,
}: CatalogProductDetailPageProps) {
  const [{ productoId }, query, access] = await Promise.all([
    params,
    searchParams,
    requireAdminAccess(),
  ]);
  const canView = hasPermission(access.tenant.permissions, "catalog.products.view");
  const canEdit = hasPermission(access.tenant.permissions, "catalog.products.edit");
  const canViewInventory =
    hasPermission(access.tenant.permissions, "inventory.stock.view") ||
    hasPermission(access.tenant.permissions, "inventory.stock.adjust");

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta sección."
          eyebrow="Catálogo"
          title="Producto/servicio"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [product, categories, productStock] = await Promise.all([
    getProductDetail(access.tenant, productoId),
    getActiveCategoriesForProductForm(access.tenant),
    canViewInventory ? getStockForProduct(access.tenant, productoId) : null,
  ]);

  if (!product.ok || !product.data) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description="Detalle comercial sin stock, bodegas ni costos avanzados."
          eyebrow="Catálogo"
          title={product.data.nombre}
        />
        <ProductStatusForm canEdit={canEdit} product={product.data} />
      </div>

      {query?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Tipo</p>
          <p className="mt-2 font-semibold">{product.data.tipo}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Estado</p>
          <p className="mt-2 font-semibold">{product.data.estado}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Precio base</p>
          <p className="mt-2 font-semibold">
            {formatMoney(product.data.precioBase, product.data.moneda)}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Impuesto sugerido</p>
          <p className="mt-2 font-semibold">{product.data.impuestoPorcentaje}%</p>
        </div>
      </div>

      {canEdit ? (
        <ProductForm
          categories={categories.ok ? categories.data : []}
          mode="update"
          product={product.data}
        />
      ) : null}

      <div className="rounded-lg border bg-background p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">Inventario</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {product.data.tipo === "producto"
                ? "Stock manual por bodega para productos físicos."
                : "Los servicios no manejan inventario."}
            </p>
          </div>
          {product.data.tipo === "producto" && canViewInventory ? (
            <Link
              className="text-sm font-medium text-primary hover:underline"
              href="/inventario/productos"
            >
              Ver inventario
            </Link>
          ) : null}
        </div>
        {product.data.tipo === "producto" && canViewInventory ? (
          productStock?.ok && productStock.data.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Bodega</th>
                    <th className="px-3 py-2">Cantidad</th>
                    <th className="px-3 py-2">Minimo</th>
                    <th className="px-3 py-2">Maximo</th>
                  </tr>
                </thead>
                <tbody>
                  {productStock.data.map((stock) => (
                    <tr className="border-t" key={stock.id}>
                      <td className="px-3 py-2">
                        {stock.bodegaNombre ?? "Bodega"}
                      </td>
                      <td className="px-3 py-2">{stock.cantidad}</td>
                      <td className="px-3 py-2">{stock.stockMinimo}</td>
                      <td className="px-3 py-2">{stock.stockMaximo ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Sin stock registrado para este producto.
            </p>
          )
        ) : null}
      </div>

      <div className="rounded-lg border border-dashed bg-background p-5 text-sm text-muted-foreground">
        Este producto puede usarse en cotizaciones. Compras, costos avanzados y
        automatizaciones de stock se implementarán en fases posteriores.
      </div>
    </section>
  );
}
