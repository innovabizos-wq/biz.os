import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { RoleForm } from "@/modules/roles/components/role-form";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type NewRolePageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function NewRolePage({ searchParams }: NewRolePageProps) {
  const params = await searchParams;
  const access = await requireAdminAccess();
  const canManage = hasPermission(access.tenant.permissions, "admin.roles.manage");

  if (!canManage) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para crear roles."
          eyebrow="Administración"
          title="Nuevo rol"
        />
        <EmptyState
          description="Tu rol actual no puede administrar roles."
          title="Acceso denegado"
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Crea un rol para la empresa actual. Los permisos se asignan despues desde el detalle del rol."
        eyebrow="Administración"
        title="Nuevo rol"
      />
      <EphemeralPageAlert error={params?.error} />
      <RoleForm mode="create" />
    </section>
  );
}
