import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { getCurrentSucursal } from "@/modules/branches/queries";
import { getAccessibleRolesForCurrentTenant } from "@/modules/roles/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import { createInvitationAction } from "@/modules/users/invitations/actions";
import { buildInvitationUrl } from "@/modules/users/invitations/invitation-url";
import { CreateInvitationForm } from "@/modules/users/invitations/components/create-invitation-form";
import { InvitationsTable } from "@/modules/users/invitations/components/invitations-table";
import { getInvitationsForCurrentTenant } from "@/modules/users/invitations/queries";

type AdminInvitacionesPageProps = {
  searchParams?: Promise<{
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
  const [invitations, roles, sucursal] = await Promise.all([
    getInvitationsForCurrentTenant(),
    getAccessibleRolesForCurrentTenant(access.tenant),
    getCurrentSucursal(access.tenant),
  ]);

  const invitationUrl = params?.token ? buildInvitationUrl(params.token) : null;

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Crea enlaces de invitacion para que nuevos usuarios se registren con Supabase Auth y acepten pertenecer a esta empresa."
        eyebrow="Administración"
        title="Invitaciones"
      />

      <div className="rounded-lg border bg-muted p-4 text-sm text-muted-foreground">
        Las invitaciones no crean usuarios manualmente. La cuenta debe existir o
        crearse con Supabase Auth usando el mismo correo de la invitacion.
      </div>

      {params?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </p>
      ) : null}

      {invitationUrl ? (
        <div className="space-y-2 rounded-lg border bg-background p-4">
          <p className="text-sm font-medium">Invitacion creada</p>
          <p className="text-sm text-muted-foreground">
            Comparte este enlace con {params?.correo ?? "el usuario invitado"}.
            El envio automatico de correo se implementara despues.
          </p>
          <code className="block break-all rounded-md bg-muted p-3 text-xs">
            {invitationUrl}
          </code>
        </div>
      ) : null}

      <CreateInvitationForm
        action={createInvitationAction}
        roles={roles.ok ? roles.data : []}
        sucursal={sucursal.ok ? sucursal.data : null}
      />

      {invitations.ok && invitations.data.length > 0 ? (
        <InvitationsTable invitations={invitations.data} />
      ) : (
        <EmptyState
          description="No hay invitaciones visibles con las politicas RLS actuales o aun no se ha creado ninguna."
          title="Invitaciones"
        />
      )}
    </section>
  );
}
