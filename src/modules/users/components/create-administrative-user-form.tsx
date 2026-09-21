import type { AccessibleRole } from "@/modules/roles/queries";
import {
  getRoleHelpText,
  sortRolesByStandardOrder,
} from "@/modules/roles/standard-roles";
import type { Sucursal } from "@/types/core";
import { Button } from "@/components/ui/button";

type CreateAdministrativeUserFormProps = {
  action: (formData: FormData) => Promise<void>;
  branches: Sucursal[];
  roles: AccessibleRole[];
};

export function CreateAdministrativeUserForm({
  action,
  branches,
  roles,
}: CreateAdministrativeUserFormProps) {
  const sortedRoles = sortRolesByStandardOrder(roles);

  return (
    <form action={action} className="grid gap-4 rounded-lg border bg-background p-5 shadow-sm">
      <div>
        <h3 className="text-base font-semibold">Crear usuario</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          El acceso queda activo de inmediato. La persona usara esta contrasena temporal y debera cambiarla al ingresar por primera vez.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Nombre completo
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" name="nombre" required />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Correo de acceso
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" name="correo" required type="email" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Contrasena temporal
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" minLength={12} name="password" required type="password" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Confirmar contrasena temporal
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" minLength={12} name="passwordConfirmation" required type="password" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm font-medium">
          Cargo / puesto
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" name="cargo" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Rol
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" name="rolId" required>
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
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" name="sucursalId">
            <option value="">Sin sucursal</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.nombre}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="space-y-2 text-sm font-medium md:max-w-[calc(33.333%-0.75rem)]">
        Telefono
        <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" name="telefono" type="tel" />
      </label>

      <Button className="w-fit" type="submit">Crear usuario</Button>
    </form>
  );
}
