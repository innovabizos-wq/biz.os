import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { getCurrentTenantContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/permission-checks";
import {
  cancelPurchaseOrderAction,
  emitPurchaseOrderAction,
  receivePurchaseOrderAction,
} from "@/modules/purchases/actions";
import {
  getPurchaseOrderDetail,
  getPurchaseOrderItems,
  getPurchaseReceiptItems,
  getPurchaseReceipts,
} from "@/modules/purchases/queries";

type PurchaseOrderDetailPageProps = {
  params: Promise<{ ordenId: string }>;
  searchParams?: Promise<{ error?: string }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CR", {
    currency: "CRC",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "Sin fecha";

  return new Date(value).toLocaleString("es-CR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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

export default async function PurchaseOrderDetailPage({
  params,
  searchParams,
}: PurchaseOrderDetailPageProps) {
  const [{ ordenId }, query, tenantResult] = await Promise.all([
    params,
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
  let orderResult;
  let itemsResult;
  let receiptsResult;

  try {
    [orderResult, itemsResult, receiptsResult] = await Promise.all([
      getPurchaseOrderDetail(tenant, ordenId),
      getPurchaseOrderItems(tenant, ordenId),
      getPurchaseReceipts(tenant, ordenId),
    ]);
  } catch {
    notFound();
  }

  if (!orderResult.ok || !orderResult.data) {
    notFound();
  }

  const order = orderResult.data;
  const items = itemsResult.ok ? itemsResult.data : [];
  const receipts = receiptsResult.ok ? receiptsResult.data : [];
  let receiptItemsResult;

  try {
    receiptItemsResult = await getPurchaseReceiptItems(
      tenant,
      receipts.map((receipt) => receipt.id),
    );
  } catch {
    receiptItemsResult = { ok: false as const };
  }
  const receiptItems = receiptItemsResult.ok ? receiptItemsResult.data : [];
  const canManage = hasPermission(tenant.permissions, "purchases.orders.manage");
  const canAdjustInventory = hasPermission(tenant.permissions, "inventory.stock.adjust");
  const canReceive =
    canManage &&
    canAdjustInventory &&
    ["emitida", "parcial"].includes(order.estado) &&
    items.some((item) => item.cantidadPendiente > 0);

  return (
    <section className="space-y-6">
      <PageHeader
        actions={
          <Link className={buttonVariants({ variant: "outline" })} href="/compras">
            Volver a compras
          </Link>
        }
        description={`${order.supplierNombre ?? "Sin proveedor"} - ${order.bodegaNombre ?? "Sin bodega"} - ${statusLabel(order.estado)}`}
        eyebrow="Compras"
        title={order.numero}
      />

      {query?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Total", formatCurrency(order.total)],
          ["Estado", statusLabel(order.estado)],
          ["Items", items.length.toLocaleString("es-CR")],
          ["Recepciones", receipts.length.toLocaleString("es-CR")],
        ].map(([label, value]) => (
          <div className="rounded-lg border bg-background p-5" key={label}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <strong className="mt-2 block text-xl">{value}</strong>
          </div>
        ))}
      </div>

      {canManage ? (
        <div className="flex flex-wrap gap-3 rounded-lg border bg-background p-5">
          {order.estado === "borrador" ? (
            <form action={emitPurchaseOrderAction}>
              <input name="orderId" type="hidden" value={order.id} />
              <Button type="submit">Emitir orden</Button>
            </form>
          ) : null}
          {["borrador", "emitida"].includes(order.estado) ? (
            <form action={cancelPurchaseOrderAction}>
              <input name="orderId" type="hidden" value={order.id} />
              <Button type="submit" variant="destructive">Cancelar orden</Button>
            </form>
          ) : null}
          {!canAdjustInventory && ["emitida", "parcial"].includes(order.estado) ? (
            <p className="text-sm text-muted-foreground">
              Para recibir inventario necesitas permiso `inventory.stock.adjust`.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border bg-background">
        <div className="border-b p-5">
          <h2 className="text-base font-semibold">Items de la orden</h2>
        </div>
        {items.length === 0 ? (
          <div className="p-5">
            <EmptyState
              description="La orden no tiene items registrados."
              title="Sin items"
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">Producto</th>
                <th className="p-3 text-right">Ordenado</th>
                <th className="p-3 text-right">Recibido</th>
                <th className="p-3 text-right">Pendiente</th>
                <th className="p-3 text-right">Costo</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr className="border-t" key={item.id}>
                  <td className="p-3">
                    <strong>{item.productoNombre ?? item.descripcion}</strong>
                    {item.productoCodigo ? (
                      <span className="block text-muted-foreground">
                        {item.productoCodigo}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-3 text-right">{item.cantidad}</td>
                  <td className="p-3 text-right">{item.cantidadRecibida}</td>
                  <td className="p-3 text-right">{item.cantidadPendiente}</td>
                  <td className="p-3 text-right">
                    {formatCurrency(item.costoUnitario)}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canReceive ? (
        <form action={receivePurchaseOrderAction} className="rounded-lg border bg-background p-5">
          <h2 className="text-base font-semibold">Registrar recepcion</h2>
          <input name="orderId" type="hidden" value={order.id} />
          <div className="mt-4 grid gap-3">
            {items
              .filter((item) => item.cantidadPendiente > 0)
              .map((item) => (
                <div className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_0.35fr]" key={item.id}>
                  <div>
                    <strong>{item.productoNombre ?? item.descripcion}</strong>
                    <p className="text-sm text-muted-foreground">
                      Pendiente: {item.cantidadPendiente}
                    </p>
                    <input name="itemId" type="hidden" value={item.id} />
                  </div>
                  <input
                    className="rounded-md border bg-background px-3 py-2"
                    max={item.cantidadPendiente}
                    min="0"
                    name="cantidad"
                    placeholder="Cantidad"
                    step="0.01"
                    type="number"
                  />
                </div>
              ))}
            <textarea className="min-h-20 rounded-md border bg-background px-3 py-2" name="notas" placeholder="Notas de recepcion" />
            <Button type="submit">Guardar recepcion</Button>
          </div>
        </form>
      ) : null}

      <div className="rounded-lg border bg-background p-5">
        <h2 className="text-base font-semibold">Historial de recepciones</h2>
        <div className="mt-4 grid gap-3">
          {receipts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay recepciones registradas.</p>
          ) : (
            receipts.map((receipt) => {
              const lines = receiptItems.filter((item) => item.receiptId === receipt.id);

              return (
                <article className="rounded-md border p-3" key={receipt.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <strong>{receipt.numero}</strong>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(receipt.receivedAt)} -{" "}
                        {receipt.bodegaNombre ?? "Sin bodega"}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {receipt.receivedByNombre ?? "Sistema"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
                    {lines.map((line) => (
                      <span key={line.id}>
                        {line.cantidad} x {line.productoNombre ?? "Producto"} -{" "}
                        {formatCurrency(line.total)}
                      </span>
                    ))}
                  </div>
                  {receipt.notas ? (
                    <p className="mt-3 text-sm text-muted-foreground">{receipt.notas}</p>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
