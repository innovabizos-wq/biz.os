import Link from "next/link";

type WhappConversationFiltersProps = {
  activeFilter: string;
  query: string;
};

const FILTERS = [
  { label: "Mios", value: "mios" },
  { label: "Sin asignar", value: "sin_asignar" },
  { label: "Todos", value: "todos" },
  { label: "No leidos", value: "no_leidos" },
  { label: "Abiertas", value: "abiertas" },
  { label: "Cerradas", value: "cerradas" },
] as const;

function hrefFor(filter: string, query: string) {
  const params = new URLSearchParams();

  params.set("vista", filter);
  if (query.trim()) params.set("q", query.trim());

  return `/whapp/conversaciones?${params.toString()}`;
}

export function WhappConversationFilters({
  activeFilter,
  query,
}: WhappConversationFiltersProps) {
  return (
    <div className="space-y-3 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const active = activeFilter === filter.value;

          return (
            <Link
              className={[
                "rounded-md border px-3 py-2 text-sm font-medium",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground",
              ].join(" ")}
              href={hrefFor(filter.value, query)}
              key={filter.value}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>
      <form className="flex flex-wrap gap-2" action="/whapp/conversaciones">
        <input name="vista" type="hidden" value={activeFilter} />
        <input
          className="h-10 min-w-64 flex-1 rounded-md border bg-background px-3 text-sm"
          defaultValue={query}
          name="q"
          placeholder="Buscar por nombre, telefono o texto"
          type="search"
        />
        <button
          className="h-10 rounded-md border px-4 text-sm font-medium"
          type="submit"
        >
          Buscar
        </button>
      </form>
    </div>
  );
}
