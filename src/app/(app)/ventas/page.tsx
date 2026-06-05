import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { SalesDatabase } from "@/modules/sales/components/sales-database";
import { getSales } from "@/modules/sales/queries";
import type { Sale } from "@/modules/sales/types";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type SalesPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

type MonthlySalesPoint = {
  activeAmount: number;
  completedAmount: number;
  label: string;
  totalAmount: number;
};

function formatPercent(value: number, total: number) {
  if (total === 0) return "0%";

  return `${Math.round((value / total) * 100)}%`;
}

function getMonthlySalesPoints(sales: Sale[]): MonthlySalesPoint[] {
  const now = new Date();
  const currentYear = now.getFullYear();

  return Array.from({ length: 12 }).map((_, month) => {
    const rows = sales.filter((sale) => {
      const date = new Date(sale.fechaVenta);

      return date.getFullYear() === currentYear && date.getMonth() === month;
    });
    const completedRows = rows.filter((sale) => sale.estado === "completada");
    const activeRows = rows.filter((sale) =>
      ["nueva", "confirmada", "en_proceso"].includes(sale.estado),
    );

    return {
      activeAmount: activeRows.reduce((sum, sale) => sum + sale.total, 0),
      completedAmount: completedRows.reduce((sum, sale) => sum + sale.total, 0),
      label: new Date(currentYear, month, 1)
        .toLocaleString("es", { month: "short" })
        .replace(".", "")
        .toUpperCase(),
      totalAmount: rows.reduce((sum, sale) => sum + sale.total, 0),
    };
  });
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("es-CR", {
    currency: "CRC",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
  }).format(value);
}

function SalesAnalyticsCards({
  activeSales,
  completedSales,
  sales,
}: {
  activeSales: Sale[];
  completedSales: Sale[];
  sales: Sale[];
}) {
  const points = getMonthlySalesPoints(sales);
  const total = sales.length;
  const conversion = formatPercent(completedSales.length, total);
  const totalGenerated = sales.reduce((sum, sale) => sum + sale.total, 0);
  const completedAmount = completedSales.reduce((sum, sale) => sum + sale.total, 0);
  const activeAmount = activeSales.reduce((sum, sale) => sum + sale.total, 0);
  const averageTicket = total > 0 ? totalGenerated / total : 0;
  const maxMonthlyValue = Math.max(
    ...points.flatMap((point) => [
      point.completedAmount,
      point.activeAmount,
    ]),
    1,
  );
  const completedLine = points
    .map((point, index) => {
      const x = 32 + index * 44;
      const y = 198 - (point.completedAmount / maxMonthlyValue) * 158;

      return `${x},${y}`;
    })
    .join(" ");
  const activeLine = points
    .map((point, index) => {
      const x = 32 + index * 44;
      const y = 198 - (point.activeAmount / maxMonthlyValue) * 158;

      return `${x},${y}`;
    })
    .join(" ");
  const kpis = [
    {
      label: "Ventas generadas",
      trend: "+12.6%",
      tone: "green",
      value: formatCompactCurrency(totalGenerated),
    },
    {
      label: "Ventas completadas",
      trend: "+8.4%",
      tone: "green",
      value: formatCompactCurrency(completedAmount),
    },
    {
      label: "Ventas activas",
      trend: "-2.6%",
      tone: "amber",
      value: formatCompactCurrency(activeAmount),
    },
    {
      label: "Ticket promedio",
      trend: "+12.6%",
      tone: "green",
      value: formatCompactCurrency(averageTicket),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <section
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_12px_26px_rgba(15,23,42,0.06)]"
            key={kpi.label}
          >
            <div className="flex items-center justify-between">
              <p className="inline-flex items-center gap-2 text-sm font-black text-slate-700">
                <span className="size-3 rounded-[4px] bg-amber-400" />
                {kpi.label}
              </p>
              <span className="text-lg font-black leading-none text-slate-500">...</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <strong className="text-2xl font-black tracking-tight text-slate-950">
                {kpi.value}
              </strong>
              <span
                className={`rounded-sm px-2 py-1 text-xs font-black ${
                  kpi.tone === "amber"
                    ? "bg-amber-50 text-amber-500"
                    : "bg-emerald-50 text-emerald-500"
                }`}
              >
                {kpi.trend} {kpi.tone === "amber" ? "down" : "up"}
              </span>
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_12px_26px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-slate-950">Analitica de ventas</h2>
            <div className="flex items-center gap-6 text-sm font-semibold text-slate-600">
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                Completadas
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-amber-400" />
                Activas
              </span>
              <button
                className="rounded-lg border border-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
                type="button"
              >
                Mensual v
              </button>
            </div>
          </div>
          <svg className="mt-3 h-48 w-full" viewBox="0 0 560 240">
            {[0, 1, 2, 3, 4, 5].map((line) => (
              <g key={line}>
                <text
                  className="fill-slate-400 text-[12px] font-semibold"
                  textAnchor="end"
                  x="24"
                  y={38 + line * 29}
                >
                  {Math.round(100 - line * 20)}
                </text>
              <line
                stroke="#edf0f7"
                strokeWidth="1"
                x1="36"
                x2="540"
                y1={34 + line * 29}
                y2={34 + line * 29}
              />
            </g>
          ))}
            <rect
              fill="#d7f8e6"
              height="145"
              opacity="0.78"
              rx="12"
              width="24"
              x="212"
              y="34"
            />
            <polyline
              fill="none"
              points={completedLine}
              stroke="#22c985"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeWidth="3"
            />
            <polyline
              fill="none"
              points={activeLine}
              stroke="#ff9f1c"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeWidth="3"
            />
            <g>
              <rect
                fill="#ffffff"
                filter="drop-shadow(0 12px 22px rgba(15,23,42,0.12))"
                height="64"
                rx="8"
                width="112"
                x="176"
                y="48"
              />
              <text
                className="fill-slate-400 text-[11px] font-semibold"
                textAnchor="middle"
                x="232"
                y="72"
              >
                Mes actual
              </text>
              <text
                className="fill-slate-950 text-[14px] font-black"
                textAnchor="middle"
                x="232"
                y="94"
              >
                {formatCompactCurrency(points[new Date().getMonth()]?.totalAmount ?? 0)}
              </text>
            </g>
            {points.map((point, index) => (
              <g key={point.label}>
                <text
                  className="fill-slate-400 text-[12px] font-semibold"
                  textAnchor="middle"
                  x={32 + index * 44}
                  y="222"
                >
                  {point.label.slice(0, 3)}
                </text>
              </g>
            ))}
            {points.map((point, index) => {
              const x = 32 + index * 44;
              const completedY = 198 - (point.completedAmount / maxMonthlyValue) * 158;
              const activeY = 198 - (point.activeAmount / maxMonthlyValue) * 158;

              return (
                <g key={`${point.label}-dots`}>
                  <circle cx={x} cy={completedY} fill="#22c985" r="3" />
                  <circle cx={x} cy={activeY} fill="#ff9f1c" r="3" />
                </g>
              );
            })}
          </svg>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_12px_26px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Conversion de ventas</h2>
            <button
              className="rounded-md bg-red-500 px-3 py-2 text-sm font-semibold text-white"
              type="button"
            >
              Export
            </button>
          </div>
          <div className="relative mx-auto mt-5 size-44">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(#ef4444 0 ${Math.max((completedSales.length / Math.max(total, 1)) * 100, 1)}%, #ffffff 0 100%)`,
              }}
            />
            <div
              className="absolute inset-5 rounded-full"
              style={{
                background: `conic-gradient(#ffffff 0 ${Math.max((activeSales.length / Math.max(total, 1)) * 100, 1)}%, #ef4444 0 100%)`,
              }}
            />
            <div
              className="absolute inset-10 rounded-full"
              style={{
                background: `conic-gradient(#ef4444 0 ${Math.max((sales.filter((sale) => sale.estado !== "cancelada").length / Math.max(total, 1)) * 100, 1)}%, #ffffff 0 100%)`,
              }}
            />
            <div className="absolute inset-14 grid place-items-center rounded-full bg-white text-center shadow-inner">
              <strong className="text-4xl font-black text-slate-950">
                {total.toLocaleString("en-US")}
              </strong>
              <span className="text-xs font-bold text-slate-400">ventas</span>
            </div>
          </div>
          <div className="mt-6 grid gap-2 text-sm font-semibold text-slate-600">
            <p className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-red-500" />
                Completadas
              </span>
              <strong>{conversion}</strong>
            </p>
            <p className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-amber-400" />
                Activas
              </span>
              <strong>{formatPercent(activeSales.length, total)}</strong>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canView = hasPermission(access.tenant.permissions, "sales.orders.view");

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta seccion."
          eyebrow="Comercial"
          title="Ventas"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const sales = await getSales(access.tenant, "todos");
  const saleRows = sales.ok ? sales.data : [];
  const activeSales = saleRows.filter((sale) =>
    ["confirmada", "en_proceso"].includes(sale.estado),
  );
  const completedSales = saleRows.filter((sale) => sale.estado === "completada");

  return (
    <section className="flex h-[calc(100vh-3rem)] min-h-0 flex-col gap-6 overflow-hidden">
      <SectionHeader
        title="Ventas"
        titleClassName="app-page-title-compact normal-case"
      />

      <EphemeralPageAlert error={params?.error} />

      <SalesAnalyticsCards
        activeSales={activeSales}
        completedSales={completedSales}
        sales={saleRows}
      />

      {!sales.ok ? (
        <EmptyState description={sales.error.message} title="No se pudo cargar" />
      ) : saleRows.length > 0 ? (
        <SalesDatabase sales={saleRows} />
      ) : (
        <EmptyState
          description="Aun no hay ventas generadas desde cotizaciones."
          title="Sin ventas"
        />
      )}
    </section>
  );
}
