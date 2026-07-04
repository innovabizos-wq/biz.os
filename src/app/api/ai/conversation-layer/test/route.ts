import { NextResponse } from "next/server";

import {
  conversationLayerApiError,
  requireConversationLayerAccess,
} from "@/modules/ai/conversation-layer-api";
import { testConversationProvider } from "@/modules/ai/conversation-layer-service";

export async function POST() {
  const access = await requireConversationLayerAccess(true);
  if (!access.ok) {
    return conversationLayerApiError(access.message, "PERMISSION_DENIED", access.status);
  }

  const result = await testConversationProvider(access.tenant);
  if (!result.ok) {
    return conversationLayerApiError(result.error.message, result.error.code, 400);
  }

  return NextResponse.json({ data: result.data });
}
