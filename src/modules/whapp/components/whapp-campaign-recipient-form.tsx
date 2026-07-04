import { Button } from "@/components/ui/button";
import { addInboxCampaignRecipientAction } from "@/modules/inbox/actions";
import { INBOX_CAMPAIGN_STATUS_LABELS } from "@/modules/inbox/constants";
import type {
  InboxCampaign,
  InboxCampaignStatus,
} from "@/modules/inbox/types";

type WhappCampaignRecipientFormProps = {
  campaigns: InboxCampaign[];
  canManage: boolean;
};

const EDITABLE_CAMPAIGN_STATUSES = [
  "borrador",
  "programada",
  "pausada",
] satisfies InboxCampaignStatus[];
const EDITABLE_CAMPAIGN_STATUS_SET = new Set<InboxCampaignStatus>(
  EDITABLE_CAMPAIGN_STATUSES,
);

export function WhappCampaignRecipientForm({
  campaigns,
  canManage,
}: WhappCampaignRecipientFormProps) {
  if (!canManage) return null;

  const editableCampaigns = campaigns.filter((campaign) =>
    EDITABLE_CAMPAIGN_STATUS_SET.has(campaign.estado),
  );
  const disabled = editableCampaigns.length === 0;

  return (
    <form
      action={addInboxCampaignRecipientAction}
      className="rounded-lg border bg-background p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Audiencia con opt-in</h2>
          <p className="text-sm text-muted-foreground">
            Carga destinatarios validos para la cola de envio de campanas.
          </p>
        </div>
        {disabled ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
            Requiere campana editable
          </span>
        ) : null}
      </div>

      <fieldset className="grid gap-4 md:grid-cols-3" disabled={disabled}>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Campana</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3"
            name="campaignId"
            required
          >
            <option value="">Seleccionar campana</option>
            {editableCampaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.nombre} - {INBOX_CAMPAIGN_STATUS_LABELS[campaign.estado]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nombre</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            name="nombre"
            placeholder="Maria Gomez"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Telefono WhatsApp</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            name="telefono"
            placeholder="+50688889999"
            required
            type="tel"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Origen del opt-in</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue="manual_whapp"
            name="optInSource"
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">ID externo</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            name="externalRecipientId"
            placeholder="lead_123"
          />
        </label>
        <label className="flex items-center gap-2 pt-6 text-sm">
          <input className="size-4" name="optIn" required type="checkbox" />
          <span>Confirmo opt-in valido para recibir mensajes.</span>
        </label>
      </fieldset>

      <label className="mt-4 block space-y-1 text-sm">
        <span className="font-medium">Variables / notas</span>
        <textarea
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2"
          disabled={disabled}
          name="variables"
          placeholder='{"nombre":"Maria","monto":"125000"}'
        />
      </label>

      <Button className="mt-4" disabled={disabled} type="submit">
        Agregar destinatario
      </Button>
    </form>
  );
}
