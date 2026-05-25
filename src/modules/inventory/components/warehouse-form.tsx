import {
  createWarehouseAction,
  updateWarehouseAction,
} from "@/modules/inventory/actions";
import type { InventoryWarehouse } from "@/modules/inventory/types";
import { Button } from "@/components/ui/button";

type WarehouseFormProps = {
  mode: "create" | "update";
  warehouse?: InventoryWarehouse;
};

export function WarehouseForm({ mode, warehouse }: WarehouseFormProps) {
  const action = mode === "create" ? createWarehouseAction : updateWarehouseAction;

  return (
    <form action={action} className="space-y-4 rounded-lg border bg-background p-5">
      {warehouse ? <input name="bodegaId" type="hidden" value={warehouse.id} /> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nombre</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={warehouse?.nombre ?? ""}
            name="nombre"
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Ubicacion</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={warehouse?.ubicacion ?? ""}
            name="ubicacion"
          />
        </label>
        <div className="flex items-end">
          <Button type="submit">
            {mode === "create" ? "Crear bodega" : "Guardar bodega"}
          </Button>
        </div>
      </div>
      <label className="space-y-1 text-sm">
        <span className="font-medium">Descripcion</span>
        <input
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue={warehouse?.descripcion ?? ""}
          name="descripcion"
        />
      </label>
    </form>
  );
}
