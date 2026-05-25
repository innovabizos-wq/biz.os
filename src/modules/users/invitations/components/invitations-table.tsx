import type { UserInvitation } from "@/modules/users/invitations/types";
import { buildInvitationUrl } from "@/modules/users/invitations/invitation-url";

type InvitationsTableProps = {
  invitations: UserInvitation[];
};

export function InvitationsTable({ invitations }: InvitationsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Correo</th>
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Rol</th>
            <th className="px-4 py-3">Sucursal</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Expira</th>
            <th className="px-4 py-3">Link</th>
          </tr>
        </thead>
        <tbody>
          {invitations.map((invitation) => (
            <tr className="border-t" key={invitation.id}>
              <td className="px-4 py-3">{invitation.correo}</td>
              <td className="px-4 py-3 font-medium">{invitation.nombre}</td>
              <td className="px-4 py-3">{invitation.rol?.nombre ?? "No visible"}</td>
              <td className="px-4 py-3">
                {invitation.sucursal?.nombre ?? "Sin sucursal"}
              </td>
              <td className="px-4 py-3">{invitation.estado}</td>
              <td className="px-4 py-3">
                {new Date(invitation.fechaExpiracion).toLocaleString("es")}
              </td>
              <td className="px-4 py-3">
                <code className="break-all rounded bg-muted px-2 py-1 text-xs">
                  {buildInvitationUrl(invitation.token)}
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
