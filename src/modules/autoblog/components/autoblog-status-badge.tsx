import { AUTOBLOG_STATUS_LABELS } from "@/modules/autoblog/constants";
import type { AutoblogStatus } from "@/modules/autoblog/types";
import { cn } from "@/lib/utils";

type AutoblogStatusBadgeProps = {
  status: AutoblogStatus;
};

const statusClassNames: Record<AutoblogStatus, string> = {
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  archived: "border-slate-200 bg-slate-100 text-slate-700",
  draft: "border-slate-200 bg-white text-slate-700",
  pending_review: "border-amber-200 bg-amber-50 text-amber-800",
  ready_to_publish: "border-sky-200 bg-sky-50 text-sky-800",
};

export function AutoblogStatusBadge({ status }: AutoblogStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
        statusClassNames[status],
      )}
    >
      {AUTOBLOG_STATUS_LABELS[status]}
    </span>
  );
}
