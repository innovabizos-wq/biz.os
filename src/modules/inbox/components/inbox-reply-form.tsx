import { addInboxMessageAction } from "@/modules/inbox/actions";
import { Button } from "@/components/ui/button";

type InboxReplyFormProps = {
  canReply: boolean;
  conversacionId: string;
};

export function InboxReplyForm({ canReply, conversacionId }: InboxReplyFormProps) {
  if (!canReply) return null;

  return (
    <form action={addInboxMessageAction} className="rounded-lg border bg-background p-4">
      <input name="conversacionId" type="hidden" value={conversacionId} />
      <input name="direccion" type="hidden" value="saliente" />
      <label className="space-y-1 text-sm">
        <span className="font-medium">Respuesta saliente simulada</span>
        <textarea
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2"
          name="contenido"
          required
        />
      </label>
      <Button className="mt-3" type="submit">
        Registrar respuesta
      </Button>
    </form>
  );
}
