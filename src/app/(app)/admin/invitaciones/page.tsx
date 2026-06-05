import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { getAccessibleRolesForCurrentTenant } from "@/modules/roles/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import { getAssignableBranchesForCurrentTenant } from "@/modules/users/queries";
import { createInvitationAction } from "@/modules/users/invitations/actions";
import { buildInvitationUrl } from "@/modules/users/invitations/invitation-url";
import { CreateInvitationForm } from "@/modules/users/invitations/components/create-invitation-form";
import { InvitationsTable } from "@/modules/users/invitations/components/invitations-table";
import { getInvitationsForCurrentTenant } from "@/modules/users/invitations/queries";

type AdminInvitacionesPageProps = {
  searchParams?: Promise<{
    created?: string;
    correo?: string;
    error?: string;
    token?: string;
  }>;
};

export default async function AdminInvitacionesPage({
  searchParams,
}: AdminInvitacionesPageProps) {
  const params = await searchParams;
  const access = await requireAdminAccess();
  const [invitations, roles, branches] = await Promise.all([
    getInvitationsForCurrentTenant(),
    getAccessibleRolesForCurrentTenant(access.tenant),
    getAssignableBranchesForCurrentTenant(access.tenant),
  ]);

  const invitationUrl = params?.token ? buildInvitationUrl(params.token) : null;

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Agrega un colaborador a tu empresa y enviale una invitacion para crear su acceso al sistema."
        eyebrow="Administracion"
        title="Agregar personal"
      />

      <div className="rounded-lg border bg-muted p-4 text-sm text-muted-foreground">
        El admin no crea ni ve contrasenas. La persona invitada crea su propia
        cuenta con Supabase Auth y queda vinculada al rol y sucursal definidos.
      </div>

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
          <p className="text-sm text-muted-foreground">
            Te invitaron a unirte a esta empresa en biz.os. Crea tu contrasena y
            completa tu acceso aqui:
          </p>
          <code className="block break-all rounded-md bg-muted p-3 text-xs">
            {invitationUrl}
          </code>
        </div>
      ) : null}

      <CreateInvitationForm
        action={createInvitationAction}
        branches={branches.ok ? branches.data : []}
        roles={roles.ok ? roles.data : []}
      />

      {invitations.ok && invitations.data.length > 0 ? (
        <InvitationsTable invitations={invitations.data} />
      ) : (
        <EmptyState
          description="No hay invitaciones visibles con las politicas RLS actuales o aun no se ha agregado personal."
          title="Personal"
        />
      )}
    </section>
  );
}
