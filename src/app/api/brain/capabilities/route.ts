import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { getBrainCapabilityManifest } from "@/modules/brain/capability-manifest";

export async function GET() {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  return NextResponse.json(getBrainCapabilityManifest(tenant.data));
}
