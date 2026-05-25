import { KpiThemeSelector } from "@/components/kpi/kpi-theme-selector";
import { SidebarLogoSelector } from "@/components/navigation/sidebar-logo-selector";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function AppearancePage() {
  const access = await requireAdminAccess();
  const canViewAppearance = hasAnyPermission(access.tenant.permissions, [
    "admin.settings.view",
    "admin.settings.manage",
  ]);

  if (!canViewAppearance) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta seccion."
          eyebrow="Configuracion"
          title="Apariencia"
        />
        <EmptyState
          description="Solicita acceso de configuracion al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Ajusta el logo del menu y la escala de color visual para los KPI premium. Estas preferencias se guardan en este navegador."
        eyebrow="Configuracion"
        title="Apariencia"
      />

      <SidebarLogoSelector />
      <KpiThemeSelector />
    </section>
  );
}
