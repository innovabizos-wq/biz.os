import { redirect } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { getAccessibleRolesForCurrentTenant } from "@/modules/roles/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import { getAssignableBranchesForCurrentTenant } from "@/modules/users/queries";
import { createInvitationAction } from "@/modules/users/invitations/actions";
import { CreateInvitationForm } from "@/modules/users/invitations/components/create-invitation-form";

export default async function NuevoPersonalPage() {
  const access = await requireAdminAccess();
  const canManage = hasPermission(access.tenant.permissions, "admin.users.manage");

  if (!canManage) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para agregar personal."
          eyebrow="RRHH"
          title="Agregar personal"
        />
        <EmptyState
          description="Tu rol no tiene admin.users.manage."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [roles, branches] = await Promise.all([
    getAccessibleRolesForCurrentTenant(access.tenant),
    getAssignableBranchesForCurrentTenant(access.tenant),
  ]);

  if (!roles.ok || roles.data.length === 0) {
    redirect("/admin/roles");
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Agrega un colaborador a tu empresa y enviale una invitacion para crear su acceso al sistema."
        eyebrow="RRHH"
        title="Agregar personal"
      />
      <CreateInvitationForm
        action={createInvitationAction}
        branches={branches.ok ? branches.data : []}
        returnTo="/rrhh/personal"
        roles={roles.data}
      />
    </section>
  );
}
