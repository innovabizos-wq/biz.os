import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/auth/session";
import {
  createBrainAutonomyRule,
  listBrainAutonomyRules,
} from "@/modules/brain/autopilot-service";

const schema = z.object({
  allowedChannels: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  amountLimit: z.number().nonnegative().nullable().optional(),
  capabilityId: z.string().trim().min(3).max(200),
  dailyLimit: z.number().int().min(1).max(10_000).optional(),
  failureThreshold: z.number().int().min(1).max(20).optional(),
  mode: z.enum(["suggest", "approve", "auto"]),
  name: z.string().trim().min(3).max(200),
  responsibleProfileId: z.string().uuid().nullable().optional(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
  shadowMode: z.boolean().optional(),
  successCriteria: z.record(z.string(), z.unknown()).optional(),
  timezone: z.string().trim().min(3).max(100).optional(),
  triggerType: z.string().trim().min(3).max(200),
  windowEnd: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  windowStart: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
});

export async function GET() {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  try {
    return NextResponse.json({ rules: await listBrainAutonomyRules(tenant.data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron consultar las reglas." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ details: body.error.flatten(), error: "Regla invalida." }, { status: 400 });
  try {
    return NextResponse.json(await createBrainAutonomyRule({ ...body.data, tenant: tenant.data }), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la regla." }, { status: 400 });
  }
}
