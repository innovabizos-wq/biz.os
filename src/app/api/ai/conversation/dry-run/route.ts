import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { dryRunConversationExecution } from "@/modules/ai/conversation-execution-bridge";

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok) {
    return NextResponse.json({ error: tenant.error.message }, { status: 401 });
  }
  if (!tenant.data) {
    return NextResponse.json({ error: "Tenant no configurado." }, { status: 401 });
  }

  const payload = await readJson(request);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const result = await dryRunConversationExecution(tenant.data, payload);
  if (!result.ok) {
    return NextResponse.json(
      { details: result.error.cause ?? null, error: result.error.message },
      { status: result.error.code === "PERMISSION_DENIED" ? 403 : 400 },
    );
  }

  return NextResponse.json(result.data);
}
