import { createFollowupAction } from "@/modules/crm/actions";
import type { CrmAssignableUser } from "@/modules/crm/types";
import { Button } from "@/components/ui/button";

type FollowupFormProps = {
  assignableUsers: CrmAssignableUser[];
  clienteId: string;
};

export function FollowupForm({ assignableUsers, clienteId }: FollowupFormProps) {
  return (
    <form
      action={createFollowupAction}
      className="grid gap-4 rounded-lg border bg-background p-5 shadow-sm"
    >
      <input name="clienteId" type="hidden" value={clienteId} />
      <div>
        <h3 className="text-base font-semibold">Nuevo seguimiento</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Agenda un pendiente comercial basico.
        </p>
      </div>

      <label className="space-y-2 text-sm font-medium">
        Asunto
        <input
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          name="asunto"
          required
        />
      </label>

      <label className="space-y-2 text-sm font-medium">
        Fecha programada
        <input
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          name="fechaProgramada"
          required
          type="datetime-local"
        />
      </label>

      <label className="space-y-2 text-sm font-medium">
        Asignado a
        <select
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          name="asignadoA"
        >
          <option value="">Sin asignar</option>
          {assignableUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2 text-sm font-medium">
        Descripcion
        <textarea
          className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
          name="descripcion"
        />
      </label>

      <Button className="w-fit" type="submit">
        Crear seguimiento
      </Button>
    </form>
  );
}
