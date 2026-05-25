import { createQuoteAction, updateQuoteAction } from "@/modules/quotes/actions";
import { DEFAULT_QUOTE_MONEDA, QUOTE_MONEDAS } from "@/modules/quotes/constants";
import type { Quote, QuoteCustomer } from "@/modules/quotes/types";
import { Button } from "@/components/ui/button";

type QuoteFormProps = {
  customers: QuoteCustomer[];
  mode: "create" | "update";
  preselectedClienteId?: string;
  quote?: Quote;
};

export function QuoteForm({
  customers,
  mode,
  preselectedClienteId,
  quote,
}: QuoteFormProps) {
  const action = mode === "create" ? createQuoteAction : updateQuoteAction;
  const selectedClienteId = quote?.clienteId ?? preselectedClienteId ?? "";

  return (
    <form action={action} className="space-y-4 rounded-lg border bg-background p-5">
      {quote ? <input name="cotizacionId" type="hidden" value={quote.id} /> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Cliente</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={selectedClienteId}
            name="clienteId"
          >
            <option value="">Sin cliente</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Vencimiento</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={quote?.fechaVencimiento ?? ""}
            name="fechaVencimiento"
            type="date"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Moneda</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={quote?.moneda ?? DEFAULT_QUOTE_MONEDA}
            name="moneda"
          >
            {QUOTE_MONEDAS.map((moneda) => (
              <option key={moneda} value={moneda}>
                {moneda}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Notas</span>
          <textarea
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
            defaultValue={quote?.notas ?? ""}
            name="notas"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Condiciones</span>
          <textarea
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
            defaultValue={quote?.condiciones ?? ""}
            name="condiciones"
          />
        </label>
      </div>
      <Button type="submit">
        {mode === "create" ? "Crear cotizacion" : "Guardar cambios"}
      </Button>
    </form>
  );
}
