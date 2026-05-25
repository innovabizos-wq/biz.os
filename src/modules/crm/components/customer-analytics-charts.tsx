import type { CrmCustomer } from "@/modules/crm/types";

type ChartSlice = {
  color: string;
  label: string;
  value: number;
};

type BarRow = {
  color: string;
  label: string;
  value: number;
};

const estadoLabels: Record<CrmCustomer["estado"], string> = {
  calificado: "Calificados",
  contactado: "Contactados",
  cotizado: "Cotizados",
  ganado: "Ganados",
  inactivo: "Inactivos",
  nuevo: "Nuevos",
  perdido: "Perdidos",
};

const estadoColors: Record<CrmCustomer["estado"], string> = {
  calificado: "#14b8a6",
  contactado: "#0ea5e9",
  cotizado: "#facc15",
  ganado: "#22c55e",
  inactivo: "#94a3b8",
  nuevo: "#6366f1",
  perdido: "#ef4444",
};

const barColors = ["#14b8a6", "#0f766e", "#facc15", "#334155", "#38bdf8"];

function countBy<T extends string>(
  rows: CrmCustomer[],
  getKey: (row: CrmCustomer) => T,
) {
  return rows.reduce<Record<T, number>>(
    (accumulator, row) => {
      const key = getKey(row);
      accumulator[key] = (accumulator[key] ?? 0) + 1;

      return accumulator;
    },
    {} as Record<T, number>,
  );
}

function getDonutSlices(customers: CrmCustomer[]): ChartSlice[] {
  const counts = countBy(customers, (customer) => customer.estado);

  return Object.entries(counts)
    .map(([estado, value]) => ({
      color: estadoColors[estado as CrmCustomer["estado"]],
      label: estadoLabels[estado as CrmCustomer["estado"]],
      value,
    }))
    .filter((slice) => slice.value > 0)
    .sort((first, second) => second.value - first.value);
}

function getBarRows(customers: CrmCustomer[]): BarRow[] {
  const counts = countBy(customers, (customer) => {
    if (customer.origen?.trim()) return customer.origen.trim();

    return customer.tipo === "cliente" ? "Clientes" : "Prospectos";
  });

  return Object.entries(counts)
    .map(([label, value], index) => ({
      color: barColors[index % barColors.length],
      label,
      value,
    }))
    .sort((first, second) => second.value - first.value)
    .slice(0, 7);
}

function buildConicGradient(slices: ChartSlice[]) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let cursor = 0;

  if (total === 0) {
    return "#e2e8f0";
  }

  const stops = slices.map((slice) => {
    const start = cursor;
    const end = cursor + (slice.value / total) * 100;
    cursor = end;

    return `${slice.color} ${start}% ${end}%`;
  });

  return `conic-gradient(${stops.join(", ")})`;
}

function formatPercent(value: number, total: number) {
  if (total === 0) return "0%";

  return `${Math.round((value / total) * 100)}%`;
}

export function CustomerAnalyticsCharts({
  customers,
}: {
  customers: CrmCustomer[];
}) {
  const donutSlices = getDonutSlices(customers);
  const barRows = getBarRows(customers);
  const total = customers.length;
  const maxBarValue = Math.max(...barRows.map((row) => row.value), 1);

  return (
    <div className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
      <section className="rounded-lg border bg-background p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-black text-slate-900">
              Clientes por estado
            </h2>
            <p className="text-xs text-muted-foreground">
              Distribucion actual de la base CRM
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
            {total}
          </span>
        </div>

        <div className="mt-4 grid items-center gap-5 md:grid-cols-[180px_1fr]">
          <div className="relative mx-auto size-40">
            <div
              aria-hidden="true"
              className="size-40 rounded-full"
              style={{ background: buildConicGradient(donutSlices) }}
            />
            <div className="absolute inset-10 flex flex-col items-center justify-center rounded-full bg-background text-center shadow-inner">
              <span className="text-2xl font-black">{total}</span>
              <span className="text-[10px] font-bold uppercase text-muted-foreground">
                registros
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {donutSlices.length > 0 ? (
              donutSlices.map((slice) => (
                <div className="flex items-center justify-between gap-3" key={slice.label}>
                  <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-700">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="truncate">{slice.label}</span>
                  </span>
                  <span className="text-xs font-black text-slate-900">
                    {slice.value} ({formatPercent(slice.value, total)})
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Sin datos disponibles.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-background p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-black text-slate-900">
              Clientes por origen
            </h2>
            <p className="text-xs text-muted-foreground">
              Origen registrado o tipo automatico cuando no hay origen
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
            Top {barRows.length}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {barRows.length > 0 ? (
            barRows.map((row) => (
              <div className="grid items-center gap-3 md:grid-cols-[150px_1fr_52px]" key={row.label}>
                <p className="truncate text-xs font-bold text-slate-700">{row.label}</p>
                <div className="h-7 rounded-sm bg-slate-100">
                  <div
                    className="flex h-7 items-center justify-end rounded-sm px-2 text-[11px] font-black text-white"
                    style={{
                      backgroundColor: row.color,
                      width: `${Math.max((row.value / maxBarValue) * 100, 8)}%`,
                    }}
                  >
                    {row.value}
                  </div>
                </div>
                <p className="text-right text-xs font-black text-slate-900">
                  {formatPercent(row.value, total)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos disponibles.</p>
          )}
        </div>
      </section>
    </div>
  );
}
