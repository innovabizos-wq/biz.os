import { CRM_INTERACCION_TIPOS } from "@/modules/crm/constants";
import { createInteractionAction } from "@/modules/crm/actions";
import { Button } from "@/components/ui/button";

type InteractionFormProps = {
  clienteId: string;
};

export function InteractionForm({ clienteId }: InteractionFormProps) {
  return (
    <form
      action={createInteractionAction}
      className="grid gap-4 rounded-lg border bg-background p-5 shadow-sm"
    >
      <input name="clienteId" type="hidden" value={clienteId} />
      <div>
        <h3 className="text-base font-semibold">Nueva interaccion</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Registro manual. No integra WhatsApp ni llamadas reales todavia.
        </p>
      </div>

      <label className="space-y-2 text-sm font-medium">
        Tipo
        <select
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue="nota"
          name="tipo"
          required
        >
          {CRM_INTERACCION_TIPOS.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2 text-sm font-medium">
        Resultado
        <input
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          name="resultado"
        />
      </label>

      <label className="space-y-2 text-sm font-medium">
        Resumen
        <textarea
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
          name="resumen"
          required
        />
      </label>

      <Button className="w-fit" type="submit">
        Registrar interaccion
      </Button>
    </form>
  );
}
