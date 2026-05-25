import type { CurrentPlanDetail } from "@/modules/plans/queries";

type CurrentPlanCardProps = {
  plan: CurrentPlanDetail;
};

export function CurrentPlanCard({ plan }: CurrentPlanCardProps) {
  return (
    <section className="rounded-lg border bg-background p-5 shadow-sm">
      <p className="font-mono text-xs text-muted-foreground">{plan.codigo}</p>
      <h3 className="mt-2 text-xl font-semibold">{plan.nombre}</h3>
      <dl className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase text-muted-foreground">
            Estado
          </dt>
          <dd className="mt-1 text-sm font-medium">{plan.estado}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-muted-foreground">
            Renovacion automatica
          </dt>
          <dd className="mt-1 text-sm font-medium">
            {plan.renovacionAutomatica ? "Si" : "No"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-muted-foreground">
            Fecha inicio
          </dt>
          <dd className="mt-1 text-sm font-medium">
            {new Date(plan.fechaInicio).toLocaleString("es")}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-muted-foreground">
            Fecha fin
          </dt>
          <dd className="mt-1 text-sm font-medium">
            {plan.fechaFin ? new Date(plan.fechaFin).toLocaleString("es") : "No definida"}
          </dd>
        </div>
      </dl>
      <pre className="mt-5 overflow-auto rounded-md bg-muted p-3 text-xs">
        {JSON.stringify(
          { limites: plan.limites, limitesOverride: plan.limitesOverride },
          null,
          2,
        )}
      </pre>
    </section>
  );
}
