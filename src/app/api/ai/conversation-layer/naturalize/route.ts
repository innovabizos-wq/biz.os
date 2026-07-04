import { NextResponse } from "next/server";

import {
  conversationLayerApiError,
  requireConversationLayerAccess,
} from "@/modules/ai/conversation-layer-api";
import { conversationLayerNaturalizeInputSchema } from "@/modules/ai/schemas";
import { naturalizeSystemResponse } from "@/modules/ai/conversation-layer-service";

export async function POST(request: Request) {
  const access = await requireConversationLayerAccess(false);
  if (!access.ok) {
    return conversationLayerApiError(access.message, "PERMISSION_DENIED", access.status);
  }

  const parsed = conversationLayerNaturalizeInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return conversationLayerApiError("Solicitud de naturalizacion invalida.", "VALIDATION_ERROR", 422);
  }

  const result = await naturalizeSystemResponse(parsed.data);
  if (!result.ok) {
    return conversationLayerApiError(result.error.message, result.error.code, 400);
  }

  return NextResponse.json({ data: result.data });
}
