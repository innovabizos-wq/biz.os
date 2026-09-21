import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { getBrainTeamRun } from "@/modules/brain/team-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) {
    return NextResponse.json({ error: tenant.ok ? "Empresa activa requerida." : tenant.error.message }, { status: 401 });
  }
  try {
    return NextResponse.json(await getBrainTeamRun(tenant.data, (await params).id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Equipo no encontrado." }, { status: 404 });
  }
}
