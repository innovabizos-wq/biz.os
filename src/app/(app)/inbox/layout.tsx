import { ModuleInactiveState } from "@/modules/platform-modules/components/module-inactive-state";
import { requireActiveModule } from "@/modules/platform-modules/active-module";

export default async function InboxLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const activeModule = await requireActiveModule("whapp");

  if (!activeModule.ok) {
    return <ModuleInactiveState moduleName="Whapp / Inbox" />;
  }

  return children;
}
