import Link from "next/link";

import type { AccessibleUser } from "@/modules/users/queries";
import { buttonVariants } from "@/components/ui/button";

type UsersTableProps = {
  canManage?: boolean;
  users: AccessibleUser[];
};

export function UsersTable({ canManage = false, users }: UsersTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Correo</th>
            <th className="px-4 py-3">Telefono</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Sucursal</th>
            <th className="px-4 py-3">Rol</th>
            <th className="px-4 py-3">Ultimo acceso</th>
            <th className="px-4 py-3">Creacion</th>
            <th className="px-4 py-3">Accion</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr className="border-t" key={user.id}>
              <td className="px-4 py-3 font-medium">{user.nombre}</td>
              <td className="px-4 py-3">{user.correo}</td>
              <td className="px-4 py-3">{user.telefono ?? "No disponible"}</td>
              <td className="px-4 py-3">{user.estado}</td>
              <td className="px-4 py-3">
                {user.sucursalNombre ?? "No asignada"}
              </td>
              <td className="px-4 py-3">{user.rolNombre ?? "No asignado"}</td>
              <td className="px-4 py-3">
                {user.ultimoAcceso
                  ? new Date(user.ultimoAcceso).toLocaleString("es")
                  : "No registrado"}
              </td>
              <td className="px-4 py-3">
                {new Date(user.createdAt).toLocaleString("es")}
              </td>
              <td className="px-4 py-3">
                <Link
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  href={`/admin/usuarios/${user.id}`}
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
