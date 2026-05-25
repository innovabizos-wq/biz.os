import { addInboxMessageAction } from "@/modules/inbox/actions";
import { Button } from "@/components/ui/button";

type InboxInternalNoteFormProps = {
  canReply: boolean;
  conversacionId: string;
};

export function InboxInternalNoteForm({
  canReply,
  conversacionId,
}: InboxInternalNoteFormProps) {
  if (!canReply) return null;

  return (
    <form action={addInboxMessageAction} className="rounded-lg border bg-background p-4">
      <input name="conversacionId" type="hidden" value={conversacionId} />
      <input name="direccion" type="hidden" value="interna" />
      <input name="esNotaInterna" type="hidden" value="true" />
      <label className="space-y-1 text-sm">
        <span className="font-medium">Nota interna</span>
        <textarea
          className="min-h-20 w-full rounded-md border bg-background px-3 py-2"
          name="contenido"
          required
        />
      </label>
      <Button className="mt-3" type="submit" variant="outline">
        Agregar nota
      </Button>
    </form>
  );
}
