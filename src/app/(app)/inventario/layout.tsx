import { ModuleInactiveState } from "@/modules/platform-modules/components/module-inactive-state";
import { requireActiveModule } from "@/modules/platform-modules/active-module";

export default async function InventarioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const activeModule = await requireActiveModule("inventory");

  if (!activeModule.ok) {
    return <ModuleInactiveState moduleName="Inventario" />;
  }

  return children;
}
