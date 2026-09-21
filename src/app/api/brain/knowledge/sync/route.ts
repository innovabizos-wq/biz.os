import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { syncCoreBusinessKnowledge } from "@/modules/brain/knowledge-service";

export async function POST() {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  try {
    return NextResponse.json(await syncCoreBusinessKnowledge(tenant.data));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo sincronizar el conocimiento." }, { status: 400 });
  }
}
