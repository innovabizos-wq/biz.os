import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { executeBrainRecommendation } from "@/modules/brain/autopilot-service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  const { id } = await context.params;
  try {
    return NextResponse.json(await executeBrainRecommendation({ recommendationId: id, tenant: tenant.data }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo ejecutar la recomendacion." }, { status: 400 });
  }
}
