import { createInboxChannelAction } from "@/modules/inbox/actions";
import { INBOX_CHANNEL_LABELS, INBOX_CHANNELS } from "@/modules/inbox/constants";
import { Button } from "@/components/ui/button";

type InboxChannelFormProps = {
  canManage: boolean;
};

export function InboxChannelForm({ canManage }: InboxChannelFormProps) {
  if (!canManage) return null;

  return (
    <form action={createInboxChannelAction} className="rounded-lg border bg-background p-5">
      <div className="grid gap-4 md:grid-cols-3">
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
          <span className="font-medium">Nombre</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            name="nombre"
            placeholder="Atencion principal"
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Identificador simulado</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            name="identificadorExterno"
            placeholder="+506 8888 0000"
          />
        </label>
      </div>
      <Button className="mt-4" type="submit">
        Crear canal manual
      </Button>
    </form>
  );
}
