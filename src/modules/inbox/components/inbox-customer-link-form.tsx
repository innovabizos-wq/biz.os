import { linkInboxConversationCustomerAction } from "@/modules/inbox/actions";
import type { InboxConversation, InboxCustomer } from "@/modules/inbox/types";
import { Button } from "@/components/ui/button";

type InboxCustomerLinkFormProps = {
  canAssign: boolean;
  conversation: InboxConversation;
  customers: InboxCustomer[];
};

export function InboxCustomerLinkForm({
  canAssign,
  conversation,
  customers,
}: InboxCustomerLinkFormProps) {
  if (!canAssign) return null;

  return (
    <form action={linkInboxConversationCustomerAction} className="space-y-2">
      <input name="conversacionId" type="hidden" value={conversation.id} />
      <label className="space-y-1 text-sm">
        <span className="font-medium">Cliente CRM</span>
        <select
          className="h-9 w-full rounded-md border bg-background px-3"
          defaultValue={conversation.clienteId ?? ""}
          name="clienteId"
          required
        >
          <option value="">Seleccionar cliente</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.nombre}
            </option>
          ))}
        </select>
      </label>
      <Button size="sm" type="submit" variant="outline">
        Vincular cliente
      </Button>
      <p className="text-xs text-muted-foreground">
        Crear cliente desde esta conversacion queda para una fase posterior.
      </p>
    </form>
  );
}
