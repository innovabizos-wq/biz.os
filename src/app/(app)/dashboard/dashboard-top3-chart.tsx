"use client";

export type DashboardTop3Series = {
  label: string;
  total: number;
  values: number[];
};

export type DashboardTop3Option = {
  id: string;
  label: string;
  subtitle: string;
  series: DashboardTop3Series[];
};

const RANK_STYLES = [
  { bar: "dark", label: "3er lugar" },
  { bar: "amber", label: "2do lugar" },
  { bar: "teal", label: "1er lugar" },
];

function formatValue(value: number) {
  return new Intl.NumberFormat("es-CR", {
    maximumFractionDigits: 0,
    notation: value >= 1000000 ? "compact" : "standard",
  }).format(value);
}

function getChartRows(options: DashboardTop3Option[]) {
  return options.slice(0, 3).map((option) => {
    const ranked = [...option.series].sort((left, right) => right.total - left.total);
    const first = ranked[0] ?? null;
    const second = ranked[1] ?? null;
    const third = ranked[2] ?? null;

    return {
      id: option.id,
      label: option.label,
      segments: [third, second, first],
      total: ranked.slice(0, 3).reduce((sum, item) => sum + item.total, 0),
    };
  });
}

export function DashboardTop3Chart({
  options,
}: {
  options: DashboardTop3Option[];
}) {
  const rows = getChartRows(options);
  const maxTotal = Math.max(1, ...rows.map((row) => row.total));
  const tickCount = 6;
  const ticks = Array.from({ length: tickCount }, (_, index) =>
    Math.round((maxTotal / (tickCount - 1)) * index),
  );

  if (rows.length === 0) {
    return null;
  }

  return (
    <article className="dashboard-top3-card">
      <div className="dashboard-top3-header">
        <div className="dashboard-top3-title">
          <h2>Top 3</h2>
          <p>Ranking mensual por ventas, vendedores y clientes destacados.</p>
        </div>
      </div>

      <div className="dashboard-top3-stacked-chart">
        <div className="dashboard-top3-stacked-rows">
          {rows.map((row) => (
            <div className="dashboard-top3-stacked-row" key={row.id}>
              <span className="dashboard-top3-row-label" title={row.label}>
                {row.label}
              </span>
              <div className="dashboard-top3-stacked-track">
                {row.segments.map((segment, index) => {
                  const style = RANK_STYLES[index] ?? RANK_STYLES[0];
                  const width = segment
                    ? Math.max(8, (segment.total / maxTotal) * 100)
                    : 0;

                  return segment ? (
                    <span
                      aria-label={`${style.label}: ${segment.label}, ${formatValue(segment.total)}`}
                      className="dashboard-top3-stacked-segment"
                      data-rank={style.bar}
                      key={`${row.id}-${style.bar}`}
                      style={{ width: `${width}%` }}
                      title={`${style.label}: ${segment.label} - ${formatValue(segment.total)}`}
                    />
                  ) : null;
                })}
              </div>
              <strong>{formatValue(row.total)}</strong>
            </div>
          ))}
        </div>

        <div className="dashboard-top3-legend" aria-label="Leyenda de posiciones">
          {[...RANK_STYLES].reverse().map((item) => (
            <span data-rank={item.bar} key={item.bar}>
              {item.label}
            </span>
          ))}
        </div>

        <div className="dashboard-top3-axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick}>{formatValue(tick)}</span>
          ))}
        </div>
      </div>
    </article>
  );
}
