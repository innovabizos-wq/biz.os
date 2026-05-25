import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { CurrentPermissionsSummary } from "@/modules/permissions/components/current-permissions-summary";
import { PermissionCatalog } from "@/modules/permissions/components/permission-catalog";
import {
  getActivePermissionCatalog,
  getCurrentUserPermissionCodes,
} from "@/modules/permissions/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function AdminPermisosPage() {
  const access = await requireAdminAccess();
  const catalog = await getActivePermissionCatalog();
  const currentPermissions = getCurrentUserPermissionCodes(access.tenant);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Catálogo de permisos activos y permisos cargados para el rol actual. Algunos permisos son capacidades futuras y no implican que el módulo operativo exista todavía."
        eyebrow="Administración"
        title="Permisos"
      />
      <CurrentPermissionsSummary permissions={currentPermissions} />
      {catalog.ok && catalog.data.length > 0 ? (
        <PermissionCatalog permissions={catalog.data} />
      ) : (
        <EmptyState
          description="No hay permisos de catalogo visibles."
          title="Catálogo de permisos"
        />
      )}
    </section>
  );
}
