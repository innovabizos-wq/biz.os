import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { ActiveModulesList } from "@/modules/platform-modules/components/active-modules-list";
import { getActiveEmpresaModules } from "@/modules/platform-modules/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function AdminModulosPage() {
  const access = await requireAdminAccess();
  const modules = await getActiveEmpresaModules(access.tenant);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Los modulos activos definen que capacidades tiene disponible la empresa. Las pantallas operativas se construiran por fases."
        eyebrow="Administración"
        title="Modulos activos"
      />
      {modules.ok && modules.data.length > 0 ? (
        <ActiveModulesList modules={modules.data} />
      ) : (
        <EmptyState
          description="No hay modulos activos visibles."
          title="Modulos activos"
        />
      )}
    </section>
  );
}
