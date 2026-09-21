import { randomUUID } from "node:crypto";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  applySalesReturnInventoryAction,
  createSalesReturnAction,
  prepareSalesReturnCreditNoteAction,
  settleSalesReturnFinancialAction,
} from "@/modules/sales-returns/actions";
import type { SalesReturn } from "@/modules/sales-returns/types";
import type { SaleInventoryWarehouse } from "@/modules/sales-inventory/types";
import type { Sale, SaleItem } from "@/modules/sales/types";

type SaleReturnsPanelProps = {
  canCreate: boolean;
  canProcessFinancial: boolean;
  canPrepareCreditNote: boolean;
  canReturnInventory: boolean;
  loadError?: string | null;
  returns: SalesReturn[];
  sale: Sale;
  saleItems: SaleItem[];
  warehouses: SaleInventoryWarehouse[];
};

const effectLabels = {
  accepted: "Aceptado",
  error_validation: "Requiere corrección",
  not_required: "No aplica",
  pending: "Pendiente",
  prepared: "Preparado",
  processed: "Procesado",
  processing: "Procesando",
  rejected: "Rechazado",
  uncertain: "Por confirmar",
} as const;

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", { currency, style: "currency" }).format(value);
}

function effectLabel(status: keyof typeof effectLabels) {
  return effectLabels[status];
}

function effectVariant(status: keyof typeof effectLabels) {
  if (status === "accepted" || status === "processed") return "default" as const;
  if (status === "rejected" || status === "error_validation") return "destructive" as const;
  if (status === "not_required") return "outline" as const;
  return "secondary" as const;
}

export function SaleReturnsPanel({
  canCreate,
  canProcessFinancial,
  canPrepareCreditNote,
  canReturnInventory,
  loadError,
  returns,
  sale,
  saleItems,
  warehouses,
}: SaleReturnsPanelProps) {
  const returnedByItem = new Map<string, number>();
  for (const salesReturn of returns) {
    if (salesReturn.status === "cancelled") continue;
    for (const item of salesReturn.items) {
      returnedByItem.set(
        item.saleItemId,
        (returnedByItem.get(item.saleItemId) ?? 0) + item.quantity,
      );
    }
  }

  const returnableItems = saleItems
    .map((item) => ({
      ...item,
      availableQuantity: Math.max(item.cantidad - (returnedByItem.get(item.id) ?? 0), 0),
    }))
    .filter((item) => item.availableQuantity > 0);
  const saleAllowsReturns = ["confirmada", "en_proceso", "completada"].includes(sale.estado);
  const showCreate = canCreate && saleAllowsReturns && returnableItems.length > 0 && !loadError;

  return (
    <section className="space-y-4">
      <div className="rounded-lg border bg-background p-5">
        <p className="font-semibold">Devoluciones</p>
        <p className="mt-1 text-sm text-muted-foreground">
          El crédito o reembolso, el reintegro físico y la nota de crédito fiscal se confirman
          por separado. Repetir una confirmación no duplica sus efectos.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {loadError} La creación queda bloqueada hasta recuperar el historial.
        </p>
      ) : null}

      {showCreate ? (
        <form action={createSalesReturnAction} className="space-y-4 rounded-lg border bg-background p-5">
          <input name="operationId" type="hidden" value={randomUUID()} />
          <input name="saleId" type="hidden" value={sale.id} />
          <div>
            <p className="font-medium">Registrar devolución parcial o total</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Indica únicamente las cantidades que el cliente devuelve en esta operación.
            </p>
          </div>
          <div className="space-y-3">
            {returnableItems.map((item) => (
              <div
                className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_9rem] sm:items-end"
                key={item.id}
              >
                <div>
                  <label className="text-sm font-medium" htmlFor={`return-quantity-${item.id}`}>
                    {item.descripcion}
                  </label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Disponible para devolver: {item.availableQuantity} de {item.cantidad}
                  </p>
                </div>
                <Input
                  id={`return-quantity-${item.id}`}
                  max={item.availableQuantity}
                  min="0"
                  name={`quantity:${item.id}`}
                  placeholder="0"
                  step="0.01"
                  type="number"
                />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`return-reason-${sale.id}`}>
              Motivo
            </label>
            <Textarea
              id={`return-reason-${sale.id}`}
              maxLength={500}
              minLength={3}
              name="reason"
              placeholder="Describe por qué se realiza la devolución."
              required
            />
          </div>
          <Button type="submit">Registrar devolución</Button>
        </form>
      ) : null}

      {!loadError && !showCreate && returns.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background p-5 text-sm text-muted-foreground">
          {returnableItems.length === 0
            ? "Todos los artículos ya fueron devueltos."
            : saleAllowsReturns
              ? "No tienes permiso para registrar devoluciones."
              : "La venta debe estar confirmada, en proceso o completada para admitir devoluciones."}
        </div>
      ) : null}

      {returns.map((salesReturn) => (
        <article className="space-y-4 rounded-lg border bg-background p-5" key={salesReturn.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-semibold">{salesReturn.number}</p>
              <p className="mt-1 text-sm text-muted-foreground">{salesReturn.reason}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(salesReturn.createdAt).toLocaleString("es-CR")}
              </p>
            </div>
            <p className="text-lg font-semibold">
              {formatMoney(salesReturn.totalAmount, salesReturn.currencyCode)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Financiero</p>
              <Badge
                className="mt-2"
                variant={effectVariant(salesReturn.financialStatus)}
              >
                {effectLabel(salesReturn.financialStatus)}
              </Badge>
              {salesReturn.financialStatus === "processed" ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Crédito {formatMoney(salesReturn.creditedAmount, salesReturn.currencyCode)} ·
                  Reembolso {formatMoney(salesReturn.refundedAmount, salesReturn.currencyCode)}
                </p>
              ) : null}
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Inventario</p>
              <Badge
                className="mt-2"
                variant={effectVariant(salesReturn.inventoryStatus)}
              >
                {effectLabel(salesReturn.inventoryStatus)}
              </Badge>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Fiscal</p>
              <Badge className="mt-2" variant={effectVariant(salesReturn.fiscalStatus)}>
                {effectLabel(salesReturn.fiscalStatus)}
              </Badge>
              {salesReturn.fiscalDocumentId ? (
                <Link
                  className="mt-2 block text-xs font-medium underline"
                  href={`/facturacion/documentos/${salesReturn.fiscalDocumentId}`}
                >
                  Ver nota de crédito
                </Link>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            {salesReturn.items.map((item) => (
              <div className="flex justify-between gap-4 text-sm" key={item.id}>
                <span>
                  {item.quantity} × {item.description}
                </span>
                <span>{formatMoney(item.totalAmount, salesReturn.currencyCode)}</span>
              </div>
            ))}
          </div>

          {salesReturn.financialStatus === "pending" && canProcessFinancial ? (
            <form
              action={settleSalesReturnFinancialAction}
              className="grid gap-3 rounded-md border bg-muted/30 p-4 md:grid-cols-2"
            >
              <input name="operationId" type="hidden" value={randomUUID()} />
              <input name="returnId" type="hidden" value={salesReturn.id} />
              <input name="saleId" type="hidden" value={sale.id} />
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor={`refund-method-${salesReturn.id}`}>
                  Medio del reembolso, si corresponde
                </label>
                <select
                  className="h-8 w-full rounded-lg border bg-background px-2.5 text-sm"
                  defaultValue="cash"
                  id={`refund-method-${salesReturn.id}`}
                  name="method"
                >
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="sinpe">SINPE</option>
                  <option value="transfer">Transferencia</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor={`refund-reference-${salesReturn.id}`}>
                  Referencia
                </label>
                <Input id={`refund-reference-${salesReturn.id}`} maxLength={160} name="reference" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium" htmlFor={`refund-notes-${salesReturn.id}`}>
                  Notas
                </label>
                <Input id={`refund-notes-${salesReturn.id}`} maxLength={1000} name="notes" />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Aplicar crédito y reembolso</Button>
              </div>
            </form>
          ) : null}

          {salesReturn.inventoryStatus === "pending" && canReturnInventory ? (
            <form
              action={applySalesReturnInventoryAction}
              className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-4"
            >
              <input name="operationId" type="hidden" value={randomUUID()} />
              <input name="returnId" type="hidden" value={salesReturn.id} />
              <input name="saleId" type="hidden" value={sale.id} />
              <div className="min-w-64 flex-1 space-y-2">
                <label className="text-sm font-medium" htmlFor={`return-warehouse-${salesReturn.id}`}>
                  Bodega que recibe la mercancía
                </label>
                <select
                  className="h-8 w-full rounded-lg border bg-background px-2.5 text-sm"
                  id={`return-warehouse-${salesReturn.id}`}
                  name="warehouseId"
                  required
                >
                  <option value="">Selecciona una bodega</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <Button disabled={warehouses.length === 0} type="submit" variant="outline">
                Reintegrar inventario
              </Button>
            </form>
          ) : null}

          {salesReturn.fiscalStatus === "pending" && canPrepareCreditNote ? (
            <form
              action={prepareSalesReturnCreditNoteAction}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-4"
            >
              <input name="operationId" type="hidden" value={randomUUID()} />
              <input name="returnId" type="hidden" value={salesReturn.id} />
              <input name="saleId" type="hidden" value={sale.id} />
              <p className="text-sm text-muted-foreground">
                La nota de crédito conservará los datos fiscales del comprobante aceptado original.
              </p>
              <Button type="submit" variant="outline">
                Preparar nota de crédito
              </Button>
            </form>
          ) : null}
        </article>
      ))}
    </section>
  );
}
