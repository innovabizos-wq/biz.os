import type { Quote, QuoteItem } from "@/modules/quotes/types";

type QuotePrintDocumentProps = {
  items: QuoteItem[];
  quote: Quote;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", {
    currency,
    style: "currency",
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "No definido";

  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00`));
}

export function QuotePrintDocument({ items, quote }: QuotePrintDocumentProps) {
  return (
    <article className="mx-auto max-w-5xl rounded-lg border bg-white p-8 text-slate-950 shadow-sm print:border-0 print:p-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b pb-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Cotizacion
          </p>
          <h1 className="mt-2 text-3xl font-bold">{quote.numero}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Estado: <span className="font-medium capitalize">{quote.estado}</span>
          </p>
        </div>
        <div className="text-right text-sm text-slate-600">
          <p>
            <span className="font-medium text-slate-950">Emision:</span>{" "}
            {formatDate(quote.fechaEmision)}
          </p>
          <p className="mt-1">
            <span className="font-medium text-slate-950">Vence:</span>{" "}
            {formatDate(quote.fechaVencimiento)}
          </p>
          <p className="mt-1">
            <span className="font-medium text-slate-950">Moneda:</span>{" "}
            {quote.moneda}
          </p>
        </div>
      </header>

      <section className="grid gap-6 border-b py-6 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Cliente
          </p>
          <p className="mt-2 text-lg font-semibold">
            {quote.clienteNombre ?? "Cliente no definido"}
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Preparado por
          </p>
          <p className="mt-2 text-lg font-semibold">
            {quote.creadoPorNombre ?? "biz.os"}
          </p>
        </div>
      </section>

      <section className="py-6">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
              <th className="py-3 pr-3">Descripcion</th>
              <th className="px-3 py-3 text-right">Cantidad</th>
              <th className="px-3 py-3 text-right">Precio</th>
              <th className="px-3 py-3 text-right">Impuesto</th>
              <th className="py-3 pl-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item) => (
                <tr className="border-b align-top" key={item.id}>
                  <td className="py-4 pr-3">
                    <p className="font-medium">{item.descripcion}</p>
                    {item.productoNombre ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Catalogo:{" "}
                        {item.productoCodigo ? `${item.productoCodigo} - ` : ""}
                        {item.productoNombre}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-4 text-right">{item.cantidad}</td>
                  <td className="px-3 py-4 text-right">
                    {formatMoney(item.precioUnitario, quote.moneda)}
                  </td>
                  <td className="px-3 py-4 text-right">
                    {formatMoney(item.impuestoMonto, quote.moneda)}
                  </td>
                  <td className="py-4 pl-3 text-right font-semibold">
                    {formatMoney(item.total, quote.moneda)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-6 text-slate-500" colSpan={5}>
                  No hay items registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="ml-auto max-w-sm space-y-3 border-t pt-6 text-sm">
        <div className="flex justify-between gap-6">
          <span className="text-slate-600">Subtotal</span>
          <span className="font-medium">{formatMoney(quote.subtotal, quote.moneda)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-slate-600">Descuento</span>
          <span className="font-medium">
            {formatMoney(quote.descuentoTotal, quote.moneda)}
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-slate-600">Impuesto</span>
          <span className="font-medium">
            {formatMoney(quote.impuestoTotal, quote.moneda)}
          </span>
        </div>
        <div className="flex justify-between gap-6 border-t pt-3 text-lg">
          <span className="font-semibold">Total</span>
          <span className="font-bold">{formatMoney(quote.total, quote.moneda)}</span>
        </div>
      </section>

      {quote.condiciones || quote.notas ? (
        <section className="mt-8 grid gap-6 border-t pt-6 md:grid-cols-2">
          {quote.condiciones ? (
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Condiciones
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {quote.condiciones}
              </p>
            </div>
          ) : null}
          {quote.notas ? (
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Notas
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {quote.notas}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
