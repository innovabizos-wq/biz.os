import { Button } from "@/components/ui/button";
import { upsertMetaTemplateAction } from "@/modules/inbox/actions";
import {
  INBOX_META_TEMPLATE_CATEGORY_LABELS,
  INBOX_META_TEMPLATE_CATEGORIES,
  INBOX_META_TEMPLATE_STATUS_LABELS,
  INBOX_META_TEMPLATE_STATUSES,
} from "@/modules/inbox/constants";
import type { InboxChannelConfig } from "@/modules/inbox/types";

type WhappTemplateFormProps = {
  canManage: boolean;
  channels: InboxChannelConfig[];
};

export function WhappTemplateForm({
  canManage,
  channels,
}: WhappTemplateFormProps) {
  if (!canManage) return null;

  const whatsappChannels = channels.filter(
    (channel) => channel.canal === "whatsapp" && channel.proveedor === "meta",
  );

  return (
    <form action={upsertMetaTemplateAction} className="rounded-lg border bg-background p-5">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nombre Meta</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            name="nombre"
            placeholder="seguimiento_cotizacion"
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Idioma</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue="es"
            name="idioma"
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Canal</span>
          <select className="h-9 w-full rounded-md border bg-background px-3" name="canalId">
            <option value="">Todos los WhatsApp Meta</option>
            {whatsappChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Categoria</span>
          <select className="h-9 w-full rounded-md border bg-background px-3" name="categoria">
            {INBOX_META_TEMPLATE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {INBOX_META_TEMPLATE_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Estado</span>
          <select className="h-9 w-full rounded-md border bg-background px-3" name="estado">
            {INBOX_META_TEMPLATE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {INBOX_META_TEMPLATE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Variables esperadas</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            name="variables"
            placeholder="nombre_cliente&#10;numero_cotizacion"
          />
        </label>
      </div>
      <label className="mt-4 block space-y-1 text-sm">
        <span className="font-medium">Cuerpo de referencia</span>
        <textarea
          className="min-h-28 w-full rounded-md border bg-background px-3 py-2"
          name="cuerpo"
          placeholder="Hola {{1}}, te escribimos sobre tu cotizacion {{2}}."
          required
        />
      </label>
      <Button className="mt-4" type="submit">
        Guardar plantilla
      </Button>
    </form>
  );
}
