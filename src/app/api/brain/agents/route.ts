import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { listBrainAgentsForTenant } from "@/modules/brain/agent-service";

export async function GET() {
  const tenant = await getCurrentTenantContext();

  if (!tenant.ok) {
    return NextResponse.json({ error: tenant.error.message }, { status: 401 });
  }

  if (!tenant.data) {
    return NextResponse.json({ error: "Tenant no configurado." }, { status: 401 });
  }

  return NextResponse.json({
    agents: listBrainAgentsForTenant(tenant.data),
  });
}
