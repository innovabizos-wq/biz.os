import type { ReactNode } from "react";

type PremiumKpiGridProps = {
  children: ReactNode;
};

export function PremiumKpiGrid({ children }: PremiumKpiGridProps) {
  return (
    <div className="premium-kpi-grid grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {children}
    </div>
  );
}
