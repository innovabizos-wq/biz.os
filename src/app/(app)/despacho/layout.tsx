import { ModuleInactiveState } from "@/modules/platform-modules/components/module-inactive-state";
import { requireActiveModule } from "@/modules/platform-modules/active-module";

export default async function DespachoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const activeModule = await requireActiveModule("dispatch");

  if (!activeModule.ok) {
    return <ModuleInactiveState moduleName="Despacho" />;
  }

  return children;
}
