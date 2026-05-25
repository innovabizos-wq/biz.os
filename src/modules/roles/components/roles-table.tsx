import Link from "next/link";

import type { AccessibleRole } from "@/modules/roles/queries";
import { buttonVariants } from "@/components/ui/button";

type RolesTableProps = {
  canManage?: boolean;
  roles: AccessibleRole[];
};

export function RolesTable({ canManage = false, roles }: RolesTableProps) {
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
          {roles.map((role) => (
            <tr className="border-t" key={role.id}>
              <td className="px-4 py-3 font-medium">{role.nombre}</td>
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
