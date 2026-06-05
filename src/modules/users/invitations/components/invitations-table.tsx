import type { UserInvitation } from "@/modules/users/invitations/types";
import { buildInvitationUrl } from "@/modules/users/invitations/invitation-url";

type InvitationsTableProps = {
  invitations: UserInvitation[];
};

export function InvitationsTable({ invitations }: InvitationsTableProps) {
  const groups = [
    {
      empty: "No hay invitaciones pendientes.",
      invitations: invitations.filter((invitation) => invitation.estado === "pendiente"),
      title: "Invitaciones pendientes",
    },
    {
      empty: "No hay invitaciones expiradas o canceladas.",
      invitations: invitations.filter((invitation) =>
        ["expirada", "cancelada"].includes(invitation.estado),
      ),
      title: "Invitaciones expiradas/canceladas",
    },
  ];

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section className="space-y-3" key={group.title}>
          <h3 className="text-base font-semibold">{group.title}</h3>
          {group.invitations.length > 0 ? (
            <div className="overflow-hidden rounded-lg border bg-background">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Personal</th>
                    <th className="px-4 py-3">Contacto</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Sucursal</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Expira</th>
                    <th className="px-4 py-3">Acceso al sistema</th>
                  </tr>
                </thead>
                <tbody>
                  {group.invitations.map((invitation) => (
                    <tr className="border-t align-top" key={invitation.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{invitation.nombre}</div>
                        {invitation.cedula ? (
                          <div className="text-xs text-muted-foreground">
                            ID: {invitation.cedula}
                          </div>
                        ) : null}
                        {invitation.cargo ? (
                          <div className="text-xs text-muted-foreground">
                            {invitation.cargo}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div>{invitation.correo}</div>
                        {invitation.telefono ? (
                          <div className="text-xs text-muted-foreground">
                            {invitation.telefono}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {invitation.rol?.nombre ?? "No visible"}
                      </td>
                      <td className="px-4 py-3">
                        {invitation.sucursal?.nombre ?? "Sin sucursal"}
                      </td>
                      <td className="px-4 py-3">{invitation.estado}</td>
                      <td className="px-4 py-3">
                        {new Date(invitation.fechaExpiracion).toLocaleString("es")}
                      </td>
                      <td className="px-4 py-3">
                        {invitation.estado === "pendiente" ? (
                          <code className="block max-w-xs break-all rounded bg-muted px-2 py-1 text-xs">
                            {buildInvitationUrl(invitation.token)}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">Sin accion</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg border bg-muted p-4 text-sm text-muted-foreground">
              {group.empty}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
