import { Button } from "@/components/ui/button";
import { upsertInboxAutomationRuleAction } from "@/modules/inbox/actions";
import {
  INBOX_AUTOMATION_ACTION_LABELS,
  INBOX_AUTOMATION_ACTIONS,
  INBOX_AUTOMATION_MODE_LABELS,
  INBOX_AUTOMATION_MODES,
  INBOX_AUTOMATION_STATUS_LABELS,
  INBOX_AUTOMATION_STATUSES,
  INBOX_AUTOMATION_TRIGGER_LABELS,
  INBOX_AUTOMATION_TRIGGERS,
} from "@/modules/inbox/constants";
import type { InboxChannelConfig } from "@/modules/inbox/types";

type WhappAutomationFormProps = {
  canManage: boolean;
  channels: InboxChannelConfig[];
};

export function WhappAutomationForm({
  canManage,
  channels,
}: WhappAutomationFormProps) {
  if (!canManage) return null;

  return (
    <form
      action={upsertInboxAutomationRuleAction}
      className="rounded-lg border bg-background p-5"
    >
      <div className="mb-4">
        <h2 className="font-semibold">Nueva regla de autopilot</h2>
        <p className="text-sm text-muted-foreground">
          Define que debe detectar Whapp, como debe operar y que accion queda
          preparada para ejecucion asistida o automatica.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nombre</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            name="nombre"
            placeholder="Priorizar leads urgentes"
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Canal</span>
          <select className="h-9 w-full rounded-md border bg-background px-3" name="canalId">
            <option value="">Todos los canales</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Prioridad</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue={100}
            max={999}
            min={1}
            name="prioridad"
            type="number"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Disparador</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3"
            name="triggerTipo"
          >
            {INBOX_AUTOMATION_TRIGGERS.map((trigger) => (
              <option key={trigger} value={trigger}>
                {INBOX_AUTOMATION_TRIGGER_LABELS[trigger]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Accion</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3"
            name="accionTipo"
          >
            {INBOX_AUTOMATION_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {INBOX_AUTOMATION_ACTION_LABELS[action]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Modo</span>
          <select className="h-9 w-full rounded-md border bg-background px-3" name="modo">
            {INBOX_AUTOMATION_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {INBOX_AUTOMATION_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Estado</span>
          <select className="h-9 w-full rounded-md border bg-background px-3" name="estado">
            {INBOX_AUTOMATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {INBOX_AUTOMATION_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium">Descripcion</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            name="descripcion"
            placeholder="Cuando llegue un mensaje con intencion de compra, crear sugerencia para el agente."
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Condiciones</span>
          <textarea
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2"
            name="condiciones"
            placeholder='Texto simple o JSON: {"palabras":["precio","cotizacion"]}'
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Configuracion de accion</span>
          <textarea
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2"
            name="accionConfig"
            placeholder='Texto simple o JSON: {"nota":"Lead con intencion alta"}'
          />
        </label>
      </div>

      <Button className="mt-4" type="submit">
        Guardar automatizacion
      </Button>
    </form>
  );
}
