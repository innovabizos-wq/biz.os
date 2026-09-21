import { randomUUID } from "node:crypto";

import {
  applySaleInventoryAction,
  releaseSaleInventoryAction,
  reserveSaleInventoryAction,
} from "@/modules/sales-inventory/actions";
import type { SaleInventoryWarehouse } from "@/modules/sales-inventory/types";
import { Button } from "@/components/ui/button";

type ApplySaleInventoryFormProps = {
  canApply: boolean;
  hasReservation: boolean;
  reservedWarehouseId: string | null;
  saleId: string;
  warehouses: SaleInventoryWarehouse[];
};

export function ApplySaleInventoryForm({
  canApply,
  hasReservation,
  reservedWarehouseId,
  saleId,
  warehouses,
}: ApplySaleInventoryFormProps) {
  if (!canApply) {
    return null;
  }

  const reservedWarehouse = warehouses.find(
    (warehouse) => warehouse.id === reservedWarehouseId,
  );

  if (hasReservation && reservedWarehouseId) {
    return (
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <div>
          <p className="font-medium text-emerald-950">Inventario reservado</p>
          <p className="text-sm text-emerald-800">
            {reservedWarehouse?.nombre ?? "Bodega seleccionada"}. La salida física consumirá esta reserva.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={releaseSaleInventoryAction}>
            <input name="operationId" type="hidden" value={randomUUID()} />
            <input name="reason" type="hidden" value="Cambio operativo antes del despacho" />
            <input name="ventaId" type="hidden" value={saleId} />
            <Button type="submit" variant="outline">
              Liberar reserva
            </Button>
          </form>
          <form action={applySaleInventoryAction}>
            <input name="bodegaId" type="hidden" value={reservedWarehouseId} />
            <input name="operationId" type="hidden" value={randomUUID()} />
            <input name="ventaId" type="hidden" value={saleId} />
            <Button type="submit">Registrar salida física</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-background p-4">
      <input name="ventaId" type="hidden" value={saleId} />
      <input name="operationId" type="hidden" value={randomUUID()} />
      <label className="space-y-1 text-sm">
        <span className="font-medium">Bodega de salida</span>
        <select
          className="h-9 min-w-56 rounded-md border bg-background px-3 text-sm"
          name="bodegaId"
          required
        >
          <option value="">Seleccionar bodega</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.nombre}
            </option>
          ))}
        </select>
      </label>
      <Button
        disabled={warehouses.length === 0}
        formAction={reserveSaleInventoryAction}
        type="submit"
        variant="outline"
      >
        Reservar para entrega
      </Button>
      <Button
        disabled={warehouses.length === 0}
        formAction={applySaleInventoryAction}
        type="submit"
      >
        Aplicar salida ahora
      </Button>
    </form>
  );
}
