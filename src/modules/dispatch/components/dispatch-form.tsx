import {
  createDispatchFromSaleAction,
  updateDispatchAction,
} from "@/modules/dispatch/actions";
import type {
  DispatchAssignableUser,
  DispatchOrder,
} from "@/modules/dispatch/types";
import { Button } from "@/components/ui/button";

type DispatchFormProps = {
  dispatch?: DispatchOrder;
  mode: "create" | "update";
  users: DispatchAssignableUser[];
  ventaId?: string;
};

export function DispatchForm({ dispatch, mode, users, ventaId }: DispatchFormProps) {
  const action =
    mode === "create" ? createDispatchFromSaleAction : updateDispatchAction;

  return (
    <form action={action} className="space-y-4 rounded-lg border bg-background p-5">
      {mode === "create" && ventaId ? (
        <input name="ventaId" type="hidden" value={ventaId} />
      ) : null}
      {dispatch ? <input name="despachoId" type="hidden" value={dispatch.id} /> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Fecha programada</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={dispatch?.fechaProgramada ?? ""}
            name="fechaProgramada"
            type="date"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Hora</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={dispatch?.horaProgramada ?? ""}
            name="horaProgramada"
            type="time"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Responsable</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={dispatch?.responsableId ?? ""}
            name="responsableId"
          >
            <option value="">Sin responsable</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="space-y-1 text-sm">
        <span className="font-medium">Direccion / ubicacion textual</span>
        <input
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue={dispatch?.direccionEntrega ?? ""}
          name="direccionEntrega"
        />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Contacto</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={dispatch?.contactoEntrega ?? ""}
            name="contactoEntrega"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Telefono</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={dispatch?.telefonoEntrega ?? ""}
            name="telefonoEntrega"
          />
        </label>
      </div>
      <label className="space-y-1 text-sm">
        <span className="font-medium">Notas operativas</span>
        <textarea
          className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
          defaultValue={dispatch?.notas ?? ""}
          name="notas"
        />
      </label>
      <Button type="submit">
        {mode === "create" ? "Crear despacho" : "Guardar despacho"}
      </Button>
    </form>
  );
}
