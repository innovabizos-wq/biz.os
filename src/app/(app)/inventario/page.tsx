import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { InventoryDatabase } from "@/modules/inventory/components/inventory-database";
import {
  canAccessInventoryNav,
  getInventoryStock,
  getInventorySummary,
} from "@/modules/inventory/queries";
import type { InventoryStock, InventorySummary } from "@/modules/inventory/types";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type InventoryPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

type ChartPoint = {
  label: string;
  max: number;
  min: number;
  value: number;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CR", {
    maximumFractionDigits: 0,
    notation: value >= 10000 ? "compact" : "standard",
  }).format(value);
}

function getStockStatus(item: InventoryStock) {
  if (item.stockMinimo > 0 && item.cantidad < item.stockMinimo) return "low";
  if (item.stockMaximo !== null && item.cantidad > item.stockMaximo) return "over";

  return "ok";
}

function getWarehousePoints(stock: InventoryStock[]): ChartPoint[] {
  const warehouses = new Map<string, ChartPoint>();

  stock.forEach((item) => {
    const key = item.bodegaNombre ?? "Bodega";
    const current = warehouses.get(key) ?? {
      label: key,
      max: 0,
      min: 0,
      value: 0,
    };

    current.value += item.cantidad;
    current.min += item.stockMinimo;
    current.max += item.stockMaximo ?? Math.max(item.cantidad, item.stockMinimo);
    warehouses.set(key, current);
  });

  return Array.from(warehouses.values())
    .sort((left, right) => right.value - left.value)
    .slice(0, 4);
}

function InventoryBarsCard({ points }: { points: ChartPoint[] }) {
  const chartPoints = points.length
    ? points
    : [{ label: "Stock", max: 1, min: 0, value: 0 }];
  const maxValue = Math.max(
    ...chartPoints.flatMap((point) => [point.value, point.min, point.max]),
    1,
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-slate-400">Inventario</p>
          <h2 className="text-sm font-black text-slate-800">Stock por bodega</h2>
        </div>
        <div className="flex gap-1 text-[10px] font-black text-slate-500">
          <span className="rounded-md bg-slate-100 px-2 py-1">Min</span>
          <span className="rounded-md bg-slate-100 px-2 py-1">Real</span>
        </div>
      </div>
      <div className="mt-4 grid h-28 grid-cols-4 items-end gap-4">
        {chartPoints.map((point) => (
          <div className="grid h-full items-end gap-1" key={point.label}>
            <div className="flex h-24 items-end justify-center gap-1">
              <span
                className="w-2 rounded-t bg-[#bde7ea]"
                style={{ height: `${Math.max((point.min / maxValue) * 100, 8)}%` }}
              />
              <span
                className="w-2 rounded-t bg-[#6bd0ca]"
                style={{ height: `${Math.max((point.value / maxValue) * 100, 8)}%` }}
              />
              <span
                className="w-2 rounded-t bg-[#2ca6b0]"
                style={{ height: `${Math.max((point.max / maxValue) * 100, 8)}%` }}
              />
            </div>
            <p className="truncate text-center text-[10px] font-black text-slate-500">
              {point.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function InventoryRadialCard({
  lowPercent,
  okPercent,
  overPercent,
}: {
  lowPercent: number;
  okPercent: number;
  overPercent: number;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
      <p className="text-xs font-bold text-slate-400">Inventario</p>
      <h2 className="text-sm font-black text-slate-800">Salud de stock</h2>
      <div className="relative mx-auto mt-3 size-32">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(#6bd0ca 0 ${okPercent}%, #e8f8f6 0 100%)`,
          }}
        />
        <div
          className="absolute inset-4 rounded-full"
          style={{
            background: `conic-gradient(#7c8cf8 0 ${lowPercent}%, #eef0ff 0 100%)`,
          }}
        />
        <div
          className="absolute inset-8 rounded-full"
          style={{
            background: `conic-gradient(#35b6c6 0 ${overPercent}%, #edf9fb 0 100%)`,
          }}
        />
        <div className="absolute inset-12 rounded-full bg-white" />
      </div>
    </section>
  );
}

function InventoryMetricCard({
  lowPercent,
  summary,
}: {
  lowPercent: number;
  summary: InventorySummary;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
      <div className="grid gap-4">
        <div className="flex items-center gap-3">
          <div className="grid size-14 place-items-center rounded-full bg-[conic-gradient(#6bd0ca_0_78%,#e9f8f7_0_100%)]">
            <span className="grid size-10 place-items-center rounded-full bg-white text-xs font-black text-[#2ca6b0]">
              {summary.productosConStock}
            </span>
          </div>
          <div>
            <p className="text-xl font-black text-slate-900">
              {formatNumber(summary.productosConStock)}
            </p>
            <span className="text-xs font-bold text-emerald-500">Con stock</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="grid size-14 place-items-center rounded-full"
            style={{
              background: `conic-gradient(#7c8cf8 0 ${lowPercent}%, #eef0ff 0 100%)`,
            }}
          >
            <span className="grid size-10 place-items-center rounded-full bg-white text-xs font-black text-[#7c8cf8]">
              {Math.round(lowPercent)}%
            </span>
          </div>
          <div>
            <p className="text-xl font-black text-slate-900">
              {formatNumber(summary.productosBajoStock)}
            </p>
            <span className="text-xs font-bold text-[#7c8cf8]">Bajo minimo</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function InventoryTrendCard({ stock }: { stock: InventoryStock[] }) {
  const values = stock
    .slice()
    .sort((left, right) => new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime())
    .slice(-12)
    .map((item, index) => ({
      label: `${index + 1}`,
      value: item.cantidad,
    }));
  const points = values.length ? values : [{ label: "1", value: 0 }];
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const line = points
    .map((point, index) => {
      const x = 16 + index * (150 / Math.max(points.length - 1, 1));
      const y = 82 - (point.value / maxValue) * 56;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
      <p className="text-xs font-bold text-slate-400">Ultimos cambios</p>
      <h2 className="text-xl font-black text-slate-900">
        {formatNumber(stock.reduce((sum, item) => sum + item.cantidad, 0))}
      </h2>
      <svg className="mt-2 h-24 w-full" viewBox="0 0 180 100">
        <path d={`16,92 ${line} 166,92`} fill="#6bd0ca" opacity="0.4" />
        <polyline fill="none" points={line} stroke="#7c8cf8" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {points.map((point, index) => {
          const x = 16 + index * (150 / Math.max(points.length - 1, 1));
          const y = 82 - (point.value / maxValue) * 56;

          return <circle cx={x} cy={y} fill="#ffffff" key={`${point.label}-${index}`} r="3" stroke="#7c8cf8" strokeWidth="2" />;
        })}
      </svg>
    </section>
  );
}

function InventoryGaugeCard({
  activeWarehouses,
  totalWarehouses,
}: {
  activeWarehouses: number;
  totalWarehouses: number;
}) {
  const percent = Math.round((activeWarehouses / Math.max(totalWarehouses, 1)) * 100);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
      <p className="text-xs font-bold text-slate-400">Bodegas</p>
      <h2 className="text-sm font-black text-slate-800">Operativas</h2>
      <svg className="mt-5 h-24 w-full" viewBox="0 0 160 90">
        <path d="M24 74a56 56 0 0 1 112 0" fill="none" stroke="#e7eef7" strokeLinecap="round" strokeWidth="10" />
        <path
          d="M24 74a56 56 0 0 1 112 0"
          fill="none"
          pathLength={100}
          stroke="#7c8cf8"
          strokeDasharray={`${Math.min(percent, 34)} 100`}
          strokeLinecap="round"
          strokeWidth="10"
        />
        <path
          d="M24 74a56 56 0 0 1 112 0"
          fill="none"
          pathLength={100}
          stroke="#6bd0ca"
          strokeDasharray={`${Math.max(percent - 34, 0)} 100`}
          strokeDashoffset="-34"
          strokeLinecap="round"
          strokeWidth="10"
        />
        <text className="fill-slate-900 text-[18px] font-black" textAnchor="middle" x="80" y="66">
          {percent}%
        </text>
      </svg>
    </section>
  );
}

function InventoryAnalyticsCharts({
  stock,
  summary,
}: {
  stock: InventoryStock[];
  summary: InventorySummary;
}) {
  const totalRows = Math.max(stock.length, 1);
  const lowStock = stock.filter((item) => getStockStatus(item) === "low").length;
  const okStock = stock.filter((item) => getStockStatus(item) === "ok").length;
  const overStock = stock.filter((item) => getStockStatus(item) === "over").length;
  const warehouseNames = new Set(stock.map((item) => item.bodegaId));

  return (
    <div className="grid gap-3 xl:grid-cols-[1.55fr_0.8fr_0.8fr_1fr_0.8fr]">
      <InventoryBarsCard points={getWarehousePoints(stock)} />
      <InventoryRadialCard
        lowPercent={(lowStock / totalRows) * 100}
        okPercent={(okStock / totalRows) * 100}
        overPercent={(overStock / totalRows) * 100}
      />
      <InventoryMetricCard
        lowPercent={(lowStock / totalRows) * 100}
        summary={summary}
      />
      <InventoryTrendCard stock={stock} />
      <InventoryGaugeCard
        activeWarehouses={summary.bodegasActivas}
        totalWarehouses={warehouseNames.size}
      />
    </div>
  );
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);

  if (!canAccessInventoryNav(access.tenant)) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta secciÃ³n."
          eyebrow="OperaciÃ³n"
          title="Inventario"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [summary, stock] = await Promise.all([
    getInventorySummary(access.tenant),
    getInventoryStock(access.tenant),
  ]);

  return (
    <section className="flex h-[calc(100vh-3rem)] min-h-0 flex-col gap-6 overflow-hidden">
      <SectionHeader
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/inventario/productos"
            >
              Stock
            </Link>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/inventario/movimientos"
            >
              Movimientos
            </Link>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/inventario/bodegas"
            >
              Bodegas
            </Link>
          </div>
        }
        title="Inventario"
        titleClassName="app-page-title-compact normal-case"
      />

      <EphemeralPageAlert error={params?.error} />

      {!summary.ok ? (
        <EmptyState description={summary.error.message} title="No se pudo cargar" />
      ) : stock.ok ? (
        <InventoryAnalyticsCharts stock={stock.data} summary={summary.data} />
      ) : null}

      {!stock.ok ? (
        <EmptyState description={stock.error.message} title="No se pudo cargar" />
      ) : stock.data.length > 0 ? (
        <InventoryDatabase stock={stock.data} />
      ) : (
        <EmptyState
          description="Registra una entrada o ajuste para crear la primera fila de stock."
          title="Sin stock registrado"
        />
      )}
    </section>
  );
}
