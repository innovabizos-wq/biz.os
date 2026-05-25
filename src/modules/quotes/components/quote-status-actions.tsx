import { changeQuoteStatusAction } from "@/modules/quotes/actions";
import type { Quote, QuoteStatus } from "@/modules/quotes/types";
import { Button } from "@/components/ui/button";

type QuoteStatusActionsProps = {
  canChangeStatus: boolean;
  quote: Quote;
};

function getNextStatuses(status: QuoteStatus): QuoteStatus[] {
  if (status === "borrador") {
    return ["enviada", "anulada"];
  }

  if (status === "enviada") {
    return ["aceptada", "rechazada", "vencida", "anulada"];
  }

  return [];
}

export function QuoteStatusActions({
  canChangeStatus,
  quote,
}: QuoteStatusActionsProps) {
  const nextStatuses = getNextStatuses(quote.estado);

  if (!canChangeStatus || nextStatuses.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {nextStatuses.map((status) => (
        <form action={changeQuoteStatusAction} key={status}>
          <input name="cotizacionId" type="hidden" value={quote.id} />
          <input name="estado" type="hidden" value={status} />
          <Button
            size="sm"
            type="submit"
            variant={status === "anulada" ? "destructive" : "outline"}
          >
            {status}
          </Button>
        </form>
      ))}
    </div>
  );
}
