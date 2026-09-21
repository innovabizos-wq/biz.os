import { Button } from "@/components/ui/button";
import {
  syncWhatsAppTemplatesAction,
  upsertMetaTemplateAction,
} from "@/modules/inbox/actions";
import {
  INBOX_META_TEMPLATE_CATEGORY_LABELS,
  INBOX_META_TEMPLATE_CATEGORIES,
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
    <div className="space-y-4">
      <form action={syncWhatsAppTemplatesAction} className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1 space-y-1 text-sm">
            <span className="font-medium">Canal oficial</span>
            <select className="h-9 w-full rounded-md border bg-background px-3" name="canalId" required>
              <option value="">Seleccionar WhatsApp Meta</option>
              {whatsappChannels.map((channel) => (
                <option key={channel.id} value={channel.id}>{channel.nombre}</option>
              ))}
            </select>
          </label>
          <Button type="submit">Sincronizar con Meta</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          El estado aprobado, la categoría y la calidad siempre se toman directamente de Meta.
        </p>
      </form>

      <form action={upsertMetaTemplateAction} className="rounded-lg border bg-background p-5">
      <input name="estado" type="hidden" value="borrador" />
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
        Guardar borrador local
      </Button>
      </form>
    </div>
  );
}
