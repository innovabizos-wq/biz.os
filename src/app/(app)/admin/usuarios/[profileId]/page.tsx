import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import { UserBranchForm } from "@/modules/users/components/user-branch-form";
import { UserProfileForm } from "@/modules/users/components/user-profile-form";
import { UserRoleForm } from "@/modules/users/components/user-role-form";
import { UserStatusForm } from "@/modules/users/components/user-status-form";
import {
  getAssignableBranchesForCurrentTenant,
  getAssignableRolesForCurrentTenant,
  getUserDetailForCurrentTenant,
} from "@/modules/users/queries";

type UserDetailPageProps = {
  params: Promise<{
    profileId: string;
  }>;
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function UserDetailPage({
  params,
  searchParams,
}: UserDetailPageProps) {
  const [{ profileId }, query, access] = await Promise.all([
    params,
    searchParams,
    requireAdminAccess(),
  ]);
  const canView = hasAnyPermission(access.tenant.permissions, [
    "admin.users.view",
    "admin.users.manage",
  ]);
  const canManage = hasPermission(access.tenant.permissions, "admin.users.manage");

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta sección."
          eyebrow="Administración"
          title="Usuario"
        />
        <EmptyState
          description="Tu rol no tiene admin.users.view ni admin.users.manage."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [user, roles, branches] = await Promise.all([
    getUserDetailForCurrentTenant(access.tenant, profileId),
    getAssignableRolesForCurrentTenant(access.tenant),
    getAssignableBranchesForCurrentTenant(access.tenant),
  ]);

  if (!user.ok || !user.data) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Administra datos basicos, rol, sucursal y estado del profile operativo."
        eyebrow="Administración"
        title={user.data.nombre}
      />

      {query?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Correo</p>
          <p className="mt-1 break-all font-medium">{user.data.correo}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Estado</p>
          <p className="mt-1 font-medium">{user.data.estado}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Rol</p>
          <p className="mt-1 font-medium">
            {user.data.rolNombre ?? "No asignado"}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Sucursal</p>
          <p className="mt-1 font-medium">
            {user.data.sucursalNombre ?? "No asignada"}
          </p>
        </div>
      </div>

      {canManage ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <UserProfileForm user={user.data} />
          <UserRoleForm roles={roles.ok ? roles.data : []} user={user.data} />
          <UserBranchForm
            branches={branches.ok ? branches.data : []}
            user={user.data}
          />
          <UserStatusForm user={user.data} />
        </div>
      ) : (
        <EmptyState
          description="Puedes ver el usuario, pero necesitas admin.users.manage para modificarlo."
          title="Solo lectura"
        />
      )}
    </section>
  );
}
