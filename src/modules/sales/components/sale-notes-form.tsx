import { updateSaleNotesAction } from "@/modules/sales/actions";
import type { Sale } from "@/modules/sales/types";
import { Button } from "@/components/ui/button";

type SaleNotesFormProps = {
  canEdit: boolean;
  sale: Sale;
};

export function SaleNotesForm({ canEdit, sale }: SaleNotesFormProps) {
  if (!canEdit || ["completada", "cancelada"].includes(sale.estado)) {
    return null;
  }

  return (
    <form action={updateSaleNotesAction} className="space-y-3 rounded-lg border bg-background p-5">
      <input name="ventaId" type="hidden" value={sale.id} />
      <label className="space-y-1 text-sm">
        <span className="font-medium">Notas</span>
        <textarea
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
          defaultValue={sale.notas ?? ""}
          name="notas"
        />
      </label>
      <Button type="submit">Guardar notas</Button>
    </form>
  );
}
