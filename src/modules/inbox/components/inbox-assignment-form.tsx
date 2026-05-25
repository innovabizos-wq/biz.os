import { assignInboxConversationAction } from "@/modules/inbox/actions";
import type { InboxAssignableUser, InboxConversation } from "@/modules/inbox/types";
import { Button } from "@/components/ui/button";

type InboxAssignmentFormProps = {
  canAssign: boolean;
  conversation: InboxConversation;
  users: InboxAssignableUser[];
};

export function InboxAssignmentForm({
  canAssign,
  conversation,
  users,
}: InboxAssignmentFormProps) {
  if (!canAssign) return null;

  return (
    <form action={assignInboxConversationAction} className="space-y-2">
      <input name="conversacionId" type="hidden" value={conversation.id} />
      <label className="space-y-1 text-sm">
        <span className="font-medium">Asignado a</span>
        <select
          className="h-9 w-full rounded-md border bg-background px-3"
          defaultValue={conversation.asignadoA ?? ""}
          name="asignadoA"
        >
          <option value="">Sin asignar</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.nombre}
            </option>
          ))}
        </select>
      </label>
      <Button size="sm" type="submit" variant="outline">
        Guardar asignacion
      </Button>
    </form>
  );
}
