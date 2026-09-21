import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { answerCustomerWithBrain } from "@/modules/brain/customer-response-service";

const schema = z.object({
  channel: z.enum(["api", "inbox", "whapp"]),
  externalConversationId: z.string().trim().min(1).max(300),
  metadata: z.record(z.string(), z.unknown()).optional(),
  query: z.string().trim().min(2).max(8_000),
  verified: z.boolean().default(false),
});

export async function POST(request: Request) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ details: body.error.flatten(), error: "Interaccion invalida." }, { status: 400 });
  try {
    return NextResponse.json(await answerCustomerWithBrain({ ...body.data, tenant: tenant.data }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Brain no pudo responder." }, { status: 400 });
  }
}
