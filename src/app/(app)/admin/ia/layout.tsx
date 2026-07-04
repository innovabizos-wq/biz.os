import { ModuleInactiveState } from "@/modules/platform-modules/components/module-inactive-state";
import { requireActiveModule } from "@/modules/platform-modules/active-module";

export default async function AiLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const activeModule = await requireActiveModule("ai");

  if (!activeModule.ok) {
    return <ModuleInactiveState moduleName="IA" />;
  }

  return children;
}
