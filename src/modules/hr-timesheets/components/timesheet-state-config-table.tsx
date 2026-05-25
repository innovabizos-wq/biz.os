import { Button } from "@/components/ui/button";
import { TIMESHEET_STATE_TYPE_LABELS, TIMESHEET_STATE_TYPES } from "@/modules/hr-timesheets/constants";
import {
  createTimesheetStateAction,
  initializeTimesheetStatesAction,
  toggleTimesheetStateAction,
  updateTimesheetStateAction,
} from "@/modules/hr-timesheets/actions";
import type { TimesheetState } from "@/modules/hr-timesheets/types";

type TimesheetStateConfigTableProps = {
  states: TimesheetState[];
};

function StateTypeSelect({
  defaultValue,
  name = "tipo",
}: {
  defaultValue?: string;
  name?: string;
}) {
  return (
    <select
      className="h-9 rounded-md border bg-background px-2 text-sm"
      defaultValue={defaultValue ?? "personalizado"}
      name={name}
    >
      {TIMESHEET_STATE_TYPES.map((type) => (
        <option key={type} value={type}>
          {TIMESHEET_STATE_TYPE_LABELS[type]}
        </option>
      ))}
    </select>
  );
}

export function TimesheetStateConfigTable({
  states,
}: TimesheetStateConfigTableProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Estados base</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Crea o repara Login, Almuerzo, Pausas, Breaks y Salida para esta empresa.
            </p>
          </div>
          <form action={initializeTimesheetStatesAction}>
            <Button type="submit" variant="outline">
              Inicializar estados base
            </Button>
          </form>
        </div>
      </div>

      <form
        action={createTimesheetStateAction}
        className="rounded-lg border bg-background p-4"
      >
        <p className="text-sm font-semibold">Crear estado personalizado</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Codigo</span>
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              name="codigo"
              placeholder="reunion_interna"
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Nombre</span>
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              name="nombre"
              placeholder="Reunion interna"
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Tipo</span>
            <StateTypeSelect />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Color</span>
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              name="color"
              placeholder="#2563eb"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Orden</span>
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              defaultValue={120}
              min={0}
              name="orden"
              type="number"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Estado regreso</span>
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              name="estadoRegresoCodigo"
              placeholder="regreso_reunion"
            />
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input name="requiereRegreso" type="checkbox" />
            Requiere regreso
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input name="cuentaComoTrabajo" type="checkbox" />
            Cuenta como trabajo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="cuentaComoPausa" type="checkbox" />
            Cuenta como pausa
          </label>
        </div>
        <div className="mt-4">
          <Button type="submit">Crear estado</Button>
        </div>
      </form>

      <div className="space-y-3">
        {states.map((state) => (
          <div className="rounded-lg border bg-background p-4" key={state.id}>
            <form action={updateTimesheetStateAction} className="grid gap-3 xl:grid-cols-[1fr_1fr_150px_110px_auto]">
              <input name="estadoId" type="hidden" value={state.id} />
              <label className="space-y-1 text-sm">
                <span className="font-medium">Codigo</span>
                <input
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:bg-muted"
                  defaultValue={state.code}
                  disabled={state.isSystem}
                  name="codigo"
                  required
                />
                {state.isSystem ? (
                  <input name="codigo" type="hidden" value={state.code} />
                ) : null}
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Nombre</span>
                <input
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  defaultValue={state.name}
                  name="nombre"
                  required
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Tipo</span>
                <StateTypeSelect defaultValue={state.type} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Orden</span>
                <input
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  defaultValue={state.order}
                  min={0}
                  name="orden"
                  type="number"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Color</span>
                <input
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  defaultValue={state.color ?? ""}
                  name="color"
                />
              </label>
              <label className="space-y-1 text-sm xl:col-span-2">
                <span className="font-medium">Estado regreso</span>
                <input
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  defaultValue={state.returnStateCode ?? ""}
                  name="estadoRegresoCodigo"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  defaultChecked={state.requiresReturn}
                  name="requiereRegreso"
                  type="checkbox"
                />
                Regreso
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  defaultChecked={state.countsAsWork}
                  name="cuentaComoTrabajo"
                  type="checkbox"
                />
                Trabajo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  defaultChecked={state.countsAsBreak}
                  name="cuentaComoPausa"
                  type="checkbox"
                />
                Pausa
              </label>
              <div className="flex flex-wrap items-center gap-2 xl:col-span-5">
                <Button size="sm" type="submit" variant="outline">
                  Guardar
                </Button>
                <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
                  {state.isSystem ? "Sistema" : "Personalizado"}
                </span>
                <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
                  {state.active ? "Activo" : "Inactivo"}
                </span>
              </div>
            </form>
            <form action={toggleTimesheetStateAction} className="mt-2">
              <input name="estadoId" type="hidden" value={state.id} />
              <input
                name="activo"
                type="hidden"
                value={state.active ? "false" : "true"}
              />
              <Button size="sm" type="submit" variant="ghost">
                {state.active ? "Desactivar" : "Activar"}
              </Button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
