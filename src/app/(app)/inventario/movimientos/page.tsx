import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { DEFAULT_INVENTORY_MOVEMENT_TYPE_FILTER } from "@/modules/inventory/constants";
import { InventoryMovementsTable } from "@/modules/inventory/components/inventory-movements-table";
import { getInventoryMovements } from "@/modules/inventory/queries";
import { inventoryMovementTypeFilterSchema } from "@/modules/inventory/schemas";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type InventoryMovementsPageProps = {
  searchParams?: Promise<{ error?: string; tipo?: string }>;
};

export default async function InventoryMovementsPage({
  searchParams,
}: InventoryMovementsPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canView =
    hasPermission(access.tenant.permissions, "inventory.movements.view") ||
    hasPermission(access.tenant.permissions, "inventory.stock.adjust");
  const type =
    inventoryMovementTypeFilterSchema.safeParse(params?.tipo).data ??
    DEFAULT_INVENTORY_MOVEMENT_TYPE_FILTER;

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta sección."
          eyebrow="Inventario"
          title="Movimientos"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const movements = await getInventoryMovements(access.tenant, type);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Historial de entradas, salidas y ajustes manuales."
        eyebrow="Inventario"
        title="Movimientos"
      />

      <EphemeralPageAlert error={params?.error} />

      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-background p-4" method="get">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Tipo</span>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            defaultValue={type}
            name="tipo"
          >
            <option value="todos">Todos</option>
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
            <option value="ajuste">Ajuste</option>
          </select>
        </label>
        <Button type="submit">Filtrar</Button>
      </form>

      {!movements.ok ? (
        <EmptyState description={movements.error.message} title="No se pudo cargar" />
      ) : movements.data.length > 0 ? (
        <InventoryMovementsTable movements={movements.data} />
      ) : (
        <EmptyState
          description="Los movimientos apareceran despues de registrar entradas, salidas o ajustes."
          title="Sin movimientos"
        />
      )}
    </section>
  );
}
