import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { getBrainRunDetail } from "@/modules/brain/run-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  try {
    return NextResponse.json(await getBrainRunDetail(tenant.data, (await params).id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Run no encontrado." }, { status: 404 });
  }
}
