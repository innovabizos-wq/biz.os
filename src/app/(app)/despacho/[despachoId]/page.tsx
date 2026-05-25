import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { DispatchForm } from "@/modules/dispatch/components/dispatch-form";
import { DispatchStatusActions } from "@/modules/dispatch/components/dispatch-status-actions";
import { DispatchSummaryCard } from "@/modules/dispatch/components/dispatch-summary-card";
import {
  getAssignableUsersForDispatch,
  getDispatchDetail,
} from "@/modules/dispatch/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type DispatchDetailPageProps = {
  params: Promise<{ despachoId: string }>;
  searchParams?: Promise<{ error?: string }>;
};

export default async function DispatchDetailPage({
  params,
  searchParams,
}: DispatchDetailPageProps) {
  const [{ despachoId }, query, access] = await Promise.all([
    params,
    searchParams,
    requireAdminAccess(),
  ]);
  const canView = hasPermission(access.tenant.permissions, "dispatch.orders.view");
  const canEdit = hasPermission(access.tenant.permissions, "dispatch.orders.edit");
  const canChangeStatus = hasPermission(
    access.tenant.permissions,
    "dispatch.orders.status.change",
  );

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta sección."
          eyebrow="Operación"
          title="Despacho"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [dispatch, users] = await Promise.all([
    getDispatchDetail(access.tenant, despachoId),
    getAssignableUsersForDispatch(access.tenant),
  ]);

  if (!dispatch.ok || !dispatch.data) {
    notFound();
  }

  const isClosed =
    dispatch.data.estado === "entregado" || dispatch.data.estado === "cancelado";

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description="Actualiza el estado conforme avanza la entrega o trabajo."
          eyebrow="Despacho"
          title={dispatch.data.numero}
        />
        <DispatchStatusActions
          canChangeStatus={canChangeStatus}
          dispatch={dispatch.data}
        />
      </div>

      {query?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </p>
      ) : null}

      <div className="rounded-lg border bg-background p-5">
        <p className="text-sm text-muted-foreground">Estado</p>
        <p className="mt-1 text-lg font-semibold">{dispatch.data.estado}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Programado: {dispatch.data.fechaProgramada ?? "Sin fecha"}{" "}
          {dispatch.data.horaProgramada ?? ""}
        </p>
      </div>

      <DispatchSummaryCard dispatch={dispatch.data} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-background p-5">
          <p className="font-semibold">Datos de entrega</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Dirección: {dispatch.data.direccionEntrega ?? "No registrada"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Contacto: {dispatch.data.contactoEntrega ?? "No registrado"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Teléfono: {dispatch.data.telefonoEntrega ?? "No registrado"}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-5">
          <p className="font-semibold">Notas y resultado</p>
          <p className="mt-3 text-sm text-muted-foreground">
            {dispatch.data.notas ?? "Sin notas operativas."}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Resultado: {dispatch.data.resultado ?? "Sin resultado."}
          </p>
        </div>
      </div>

      {canEdit && !isClosed ? (
        <DispatchForm
          dispatch={dispatch.data}
          mode="update"
          users={users.ok ? users.data : []}
        />
      ) : null}

      <div className="rounded-lg border border-dashed bg-background p-5 text-sm text-muted-foreground">
        Rutas, mapas, tracking y pruebas de entrega se implementarán en fases
        posteriores.
      </div>
    </section>
  );
}
