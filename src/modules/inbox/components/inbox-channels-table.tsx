import Link from "next/link";

import { changeInboxChannelStatusAction } from "@/modules/inbox/actions";
import {
  INBOX_CHANNEL_LABELS,
  INBOX_CONNECTION_STATUS_LABELS,
} from "@/modules/inbox/constants";
import type { InboxChannelConfig } from "@/modules/inbox/types";
import { Button, buttonVariants } from "@/components/ui/button";

type InboxChannelsTableProps = {
  canManage: boolean;
  channels: InboxChannelConfig[];
};

export function InboxChannelsTable({
  canManage,
  channels,
}: InboxChannelsTableProps) {
  return (
    <div className="overflow-auto rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Canal</th>
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Proveedor</th>
            <th className="px-4 py-3">Identificador</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Conexion</th>
            <th className="px-4 py-3">Accion</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((channel) => (
            <tr className="border-t" key={channel.id}>
              <td className="px-4 py-3">{INBOX_CHANNEL_LABELS[channel.canal]}</td>
              <td className="px-4 py-3 font-medium">{channel.nombre}</td>
              <td className="px-4 py-3">{channel.proveedor}</td>
              <td className="px-4 py-3">
                {channel.identificadorExterno ?? "No registrado"}
              </td>
              <td className="px-4 py-3">{channel.estado}</td>
              <td className="px-4 py-3">
                {INBOX_CONNECTION_STATUS_LABELS[channel.conexionEstado]}
              </td>
              <td className="flex gap-2 px-4 py-3">
                <Link
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  href={`/inbox/canales/${channel.id}`}
                >
                  Ver
                </Link>
                {canManage ? (
                  <form action={changeInboxChannelStatusAction}>
                    <input name="canalId" type="hidden" value={channel.id} />
                    <input
                      name="estado"
                      type="hidden"
                      value={channel.estado === "activo" ? "inactivo" : "activo"}
                    />
                    <Button size="sm" type="submit" variant="outline">
                      {channel.estado === "activo" ? "Inactivar" : "Activar"}
                    </Button>
                  </form>
                ) : (
                  <span className="text-muted-foreground">Sin permiso</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
