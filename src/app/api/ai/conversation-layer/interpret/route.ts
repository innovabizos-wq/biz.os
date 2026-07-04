import { NextResponse } from "next/server";

import {
  conversationLayerApiError,
  requireConversationLayerAccess,
} from "@/modules/ai/conversation-layer-api";
import { conversationLayerInterpretInputSchema } from "@/modules/ai/schemas";
import { interpretUserMessage } from "@/modules/ai/conversation-layer-service";

export async function POST(request: Request) {
  const access = await requireConversationLayerAccess(false);
  if (!access.ok) {
    return conversationLayerApiError(access.message, "PERMISSION_DENIED", access.status);
  }

  const parsed = conversationLayerInterpretInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return conversationLayerApiError("Solicitud de interpretacion invalida.", "VALIDATION_ERROR", 422);
  }

  const result = await interpretUserMessage(parsed.data);
  if (!result.ok) {
    return conversationLayerApiError(result.error.message, result.error.code, 400);
  }

  return NextResponse.json({ data: result.data });
}
