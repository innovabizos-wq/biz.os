import { randomUUID } from "node:crypto";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  applyPurchaseReturnInventoryAction,
  createPurchaseReturnAction,
  settlePurchaseReturnFinancialAction,
} from "@/modules/purchase-returns/actions";
import type { PurchaseReturn } from "@/modules/purchase-returns/types";
import type {
  PurchaseOrder,
  PurchaseReceipt,
  PurchaseReceiptItem,
} from "@/modules/purchases/types";

type PurchaseReturnsPanelProps = {
  canCreate: boolean;
  canProcessFinancial: boolean;
  canReturnInventory: boolean;
  loadError?: string | null;
  order: PurchaseOrder;
  receiptItems: PurchaseReceiptItem[];
  receipts: PurchaseReceipt[];
  returns: PurchaseReturn[];
};

const effectLabels = {
  not_required: "No aplica",
  pending: "Pendiente",
  processed: "Procesado",
} as const;

function effectVariant(status: keyof typeof effectLabels) {
  if (status === "processed") return "default" as const;
  if (status === "not_required") return "outline" as const;
  return "secondary" as const;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", { currency, style: "currency" }).format(value);
}

export function PurchaseReturnsPanel({
  canCreate,
  canProcessFinancial,
  canReturnInventory,
  loadError,
  order,
  receiptItems,
  receipts,
  returns,
}: PurchaseReturnsPanelProps) {
  const returnedByReceiptItem = new Map<string, number>();
  for (const purchaseReturn of returns) {
    if (purchaseReturn.status === "cancelled") continue;
    for (const item of purchaseReturn.items) {
      returnedByReceiptItem.set(
        item.receiptItemId,
        (returnedByReceiptItem.get(item.receiptItemId) ?? 0) + item.quantity,
      );
    }
  }

  const receiptNumbers = new Map(receipts.map((receipt) => [receipt.id, receipt.numero]));
  const returnableItems = receiptItems
    .map((item) => ({
      ...item,
      availableQuantity: Math.max(
        item.cantidad - (returnedByReceiptItem.get(item.id) ?? 0),
        0,
      ),
      receiptNumber: receiptNumbers.get(item.receiptId) ?? "Recepción",
    }))
    .filter((item) => item.availableQuantity > 0);
  const showCreate = canCreate && returnableItems.length > 0 && !loadError;

  return (
    <section className="space-y-4">
      <div className="rounded-lg border bg-background p-5">
        <p className="font-semibold">Devoluciones al proveedor</p>
        <p className="mt-1 text-sm text-muted-foreground">
          La salida física y el ajuste de la cuenta por pagar se confirman por separado.
          Cada confirmación puede repetirse con seguridad sin duplicar existencias ni saldos.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {loadError} La creación queda bloqueada hasta recuperar el historial.
        </p>
      ) : null}

      {showCreate ? (
        <form
          action={createPurchaseReturnAction}
          className="space-y-4 rounded-lg border bg-background p-5"
        >
          <input name="operationId" type="hidden" value={randomUUID()} />
          <input name="orderId" type="hidden" value={order.id} />
          <div>
            <p className="font-medium">Registrar devolución parcial o total</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Las cantidades disponibles provienen de recepciones reales y descuentan
              devoluciones anteriores.
            </p>
          </div>
          <div className="space-y-3">
            {returnableItems.map((item) => (
              <div
                className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_9rem] sm:items-end"
                key={item.id}
              >
                <div>
                  <label className="text-sm font-medium" htmlFor={`purchase-return-${item.id}`}>
                    {item.productoNombre ?? "Producto"}
                  </label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.receiptNumber} · disponible {item.availableQuantity} de {item.cantidad}
                  </p>
                </div>
                <Input
                  id={`purchase-return-${item.id}`}
                  max={item.availableQuantity}
                  min="0"
                  name={`returnQuantity:${item.id}`}
                  placeholder="0"
                  step="0.01"
                  type="number"
                />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`purchase-return-reason-${order.id}`}>
              Motivo
            </label>
            <Textarea
              id={`purchase-return-reason-${order.id}`}
              maxLength={500}
              minLength={3}
              name="reason"
              placeholder="Describe por qué se devuelve la mercancía."
              required
            />
          </div>
          <Button type="submit">Registrar devolución</Button>
        </form>
      ) : null}

      {!loadError && !showCreate && returns.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background p-5 text-sm text-muted-foreground">
          {returnableItems.length === 0
            ? "Aún no hay mercancía recibida disponible para devolver."
            : "No tienes permiso para registrar devoluciones."}
        </div>
      ) : null}

      {returns.map((purchaseReturn) => (
        <article className="space-y-4 rounded-lg border bg-background p-5" key={purchaseReturn.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-semibold">{purchaseReturn.number}</p>
              <p className="mt-1 text-sm text-muted-foreground">{purchaseReturn.reason}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(purchaseReturn.createdAt).toLocaleString("es-CR")}
              </p>
            </div>
            <p className="text-lg font-semibold">
              {formatMoney(purchaseReturn.totalAmount, purchaseReturn.currencyCode)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Inventario</p>
              <Badge className="mt-2" variant={effectVariant(purchaseReturn.inventoryStatus)}>
                {effectLabels[purchaseReturn.inventoryStatus]}
              </Badge>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Cuenta por pagar</p>
              <Badge className="mt-2" variant={effectVariant(purchaseReturn.financialStatus)}>
                {effectLabels[purchaseReturn.financialStatus]}
              </Badge>
              {purchaseReturn.supplierCreditAmount > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Saldo a favor con proveedor: {formatMoney(
                    purchaseReturn.supplierCreditAmount,
                    purchaseReturn.currencyCode,
                  )}
                </p>
              ) : null}
              {purchaseReturn.supplierDocumentReference ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Referencia: {purchaseReturn.supplierDocumentReference}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            {purchaseReturn.items.map((item) => (
              <div className="flex justify-between gap-4 text-sm" key={item.id}>
                <span>
                  {item.quantity} × {item.description}
                </span>
                <span>{formatMoney(item.totalAmount, purchaseReturn.currencyCode)}</span>
              </div>
            ))}
          </div>

          {purchaseReturn.inventoryStatus === "pending" && canReturnInventory ? (
            <form
              action={applyPurchaseReturnInventoryAction}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-4"
            >
              <input name="operationId" type="hidden" value={randomUUID()} />
              <input name="orderId" type="hidden" value={order.id} />
              <input name="returnId" type="hidden" value={purchaseReturn.id} />
              <p className="text-sm text-muted-foreground">
                Retira las unidades de las bodegas donde fueron recibidas.
              </p>
              <Button type="submit" variant="outline">
                Confirmar salida física
              </Button>
            </form>
          ) : null}

          {purchaseReturn.financialStatus === "pending" && canProcessFinancial ? (
            <form
              action={settlePurchaseReturnFinancialAction}
              className="grid gap-3 rounded-md border bg-muted/30 p-4 md:grid-cols-[1fr_auto] md:items-end"
            >
              <input name="operationId" type="hidden" value={randomUUID()} />
              <input name="orderId" type="hidden" value={order.id} />
              <input name="returnId" type="hidden" value={purchaseReturn.id} />
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor={`supplier-document-${purchaseReturn.id}`}
                >
                  Nota de crédito o referencia del proveedor
                </label>
                <Input
                  id={`supplier-document-${purchaseReturn.id}`}
                  maxLength={160}
                  name="supplierDocumentReference"
                  placeholder="Opcional"
                />
              </div>
              <Button type="submit">Ajustar cuenta por pagar</Button>
            </form>
          ) : null}
        </article>
      ))}
    </section>
  );
}
