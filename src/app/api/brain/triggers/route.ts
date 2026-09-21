import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { processBrainTrigger } from "@/modules/brain/autopilot-service";

const schema = z.object({
  channel: z.string().trim().min(1).max(50).optional(),
  dedupeKey: z.string().trim().min(8).max(300),
  eventType: z.string().trim().min(3).max(200),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ details: body.error.flatten(), error: "Evento invalido." }, { status: 400 });
  try {
    return NextResponse.json(await processBrainTrigger({ ...body.data, tenant: tenant.data }), { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo procesar el evento." }, { status: 400 });
  }
}
