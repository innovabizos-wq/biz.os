import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { getBrainAutopilotHealth } from "@/modules/brain/autopilot-service";

export async function GET() {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  try {
    return NextResponse.json(await getBrainAutopilotHealth(tenant.data));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo consultar la salud." }, { status: 400 });
  }
}
