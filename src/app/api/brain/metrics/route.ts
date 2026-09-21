import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { getBrainTaskMetrics } from "@/modules/brain/metrics-service";

function readLimit(request: Request) {
  const value = Number(new URL(request.url).searchParams.get("limit") ?? 100);
  return Number.isFinite(value) ? value : 100;
}

export async function GET(request: Request) {
  const tenant = await getCurrentTenantContext();

  if (!tenant.ok) {
    return NextResponse.json({ error: tenant.error.message }, { status: 401 });
  }

  if (!tenant.data) {
    return NextResponse.json({ error: "Tenant no configurado." }, { status: 401 });
  }

  const result = await getBrainTaskMetrics(tenant.data, {
    limit: readLimit(request),
  });

  if (!result.ok) {
    return NextResponse.json(
      { details: result.error.cause ?? null, error: result.error.message },
      { status: result.error.code === "PERMISSION_DENIED" ? 403 : 400 },
    );
  }

  return NextResponse.json(result.data);
}
