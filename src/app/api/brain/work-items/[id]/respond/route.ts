import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { respondBrainWorkItem } from "@/modules/brain/work-item-service";

const schema = z.object({
  comment: z.string().trim().max(4_000).optional(),
  result: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["completed", "needs_changes"]),
  version: z.number().int().positive(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) {
    return NextResponse.json({ error: tenant.ok ? "Empresa activa requerida." : tenant.error.message }, { status: 401 });
  }
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ details: body.error.flatten(), error: "Respuesta invalida." }, { status: 400 });
  }
  try {
    return NextResponse.json(await respondBrainWorkItem({
      ...body.data,
      tenant: tenant.data,
      workItemId: (await params).id,
    }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo responder la tarea." }, { status: 409 });
  }
}
