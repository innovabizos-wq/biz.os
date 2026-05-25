import type { CrmInteraction } from "@/modules/crm/types";

type InteractionsListProps = {
  interactions: CrmInteraction[];
};

export function InteractionsList({ interactions }: InteractionsListProps) {
  if (interactions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-background p-5 text-sm text-muted-foreground">
        No hay interacciones registradas.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {interactions.map((interaction) => (
        <article className="rounded-lg border bg-background p-4" key={interaction.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold">{interaction.tipo}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(interaction.createdAt).toLocaleString("es")}
            </p>
          </div>
          {interaction.resultado ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Resultado: {interaction.resultado}
            </p>
          ) : null}
          <p className="mt-2 text-sm">{interaction.resumen}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Por {interaction.createdByNombre ?? "usuario no visible"}
          </p>
        </article>
      ))}
    </div>
  );
}
