import { ModuleInactiveState } from "@/modules/platform-modules/components/module-inactive-state";
import { requireActiveModule } from "@/modules/platform-modules/active-module";

export default async function RrhhLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const activeModule = await requireActiveModule("hr");

  if (!activeModule.ok) {
    return <ModuleInactiveState moduleName="RRHH" />;
  }

  return children;
}
