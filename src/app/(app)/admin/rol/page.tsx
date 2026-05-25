import { EmptyState } from "@/components/shared/empty-state";
import { InfoCard } from "@/components/shared/info-card";
import { SectionHeader } from "@/components/shared/section-header";
import { PermissionList } from "@/modules/roles/components/permission-list";
import { getCurrentRol, getCurrentRolPermissions } from "@/modules/roles/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function AdminRolPage() {
  const access = await requireAdminAccess();
  const [rol, permissions] = await Promise.all([
    getCurrentRol(access.tenant),
    getCurrentRolPermissions(access.tenant),
  ]);

  if (!rol.ok || !rol.data) {
    return <EmptyState description="No hay rol asignado." title="Rol" />;
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Rol actual y permisos visibles para el usuario autenticado."
        eyebrow="Administración"
        title="Rol y permisos"
      />
      <InfoCard
        items={[
          { label: "Nombre", value: rol.data.nombre },
          { label: "Descripcion", value: rol.data.descripcion },
          { label: "Estado", value: rol.data.estado },
          { label: "Sistema", value: rol.data.esSistema ? "Si" : "No" },
        ]}
        title="Datos del rol"
      />
      {permissions.ok && permissions.data.length > 0 ? (
        <PermissionList permissions={permissions.data} />
      ) : (
        <EmptyState
          description="No hay permisos visibles para este rol."
          title="Permisos"
        />
      )}
    </section>
  );
}
