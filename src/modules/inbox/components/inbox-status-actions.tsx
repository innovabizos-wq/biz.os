import { changeInboxConversationStatusAction } from "@/modules/inbox/actions";
import { INBOX_STATUS_LABELS } from "@/modules/inbox/constants";
import type { InboxConversation } from "@/modules/inbox/types";
import { Button } from "@/components/ui/button";

type InboxStatusActionsProps = {
  canChangeStatus: boolean;
  conversation: InboxConversation;
};

export function InboxStatusActions({
  canChangeStatus,
  conversation,
}: InboxStatusActionsProps) {
  if (!canChangeStatus) return null;

  const nextStatus = conversation.estado === "cerrada" ? "abierta" : "cerrada";

  return (
    <form action={changeInboxConversationStatusAction}>
      <input name="conversacionId" type="hidden" value={conversation.id} />
      <input name="estado" type="hidden" value={nextStatus} />
      <Button type="submit" variant="outline">
        {conversation.estado === "cerrada" ? "Reabrir" : "Cerrar"} conversacion
        <span className="sr-only">{INBOX_STATUS_LABELS[nextStatus]}</span>
      </Button>
    </form>
  );
}
