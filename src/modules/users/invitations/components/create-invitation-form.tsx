import type { AccessibleRole } from "@/modules/roles/queries";
import type { Sucursal } from "@/types/core";
import { Button } from "@/components/ui/button";

type CreateInvitationFormProps = {
  action: (formData: FormData) => Promise<void>;
  roles: AccessibleRole[];
  sucursal: Sucursal | null;
};

export function CreateInvitationForm({
  action,
  roles,
  sucursal,
}: CreateInvitationFormProps) {
  return (
    <form
      action={action}
      className="grid gap-4 rounded-lg border bg-background p-5 shadow-sm"
    >
      <div>
        <h3 className="text-base font-semibold">Crear invitacion</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Se genera un enlace para que el usuario cree su cuenta o inicie sesion.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Correo
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            name="correo"
            required
            type="email"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Nombre
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            name="nombre"
            required
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Rol
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            name="rolId"
            required
          >
            <option value="">Seleccionar rol</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Sucursal
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            name="sucursalId"
          >
            <option value="">Sin sucursal</option>
            {sucursal ? (
              <option value={sucursal.id}>{sucursal.nombre}</option>
            ) : null}
          </select>
        </label>
      </div>

      <Button className="w-fit" type="submit">
        Crear invitacion
      </Button>
    </form>
  );
}
