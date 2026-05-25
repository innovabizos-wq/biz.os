import type { ActiveEmpresaModule } from "@/modules/platform-modules/queries";

type ActiveModulesListProps = {
  modules: ActiveEmpresaModule[];
};

export function ActiveModulesList({ modules }: ActiveModulesListProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {modules.map((module) => (
        <article className="rounded-lg border bg-background p-4" key={module.codigo}>
          <p className="font-mono text-xs text-muted-foreground">{module.codigo}</p>
          <h3 className="mt-2 font-semibold">{module.nombre}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Estado: {module.estado}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Activado: {new Date(module.fechaActivacion).toLocaleString("es")}
          </p>
        </article>
      ))}
    </div>
  );
}
