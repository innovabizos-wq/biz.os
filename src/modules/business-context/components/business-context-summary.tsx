import type { BusinessContext } from "@/modules/business-context/types";

type BusinessContextSummaryProps = {
  context: BusinessContext | null;
};

function hasValue(value: string | null) {
  return Boolean(value?.trim());
}

export function BusinessContextSummary({ context }: BusinessContextSummaryProps) {
  const completed = context
    ? [
        context.businessSummary,
        context.targetAudience,
        context.productsServices,
        context.operationalRules,
        context.aiInstructions,
      ].filter(hasValue).length
    : 0;

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <article className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Estado</p>
        <p className="mt-2 font-semibold">
          {context ? "Contexto iniciado" : "Sin contexto"}
        </p>
      </article>
      <article className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Areas clave</p>
        <p className="mt-2 font-semibold">{completed}/5 completadas</p>
      </article>
      <article className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Uso transversal</p>
        <p className="mt-2 font-semibold">IA, Autoblog y automatizaciones</p>
      </article>
    </div>
  );
}
