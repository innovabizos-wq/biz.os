import {
  assignPermissionToRoleAction,
  removePermissionFromRoleAction,
} from "@/modules/roles/actions";
import type { RolePermissionDetail } from "@/modules/roles/queries";
import type { PermissionCatalogItem } from "@/modules/permissions/queries";
import type { PermissionCode } from "@/types/core";
import { Button } from "@/components/ui/button";

type RolePermissionsManagerProps = {
  assignedPermissions: RolePermissionDetail[];
  catalog: PermissionCatalogItem[];
  canManage: boolean;
  rolId: string;
  roleName?: string;
};

function groupCode(code: string): string {
  return code.split(".")[0] ?? "otros";
}

export function RolePermissionsManager({
  assignedPermissions,
  canManage,
  catalog,
  rolId,
  roleName,
}: RolePermissionsManagerProps) {
  const isProtectedSuperAdmin = roleName === "Super Admin";
  const assignedCodes = new Set<PermissionCode>(
    assignedPermissions.map((permission) => permission.codigo),
  );

  const grouped = catalog.reduce<Record<string, PermissionCatalogItem[]>>(
    (acc, permission) => {
      const group = permission.moduloCodigo ?? groupCode(permission.codigo);
      acc[group] = [...(acc[group] ?? []), permission];
      return acc;
    },
    {},
  );

  return (
    <section className="space-y-4 rounded-lg border bg-background p-5 shadow-sm">
      <div>
        <h3 className="text-base font-semibold">Permisos del rol</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          El catalogo global no se edita aqui. Solo se asignan o quitan permisos
          al rol de esta empresa.
        </p>
        {isProtectedSuperAdmin ? (
          <p className="mt-2 rounded-md border bg-muted p-3 text-sm text-muted-foreground">
            El rol Super Admin protege el acceso total de la empresa y no puede
            quedar sin permisos.
          </p>
        ) : null}
      </div>

      {Object.entries(grouped).map(([group, permissions]) => (
        <div className="space-y-2" key={group}>
          <h4 className="text-sm font-semibold uppercase text-muted-foreground">
            {group}
          </h4>
          <div className="grid gap-2 md:grid-cols-2">
            {permissions.map((permission) => {
              const isAssigned = assignedCodes.has(permission.codigo);

              return (
                <div
                  className="flex items-start justify-between gap-3 rounded-md bg-muted p-3"
                  key={permission.codigo}
                >
                  <div>
                    <p className="font-mono text-xs">{permission.codigo}</p>
                    <p className="mt-1 text-sm font-medium">{permission.nombre}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isAssigned ? "Asignado" : "No asignado"}
                    </p>
                  </div>
                  {canManage ? (
                    <form
                      action={
                        isAssigned
                          ? removePermissionFromRoleAction
                          : assignPermissionToRoleAction
                      }
                    >
                      <input name="rolId" type="hidden" value={rolId} />
                      <input
                        name="permisoCodigo"
                        type="hidden"
                        value={permission.codigo}
                      />
                      <Button
                        disabled={isProtectedSuperAdmin && isAssigned}
                        size="sm"
                        type="submit"
                        variant={isAssigned ? "outline" : "default"}
                      >
                        {isAssigned ? "Quitar" : "Asignar"}
                      </Button>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
