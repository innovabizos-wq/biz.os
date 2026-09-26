import { AdminTabs, type AdminTabItem } from "@/components/admin/admin-tabs";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const access = await requireAdminAccess();
  const showAdminSettings = hasAnyPermission(access.tenant.permissions, [
    "admin.settings.view",
    "admin.settings.manage",
  ]);
  const showBillingModule = isModuleActive(access.tenant.activeModules, "billing");
  const showAiModule = isModuleActive(access.tenant.activeModules, "ai");
  const showFiscalSettings =
    showBillingModule &&
    hasAnyPermission(access.tenant.permissions, [
      "admin.settings.view",
      "admin.settings.manage",
      "billing.fiscal.view",
      "billing.fiscal.manage",
    ]);
  const showAdminUsers = hasAnyPermission(access.tenant.permissions, [
    "admin.users.view",
    "admin.users.manage",
  ]);
  const showAdminRoles = hasAnyPermission(access.tenant.permissions, [
    "admin.roles.view",
    "admin.roles.manage",
  ]);
  const showAiSettings =
    showAiModule &&
    hasAnyPermission(access.tenant.permissions, [
      "admin.settings.manage",
      "ai.reports.use",
    ]);
  const tabs: AdminTabItem[] = [
    { href: "/admin", label: "Inicio" },
    showAdminSettings ? { href: "/admin/empresa", label: "Empresa" } : null,
    showAdminUsers || showAdminRoles ? { href: "/admin/usuarios", label: "Equipo y acceso" } : null,
    showFiscalSettings ? { href: "/admin/conexiones", label: "Conexiones" } : null,
    showAiSettings || showAdminSettings ? { href: "/admin/contexto", label: "Automatización" } : null,
  ].filter(Boolean) as AdminTabItem[];

  return (
    <section className="flex h-[calc(100vh-3rem)] min-h-0 flex-col gap-4 overflow-hidden">
      <AdminTabs tabs={tabs} />
      <div className="min-h-0 flex-1 overflow-auto pr-1">{children}</div>
    </section>
  );
}
