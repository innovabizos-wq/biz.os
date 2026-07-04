import Link from "next/link";
import { PackagePlus } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { getCurrentTenantContext } from "@/lib/auth/session";
import { getProductsForInventory, getWarehouses } from "@/modules/inventory/queries";
import {
  createPurchaseOrderAction,
  createSupplierAction,
  updateSupplierStatusAction,
} from "@/modules/purchases/actions";
import {
  canManagePurchases,
  getPurchaseOrderItems,
  getPurchaseOrders,
  getPurchaseSuppliers,
} from "@/modules/purchases/queries";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseSupplier,
  PurchasesSummary,
} from "@/modules/purchases/types";
import { redirect } from "next/navigation";

type PurchasesPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CR", {
    currency: "CRC",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";

  return new Date(value).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    borrador: "Borrador",
    cancelada: "Cancelada",
    emitida: "Emitida",
    parcial: "Recepcion parcial",
    recibida: "Recibida",
  };

  return labels[status] ?? status;
}

function buildPurchasesSummary(
  suppliers: PurchaseSupplier[],
  orders: PurchaseOrder[],
  items: PurchaseOrderItem[],
): PurchasesSummary {
  const openOrderIds = new Set(
    orders
      .filter((order) => ["emitida", "parcial"].includes(order.estado))
      .map((order) => order.id),
  );

  return {
    ordenesBorrador: orders.filter((order) => order.estado === "borrador").length,
    ordenesEmitidas: orders.filter((order) => order.estado === "emitida").length,
    ordenesParciales: orders.filter((order) => order.estado === "parcial").length,
    ordenesRecibidas: orders.filter((order) => order.estado === "recibida").length,
    proveedoresActivos: suppliers.filter((supplier) => supplier.estado === "activo").length,
    totalComprado: orders
      .filter((order) => order.estado === "recibida")
      .reduce((sum, order) => sum + order.total, 0),
    totalPendienteRecepcion: items
      .filter((item) => openOrderIds.has(item.orderId))
      .reduce((sum, item) => sum + item.cantidadPendiente * item.costoUnitario, 0),
  };
}

export default async function PurchasesPage({ searchParams }: PurchasesPageProps) {
  const [params, tenantResult] = await Promise.all([
    searchParams,
    getCurrentTenantContext(),
  ]);

  if (!tenantResult.ok) {
    redirect("/login");
  }

  if (!tenantResult.data) {
    redirect("/onboarding");
  }

  const tenant = tenantResult.data;
  let suppliersResult;
  let ordersResult;
  let itemsResult;
  let productsResult;
  let warehousesResult;

  try {
    [suppliersResult, ordersResult, itemsResult, productsResult, warehousesResult] =
      await Promise.all([
        getPurchaseSuppliers(tenant),
        getPurchaseOrders(tenant),
        getPurchaseOrderItems(tenant),
        getProductsForInventory(tenant),
        getWarehouses(tenant),
      ]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo cargar compras.";

    return (
      <section className="space-y-6">
        <PageHeader description={message} eyebrow="Operacion" title="Compras" />
      </section>
    );
  }

  if (!ordersResult.ok || !suppliersResult.ok) {
    const message = !ordersResult.ok
      ? ordersResult.error.message
      : !suppliersResult.ok
        ? suppliersResult.error.message
        : "No se pudo cargar compras.";

    return (
      <section className="space-y-6">
        <PageHeader description={message} eyebrow="Operacion" title="Compras" />
      </section>
    );
  }

  const canManage = canManagePurchases(tenant);
  const suppliers = suppliersResult.data;
  const activeSuppliers = suppliers.filter((supplier) => supplier.estado === "activo");
  const orders = ordersResult.data;
  const orderItems = itemsResult.ok ? itemsResult.data : [];
  const products = productsResult.ok ? productsResult.data : [];
  const warehouses = warehousesResult.ok
    ? warehousesResult.data.filter((warehouse) => warehouse.estado === "activa")
    : [];
  const summary = buildPurchasesSummary(suppliers, orders, orderItems);

  return (
    <section className="space-y-6">
      <PageHeader
        description="Proveedores, ordenes multi-item, recepciones parciales e inventario."
        eyebrow="Operacion"
        title="Compras y proveedores"
      />

      {params?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Proveedores activos", summary.proveedoresActivos.toLocaleString("es-CR")],
          [
            "Ordenes abiertas",
            (summary.ordenesEmitidas + summary.ordenesParciales).toLocaleString("es-CR"),
          ],
          ["Pendiente recepcion", formatCurrency(summary.totalPendienteRecepcion)],
          ["Total recibido", formatCurrency(summary.totalComprado)],
        ].map(([label, value]) => (
          <div className="rounded-lg border bg-background p-5 shadow-sm" key={label}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <strong className="mt-2 block text-2xl">{value}</strong>
          </div>
        ))}
      </div>

      {canManage ? (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
          <div className="space-y-4">
            <form action={createSupplierAction} className="rounded-lg border bg-background p-5">
              <h2 className="text-base font-semibold">Nuevo proveedor</h2>
              <div className="mt-4 grid gap-3">
                <input className="rounded-md border bg-background px-3 py-2" name="nombre" placeholder="Nombre" required />
                <input className="rounded-md border bg-background px-3 py-2" name="identificacion" placeholder="Identificacion" />
                <div className="grid gap-3 md:grid-cols-2">
                  <input className="rounded-md border bg-background px-3 py-2" name="correo" placeholder="Correo" />
                  <input className="rounded-md border bg-background px-3 py-2" name="telefono" placeholder="Telefono" />
                </div>
                <input className="rounded-md border bg-background px-3 py-2" name="direccion" placeholder="Direccion" />
                <Button type="submit">Crear proveedor</Button>
              </div>
            </form>

            <div className="rounded-lg border bg-background p-5">
              <h2 className="text-base font-semibold">Proveedores</h2>
              <div className="mt-4 grid gap-3">
                {suppliers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay proveedores.</p>
                ) : (
                  suppliers.slice(0, 8).map((supplier) => (
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                      key={supplier.id}
                    >
                      <div>
                        <strong>{supplier.nombre}</strong>
                        <p className="text-sm text-muted-foreground">
                          {supplier.correo ?? supplier.telefono ?? "Sin contacto"} -{" "}
                          {supplier.estado}
                        </p>
                      </div>
                      <form action={updateSupplierStatusAction}>
                        <input name="supplierId" type="hidden" value={supplier.id} />
                        <input
                          name="estado"
                          type="hidden"
                          value={supplier.estado === "activo" ? "inactivo" : "activo"}
                        />
                        <Button size="sm" type="submit" variant="outline">
                          {supplier.estado === "activo" ? "Inactivar" : "Activar"}
                        </Button>
                      </form>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <form action={createPurchaseOrderAction} className="rounded-lg border bg-background p-5">
            <h2 className="text-base font-semibold">Nueva orden de compra</h2>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 md:grid-cols-3">
                <select className="rounded-md border bg-background px-3 py-2" name="supplierId" required>
                  <option value="">Proveedor</option>
                  {activeSuppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.nombre}
                    </option>
                  ))}
                </select>
                <select className="rounded-md border bg-background px-3 py-2" name="bodegaId" required>
                  <option value="">Bodega de recepcion</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.nombre}
                    </option>
                  ))}
                </select>
                <select className="rounded-md border bg-background px-3 py-2" name="estado">
                  <option value="emitida">Emitir de inmediato</option>
                  <option value="borrador">Guardar borrador</option>
                </select>
              </div>
              {[0, 1, 2, 3, 4].map((index) => (
                <div className="grid gap-3 rounded-md border p-3 md:grid-cols-[1.2fr_1.4fr_0.6fr_0.7fr_0.5fr]" key={index}>
                  <select className="rounded-md border bg-background px-3 py-2" name="productoId">
                    <option value="">Producto</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.codigo ? `${product.codigo} - ` : ""}
                        {product.nombre}
                      </option>
                    ))}
                  </select>
                  <input className="rounded-md border bg-background px-3 py-2" name="descripcion" placeholder="Descripcion opcional" />
                  <input className="rounded-md border bg-background px-3 py-2" min="0" name="cantidad" placeholder="Cant." step="0.01" type="number" />
                  <input className="rounded-md border bg-background px-3 py-2" min="0" name="costoUnitario" placeholder="Costo" step="0.01" type="number" />
                  <input className="rounded-md border bg-background px-3 py-2" min="0" name="impuestoPorcentaje" placeholder="Imp %" step="0.01" type="number" />
                </div>
              ))}
              <textarea className="min-h-20 rounded-md border bg-background px-3 py-2" name="notas" placeholder="Notas internas" />
              <Button type="submit">
                <PackagePlus aria-hidden={true} size={16} />
                Crear orden multi-item
              </Button>
              {activeSuppliers.length === 0 || products.length === 0 || warehouses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Para crear ordenes necesitas al menos un proveedor activo, un producto
                  activo y una bodega activa.
                </p>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}

      {orders.length === 0 ? (
        <EmptyState
          description="Crea una orden multi-item para recibir inventario con trazabilidad y generar cuentas por pagar."
          title="No hay ordenes de compra"
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-background">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">Orden</th>
                <th className="p-3">Proveedor</th>
                <th className="p-3">Bodega</th>
                <th className="p-3">Items</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Accion</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const items = orderItems.filter((item) => item.orderId === order.id);
                const pendingItems = items.filter((item) => item.cantidadPendiente > 0);

                return (
                  <tr className="border-t align-top" key={order.id}>
                    <td className="p-3">
                      <strong>{order.numero}</strong>
                      <span className="block text-muted-foreground">
                        {formatDate(order.fechaOrden)}
                      </span>
                    </td>
                    <td className="p-3">{order.supplierNombre ?? "Sin proveedor"}</td>
                    <td className="p-3">{order.bodegaNombre ?? "Sin bodega"}</td>
                    <td className="p-3">
                      {items.slice(0, 3).map((item) => (
                        <span className="block text-muted-foreground" key={item.id}>
                          {item.cantidadRecibida}/{item.cantidad} -{" "}
                          {item.productoNombre ?? item.descripcion}
                        </span>
                      ))}
                      {items.length > 3 ? (
                        <span className="text-muted-foreground">
                          +{items.length - 3} mas
                        </span>
                      ) : null}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="p-3">{statusLabel(order.estado)}</td>
                    <td className="p-3">
                      <Link
                        className={buttonVariants({ size: "sm", variant: "outline" })}
                        href={`/compras/ordenes/${order.id}`}
                      >
                        {pendingItems.length > 0 ? "Recibir" : "Ver"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
