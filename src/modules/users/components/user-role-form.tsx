import { changeUserRoleAction } from "@/modules/users/actions";
import type { AccessibleUser } from "@/modules/users/queries";
import type { Rol } from "@/types/core";
import { Button } from "@/components/ui/button";

type UserRoleFormProps = {
  roles: Rol[];
  user: AccessibleUser;
};

export function UserRoleForm({ roles, user }: UserRoleFormProps) {
  return (
    <form
      action={changeUserRoleAction}
      className="grid gap-4 rounded-lg border bg-background p-5 shadow-sm"
    >
      <input name="profileId" type="hidden" value={user.id} />
      <div>
        <h3 className="text-base font-semibold">Rol</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Solo se pueden asignar roles activos de esta empresa.
        </p>
      </div>

      <label className="space-y-2 text-sm font-medium">
        Rol asignado
        <select
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue={user.rolId ?? ""}
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

      <Button className="w-fit" type="submit">
        Cambiar rol
      </Button>
    </form>
  );
}
