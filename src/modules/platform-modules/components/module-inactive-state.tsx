import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";

type ModuleInactiveStateProps = {
  moduleName: string;
};

export function ModuleInactiveState({ moduleName }: ModuleInactiveStateProps) {
  return (
    <section className="space-y-6">
      <SectionHeader
        description="Este modulo no esta activo para tu empresa."
        eyebrow="Modulo inactivo"
        title={moduleName}
      />
      <EmptyState
        description="Solicita a un administrador activar este modulo desde Administracion / Modulos."
        title="Este modulo no esta activo para tu empresa."
      />
    </section>
  );
}
