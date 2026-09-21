import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/auth/session";
import {
  getOrCreateBrainConversation,
  loadBrainMessages,
} from "@/modules/brain/runtime/conversation-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenantResult = await getCurrentTenantContext();
  if (!tenantResult.ok || !tenantResult.data) {
    return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  }
  const parsed = z.string().uuid().safeParse((await params).id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Conversación inválida." }, { status: 400 });
  }
  try {
    await getOrCreateBrainConversation({
      channel: "internal",
      conversationId: parsed.data,
      tenant: tenantResult.data,
    });
    const messages = await loadBrainMessages(tenantResult.data, parsed.data);
    return NextResponse.json({ id: parsed.data, messages });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar Brain." },
      { status: 500 },
    );
  }
}
