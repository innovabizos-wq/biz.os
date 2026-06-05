import { createAutoblogTopicAction } from "@/modules/autoblog/actions";
import {
  AUTOBLOG_SOURCE_MODE_LABELS,
  AUTOBLOG_SOURCE_MODES,
} from "@/modules/autoblog/constants";
import { Button } from "@/components/ui/button";

type AutoblogTopicFormProps = {
  canCreate: boolean;
};

export function AutoblogTopicForm({ canCreate }: AutoblogTopicFormProps) {
  return (
    <form action={createAutoblogTopicAction} className="rounded-lg border bg-background p-5">
      <fieldset className="space-y-4" disabled={!canCreate}>
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Tema/titulo base</span>
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              name="title"
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Modo</span>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              defaultValue="manual"
              name="sourceMode"
            >
              {AUTOBLOG_SOURCE_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {AUTOBLOG_SOURCE_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Descripcion del tema</span>
          <textarea
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
            name="description"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">URLs de fuente opcionales</span>
          <textarea
            className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
            name="sourceUrlsText"
            placeholder="Una URL por linea"
          />
        </label>
        <div className="flex justify-end">
          <Button disabled={!canCreate} type="submit">
            Guardar tema
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
