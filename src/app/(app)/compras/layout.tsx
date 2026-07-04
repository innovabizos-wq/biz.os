import { ModuleInactiveState } from "@/modules/platform-modules/components/module-inactive-state";
import { requireActiveModule } from "@/modules/platform-modules/active-module";

export default async function PurchasesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const activeModule = await requireActiveModule("purchases");

  if (!activeModule.ok) {
    return <ModuleInactiveState moduleName="Compras" />;
  }

  return children;
}
