import { getInboxConversations } from "@/modules/inbox/queries";
import type { InboxWidgetConversation } from "@/modules/inbox-widget/types";
import type { CoreResult } from "@/types/core";
import { ok } from "@/types/core";

export async function getInboxWidgetConversations(): Promise<
  CoreResult<InboxWidgetConversation[]>
> {
  const result = await getInboxConversations();

  if (!result.ok) return ok([]);

  return ok(result.data.slice(0, 30));
}
