"use client";

import { FileText, Pencil, ReceiptText, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  addQuoteItemAction,
  confirmSaleFromQuoteAction,
  deleteQuoteAction,
  deleteQuoteItemAction,
  updateQuoteAction,
  updateQuoteItemAction,
} from "@/modules/quotes/actions";
import type {
  Quote,
  QuoteCatalogProduct,
  QuoteCustomer,
  QuoteItem,
} from "@/modules/quotes/types";
import { issueInvoiceFromSaleAction } from "@/modules/billing/actions";
import type { ElectronicInvoice, FiscalConfiguration } from "@/modules/billing/types";
import type { Sale } from "@/modules/sales/types";

type QuotesTableProps = {
  canCreateInvoice: boolean;
  canDeleteQuote: boolean;
  canEditQuote: boolean;
  canConfirmSale: boolean;
  className?: string;
  customers: QuoteCustomer[];
  fiscalConfiguration: FiscalConfiguration | null;
  invoicesBySaleId: Record<string, ElectronicInvoice>;
  itemsByQuoteId: Record<string, QuoteItem[]>;
  products: QuoteCatalogProduct[];
  quotes: Quote[];
  salesByQuoteId: Record<string, Sale>;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", {
    currency,
    style: "currency",
  }).format(value);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    aceptada: "Aceptada",
    anulada: "Anulada",
    borrador: "Borrador",
    cancelada: "Cancelada",
    completada: "Completada",
    confirmada: "Confirmada",
    enviada: "Enviada",
    en_proceso: "En proceso",
    error: "Error",
    firmando: "Firmando",
    nueva: "Nueva",
    rechazada: "Rechazada",
    vencida: "Vencida",
  };

  return labels[status] ?? status;
}

function commercialStatusLabel(quote: Quote, sale?: Sale) {
  if (sale) return "Venta generada";
  if (["rechazada", "vencida", "anulada"].includes(quote.estado)) {
    return statusLabel(quote.estado);
  }

  return "Pendiente de venta";
}

function numberToInput(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function QuoteItemCreateForm({
  products,
  quote,
}: {
  products: QuoteCatalogProduct[];
  quote: Quote;
}) {
  const [productId, setProductId] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [tax, setTax] = useState("0");

  function applyProduct(nextProductId: string) {
    const product = products.find((item) => item.id === nextProductId);
    setProductId(nextProductId);

    if (!product) return;

    setDescription(product.descripcion ?? product.nombre);
    setPrice(numberToInput(product.precioBase));
    setTax(numberToInput(product.impuestoPorcentaje));
  }

  return (
    <form action={addQuoteItemAction} className="rounded-lg border bg-emerald-50/40 p-3">
      <input name="cotizacionId" type="hidden" value={quote.id} />
      <div className="grid gap-2 xl:grid-cols-[1fr_1.35fr_0.55fr_0.75fr_0.75fr_0.75fr_auto]">
        <select
          className="h-9 min-w-0 rounded-md border bg-white px-2 text-xs"
          name="productoId"
          onChange={(event) => applyProduct(event.target.value)}
          value={productId}
        >
          <option value="">Item manual</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.codigo ? `${product.codigo} - ` : ""}
              {product.nombre}
            </option>
          ))}
        </select>
        <input
          className="h-9 min-w-0 rounded-md border bg-white px-2 text-xs"
          name="descripcion"
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Descripcion"
          required
          value={description}
        />
        <input
          className="h-9 min-w-0 rounded-md border bg-white px-2 text-xs"
          defaultValue="1"
          min="0.01"
          name="cantidad"
          step="0.01"
          type="number"
        />
        <input
          className="h-9 min-w-0 rounded-md border bg-white px-2 text-xs"
          min="0.01"
          name="precioUnitario"
          onChange={(event) => setPrice(event.target.value)}
          step="0.01"
          type="number"
          value={price}
        />
        <input
          className="h-9 min-w-0 rounded-md border bg-white px-2 text-xs"
          defaultValue="0"
          min="0"
          name="descuento"
          step="0.01"
          type="number"
        />
        <input
          className="h-9 min-w-0 rounded-md border bg-white px-2 text-xs"
          min="0"
          name="impuestoPorcentaje"
          onChange={(event) => setTax(event.target.value)}
          step="0.01"
          type="number"
          value={tax}
        />
        <Button className="h-9" size="sm" type="submit">
          Agregar
        </Button>
      </div>
    </form>
  );
}

function EditableQuoteItems({
  items,
  products,
  quote,
}: {
  items: QuoteItem[];
  products: QuoteCatalogProduct[];
  quote: Quote;
}) {
  return (
    <div className="space-y-3">
      <QuoteItemCreateForm products={products} quote={quote} />
      {items.length > 0 ? (
        items.map((item) => (
          <article className="rounded-lg border bg-white p-3" key={item.id}>
            <form action={updateQuoteItemAction} className="space-y-2">
              <input name="cotizacionId" type="hidden" value={quote.id} />
              <input name="itemId" type="hidden" value={item.id} />
              <div className="grid gap-2 xl:grid-cols-[1fr_1.35fr_0.55fr_0.75fr_0.75fr_0.75fr_auto]">
                <select
                  className="h-9 min-w-0 rounded-md border bg-white px-2 text-xs"
                  defaultValue={item.productoId ?? ""}
                  name="productoId"
                >
                  <option value="">Item manual</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.codigo ? `${product.codigo} - ` : ""}
                      {product.nombre}
                    </option>
                  ))}
                </select>
                <input
                  className="h-9 min-w-0 rounded-md border bg-white px-2 text-xs"
                  defaultValue={item.descripcion}
                  name="descripcion"
                  required
                />
                <input
                  className="h-9 min-w-0 rounded-md border bg-white px-2 text-xs"
                  defaultValue={item.cantidad}
                  min="0.01"
                  name="cantidad"
                  step="0.01"
                  type="number"
                />
                <input
                  className="h-9 min-w-0 rounded-md border bg-white px-2 text-xs"
                  defaultValue={item.precioUnitario}
                  min="0.01"
                  name="precioUnitario"
                  step="0.01"
                  type="number"
                />
                <input
                  className="h-9 min-w-0 rounded-md border bg-white px-2 text-xs"
                  defaultValue={item.descuento}
                  min="0"
                  name="descuento"
                  step="0.01"
                  type="number"
                />
                <input
                  className="h-9 min-w-0 rounded-md border bg-white px-2 text-xs"
                  defaultValue={item.impuestoPorcentaje}
                  min="0"
                  name="impuestoPorcentaje"
                  step="0.01"
                  type="number"
                />
                <Button className="h-9" size="sm" type="submit">
                  Guardar
                </Button>
              </div>
            </form>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                Subtotal {formatMoney(item.subtotal, quote.moneda)} - Impuesto{" "}
                {formatMoney(item.impuestoMonto, quote.moneda)}
              </span>
              <form
                action={deleteQuoteItemAction}
                onSubmit={(event) => {
                  if (!window.confirm("Eliminar este item?")) event.preventDefault();
                }}
              >
                <input name="cotizacionId" type="hidden" value={quote.id} />
                <input name="itemId" type="hidden" value={item.id} />
                <Button size="sm" type="submit" variant="destructive">
                  Eliminar
                </Button>
              </form>
            </div>
          </article>
        ))
      ) : (
        <p className="rounded-lg border border-dashed bg-white p-4 text-center text-sm text-muted-foreground">
          Agrega el primer item para completar la proforma.
        </p>
      )}
    </div>
  );
}

function QuoteEditModal({
  customers,
  items,
  onClose,
  products,
  quote,
}: {
  customers: QuoteCustomer[];
  items: QuoteItem[];
  onClose: () => void;
  products: QuoteCatalogProduct[];
  quote: Quote;
}) {
  return (
    <div aria-modal="true" className="fixed inset-0 z-[9999] bg-black/60 p-4" role="dialog">
      <div className="mx-auto flex h-[min(760px,calc(100vh-2rem))] w-[min(1080px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
              Cotizacion
            </p>
            <h2 className="text-xl font-black">{quote.numero}</h2>
          </div>
          <button
            aria-label="Cerrar editor de cotizacion"
            className="inline-flex size-9 items-center justify-center rounded-md border text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-5 lg:grid-cols-[0.82fr_1.18fr]">
          <form action={updateQuoteAction} className="space-y-4 rounded-lg border bg-slate-50 p-4">
            <input name="cotizacionId" type="hidden" value={quote.id} />
            <label className="block space-y-1 text-sm font-semibold">
              <span>Cliente</span>
              <select
                className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                defaultValue={quote.clienteId ?? ""}
                name="clienteId"
              >
                <option value="">Sin cliente asignado</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.nombre}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-semibold">
                <span>Moneda</span>
                <select
                  className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                  defaultValue={quote.moneda}
                  name="moneda"
                >
                  <option value="CRC">CRC</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label className="block space-y-1 text-sm font-semibold">
                <span>Vencimiento</span>
                <input
                  className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                  defaultValue={quote.fechaVencimiento ?? ""}
                  name="fechaVencimiento"
                  type="date"
                />
              </label>
            </div>

            <label className="block space-y-1 text-sm font-semibold">
              <span>Notas</span>
              <textarea
                className="min-h-24 w-full rounded-md border bg-white px-3 py-2 text-sm"
                defaultValue={quote.notas ?? ""}
                name="notas"
              />
            </label>
            <label className="block space-y-1 text-sm font-semibold">
              <span>Condiciones</span>
              <textarea
                className="min-h-24 w-full rounded-md border bg-white px-3 py-2 text-sm"
                defaultValue={quote.condiciones ?? ""}
                name="condiciones"
              />
            </label>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button onClick={onClose} type="button" variant="outline">
                Cancelar
              </Button>
              <Button type="submit">Guardar cambios</Button>
            </div>
          </form>

          <section className="min-h-0 rounded-lg border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-black">Items</p>
                <p className="text-xs text-muted-foreground">
                  Productos disponibles: {products.length}
                </p>
              </div>
              <p className="text-lg font-black">{formatMoney(quote.total, quote.moneda)}</p>
            </div>
            <div className="max-h-[520px] overflow-auto rounded-lg border bg-slate-50 p-3">
              <EditableQuoteItems items={items} products={products} quote={quote} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function InvoiceModal({
  fiscalConfiguration,
  onClose,
  quote,
  sale,
}: {
  fiscalConfiguration: FiscalConfiguration | null;
  onClose: () => void;
  quote: Quote;
  sale: Sale;
}) {
  const activity = fiscalConfiguration?.actividadEconomica ?? "";

  return (
    <div aria-modal="true" className="fixed inset-0 z-[9999] bg-black/60 p-4" role="dialog">
      <div className="mx-auto grid h-[min(760px,calc(100vh-2rem))] w-[min(1100px,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white shadow-2xl lg:grid-cols-[0.92fr_1.08fr]">
        <form action={issueInvoiceFromSaleAction} className="min-h-0 overflow-auto border-r p-5">
          <input name="ventaId" type="hidden" value={sale.id} />
          <div className="mb-5 flex items-start justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                Facturacion fiscal
              </p>
              <h2 className="text-xl font-black">Emitir factura</h2>
            </div>
            <button
              aria-label="Cerrar factura"
              className="inline-flex size-9 items-center justify-center rounded-md border"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          {!fiscalConfiguration?.listoParaEmitir ? (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Completa Admin &gt; Fiscal antes de emitir comprobantes.
            </p>
          ) : null}
          <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
            Esta accion prepara la factura local. El envio real a Hacienda queda
            pendiente hasta completar la firma XAdES-EPES y recepcion oficial.
          </p>

          <div className="grid gap-3">
            <label className="space-y-1 text-sm font-semibold">
              <span>Cliente fiscal</span>
              <input
                className="h-10 w-full rounded-md border px-3 text-sm"
                defaultValue={quote.clienteNombre ?? ""}
                name="nombreReceptor"
                placeholder="Nombre del receptor"
              />
            </label>
            <label className="space-y-1 text-sm font-semibold">
              <span>Identificacion</span>
              <input
                className="h-10 w-full rounded-md border px-3 text-sm"
                name="identificacionReceptor"
                placeholder="Cedula fisica o juridica"
              />
            </label>
            <label className="space-y-1 text-sm font-semibold">
              <span>Correo receptor</span>
              <input
                className="h-10 w-full rounded-md border px-3 text-sm"
                name="correoReceptor"
                placeholder="correo@cliente.com"
                type="email"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold">
                <span>Actividad</span>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  defaultValue={activity}
                  name="actividadEconomica"
                  required
                />
              </label>
              <label className="space-y-1 text-sm font-semibold">
                <span>Condicion de venta</span>
                <select className="h-10 w-full rounded-md border px-3 text-sm" name="condicionVenta">
                  <option value="01">Contado</option>
                  <option value="02">Credito</option>
                </select>
              </label>
            </div>
            <label className="space-y-1 text-sm font-semibold">
              <span>Medio de pago</span>
              <select className="h-10 w-full rounded-md border px-3 text-sm" name="medioPago">
                <option value="01">Efectivo</option>
                <option value="02">Tarjeta</option>
                <option value="04">Transferencia</option>
              </select>
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2 border-t pt-4">
            <Button onClick={onClose} type="button" variant="outline">
              Cancelar
            </Button>
            <Button disabled={!fiscalConfiguration?.listoParaEmitir} type="submit">
              Confirmar
            </Button>
          </div>
        </form>

        <aside className="min-h-0 overflow-auto bg-slate-50 p-6">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Vista previa
            </p>
            <h3 className="mt-2 text-2xl font-black">Factura electronica</h3>
            <div className="mt-5 grid gap-3 text-sm">
              <div className="flex justify-between">
                <span>Venta</span>
                <strong>{sale.numero}</strong>
              </div>
              <div className="flex justify-between">
                <span>Cliente</span>
                <strong>{quote.clienteNombre ?? "Sin cliente"}</strong>
              </div>
              <div className="flex justify-between">
                <span>Ambiente</span>
                <strong>{fiscalConfiguration?.ambiente ?? "Pruebas"}</strong>
              </div>
              <div className="mt-3 flex justify-between border-t pt-3 text-lg">
                <span>Total</span>
                <strong>{formatMoney(sale.total, sale.moneda)}</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function QuotesTable({
  canCreateInvoice,
  canDeleteQuote,
  canEditQuote,
  canConfirmSale,
  className,
  customers,
  fiscalConfiguration,
  invoicesBySaleId,
  itemsByQuoteId,
  products,
  quotes,
  salesByQuoteId,
}: QuotesTableProps) {
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [invoiceQuoteId, setInvoiceQuoteId] = useState<string | null>(null);
  const editingQuote = quotes.find((quote) => quote.id === editingQuoteId) ?? null;
  const invoiceQuote = quotes.find((quote) => quote.id === invoiceQuoteId) ?? null;
  const invoiceSale = invoiceQuote ? salesByQuoteId[invoiceQuote.id] : null;

  return (
    <div className={cn("overflow-auto rounded-lg border bg-background", className)}>
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Numero</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Emision</th>
            <th className="px-4 py-3">Vencimiento</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Creado por</th>
            <th className="px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((quote) => {
            const sale = salesByQuoteId[quote.id];
            const invoice = sale ? invoicesBySaleId[sale.id] : null;
            const quoteItems = itemsByQuoteId[quote.id] ?? [];
            const canIssueInvoice =
              canCreateInvoice &&
              sale &&
              ["confirmada", "en_proceso", "completada"].includes(sale.estado) &&
              !invoice;

            return (
              <tr className="border-t" key={quote.id}>
                <td className="px-4 py-3 font-medium">{quote.numero}</td>
                <td className="px-4 py-3">{quote.clienteNombre ?? "Sin cliente"}</td>
                <td className="px-4 py-3">{commercialStatusLabel(quote, sale)}</td>
                <td className="px-4 py-3">{quote.fechaEmision}</td>
                <td className="px-4 py-3">
                  {quote.fechaVencimiento ?? "No definido"}
                </td>
                <td className="px-4 py-3">{formatMoney(quote.total, quote.moneda)}</td>
                <td className="px-4 py-3">
                  {quote.creadoPorNombre ?? "No disponible"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={buttonVariants({ size: "sm", variant: "outline" })}
                      disabled={!canEditQuote || Boolean(sale)}
                      onClick={() => setEditingQuoteId(quote.id)}
                      title={
                        sale
                          ? "La venta ya fue generada; los datos quedaron congelados."
                          : "Editar cotizacion"
                      }
                      type="button"
                    >
                      <Pencil aria-hidden="true" />
                      Editar
                    </button>

                    {sale ? (
                      <>
                        <span className="inline-flex h-8 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[0.8rem] font-bold text-emerald-800">
                          Venta generada
                        </span>
                        <Link
                          className={buttonVariants({ size: "sm", variant: "outline" })}
                          href={`/ventas/${sale.id}`}
                        >
                          Ver venta
                        </Link>
                        {invoice ? (
                          invoice.fiscalDocumentId ? (
                            <Link
                              className={buttonVariants({
                                className: "border-yellow-300 bg-yellow-50 text-yellow-900 hover:bg-yellow-100",
                                size: "sm",
                                variant: "outline",
                              })}
                              href={`/facturacion/documentos/${invoice.fiscalDocumentId}`}
                            >
                              <ReceiptText aria-hidden="true" />
                              Factura {statusLabel(invoice.estado)}
                            </Link>
                          ) : (
                            <span className="inline-flex h-8 items-center rounded-lg border border-yellow-300 bg-yellow-50 px-2.5 text-[0.8rem] font-bold text-yellow-900">
                              Factura {statusLabel(invoice.estado)}
                            </span>
                          )
                        ) : canIssueInvoice ? (
                          <button
                            className={buttonVariants({
                              className: "bg-yellow-400 text-slate-950 hover:bg-yellow-300",
                              size: "sm",
                              variant: "outline",
                            })}
                            onClick={() => setInvoiceQuoteId(quote.id)}
                            type="button"
                          >
                            <ReceiptText aria-hidden="true" />
                            Emitir factura
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <form action={confirmSaleFromQuoteAction}>
                        <input name="cotizacionId" type="hidden" value={quote.id} />
                        <button
                          className={buttonVariants({
                            className: "bg-emerald-600 text-white hover:bg-emerald-700",
                            size: "sm",
                            variant: "outline",
                          })}
                          disabled={!canConfirmSale || quoteItems.length === 0}
                          title={
                            quoteItems.length === 0
                              ? "Agrega al menos un item antes de confirmar la venta."
                              : "Confirmar venta"
                          }
                          type="submit"
                        >
                          <FileText aria-hidden="true" />
                          Confirmar venta
                        </button>
                      </form>
                    )}

                    <form
                      action={deleteQuoteAction}
                      onSubmit={(event) => {
                        if (!window.confirm("Eliminar esta cotizacion?")) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input name="cotizacionId" type="hidden" value={quote.id} />
                      <button
                        className={buttonVariants({
                          className: "border-red-200 bg-red-600 text-white hover:bg-red-700",
                          size: "sm",
                          variant: "outline",
                        })}
                        disabled={!canDeleteQuote}
                        title={
                          canDeleteQuote
                            ? "Eliminar cotizacion"
                            : "Solo administradores pueden eliminar"
                        }
                        type="submit"
                      >
                        <Trash2 aria-hidden="true" />
                        Eliminar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {editingQuote ? (
        <QuoteEditModal
          customers={customers}
          items={itemsByQuoteId[editingQuote.id] ?? []}
          onClose={() => setEditingQuoteId(null)}
          products={products}
          quote={editingQuote}
        />
      ) : null}

      {invoiceQuote && invoiceSale ? (
        <InvoiceModal
          fiscalConfiguration={fiscalConfiguration}
          onClose={() => setInvoiceQuoteId(null)}
          quote={invoiceQuote}
          sale={invoiceSale}
        />
      ) : null}
    </div>
  );
}
