import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import { UsersTable } from "@/modules/users/components/users-table";
import { getAccessibleUsersForCurrentTenant } from "@/modules/users/queries";

type AdminUsuariosPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function AdminUsuariosPage({
  searchParams,
}: AdminUsuariosPageProps) {
  const params = await searchParams;
  const access = await requireAdminAccess();
  const canView = hasAnyPermission(access.tenant.permissions, [
    "admin.users.view",
    "admin.users.manage",
  ]);
  const canManage = hasPermission(access.tenant.permissions, "admin.users.manage");

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta seccion."
          eyebrow="Administracion"
          title="Usuarios"
        />
        <EmptyState
          description="Tu rol no tiene admin.users.view ni admin.users.manage."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const users = await getAccessibleUsersForCurrentTenant(access.tenant);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description="Usuarios activos de la empresa actual. El personal nuevo se agrega por invitacion."
          eyebrow="Administracion"
          title="Usuarios activos"
        />
        {canManage ? (
          <Link className={buttonVariants()} href="/admin/invitaciones">
            Agregar personal
          </Link>
        ) : null}
      </div>

      <div className="rounded-lg border bg-muted p-4 text-sm text-muted-foreground">
        No se crean usuarios ni contrasenas temporales desde este panel. El
        colaborador crea su propia contrasena al aceptar la invitacion.
      </div>

      <EphemeralPageAlert error={params?.error} />

      {users.ok && users.data.length > 0 ? (
        <UsersTable canManage={canManage} users={users.data} />
      ) : (
        <EmptyState
          description="No hay usuarios visibles con las politicas actuales."
          title="Usuarios activos"
        />
      )}
    </section>
  );
}
