import { changeWarehouseStatusAction } from "@/modules/inventory/actions";
import type { InventoryWarehouse } from "@/modules/inventory/types";
import { Button } from "@/components/ui/button";

type WarehouseStatusFormProps = {
  canManage: boolean;
  warehouse: InventoryWarehouse;
};

export function WarehouseStatusForm({
  canManage,
  warehouse,
}: WarehouseStatusFormProps) {
  if (!canManage) {
    return null;
  }

  const nextStatus = warehouse.estado === "activa" ? "inactiva" : "activa";

  return (
    <form action={changeWarehouseStatusAction}>
      <input name="bodegaId" type="hidden" value={warehouse.id} />
      <input name="estado" type="hidden" value={nextStatus} />
      <Button size="sm" type="submit" variant="outline">
        {nextStatus === "activa" ? "Activar" : "Inactivar"}
      </Button>
    </form>
  );
}
