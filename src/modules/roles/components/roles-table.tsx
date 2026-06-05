import Link from "next/link";

import type { AccessibleRole } from "@/modules/roles/queries";
import {
  isDriverRole,
  isStandardRole,
  isSuperAdminRole,
  sortRolesByStandardOrder,
} from "@/modules/roles/standard-roles";
import { buttonVariants } from "@/components/ui/button";

type RolesTableProps = {
  canManage?: boolean;
  roles: AccessibleRole[];
};

export function RolesTable({ canManage = false, roles }: RolesTableProps) {
  const sortedRoles = sortRolesByStandardOrder(roles);

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Descripcion</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Sistema</th>
            <th className="px-4 py-3">Permisos</th>
            <th className="px-4 py-3">Creacion</th>
            <th className="px-4 py-3">Accion</th>
          </tr>
        </thead>
        <tbody>
          {sortedRoles.map((role) => (
            <tr className="border-t" key={role.id}>
              <td className="px-4 py-3">
                <div className="font-medium">{role.nombre}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {isSuperAdminRole(role.nombre) ? (
                    <>
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                        Acceso total
                      </span>
                      <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        Protegido
                      </span>
                    </>
                  ) : null}
                  {isDriverRole(role.nombre) ? (
                    <span className="rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-800">
                      Despacho / Ubicacion
                    </span>
                  ) : null}
                  {isStandardRole(role.nombre) ? (
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Rol estandar
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3">
                {role.descripcion ?? "No disponible"}
              </td>
              <td className="px-4 py-3">{role.estado}</td>
              <td className="px-4 py-3">{role.esSistema ? "Si" : "No"}</td>
              <td className="px-4 py-3">{role.permissionCount}</td>
              <td className="px-4 py-3">
                {new Date(role.createdAt).toLocaleString("es")}
              </td>
              <td className="px-4 py-3">
                <Link
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  href={`/admin/roles/${role.id}`}
                >
                  {canManage ? "Administrar" : "Ver"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
