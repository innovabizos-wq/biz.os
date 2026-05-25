import type { InventoryWarehouse } from "@/modules/inventory/types";
import { WarehouseForm } from "@/modules/inventory/components/warehouse-form";
import { WarehouseStatusForm } from "@/modules/inventory/components/warehouse-status-form";

type WarehousesTableProps = {
  canManage: boolean;
  warehouses: InventoryWarehouse[];
};

export function WarehousesTable({ canManage, warehouses }: WarehousesTableProps) {
  return (
    <div className="space-y-4">
      {warehouses.map((warehouse) => (
        <div className="rounded-lg border bg-background p-5" key={warehouse.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-semibold">{warehouse.nombre}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {warehouse.ubicacion ?? "Sin ubicacion"} · {warehouse.estado}
              </p>
              {warehouse.descripcion ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {warehouse.descripcion}
                </p>
              ) : null}
            </div>
            <WarehouseStatusForm canManage={canManage} warehouse={warehouse} />
          </div>
          {canManage ? (
            <div className="mt-4">
              <WarehouseForm mode="update" warehouse={warehouse} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
