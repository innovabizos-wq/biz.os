import { createInboxConversationAction } from "@/modules/inbox/actions";
import { INBOX_CHANNEL_LABELS, INBOX_CHANNELS } from "@/modules/inbox/constants";
import type {
  InboxAssignableUser,
  InboxChannelConfig,
  InboxCustomer,
} from "@/modules/inbox/types";
import { Button } from "@/components/ui/button";

type InboxConversationFormProps = {
  canCreate: boolean;
  channels: InboxChannelConfig[];
  customers: InboxCustomer[];
  users: InboxAssignableUser[];
};

export function InboxConversationForm({
  canCreate,
  channels,
  customers,
  users,
}: InboxConversationFormProps) {
  if (!canCreate) return null;

  return (
    <form
      action={createInboxConversationAction}
      className="rounded-lg border bg-background p-5"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Canal configurado</span>
          <select className="h-9 w-full rounded-md border bg-background px-3" name="canalId">
            <option value="">Sin canal configurado</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Canal</span>
          <select className="h-9 w-full rounded-md border bg-background px-3" name="canal">
            {INBOX_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {INBOX_CHANNEL_LABELS[channel]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Cliente CRM</span>
          <select className="h-9 w-full rounded-md border bg-background px-3" name="clienteId">
            <option value="">Sin cliente</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nombre contacto</span>
          <input className="h-9 w-full rounded-md border bg-background px-3" name="contactoNombre" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Telefono</span>
          <input className="h-9 w-full rounded-md border bg-background px-3" name="contactoTelefono" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Usuario</span>
          <input className="h-9 w-full rounded-md border bg-background px-3" name="contactoUsuario" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Identificador</span>
          <input className="h-9 w-full rounded-md border bg-background px-3" name="contactoIdentificador" />
        </label>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Asignado a</span>
          <select className="h-9 w-full rounded-md border bg-background px-3" name="asignadoA">
            <option value="">Sin asignar</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Mensaje inicial entrante</span>
          <input className="h-9 w-full rounded-md border bg-background px-3" name="mensajeInicial" />
        </label>
      </div>
      <Button className="mt-4" type="submit">
        Nueva conversacion manual
      </Button>
    </form>
  );
}
