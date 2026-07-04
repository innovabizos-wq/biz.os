import { Button } from "@/components/ui/button";
import { sendWhatsAppTemplateAction } from "@/modules/inbox/actions";
import type { InboxMetaTemplate } from "@/modules/inbox/types";

type InboxWhatsAppTemplateFormProps = {
  canReply: boolean;
  conversacionId: string;
  realWhatsAppReady: boolean;
  redirectTo: string;
  templates: InboxMetaTemplate[];
};

export function InboxWhatsAppTemplateForm({
  canReply,
  conversacionId,
  realWhatsAppReady,
  redirectTo,
  templates,
}: InboxWhatsAppTemplateFormProps) {
  if (!canReply || templates.length === 0) return null;

  return (
    <form action={sendWhatsAppTemplateAction} className="rounded-lg border bg-background p-4">
      <input name="conversacionId" type="hidden" value={conversacionId} />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Plantilla Meta aprobada</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            disabled={!realWhatsAppReady}
            name="templateId"
            required
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.nombre} ({template.idioma})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Variables</span>
          <textarea
            className="min-h-10 w-full rounded-md border bg-background px-3 py-2"
            disabled={!realWhatsAppReady}
            name="variables"
            placeholder="Una variable por linea, en orden"
          />
        </label>
      </div>
      <Button className="mt-3" disabled={!realWhatsAppReady} type="submit">
        Enviar plantilla
      </Button>
    </form>
  );
}
