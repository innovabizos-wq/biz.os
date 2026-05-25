"use server";

import { getInboxMessages } from "@/modules/inbox/queries";

export async function getInboxWidgetMessagesAction(conversationId: string) {
  const result = await getInboxMessages(conversationId);

  if (!result.ok) return [];

  return result.data;
}
