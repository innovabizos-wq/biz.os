import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/auth/session";
import {
  listBrainWorkItems,
  startBrainHumanWorkItem,
} from "@/modules/brain/work-item-service";

const createSchema = z.object({
  assignedProfileId: z.string().uuid(),
  description: z.string().trim().min(10).max(8_000),
  input: z.record(z.string(), z.unknown()).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  runId: z.string().uuid().nullish(),
  slaDueAt: z.string().datetime().nullish(),
  teamRunId: z.string().uuid().nullish(),
  title: z.string().trim().min(3).max(200),
});

export async function GET(request: Request) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) {
    return NextResponse.json({ error: tenant.ok ? "Empresa activa requerida." : tenant.error.message }, { status: 401 });
  }
  const url = new URL(request.url);
  try {
    return NextResponse.json({
      workItems: await listBrainWorkItems(tenant.data, {
        assignedToMe: url.searchParams.get("mine") === "true",
        status: url.searchParams.get("status"),
      }),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron consultar las tareas." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) {
    return NextResponse.json({ error: tenant.ok ? "Empresa activa requerida." : tenant.error.message }, { status: 401 });
  }
  const body = createSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ details: body.error.flatten(), error: "Tarea humana invalida." }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await startBrainHumanWorkItem({ ...body.data, tenant: tenant.data }),
      { status: 202 },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la tarea." }, { status: 400 });
  }
}
