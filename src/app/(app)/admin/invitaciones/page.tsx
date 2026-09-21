import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { getAccessibleRolesForCurrentTenant } from "@/modules/roles/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import { createAdministrativeUserAction } from "@/modules/users/actions";
import { CreateAdministrativeUserForm } from "@/modules/users/components/create-administrative-user-form";
import { getAssignableBranchesForCurrentTenant } from "@/modules/users/queries";

type AdminInvitacionesPageProps = {
  searchParams?: Promise<{
    created?: string;
    error?: string;
  }>;
};

export default async function AdminInvitacionesPage({
  searchParams,
}: AdminInvitacionesPageProps) {
  const params = await searchParams;
  const access = await requireAdminAccess();
  const [roles, branches] = await Promise.all([
    getAccessibleRolesForCurrentTenant(access.tenant),
    getAssignableBranchesForCurrentTenant(access.tenant),
  ]);
  const canManage = hasPermission(access.tenant.permissions, "admin.users.manage");

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Crea accesos operativos con rol y sucursal, sin verificacion de correo."
        eyebrow="Administracion"
        title="Crear usuario"
      />

      <div className="rounded-lg border bg-muted p-4 text-sm text-muted-foreground">
        Solo un administrador puede crear accesos. El correo queda confirmado internamente y el usuario debe cambiar la contrasena temporal al iniciar sesion.
      </div>

      <EphemeralPageAlert error={params?.error} />

      {params?.created === "1" ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800">
          Usuario creado. Puede iniciar sesion de inmediato con la contrasena temporal.
        </p>
      ) : null}

      {canManage ? (
        <CreateAdministrativeUserForm
          action={createAdministrativeUserAction}
          branches={branches.ok ? branches.data : []}
          roles={roles.ok ? roles.data : []}
        />
      ) : null}
    </section>
  );
}
