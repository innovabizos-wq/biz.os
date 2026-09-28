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
        description="Todos los modulos incluidos quedan activos desde el inicio para cada empresa."
        eyebrow="Administracion"
        title="Modulos activos"
      />

      <EphemeralPageAlert error={params?.error} success={params?.success} />

      <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
        Los modulos de biz.os quedan disponibles desde el primer inicio. Los
        permisos siguen definiendo que usuarios pueden usar cada funcion, y las
        conexiones o credenciales pendientes se configuran dentro de cada modulo.
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
        Mobile se mantiene como modulo API-only. Reportes, Facturacion, Pagos,
        Compras, Whapp, Autoblog, IA y Brain aparecen desde el inicio cuando el
        usuario tiene permisos para verlos.
      </p>
    </section>
  );
}
