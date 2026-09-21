import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { startBrainTeam } from "@/modules/brain/team-service";

const schema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
  maxConcurrency: z.number().int().min(1).max(5).optional(),
  objective: z.string().trim().min(10).max(4_000),
  parentRunId: z.string().uuid().nullish(),
  requestedAgents: z.array(z.enum([
    "compras", "contenido", "finanzas", "inventario", "logistica",
    "marketing", "operaciones", "rrhh", "soporte", "ventas",
  ])).max(5).optional(),
});

export async function POST(request: Request) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) {
    return NextResponse.json({ error: tenant.ok ? "Empresa activa requerida." : tenant.error.message }, { status: 401 });
  }
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ details: body.error.flatten(), error: "Objetivo de equipo invalido." }, { status: 400 });
  }
  try {
    return NextResponse.json(await startBrainTeam({ ...body.data, tenant: tenant.data }), { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo iniciar el equipo." }, { status: 400 });
  }
}
