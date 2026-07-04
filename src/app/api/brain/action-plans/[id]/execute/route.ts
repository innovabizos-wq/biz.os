import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { executeBrainActionPlan } from "@/modules/brain/plan-executor";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok) {
    return NextResponse.json({ error: tenant.error.message }, { status: 401 });
  }
  if (!tenant.data) {
    return NextResponse.json({ error: "Tenant no configurado." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await executeBrainActionPlan(tenant.data, id);

  if (!result.ok) {
    return NextResponse.json(
      { details: result.error.cause ?? null, error: result.error.message },
      { status: result.error.code === "PERMISSION_DENIED" ? 403 : 400 },
    );
  }

  return NextResponse.json(result.data);
}
