import { Button } from "@/components/ui/button";
import {
  dispatchInboxCampaignBatchAction,
  prepareInboxCampaignQueueAction,
  updateInboxCampaignStatusAction,
} from "@/modules/inbox/actions";
import {
  INBOX_CAMPAIGN_STATUS_LABELS,
  INBOX_META_TEMPLATE_CATEGORY_LABELS,
} from "@/modules/inbox/constants";
import type { InboxCampaign } from "@/modules/inbox/types";

type WhappCampaignsTableProps = {
  campaigns: InboxCampaign[];
  canManage: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "Sin programar";
  return new Date(value).toLocaleString("es-CR");
}

function statusClassName(status: InboxCampaign["estado"]) {
  if (status === "enviada") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "enviando") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "programada") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "cancelada") return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getAudienceNotes(campaign: InboxCampaign) {
  const value = campaign.audiencia.notas;
  return typeof value === "string" && value.trim() ? value.trim() : "Sin audiencia";
}

export function WhappCampaignsTable({
  campaigns,
  canManage,
}: WhappCampaignsTableProps) {
  return (
    <div className="overflow-auto rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Campana</th>
            <th className="px-4 py-3">Canal</th>
            <th className="px-4 py-3">Plantilla</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Programacion</th>
            <th className="px-4 py-3">Metricas</th>
            {canManage ? <th className="px-4 py-3">Control</th> : null}
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr className="border-t align-top" key={campaign.id}>
              <td className="max-w-md px-4 py-3">
                <p className="font-medium">{campaign.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {campaign.objetivo ?? "Sin objetivo"}
                </p>
                <p className="mt-2 line-clamp-2 text-muted-foreground">
                  {getAudienceNotes(campaign)}
                </p>
              </td>
              <td className="px-4 py-3">{campaign.canalNombre ?? "WhatsApp Meta"}</td>
              <td className="px-4 py-3">
                <p>{campaign.plantillaNombre ?? "Plantilla"}</p>
                <p className="text-xs text-muted-foreground">
                  {campaign.plantillaCategoria
                    ? INBOX_META_TEMPLATE_CATEGORY_LABELS[
                        campaign.plantillaCategoria
                      ]
                    : "Sin categoria"}
                  {campaign.plantillaIdioma ? ` - ${campaign.plantillaIdioma}` : ""}
                </p>
              </td>
              <td className="px-4 py-3">
                <span
                  className={[
                    "inline-flex rounded-full border px-2 py-1 text-xs font-bold",
                    statusClassName(campaign.estado),
                  ].join(" ")}
                >
                  {INBOX_CAMPAIGN_STATUS_LABELS[campaign.estado]}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {formatDate(campaign.scheduledAt)}
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                <p>dest: {campaign.recipientCount}</p>
                <p>env: {campaign.sentCount}</p>
                <p>resp: {campaign.repliedCount}</p>
                <p>fall: {campaign.failedCount}</p>
              </td>
              {canManage ? (
                <td className="min-w-48 px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {["borrador", "programada", "pausada"].includes(
                      campaign.estado,
                    ) ? (
                      <form action={prepareInboxCampaignQueueAction}>
                        <input
                          name="campaignId"
                          type="hidden"
                          value={campaign.id}
                        />
                        <Button size="sm" type="submit" variant="outline">
                          Preparar cola
                        </Button>
                      </form>
                    ) : null}
                    {campaign.estado === "enviando" ||
                    campaign.estado === "programada" ? (
                      <form action={updateInboxCampaignStatusAction}>
                        <input
                          name="campaignId"
                          type="hidden"
                          value={campaign.id}
                        />
                        <input name="estado" type="hidden" value="pausada" />
                        <Button size="sm" type="submit" variant="outline">
                          Pausar
                        </Button>
                      </form>
                    ) : null}
                    {campaign.estado === "enviando" ? (
                      <form action={dispatchInboxCampaignBatchAction}>
                        <input
                          name="campaignId"
                          type="hidden"
                          value={campaign.id}
                        />
                        <Button size="sm" type="submit">
                          Despachar lote
                        </Button>
                      </form>
                    ) : null}
                    {campaign.estado === "pausada" ? (
                      <form action={updateInboxCampaignStatusAction}>
                        <input
                          name="campaignId"
                          type="hidden"
                          value={campaign.id}
                        />
                        <input name="estado" type="hidden" value="programada" />
                        <Button size="sm" type="submit" variant="outline">
                          Reabrir
                        </Button>
                      </form>
                    ) : null}
                    {campaign.estado !== "cancelada" &&
                    campaign.estado !== "enviada" ? (
                      <form action={updateInboxCampaignStatusAction}>
                        <input
                          name="campaignId"
                          type="hidden"
                          value={campaign.id}
                        />
                        <input name="estado" type="hidden" value="cancelada" />
                        <Button size="sm" type="submit" variant="outline">
                          Cancelar
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
