import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { prepareFiscalDocumentFromSaleAction } from "@/modules/billing/actions";
import { SaleDispatchPanel } from "@/modules/dispatch/components/sale-dispatch-panel";
import {
  canAccessDispatchNav,
  getAssignableUsersForDispatch,
  getDispatchForSale,
} from "@/modules/dispatch/queries";
import { SaleItemsTable } from "@/modules/sales/components/sale-items-table";
import { SaleNotesForm } from "@/modules/sales/components/sale-notes-form";
import { SaleStatusActions } from "@/modules/sales/components/sale-status-actions";
import { SaleSummaryCard } from "@/modules/sales/components/sale-summary-card";
import { getSaleDetail, getSaleItems } from "@/modules/sales/queries";
import { SaleInventoryPanel } from "@/modules/sales-inventory/components/sale-inventory-panel";
import {
  canApplySaleInventory,
  canViewSaleInventoryPanel,
  getActiveWarehousesForSaleInventory,
  getSaleInventorySummary,
} from "@/modules/sales-inventory/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type SaleDetailPageProps = {
  params: Promise<{ ventaId: string }>;
  searchParams?: Promise<{ error?: string }>;
};

export default async function SaleDetailPage({
  params,
  searchParams,
}: SaleDetailPageProps) {
  const [{ ventaId }, query, access] = await Promise.all([
    params,
    searchParams,
    requireAdminAccess(),
  ]);
  const canView = hasPermission(access.tenant.permissions, "sales.orders.view");
  const canEdit = hasPermission(access.tenant.permissions, "sales.orders.edit");
  const canChangeStatus = hasPermission(
    access.tenant.permissions,
    "sales.orders.status.change",
  );
  const canViewInventory = canViewSaleInventoryPanel(access.tenant);
  const canApplyInventory = canApplySaleInventory(access.tenant);
  const canViewDispatch = canAccessDispatchNav(access.tenant);
  const canCreateDispatch = hasPermission(
    access.tenant.permissions,
    "dispatch.orders.create",
  );
  const canViewPayments =
    isModuleActive(access.tenant.activeModules, "payments") &&
    hasPermission(access.tenant.permissions, "payments.accounts.view");
  const billingActive = isModuleActive(access.tenant.activeModules, "billing");
  const canViewBilling =
    billingActive &&
    hasAnyPermission(access.tenant.permissions, [
      "billing.view",
      "billing.config.view",
      "billing.invoices.view",
      "billing.fiscal.view",
    ]);
  const canPrepareFiscalDocument =
    billingActive &&
    hasAnyPermission(access.tenant.permissions, [
      "billing.issue",
      "billing.invoices.create",
    ]);

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta sección."
          eyebrow="Comercial"
          title="Venta"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [
    sale,
    items,
    inventorySummary,
    inventoryWarehouses,
    dispatch,
    dispatchUsers,
  ] = await Promise.all([
    getSaleDetail(access.tenant, ventaId),
    getSaleItems(access.tenant, ventaId),
    canViewInventory ? getSaleInventorySummary(access.tenant, ventaId) : null,
    canApplyInventory ? getActiveWarehousesForSaleInventory(access.tenant) : null,
    canViewDispatch ? getDispatchForSale(access.tenant, ventaId) : null,
    canCreateDispatch ? getAssignableUsersForDispatch(access.tenant) : null,
  ]);

  if (!sale.ok || !sale.data) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Orden comercial congelada desde una cotizacion confirmada."
        eyebrow="Comercial"
        title={sale.data.numero}
      />

      {query?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </p>
      ) : null}

      <div className="rounded-lg border bg-background p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Estado</p>
            <p className="mt-1 text-lg font-semibold">{sale.data.estado}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Cliente: {sale.data.clienteNombre ?? "Sin cliente"} | Fecha:{" "}
              {sale.data.fechaVenta}
            </p>
            {sale.data.cotizacionId ? (
              <Link
                className={buttonVariants({ size: "sm", variant: "outline" })}
                href={`/cotizaciones/${sale.data.cotizacionId}`}
              >
                Ver cotización {sale.data.cotizacionNumero}
              </Link>
            ) : null}
          </div>
          <SaleStatusActions
            canChangeStatus={canChangeStatus}
            sale={sale.data}
          />
        </div>
      </div>

      <SaleSummaryCard sale={sale.data} />

      <div className="rounded-lg border bg-background p-5">
        <p className="font-semibold">Siguiente paso</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {sale.data.estado === "nueva"
            ? "Confirma la venta cuando la orden esté lista para operación."
            : sale.data.inventarioEstado !== "aplicado"
              ? "Aplica la salida de inventario si la venta incluye productos físicos."
              : dispatch?.ok && dispatch.data
                ? "Da seguimiento al despacho hasta completar la entrega o trabajo."
                : "Crea el despacho si esta venta requiere entrega, instalación o visita."}
        </p>
      </div>

      {canPrepareFiscalDocument ? (
        <div className="rounded-lg border bg-background p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Documento fiscal interno</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Prepara factura o tiquete fiscal interno. XML, firma y Hacienda
                se habilitan despues de completar sus validaciones reales.
              </p>
            </div>
            <form action={prepareFiscalDocumentFromSaleAction} className="flex gap-2">
              <input name="ventaId" type="hidden" value={sale.data.id} />
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                name="documentTypeCode"
              >
                <option value="01">Factura</option>
                <option value="04">Tiquete</option>
              </select>
              <button className={buttonVariants({ size: "sm" })} type="submit">
                Preparar
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <SaleNotesForm canEdit={canEdit} sale={sale.data} />

      {canViewInventory ? (
        <SaleInventoryPanel
          canApply={canApplyInventory}
          canMarkWithoutInventory={canEdit}
          items={inventorySummary?.ok ? inventorySummary.data : []}
          sale={sale.data}
          warehouses={inventoryWarehouses?.ok ? inventoryWarehouses.data : []}
        />
      ) : null}

      {canViewDispatch ? (
        <SaleDispatchPanel
          canCreate={canCreateDispatch}
          dispatch={dispatch?.ok ? dispatch.data : null}
          sale={sale.data}
          users={dispatchUsers?.ok ? dispatchUsers.data : []}
        />
      ) : null}

      <section className="space-y-4">
        <SectionHeader
          description="Items congelados desde la cotización origen."
          title="Items"
        />
        <SaleItemsTable items={items.ok ? items.data : []} sale={sale.data} />
      </section>

      <div className="rounded-lg border border-dashed bg-background p-5 text-sm text-muted-foreground">
        {canViewPayments ? (
          <>
            Pagos esta disponible desde{" "}
            <Link className="font-medium text-foreground underline" href="/pagos">
              cuentas por cobrar
            </Link>
            .
          </>
        ) : (
          "Pagos se activa desde el modulo opcional cuando la empresa lo necesite."
        )}{" "}
        {canViewBilling
          ? "Facturacion fiscal esta disponible desde el modulo Facturacion."
          : "Facturacion fiscal real sigue pendiente de firma XAdES-EPES y pruebas Hacienda."}{" "}
        El inventario solo se descuenta con accion manual del usuario.
      </div>
    </section>
  );
}
