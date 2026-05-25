import { DriverStatusCards } from "@/modules/logistics/components/driver-status-cards";
import { LiveDriversMap } from "@/modules/logistics/components/live-drivers-map";
import { LogisticsSummaryPanel } from "@/modules/logistics/components/logistics-summary-panel";
import type {
  DriverTrackingSummary,
  LiveDriver,
} from "@/modules/driver-tracking/types";
import type {
  LogisticsDashboardStats,
  LogisticsDaySummary,
} from "@/modules/logistics/types";

type LogisticsLivePanelProps = {
  driverSummary: DriverTrackingSummary;
  liveDrivers: LiveDriver[];
  stats: LogisticsDashboardStats;
  summary: LogisticsDaySummary;
};

export function LogisticsLivePanel({
  driverSummary,
  liveDrivers,
  stats,
  summary,
}: LogisticsLivePanelProps) {
  return (
    <div className="grid h-[398px] shrink-0 gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
      <DriverStatusCards dispatchStats={stats} driverSummary={driverSummary} />
      <LiveDriversMap drivers={liveDrivers} />
      <LogisticsSummaryPanel stats={stats} summary={summary} />
    </div>
  );
}
