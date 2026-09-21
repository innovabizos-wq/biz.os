import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/auth/session";
import {
  completeBrainEvalRun,
  listBrainEvalRuns,
  startBrainEvalRun,
} from "@/modules/brain/eval-service";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), commitSha: z.string().max(100).nullish(), suite: z.string().trim().min(2).max(200), totalCases: z.number().int().min(1).max(100_000) }),
  z.object({ action: z.literal("complete"), evalRunId: z.string().uuid(), failedCases: z.number().int().nonnegative(), metrics: z.record(z.string(), z.unknown()).optional(), passedCases: z.number().int().nonnegative() }),
]);

export async function GET() {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  try {
    return NextResponse.json({ evals: await listBrainEvalRuns(tenant.data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron leer las evaluaciones." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ details: body.error.flatten(), error: "Evaluacion invalida." }, { status: 400 });
  try {
    return NextResponse.json(body.data.action === "start"
      ? await startBrainEvalRun({ ...body.data, tenant: tenant.data })
      : await completeBrainEvalRun({ ...body.data, tenant: tenant.data }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo registrar la evaluacion." }, { status: 400 });
  }
}
