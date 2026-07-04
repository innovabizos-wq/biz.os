import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { getBrainSignals } from "@/modules/brain/queries";

export async function GET() {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok) {
    return NextResponse.json({ error: tenant.error.message }, { status: 401 });
  }
  if (!tenant.data) {
    return NextResponse.json({ error: "Tenant no configurado." }, { status: 401 });
  }

  const result = await getBrainSignals(tenant.data);
  if (!result.ok) {
    return NextResponse.json(
      { details: result.error.cause ?? null, error: result.error.message },
      { status: result.error.code === "PERMISSION_DENIED" ? 403 : 400 },
    );
  }

  return NextResponse.json({ signals: result.data });
}
