import { Button } from "@/components/ui/button";
import { upsertInboxCampaignAction } from "@/modules/inbox/actions";
import {
  INBOX_CAMPAIGN_STATUS_LABELS,
  INBOX_CAMPAIGN_STATUSES,
} from "@/modules/inbox/constants";
import type {
  InboxChannelConfig,
  InboxMetaTemplate,
} from "@/modules/inbox/types";

type WhappCampaignFormProps = {
  canManage: boolean;
  channels: InboxChannelConfig[];
  templates: InboxMetaTemplate[];
};

export function WhappCampaignForm({
  canManage,
  channels,
  templates,
}: WhappCampaignFormProps) {
  if (!canManage) return null;

  const whatsappChannels = channels.filter(
    (channel) =>
      channel.canal === "whatsapp" &&
      channel.proveedor === "meta" &&
      channel.estado === "activo" &&
      channel.conexionEstado === "configurado",
  );
  const approvedTemplates = templates.filter(
    (template) => template.estado === "aprobada",
  );
  const disabled =
    whatsappChannels.length === 0 || approvedTemplates.length === 0;

  return (
    <form action={upsertInboxCampaignAction} className="rounded-lg border bg-background p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Nueva campana WhatsApp</h2>
          <p className="text-sm text-muted-foreground">
            Crea el borrador operativo con plantilla aprobada antes de activar
            envios por cola.
          </p>
        </div>
        {disabled ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
            Requiere canal activo y plantilla aprobada
          </span>
        ) : null}
      </div>

      <fieldset className="grid gap-4 md:grid-cols-3" disabled={disabled}>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nombre</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            name="nombre"
            placeholder="Seguimiento cotizaciones junio"
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Canal WhatsApp Meta</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3"
            name="canalId"
            required
          >
            <option value="">Seleccionar canal</option>
            {whatsappChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Plantilla aprobada</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3"
            name="templateId"
            required
          >
            <option value="">Seleccionar plantilla</option>
            {approvedTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.nombre}
                {template.canalNombre ? ` - ${template.canalNombre}` : " - global"}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Estado</span>
          <select className="h-9 w-full rounded-md border bg-background px-3" name="estado">
            {INBOX_CAMPAIGN_STATUSES.map((status) => (
              <option key={status} value={status}>
                {INBOX_CAMPAIGN_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Programada para</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            name="scheduledAt"
            type="datetime-local"
          />
        </label>
        <label className="space-y-1 text-sm md:col-span-1">
          <span className="font-medium">Objetivo</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            name="objetivo"
            placeholder="Reactivar leads con cotizacion abierta"
          />
        </label>
      </fieldset>

      <label className="mt-4 block space-y-1 text-sm">
        <span className="font-medium">Audiencia prevista</span>
        <textarea
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2"
          disabled={disabled}
          name="audiencia"
          placeholder="Notas, segmento, filtros CRM u origen de la lista."
        />
      </label>

      <Button className="mt-4" disabled={disabled} type="submit">
        Guardar campana
      </Button>
    </form>
  );
}
