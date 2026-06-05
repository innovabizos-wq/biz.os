import { ModuleInactiveState } from "@/modules/platform-modules/components/module-inactive-state";
import { requireActiveModule } from "@/modules/platform-modules/active-module";

export default async function AutoblogLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const activeModule = await requireActiveModule("autoblog");

  if (!activeModule.ok) {
    return <ModuleInactiveState moduleName="Autoblog" />;
  }

  return children;
}
