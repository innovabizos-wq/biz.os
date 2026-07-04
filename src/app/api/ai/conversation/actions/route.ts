import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { listConversationActionsForTenant } from "@/lib/ai/action-registry";

async function getTenantOrResponse() {
  const tenant = await getCurrentTenantContext();

  if (!tenant.ok) {
    return { response: NextResponse.json({ error: tenant.error.message }, { status: 401 }) };
  }

  if (!tenant.data) {
    return { response: NextResponse.json({ error: "Tenant no configurado." }, { status: 401 }) };
  }

  return { tenant: tenant.data };
}

export async function GET() {
  const context = await getTenantOrResponse();
  if ("response" in context) return context.response;

  return NextResponse.json({
    actions: listConversationActionsForTenant(context.tenant),
  });
}
