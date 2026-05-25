import Link from "next/link";
import type { ReactNode } from "react";

export type PremiumKpiVariant =
  | "blue"
  | "red"
  | "green"
  | "gold"
  | "purple"
  | "dark";

export type PremiumKpiCardProps = {
  title: string;
  value: string | number;
  icon: ReactNode;
  variant?: PremiumKpiVariant;
  trendValue?: string;
  trendLabel?: string;
  trendTone?: "positive" | "negative" | "neutral";
  sparklineTone?: "blue" | "red" | "green" | "gold" | "purple";
  footerLeftLabel?: string;
  footerLeftValue?: string | number;
  footerRightLabel?: string;
  footerRightValue?: string | number;
  href?: string;
};

function getTrendClass(tone: PremiumKpiCardProps["trendTone"]) {
  if (tone === "negative") return "text-red-200";
  if (tone === "neutral") return "text-white/80";
  return "text-lime-300";
}

function PremiumKpiContent({
  title,
  value,
  icon,
  variant = "blue",
  trendValue,
  trendLabel = "vs. semana anterior",
  trendTone = "positive",
  footerLeftLabel,
  footerLeftValue,
  footerRightLabel,
  footerRightValue,
}: PremiumKpiCardProps) {
  const titleLength = title.replace(/\s+/g, "").length;
  const titleClassName =
    titleLength > 20
      ? "premium-kpi-title premium-kpi-title-compact"
      : titleLength > 15
        ? "premium-kpi-title premium-kpi-title-balanced"
        : "premium-kpi-title";

  return (
    <div className={`premium-kpi-card premium-kpi-${variant}`}>
      <span className="premium-kpi-shine" />
      <span className="premium-kpi-border" />
      <span className="premium-kpi-bottom-glow" />

      <div className="relative z-10 flex min-h-[136px] flex-1 flex-col justify-between">
        <div className="premium-kpi-header">
          <div className="flex min-w-0 items-center gap-3">
            <div className="premium-kpi-icon">{icon}</div>

            <div className="min-w-0">
              <div className="premium-kpi-value">
                {value}
              </div>
              <div className={titleClassName}>
                {title}
              </div>
            </div>
          </div>

          {trendValue ? (
            <div className="premium-kpi-trend">
              <div className={`premium-kpi-trend-value ${getTrendClass(trendTone)}`}>
                {trendValue}
              </div>
              <div className="premium-kpi-trend-label">
                {trendLabel}
              </div>
            </div>
          ) : null}
        </div>

        <div className="premium-kpi-sparkbox">
          <svg
            aria-hidden="true"
            className="premium-kpi-sparkline"
            fill="none"
            viewBox="0 0 180 42"
          >
            <defs>
              <linearGradient id={`spark-${variant}`} x1="2" x2="178" y1="31" y2="10">
                <stop stopColor="currentColor" stopOpacity="0.55" />
                <stop offset="0.55" stopColor="currentColor" stopOpacity="1" />
                <stop offset="1" stopColor="white" stopOpacity="0.92" />
              </linearGradient>
            </defs>
            <path
              className="premium-kpi-sparkline-baseline"
              d="M2 36 L178 36"
              stroke="currentColor"
              strokeOpacity="0.18"
              strokeWidth="1"
            />
            <path
              className="premium-kpi-sparkline-main"
              d="M2 31 L16 30 L28 32 L42 28 L56 28 L70 20 L84 29 L98 32 L112 26 L126 30 L140 20 L154 31 L170 30 L178 10"
              stroke={`url(#spark-${variant})`}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
            <path
              className="premium-kpi-sparkline-highlight"
              d="M2 31 L16 30 L28 32 L42 28 L56 28 L70 20 L84 29 L98 32 L112 26 L126 30 L140 20 L154 31 L170 30 L178 10"
              stroke="white"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.38"
              strokeWidth="0.8"
            />
            {[
              [28, 32],
              [42, 28],
              [56, 28],
              [70, 20],
              [98, 32],
              [112, 26],
              [126, 30],
              [140, 20],
              [170, 30],
              [178, 10],
            ].map(([cx, cy]) => (
              <circle
                cx={cx}
                cy={cy}
                fill="white"
                fillOpacity="0.62"
                key={`${cx}-${cy}`}
                r="1.1"
              />
            ))}
            <path
              className="premium-kpi-sparkline-end"
              d="M178 10 V36"
              stroke="currentColor"
              strokeLinecap="round"
              strokeOpacity="0.78"
              strokeWidth="1.8"
            />
          </svg>
        </div>

        <div className="premium-kpi-footer">
          <div className="min-w-0 pr-3">
            <div className="premium-kpi-footer-label">
              {footerLeftLabel}
            </div>
            <div className="premium-kpi-footer-value">
              {footerLeftValue}
            </div>
          </div>

          <div className="min-w-0 pl-4">
            <div className="premium-kpi-footer-label">
              {footerRightLabel}
            </div>
            <div className="premium-kpi-footer-value">
              {footerRightValue}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PremiumKpiCard(props: PremiumKpiCardProps) {
  if (props.href) {
    return (
      <Link className="block" href={props.href}>
        <PremiumKpiContent {...props} />
      </Link>
    );
  }

  return <PremiumKpiContent {...props} />;
}
