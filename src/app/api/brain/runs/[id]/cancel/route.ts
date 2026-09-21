import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { cancelBrainRun } from "@/modules/brain/run-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  try {
    return NextResponse.json(await cancelBrainRun(tenant.data, (await params).id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cancelar el run." }, { status: 400 });
  }
}
