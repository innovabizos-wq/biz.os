import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { installStandardRolesAction } from "@/modules/roles/actions";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { RolesTable } from "@/modules/roles/components/roles-table";
import { getAccessibleRolesForCurrentTenant } from "@/modules/roles/queries";
import { getMissingStandardRoleNames } from "@/modules/roles/standard-roles";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type AdminRolesPageProps = {
  searchParams?: Promise<{
    error?: string;
    permisosAsignados?: string;
    rolesCreados?: string;
    rolesExistentes?: string;
    standardRoles?: string;
  }>;
};

export default async function AdminRolesPage({ searchParams }: AdminRolesPageProps) {
  const params = await searchParams;
  const access = await requireAdminAccess();
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
          title="Roles"
        />
        <EmptyState
          description="Tu rol no tiene admin.roles.view ni admin.roles.manage."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const roles = await getAccessibleRolesForCurrentTenant(access.tenant);
  const missingStandardRoles = roles.ok ? getMissingStandardRoleNames(roles.data) : [];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description="Roles de la empresa actual. La administracion usa RPCs seguras y no acepta empresa_id desde frontend."
          eyebrow="Administración"
          title="Roles"
        />
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {missingStandardRoles.length > 0 ? (
              <form action={installStandardRolesAction}>
                <button className={buttonVariants({ variant: "outline" })} type="submit">
                  Instalar roles estandar
                </button>
              </form>
            ) : null}
            <Link className={buttonVariants()} href="/admin/roles/nuevo">
              Nuevo rol
            </Link>
          </div>
        ) : null}
      </div>

      <EphemeralPageAlert error={params?.error} />

      {params?.standardRoles === "installed" ? (
        <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
          Roles estandar instalados. Creados: {params.rolesCreados ?? "0"}.
          Existentes: {params.rolesExistentes ?? "0"}. Permisos asignados:{" "}
          {params.permisosAsignados ?? "0"}.
        </p>
      ) : null}

      {roles.ok && roles.data.length > 0 ? (
        <RolesTable canManage={canManage} roles={roles.data} />
      ) : (
        <EmptyState
          description="No hay roles visibles con las politicas actuales."
          title="Roles"
        />
      )}
    </section>
  );
}
