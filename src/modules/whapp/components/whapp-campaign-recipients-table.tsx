import { Button } from "@/components/ui/button";
import { updateInboxCampaignRecipientStatusAction } from "@/modules/inbox/actions";
import { INBOX_CAMPAIGN_RECIPIENT_STATUS_LABELS } from "@/modules/inbox/constants";
import type {
  InboxCampaign,
  InboxCampaignRecipient,
} from "@/modules/inbox/types";

type WhappCampaignRecipientsTableProps = {
  campaigns: InboxCampaign[];
  canManage: boolean;
  recipients: InboxCampaignRecipient[];
};

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-CR");
}

function statusClassName(status: InboxCampaignRecipient["estado"]) {
  if (status === "respondido") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (status === "fallido") return "border-red-200 bg-red-50 text-red-800";
  if (status === "en_cola" || status === "enviado") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }
  if (status === "excluido") return "border-slate-200 bg-slate-50 text-slate-500";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export function WhappCampaignRecipientsTable({
  campaigns,
  canManage,
  recipients,
}: WhappCampaignRecipientsTableProps) {
  const campaignNames = new Map(
    campaigns.map((campaign) => [campaign.id, campaign.nombre]),
  );

  return (
    <div className="overflow-auto rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Destinatario</th>
            <th className="px-4 py-3">Campana</th>
            <th className="px-4 py-3">Opt-in</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Tracking</th>
            <th className="px-4 py-3">Error</th>
            {canManage ? <th className="px-4 py-3">Control</th> : null}
          </tr>
        </thead>
        <tbody>
          {recipients.map((recipient) => (
            <tr className="border-t align-top" key={recipient.id}>
              <td className="px-4 py-3">
                <p className="font-medium">{recipient.nombre ?? "Sin nombre"}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {recipient.telefono}
                </p>
                {recipient.externalRecipientId ? (
                  <p className="text-xs text-muted-foreground">
                    ID: {recipient.externalRecipientId}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3">
                {campaignNames.get(recipient.campaignId) ?? "Campana"}
              </td>
              <td className="px-4 py-3">
                <p>{recipient.optIn ? "Confirmado" : "No confirmado"}</p>
                <p className="text-xs text-muted-foreground">
                  {recipient.optInSource ?? "Sin origen"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(recipient.optInAt)}
                </p>
              </td>
              <td className="px-4 py-3">
                <span
                  className={[
                    "inline-flex rounded-full border px-2 py-1 text-xs font-bold",
                    statusClassName(recipient.estado),
                  ].join(" ")}
                >
                  {INBOX_CAMPAIGN_RECIPIENT_STATUS_LABELS[recipient.estado]}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs">
                <p>Int: {recipient.attemptCount}</p>
                <p>Env: {formatDate(recipient.sentAt)}</p>
                <p>Ent: {formatDate(recipient.deliveredAt)}</p>
                <p>Lee: {formatDate(recipient.readAt)}</p>
                <p>Resp: {formatDate(recipient.repliedAt)}</p>
                {recipient.canalMessageId ? (
                  <p className="font-mono text-muted-foreground">
                    {recipient.canalMessageId}
                  </p>
                ) : null}
              </td>
              <td className="max-w-xs px-4 py-3 text-xs text-muted-foreground">
                {recipient.lastError ?? "Sin error"}
              </td>
              {canManage ? (
                <td className="min-w-44 px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {recipient.estado === "excluido" ||
                    recipient.estado === "fallido" ? (
                      <form action={updateInboxCampaignRecipientStatusAction}>
                        <input
                          name="recipientId"
                          type="hidden"
                          value={recipient.id}
                        />
                        <input name="estado" type="hidden" value="listo" />
                        <Button size="sm" type="submit" variant="outline">
                          Restaurar
                        </Button>
                      </form>
                    ) : null}
                    {![
                      "enviado",
                      "entregado",
                      "leido",
                      "respondido",
                      "excluido",
                    ].includes(recipient.estado) ? (
                      <form action={updateInboxCampaignRecipientStatusAction}>
                        <input
                          name="recipientId"
                          type="hidden"
                          value={recipient.id}
                        />
                        <input name="estado" type="hidden" value="excluido" />
                        <Button size="sm" type="submit" variant="outline">
                          Excluir
                        </Button>
                      </form>
                    ) : null}
                    {recipient.estado === "en_cola" ? (
                      <form action={updateInboxCampaignRecipientStatusAction}>
                        <input
                          name="recipientId"
                          type="hidden"
                          value={recipient.id}
                        />
                        <input name="estado" type="hidden" value="fallido" />
                        <input
                          name="lastError"
                          type="hidden"
                          value="Marcado manualmente antes del envio."
                        />
                        <Button size="sm" type="submit" variant="outline">
                          Fallido
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
