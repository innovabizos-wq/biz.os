import { changeRoleStatusAction } from "@/modules/roles/actions";
import type { Rol } from "@/types/core";
import { Button } from "@/components/ui/button";

type RoleStatusFormProps = {
  role: Rol;
};

export function RoleStatusForm({ role }: RoleStatusFormProps) {
  const isProtected = role.nombre === "Super Admin";
  const nextStatus = role.estado === "activo" ? "inactivo" : "activo";

  return (
    <form
      action={changeRoleStatusAction}
      className="rounded-lg border bg-background p-5 shadow-sm"
    >
      <input name="rolId" type="hidden" value={role.id} />
      <input name="estado" type="hidden" value={nextStatus} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">Estado del rol</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isProtected
              ? "El rol Super Admin protege el acceso total de la empresa y no puede eliminarse."
              : "No se borra fisicamente ningun rol."}{" "}
            Estado actual: <span className="font-medium">{role.estado}</span>.
          </p>
        </div>
        <Button
          disabled={isProtected && nextStatus === "inactivo"}
          type="submit"
          variant={nextStatus === "activo" ? "default" : "outline"}
        >
          {nextStatus === "activo" ? "Activar rol" : "Inactivar rol"}
        </Button>
      </div>
    </form>
  );
}
