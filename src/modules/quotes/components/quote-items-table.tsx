import {
  deleteQuoteItemAction,
  updateQuoteItemAction,
} from "@/modules/quotes/actions";
import type {
  Quote,
  QuoteCatalogProduct,
  QuoteItem,
} from "@/modules/quotes/types";
import { Button } from "@/components/ui/button";

type QuoteItemsTableProps = {
  activeProducts: QuoteCatalogProduct[];
  canEdit: boolean;
  items: QuoteItem[];
  quote: Quote;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", {
    currency,
    style: "currency",
  }).format(value);
}

export function QuoteItemsTable({
  activeProducts,
  canEdit,
  items,
  quote,
}: QuoteItemsTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-background p-5 text-sm text-muted-foreground">
        No hay items en esta cotizacion.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article className="rounded-lg border bg-background p-4" key={item.id}>
          {canEdit ? (
            <form action={updateQuoteItemAction} className="space-y-3">
              <input name="cotizacionId" type="hidden" value={quote.id} />
              <input name="itemId" type="hidden" value={item.id} />
              <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_0.6fr_0.8fr_0.8fr_0.8fr_auto]">
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  defaultValue={item.productoId ?? ""}
                  name="productoId"
                >
                  <option value="">Item manual</option>
                  {activeProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.codigo ? `${product.codigo} - ` : ""}
                      {product.nombre}
                    </option>
                  ))}
                </select>
                <input
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  defaultValue={item.descripcion}
                  name="descripcion"
                  required
                />
                <input
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  defaultValue={item.cantidad}
                  min="0.01"
                  name="cantidad"
                  step="0.01"
                  type="number"
                />
                <input
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  defaultValue={item.precioUnitario}
                  min="0.01"
                  name="precioUnitario"
                  step="0.01"
                  type="number"
                />
                <input
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  defaultValue={item.descuento}
                  min="0"
                  name="descuento"
                  step="0.01"
                  type="number"
                />
                <input
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  defaultValue={item.impuestoPorcentaje}
                  min="0"
                  name="impuestoPorcentaje"
                  step="0.01"
                  type="number"
                />
                <Button size="sm" type="submit">
                  Guardar
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <p className="font-medium">{item.descripcion}</p>
              {item.productoNombre ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Catalogo: {item.productoCodigo ? `${item.productoCodigo} - ` : ""}
                  {item.productoNombre}
                </p>
              ) : null}
              <p className="mt-1 text-sm text-muted-foreground">
                {item.cantidad} x {formatMoney(item.precioUnitario, quote.moneda)}
              </p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
              {item.productoNombre ? (
                <>
                  Catalogo:{" "}
                  {item.productoCodigo ? `${item.productoCodigo} - ` : ""}
                  {item.productoNombre} -{" "}
                </>
              ) : (
                "Item manual - "
              )}
              Subtotal {formatMoney(item.subtotal, quote.moneda)} - Descuento{" "}
              {formatMoney(item.descuento, quote.moneda)} - Impuesto{" "}
              {formatMoney(item.impuestoMonto, quote.moneda)}
            </p>
            <div className="flex items-center gap-3">
              <p className="font-semibold">{formatMoney(item.total, quote.moneda)}</p>
              {canEdit ? (
                <form action={deleteQuoteItemAction}>
                  <input name="cotizacionId" type="hidden" value={quote.id} />
                  <input name="itemId" type="hidden" value={item.id} />
                  <Button size="sm" type="submit" variant="destructive">
                    Eliminar
                  </Button>
                </form>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
