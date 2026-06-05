import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import { UsersTable } from "@/modules/users/components/users-table";
import { getAccessibleUsersForCurrentTenant } from "@/modules/users/queries";
import { InvitationsTable } from "@/modules/users/invitations/components/invitations-table";
import { buildInvitationUrl } from "@/modules/users/invitations/invitation-url";
import { getInvitationsForCurrentTenant } from "@/modules/users/invitations/queries";

type RrhhPersonalPageProps = {
  searchParams?: Promise<{
    correo?: string;
    created?: string;
    error?: string;
    token?: string;
  }>;
};

export default async function RrhhPersonalPage({
  searchParams,
}: RrhhPersonalPageProps) {
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
          description="No tienes permiso para ver el personal."
          eyebrow="RRHH"
          title="Personal"
        />
        <EmptyState
          description="Tu rol no tiene admin.users.view ni admin.users.manage."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [users, invitations] = await Promise.all([
    getAccessibleUsersForCurrentTenant(access.tenant),
    getInvitationsForCurrentTenant(),
  ]);
  const invitationUrl = params?.token ? buildInvitationUrl(params.token) : null;

  return (
    <section className="space-y-8">
      <SectionHeader
        actions={
          canManage ? (
            <Link className={buttonVariants()} href="/rrhh/personal/nuevo">
              Agregar personal
            </Link>
          ) : null
        }
        description="Personal activo e invitaciones de acceso al sistema para esta empresa."
        eyebrow="RRHH"
        title="Personal"
      />

      <EphemeralPageAlert error={params?.error} />

      {invitationUrl ? (
        <div className="space-y-2 rounded-lg border bg-background p-4">
          <p className="text-sm font-medium">
            Invitacion enviada correctamente a{" "}
            {params?.correo ?? "el correo indicado"}.
          </p>
          <p className="text-sm text-muted-foreground">
            Invitacion creada. Copia este enlace y envialo al colaborador.
          </p>
          <code className="block break-all rounded-md bg-muted p-3 text-xs">
            {invitationUrl}
          </code>
        </div>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-base font-semibold">Usuarios activos</h3>
        {users.ok && users.data.length > 0 ? (
          <UsersTable canManage={canManage} users={users.data} />
        ) : (
          <EmptyState
            description="No hay usuarios activos visibles con las politicas actuales."
            title="Usuarios activos"
          />
        )}
      </section>

      {invitations.ok && invitations.data.length > 0 ? (
        <InvitationsTable invitations={invitations.data} />
      ) : (
        <EmptyState
          description="No hay invitaciones pendientes, expiradas o canceladas."
          title="Invitaciones de personal"
        />
      )}
    </section>
  );
}
