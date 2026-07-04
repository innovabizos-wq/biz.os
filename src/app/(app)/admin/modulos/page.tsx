import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { ActiveModulesList } from "@/modules/platform-modules/components/active-modules-list";
import { getCompanyModulesStatus } from "@/modules/platform-modules/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type AdminModulosPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

export default async function AdminModulosPage({
  searchParams,
}: AdminModulosPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canManage = hasPermission(
    access.tenant.permissions,
    "admin.settings.manage",
  );

  if (!canManage) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="Solicita permisos administrativos para cambiar modulos de la empresa."
          eyebrow="Administracion"
          title="Modulos activos"
        />
        <EmptyState
          description="No tienes permiso para administrar modulos."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const modules = await getCompanyModulesStatus(access.tenant);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Activa o desactiva los modulos disponibles para esta empresa."
        eyebrow="Administracion"
        title="Modulos activos"
      />

      <EphemeralPageAlert error={params?.error} success={params?.success} />

      <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
        Los modulos activos definen que funciones estan disponibles para esta
        empresa. Los permisos definen que usuarios pueden usar esas funciones.
        Al activar un modulo opcional, los roles Administrador y Super Admin
        reciben automaticamente los permisos base para que sea visible y usable
        sin editar roles manualmente.
      </p>

      {modules.ok && modules.data.length > 0 ? (
        <ActiveModulesList modules={modules.data} />
      ) : (
        <EmptyState
          description={
            modules.ok
              ? "No hay modulos disponibles en el catalogo."
              : modules.error.message
          }
          title="Modulos activos"
        />
      )}

      <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
        Mobile se mantiene como modulo API-only. Reports queda disponible como
        Reportes dentro de la navegacion principal cuando el modulo y permisos
        estan activos.
      </p>
    </section>
  );
}
