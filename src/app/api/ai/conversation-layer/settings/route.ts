import { NextResponse } from "next/server";

import {
  conversationLayerApiError,
  requireConversationLayerAccess,
} from "@/modules/ai/conversation-layer-api";
import { conversationLayerSettingsSchema } from "@/modules/ai/schemas";
import {
  getConversationLayerSettings,
  updateConversationLayerSettings,
} from "@/modules/ai/conversation-layer-service";

export async function GET() {
  const access = await requireConversationLayerAccess(false);
  if (!access.ok) {
    return conversationLayerApiError(access.message, "PERMISSION_DENIED", access.status);
  }

  const settings = await getConversationLayerSettings(access.tenant);
  if (!settings.ok) {
    return conversationLayerApiError(settings.error.message, settings.error.code, 400);
  }

  return NextResponse.json({ data: settings.data });
}

export async function POST(request: Request) {
  const access = await requireConversationLayerAccess(true);
  if (!access.ok) {
    return conversationLayerApiError(access.message, "PERMISSION_DENIED", access.status);
  }

  const parsed = conversationLayerSettingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return conversationLayerApiError("Configuracion invalida.", "VALIDATION_ERROR", 422);
  }

  const result = await updateConversationLayerSettings(access.tenant, parsed.data);
  if (!result.ok) {
    return conversationLayerApiError(result.error.message, result.error.code, 400);
  }

  return NextResponse.json({ data: result.data });
}
