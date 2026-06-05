import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  INBOX_CHANNEL_LABELS,
  INBOX_CONNECTION_STATUS_LABELS,
} from "@/modules/inbox/constants";
import type { InboxChannelConfig } from "@/modules/inbox/types";

type WhappChannelListProps = {
  channels: InboxChannelConfig[];
};

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function WhappChannelList({ channels }: WhappChannelListProps) {
  const phoneCounts = new Map<string, number>();

  for (const channel of channels) {
    const phoneNumberId = getString(channel.configuracionPublica.phone_number_id);
    if (phoneNumberId) phoneCounts.set(phoneNumberId, (phoneCounts.get(phoneNumberId) ?? 0) + 1);
  }

  return (
    <div className="overflow-auto rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Canal</th>
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Conexion</th>
            <th className="px-4 py-3">phone_number_id</th>
            <th className="px-4 py-3">WABA</th>
            <th className="px-4 py-3">Duplicado</th>
            <th className="px-4 py-3">Accion</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((channel) => {
            const phoneNumberId = getString(channel.configuracionPublica.phone_number_id);
            const wabaId = getString(channel.configuracionPublica.waba_id);
            const duplicate = phoneNumberId
              ? (phoneCounts.get(phoneNumberId) ?? 0) > 1
              : false;

            return (
              <tr className="border-t" key={channel.id}>
                <td className="px-4 py-3">{INBOX_CHANNEL_LABELS[channel.canal]}</td>
                <td className="px-4 py-3 font-medium">{channel.nombre}</td>
                <td className="px-4 py-3">{channel.estado}</td>
                <td className="px-4 py-3">
                  {INBOX_CONNECTION_STATUS_LABELS[channel.conexionEstado]}
                </td>
                <td className="break-all px-4 py-3 font-mono text-xs">
                  {phoneNumberId ?? "No registrado"}
                </td>
                <td className="break-all px-4 py-3 font-mono text-xs">
                  {wabaId ?? "No registrado"}
                </td>
                <td className="px-4 py-3">
                  {duplicate ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                      Revisar
                    </span>
                  ) : (
                    "No"
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    className={buttonVariants({ size: "sm", variant: "outline" })}
                    href={`/whapp/canales/${channel.id}`}
                  >
                    Salud
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
