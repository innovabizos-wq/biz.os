import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { recordBrainFeedback } from "@/modules/brain/runtime/conversation-repository";

const feedbackSchema = z.object({
  comment: z.string().trim().max(1_000).nullish(),
  conversationId: z.string().uuid(),
  messageId: z.string().min(1).max(200),
  rating: z.union([z.literal(-1), z.literal(1)]),
});

export async function POST(request: Request) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) {
    return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  }

  const body = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "El feedback no es válido." }, { status: 400 });
  }

  try {
    await recordBrainFeedback({ ...body.data, tenant: tenant.data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar el feedback." },
      { status: 500 },
    );
  }
}
