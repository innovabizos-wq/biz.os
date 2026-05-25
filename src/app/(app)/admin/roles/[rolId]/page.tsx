import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { getActivePermissionCatalog } from "@/modules/permissions/queries";
import { RoleForm } from "@/modules/roles/components/role-form";
import { RolePermissionsManager } from "@/modules/roles/components/role-permissions-manager";
import { RoleStatusForm } from "@/modules/roles/components/role-status-form";
import {
  getRoleDetailForCurrentTenant,
  getRolePermissionsForCurrentTenant,
} from "@/modules/roles/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type RoleDetailPageProps = {
  params: Promise<{
    rolId: string;
  }>;
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function RoleDetailPage({
  params,
  searchParams,
}: RoleDetailPageProps) {
  const [{ rolId }, query, access] = await Promise.all([
    params,
    searchParams,
    requireAdminAccess(),
  ]);
  const canView = hasAnyPermission(access.tenant.permissions, [
    "admin.roles.view",
    "admin.roles.manage",
  ]);
  const canManage = hasPermission(access.tenant.permissions, "admin.roles.manage");

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta sección."
          eyebrow="Administración"
          title="Rol"
        />
        <EmptyState
          description="Tu rol no tiene admin.roles.view ni admin.roles.manage."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [role, rolePermissions, catalog] = await Promise.all([
    getRoleDetailForCurrentTenant(access.tenant, rolId),
    getRolePermissionsForCurrentTenant(access.tenant, rolId),
    getActivePermissionCatalog(),
  ]);

  if (!role.ok || !role.data) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Detalle del rol, estado y permisos asignados dentro de la empresa actual."
        eyebrow="Administración"
        title={role.data.nombre}
      />

      {query?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Estado</p>
          <p className="mt-1 font-medium">{role.data.estado}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Sistema</p>
          <p className="mt-1 font-medium">{role.data.esSistema ? "Si" : "No"}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Permisos</p>
          <p className="mt-1 font-medium">{role.data.permissionCount}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Creacion</p>
          <p className="mt-1 font-medium">
            {new Date(role.data.createdAt).toLocaleDateString("es")}
          </p>
        </div>
      </div>

      {canManage ? (
        <>
          <RoleForm mode="update" role={role.data} />
          <RoleStatusForm role={role.data} />
        </>
      ) : (
        <EmptyState
          description="Puedes ver el rol, pero necesitas admin.roles.manage para editarlo."
          title="Solo lectura"
        />
      )}

      <RolePermissionsManager
        assignedPermissions={rolePermissions.ok ? rolePermissions.data : []}
        canManage={canManage}
        catalog={catalog.ok ? catalog.data : []}
        rolId={role.data.id}
      />
    </section>
  );
}
