import {
  INBOX_CHANNEL_LABELS,
  INBOX_CHANNEL_VISUALS,
} from "@/modules/inbox/constants";
import type { InboxChannel } from "@/modules/inbox/types";

type InboxChannelBadgeProps = {
  channel: InboxChannel;
  showLabel?: boolean;
};

export function InboxChannelBadge({
  channel,
  showLabel = true,
}: InboxChannelBadgeProps) {
  const visual = INBOX_CHANNEL_VISUALS[channel];

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-bold",
        visual.accentClassName,
      ].join(" ")}
      title={INBOX_CHANNEL_LABELS[channel]}
    >
      <span className="inline-flex size-5 items-center justify-center rounded-full bg-background/80 text-[10px] uppercase">
        {visual.icon}
      </span>
      {showLabel ? <span>{INBOX_CHANNEL_LABELS[channel]}</span> : null}
    </span>
  );
}
