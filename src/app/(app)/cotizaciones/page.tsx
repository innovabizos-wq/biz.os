import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { getFiscalConfiguration, getInvoicesForSales } from "@/modules/billing/queries";
import { FloatingQuoteButton } from "@/modules/quotes/components/floating-quote-button";
import { QuotesDatabase } from "@/modules/quotes/components/quotes-database";
import {
  getActiveCatalogProductsForQuote,
  getCustomersForQuote,
  getQuoteItemsForQuotes,
  getQuotes,
} from "@/modules/quotes/queries";
import type { Quote, QuoteStatus } from "@/modules/quotes/types";
import { getSalesForQuotes } from "@/modules/sales/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type QuotesPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

type DonutSegment = {
  color: string;
  label: string;
  value: number;
};

type MonthPoint = {
  acceptedRate: number;
  label: string;
  openAmount: number;
  totalAmount: number;
};

type DailyQuotePoint = {
  acceptedRate: number;
  day: number;
  label: string;
  openAmount: number;
  totalAmount: number;
};

const statusLabels: Record<QuoteStatus, string> = {
  aceptada: "Aceptadas",
  anulada: "Anuladas",
  borrador: "Borradores",
  enviada: "Enviadas",
  rechazada: "Rechazadas",
  vencida: "Vencidas",
};

const statusColors: Record<QuoteStatus, string> = {
  aceptada: "#35c4bf",
  anulada: "#9ca3af",
  borrador: "#ffc229",
  enviada: "#0ea5e9",
  rechazada: "#ef4444",
  vencida: "#334155",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CR", {
    currency: "CRC",
    maximumFractionDigits: 0,
    notation: value >= 1000000 ? "compact" : "standard",
    style: "currency",
  }).format(value);
}

function formatPercent(value: number, total: number) {
  if (total === 0) return "0%";

  return `${Math.round((value / total) * 100)}%`;
}

function buildConicGradient(segments: DonutSegment[]) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let cursor = 0;

  if (total === 0) return "#eef2f7";

  return `conic-gradient(${segments
    .map((segment) => {
      const start = cursor;
      const end = cursor + (segment.value / total) * 100;
      cursor = end;

      return `${segment.color} ${start}% ${end}%`;
    })
    .join(", ")})`;
}

function getStatusSegments(quotes: Quote[]): DonutSegment[] {
  return (Object.keys(statusLabels) as QuoteStatus[])
    .map((status) => ({
      color: statusColors[status],
      label: statusLabels[status],
      value: quotes.filter((quote) => quote.estado === status).length,
    }))
    .filter((segment) => segment.value > 0);
}

function getLastMonths(count = 12) {
  const now = new Date();

  return Array.from({ length: count }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);

    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleString("es", { month: "short" }).replace(".", ""),
      month: date.getMonth(),
      year: date.getFullYear(),
    };
  });
}

function getMonthlyPoints(quotes: Quote[]): MonthPoint[] {
  return getLastMonths().map((month) => {
    const rows = quotes.filter((quote) => {
      const date = new Date(quote.fechaEmision);

      return date.getFullYear() === month.year && date.getMonth() === month.month;
    });
    const accepted = rows.filter((quote) => quote.estado === "aceptada");
    const open = rows.filter((quote) => ["borrador", "enviada"].includes(quote.estado));

    return {
      acceptedRate: rows.length > 0 ? Math.round((accepted.length / rows.length) * 100) : 0,
      label: month.label.toUpperCase(),
      openAmount: open.reduce((sum, quote) => sum + quote.total, 0),
      totalAmount: rows.reduce((sum, quote) => sum + quote.total, 0),
    };
  });
}

function getCurrentMonthDailyPoints(quotes: Quote[]): DailyQuotePoint[] {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: daysInMonth }).map((_, index) => {
    const day = index + 1;
    const rows = quotes.filter((quote) => {
      const date = new Date(quote.fechaEmision);

      return (
        date.getFullYear() === year &&
        date.getMonth() === month &&
        date.getDate() === day
      );
    });
    const accepted = rows.filter((quote) => quote.estado === "aceptada");
    const open = rows.filter((quote) =>
      ["borrador", "enviada", "vencida"].includes(quote.estado),
    );

    return {
      acceptedRate:
        rows.length > 0 ? Math.round((accepted.length / rows.length) * 100) : 0,
      day,
      label: `${day}`,
      openAmount: open.reduce((sum, quote) => sum + quote.total, 0),
      totalAmount: rows.reduce((sum, quote) => sum + quote.total, 0),
    };
  });
}

function getAgingBuckets(quotes: Quote[]) {
  const now = new Date();
  const openQuotes = quotes.filter((quote) =>
    ["borrador", "enviada", "vencida"].includes(quote.estado),
  );

  return [
    { label: "<30 Days", max: 30, min: 0 },
    { label: "<60 Days", max: 60, min: 31 },
    { label: "<90 Days", max: 90, min: 61 },
    { label: ">90 Days", max: Number.POSITIVE_INFINITY, min: 91 },
  ].map((bucket) => {
    const value = openQuotes
      .filter((quote) => {
        const date = new Date(quote.fechaEmision);
        const days = Math.max(
          0,
          Math.floor((now.getTime() - date.getTime()) / 86400000),
        );

        return days >= bucket.min && days <= bucket.max;
      })
      .reduce((sum, quote) => sum + quote.total, 0);

    return { label: bucket.label, value };
  });
}

function Gauge({
  label,
  percent,
  value,
}: {
  label: string;
  percent: number;
  value: string;
}) {
  const clamped = Math.max(0, Math.min(percent, 100));

  return (
    <div className="text-center">
      <svg className="mx-auto h-20 w-32" viewBox="0 0 120 72">
        <path
          d="M18 60a42 42 0 0 1 84 0"
          fill="none"
          stroke="#d8dee8"
          strokeLinecap="butt"
          strokeWidth="18"
        />
        <path
          d="M18 60a42 42 0 0 1 84 0"
          fill="none"
          pathLength={100}
          stroke="#97c9e7"
          strokeDasharray={`${Math.min(clamped, 33)} 100`}
          strokeLinecap="butt"
          strokeWidth="18"
        />
        <path
          d="M18 60a42 42 0 0 1 84 0"
          fill="none"
          pathLength={100}
          stroke="#2f7aa6"
          strokeDasharray={`${Math.max(clamped - 33, 0)} 100`}
          strokeDashoffset={-33}
          strokeLinecap="butt"
          strokeWidth="18"
        />
        <path
          d="M18 60a42 42 0 0 1 84 0"
          fill="none"
          pathLength={100}
          stroke="#1e3a5f"
          strokeDasharray={`${Math.max(clamped - 66, 0)} 100`}
          strokeDashoffset={-66}
          strokeLinecap="butt"
          strokeWidth="18"
        />
        <text
          className="fill-slate-700 text-[12px] font-black"
          textAnchor="middle"
          x="60"
          y="58"
        >
          {value}
        </text>
      </svg>
      <p className="mt-1 text-sm font-black text-slate-700">{label}</p>
    </div>
  );
}

function Donut({
  center,
  segments,
  subtitle,
}: {
  center: string;
  segments: DonutSegment[];
  subtitle: string;
}) {
  return (
    <div className="relative mx-auto size-44">
      <div
        aria-hidden="true"
        className="size-44 rounded-full"
        style={{ background: buildConicGradient(segments) }}
      />
      <div className="absolute inset-10 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
        <span className="text-4xl font-light text-slate-900">{center}</span>
        <span className="mt-1 text-[11px] font-bold text-slate-500">{subtitle}</span>
      </div>
    </div>
  );
}

function DailyQuoteAmountChart({ points }: { points: DailyQuotePoint[] }) {
  const maxValue = Math.max(...points.map((point) => point.totalAmount), 1);
  const linePoints = points
    .map((point, index) => {
      const step = 306 / Math.max(points.length - 1, 1);
      const x = 24 + index * step;
      const y = 166 - (point.acceptedRate / 100) * 130;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <section className="rounded-sm border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="text-center text-sm font-black text-slate-600">
        Monto cotizado diario
      </h2>
      <div className="mt-3 flex items-center justify-center gap-6 text-xs font-bold text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-8 bg-[#35c4bf]" />
          Cotizado
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-8 bg-slate-700" />
          Abierto
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-8 bg-slate-800" />
          Aceptacion %
        </span>
      </div>
      <svg className="mt-1 h-56 w-full" viewBox="0 0 350 220">
        {[0, 1, 2, 3, 4].map((line) => (
          <line
            key={line}
            stroke="#e5e7eb"
            strokeWidth="1"
            x1="20"
            x2="340"
            y1={34 + line * 34}
            y2={34 + line * 34}
          />
        ))}
        {points.map((point, index) => {
          const step = 306 / Math.max(points.length - 1, 1);
          const x = 18 + index * step;
          const totalHeight = Math.max((point.totalAmount / maxValue) * 145, 2);
          const openHeight = Math.max((point.openAmount / maxValue) * 145, 2);
          const showLabel =
            point.day === 1 || point.day === points.length || point.day % 5 === 0;

          return (
            <g key={point.label}>
              <rect
                fill="#35c4bf"
                height={totalHeight}
                rx="1"
                width="10"
                x={x}
                y={176 - totalHeight}
              />
              <rect
                fill="#334155"
                height={openHeight}
                rx="1"
                width="6"
                x={x + 12}
                y={176 - openHeight}
              />
              {showLabel ? (
                <text
                  className="fill-slate-400 text-[9px] font-bold"
                  textAnchor="middle"
                  x={x + 7}
                  y="205"
                >
                  {point.label}
                </text>
              ) : null}
            </g>
          );
        })}
        <polyline
          fill="none"
          points={linePoints}
          stroke="#111827"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </section>
  );
}

function AgingGaugeCard({
  quotes,
}: {
  quotes: Quote[];
}) {
  const openQuotes = quotes.filter((quote) =>
    ["borrador", "enviada", "vencida"].includes(quote.estado),
  );
  const late = openQuotes.filter((quote) => quote.estado === "vencida").length;

  return (
    <section className="rounded-sm border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="text-center text-sm font-black text-slate-600">
        Riesgo vencido
      </h2>
      <Gauge
        label={`${late} vencidas`}
        percent={Math.round((late / Math.max(openQuotes.length, 1)) * 100)}
        value={formatPercent(late, openQuotes.length)}
      />
    </section>
  );
}

function AgingBarsCard({
  openAmount,
  quotes,
}: {
  openAmount: number;
  quotes: Quote[];
}) {
  const buckets = getAgingBuckets(quotes);
  const maxBucket = Math.max(...buckets.map((bucket) => bucket.value), 1);

  return (
    <section className="rounded-sm border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between text-sm">
        <p className="font-black text-slate-700">Antiguedad abierta</p>
        <p className="text-right text-xs font-bold text-slate-500">
          Total abierto
          <br />
          <span className="text-sm text-slate-800">{formatCurrency(openAmount)}</span>
        </p>
      </div>
      <div className="mt-2 grid grid-cols-4 items-end gap-4">
        {buckets.map((bucket) => (
          <div className="text-center" key={bucket.label}>
            <p className="mb-1 text-[10px] font-bold text-slate-500">
              {formatCurrency(bucket.value)}
            </p>
            <div
              className="mx-auto w-8 bg-[#ffc229]"
              style={{ height: `${Math.max((bucket.value / maxBucket) * 88, 10)}px` }}
            />
            <p className="mt-1 text-[10px] font-bold text-slate-500">
              {bucket.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrendGaugeCard({ quotes }: { quotes: Quote[] }) {
  const decidedQuotes = quotes.filter((quote) =>
    ["aceptada", "rechazada", "anulada"].includes(quote.estado),
  );
  const accepted = decidedQuotes.filter((quote) => quote.estado === "aceptada").length;

  return (
    <section className="rounded-sm border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="text-center text-sm font-black text-slate-600">
        Conversion aceptada
      </h2>
      <Gauge
        label={`${accepted} aceptadas`}
        percent={Math.round((accepted / Math.max(decidedQuotes.length, 1)) * 100)}
        value={formatPercent(accepted, decidedQuotes.length)}
      />
    </section>
  );
}

function TrendLineCard({ points }: { points: MonthPoint[] }) {
  const maxValue = Math.max(...points.map((point) => point.totalAmount), 1);
  const polyline = points
    .map((point, index) => {
      const x = 16 + index * 20;
      const y = 115 - (point.totalAmount / maxValue) * 72;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <section className="rounded-sm border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-black text-slate-700">Tendencia cotizada</p>
      <svg className="mt-1 h-32 w-full" viewBox="0 0 240 135">
        {[0, 1, 2].map((line) => (
          <line
            key={line}
            stroke="#e5e7eb"
            strokeWidth="1"
            x1="10"
            x2="230"
            y1={38 + line * 34}
            y2={38 + line * 34}
          />
        ))}
        <polyline
          fill="none"
          points={polyline}
          stroke="#26364a"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        {points.map((point, index) => (
          <text
            className="fill-slate-400 text-[9px] font-bold"
            key={point.label}
            textAnchor="middle"
            x={16 + index * 20}
            y="130"
          >
            {point.label.slice(0, 1)}
          </text>
        ))}
      </svg>
    </section>
  );
}

function QuoteAnalyticsCharts({
  acceptedQuotes,
  draftAndSentQuotes,
  openAmount,
  quotes,
}: {
  acceptedQuotes: Quote[];
  draftAndSentQuotes: Quote[];
  openAmount: number;
  quotes: Quote[];
}) {
  const total = quotes.length;
  const points = getMonthlyPoints(quotes);
  const dailyPoints = getCurrentMonthDailyPoints(quotes);
  const acceptedPercent = formatPercent(acceptedQuotes.length, total);
  const openPercent = formatPercent(draftAndSentQuotes.length, total);
  const statusSegments = getStatusSegments(quotes);

  return (
    <div className="grid gap-3 xl:grid-cols-[1.35fr_0.8fr_1.8fr]">
      <DailyQuoteAmountChart points={dailyPoints} />

      <section className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-center text-sm font-black text-slate-600">
          Estado de cotizaciones
        </h2>
        <div className="mt-4">
          <Donut
            center={`${total}`}
            segments={statusSegments}
            subtitle={`Abiertas ${openPercent}`}
          />
        </div>
        <p className="mt-2 text-center text-xs font-bold text-slate-500">
          Aceptadas {acceptedPercent}
        </p>
        <div className="mt-3 flex justify-center gap-4 text-xs font-bold text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-[#35c4bf]" />
            Aceptadas
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-[#ef4444]" />
            Perdidas
          </span>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <AgingGaugeCard quotes={quotes} />
        <TrendGaugeCard quotes={quotes} />
        <AgingBarsCard openAmount={openAmount} quotes={quotes} />
        <TrendLineCard points={points} />
      </div>
    </div>
  );
}

export default async function QuotesPage({ searchParams }: QuotesPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canView = hasPermission(access.tenant.permissions, "quotes.view");
  const canCreate = hasPermission(access.tenant.permissions, "quotes.create");
  const canEdit = hasPermission(access.tenant.permissions, "quotes.edit");
  const canConfirmSale =
    hasPermission(access.tenant.permissions, "quotes.status.change") &&
    hasPermission(access.tenant.permissions, "sales.orders.create") &&
    hasPermission(access.tenant.permissions, "sales.orders.status.change");
  const canDeleteQuote =
    hasPermission(access.tenant.permissions, "admin.settings.manage") ||
    hasPermission(access.tenant.permissions, "admin.roles.manage");
  const canCreateInvoice = hasPermission(
    access.tenant.permissions,
    "billing.invoices.create",
  );

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta seccion."
          eyebrow="Comercial"
          title="Cotizaciones"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [quotes, quoteCustomers, quoteProducts, fiscalConfiguration] =
    await Promise.all([
      getQuotes(access.tenant, "todos"),
      canCreate || canEdit ? getCustomersForQuote(access.tenant) : null,
      canCreate || canEdit ? getActiveCatalogProductsForQuote(access.tenant) : null,
      canCreateInvoice ? getFiscalConfiguration(access.tenant) : null,
    ]);
  const quoteRows = quotes.ok ? quotes.data : [];
  const quoteIds = quoteRows.map((quote) => quote.id);
  const [itemsByQuote, salesByQuote] = await Promise.all([
    getQuoteItemsForQuotes(access.tenant, quoteIds),
    getSalesForQuotes(access.tenant, quoteIds),
  ]);
  const salesByQuoteId = salesByQuote.ok ? salesByQuote.data : {};
  const saleIds = Object.values(salesByQuoteId).map((sale) => sale.id);
  const invoicesBySale = await getInvoicesForSales(access.tenant, saleIds);
  const draftAndSentQuotes = quoteRows.filter((quote) =>
    ["borrador", "enviada"].includes(quote.estado),
  );
  const acceptedQuotes = quoteRows.filter((quote) => quote.estado === "aceptada");
  const openAmount = draftAndSentQuotes.reduce((sum, quote) => sum + quote.total, 0);

  return (
    <section className="flex h-[calc(100vh-3rem)] min-h-0 flex-col gap-6 overflow-hidden">
      <SectionHeader
        actions={
          canCreate ? (
            <FloatingQuoteButton
              activeProducts={quoteProducts?.ok ? quoteProducts.data : []}
              customers={quoteCustomers?.ok ? quoteCustomers.data : []}
            />
          ) : null
        }
        title="Cotizaciones"
        titleClassName="app-page-title-compact normal-case"
      />

      <EphemeralPageAlert error={params?.error} success={params?.success} />

      <QuoteAnalyticsCharts
        acceptedQuotes={acceptedQuotes}
        draftAndSentQuotes={draftAndSentQuotes}
        openAmount={openAmount}
        quotes={quoteRows}
      />

      {!quotes.ok ? (
        <EmptyState description={quotes.error.message} title="No se pudo cargar" />
      ) : quoteRows.length > 0 ? (
        <QuotesDatabase
          canConfirmSale={canConfirmSale}
          canCreateInvoice={canCreateInvoice}
          canDeleteQuote={canDeleteQuote}
          canEditQuote={canEdit}
          customers={quoteCustomers?.ok ? quoteCustomers.data : []}
          fiscalConfiguration={fiscalConfiguration?.ok ? fiscalConfiguration.data : null}
          invoicesBySaleId={invoicesBySale.ok ? invoicesBySale.data : {}}
          itemsByQuoteId={itemsByQuote.ok ? itemsByQuote.data : {}}
          products={quoteProducts?.ok ? quoteProducts.data : []}
          quotes={quoteRows}
          salesByQuoteId={salesByQuoteId}
        />
      ) : (
        <EmptyState
          description="Aun no hay cotizaciones visibles."
          title="Sin cotizaciones"
        />
      )}
    </section>
  );
}
