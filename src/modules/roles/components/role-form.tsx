import {
  createRoleAction,
  updateRoleAction,
} from "@/modules/roles/actions";
import type { Rol } from "@/types/core";
import { Button } from "@/components/ui/button";

type RoleFormProps = {
  mode: "create" | "update";
  role?: Rol;
};

export function RoleForm({ mode, role }: RoleFormProps) {
  const isUpdate = mode === "update";

  return (
    <form
      action={isUpdate ? updateRoleAction : createRoleAction}
      className="grid gap-4 rounded-lg border bg-background p-5 shadow-sm"
    >
      {role ? <input name="rolId" type="hidden" value={role.id} /> : null}
      <div>
        <h3 className="text-base font-semibold">
          {isUpdate ? "Datos del rol" : "Nuevo rol"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          El rol se crea dentro de la empresa actual resuelta desde la sesion.
        </p>
      </div>

      <label className="space-y-2 text-sm font-medium">
        Nombre
        <input
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue={role?.nombre}
          name="nombre"
          required
        />
      </label>

      <label className="space-y-2 text-sm font-medium">
        Descripcion
        <textarea
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
          defaultValue={role?.descripcion ?? ""}
          name="descripcion"
        />
      </label>

      <Button className="w-fit" type="submit">
        {isUpdate ? "Guardar cambios" : "Crear rol"}
      </Button>
    </form>
  );
}
