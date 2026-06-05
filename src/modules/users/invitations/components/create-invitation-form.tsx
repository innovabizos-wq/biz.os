import type { AccessibleRole } from "@/modules/roles/queries";
import {
  getRoleHelpText,
  sortRolesByStandardOrder,
} from "@/modules/roles/standard-roles";
import type { Sucursal } from "@/types/core";
import { Button } from "@/components/ui/button";

type CreateInvitationFormProps = {
  action: (formData: FormData) => Promise<void>;
  branches: Sucursal[];
  roles: AccessibleRole[];
  returnTo?: "/admin/invitaciones" | "/rrhh/personal";
};

export function CreateInvitationForm({
  action,
  branches,
  roles,
  returnTo = "/admin/invitaciones",
}: CreateInvitationFormProps) {
  const sortedRoles = sortRolesByStandardOrder(roles);

  return (
    <form
      action={action}
      className="grid gap-4 rounded-lg border bg-background p-5 shadow-sm"
    >
      <div>
        <input name="returnTo" type="hidden" value={returnTo} />
        <h3 className="text-base font-semibold">Agregar personal</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Agrega un colaborador a tu empresa y enviale una invitacion para crear
          su acceso al sistema.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Nombre completo
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            name="nombre"
            required
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Correo electronico
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            name="correo"
            required
            type="email"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Cedula / identificacion
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            name="cedula"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Telefono
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            name="telefono"
            type="tel"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm font-medium">
          Cargo / puesto
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            name="cargo"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Rol
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            name="rolId"
            required
          >
            <option value="">Seleccionar rol</option>
            {sortedRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {getRoleHelpText(role.nombre)
                  ? `${role.nombre} - ${getRoleHelpText(role.nombre)}`
                  : role.nombre}
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
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Button className="w-fit" type="submit">
        Agregar y enviar invitacion
      </Button>
    </form>
  );
}
