import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { confirmConversationExecution } from "@/modules/ai/conversation-execution-bridge";

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
  const token =
    payload && typeof payload === "object" && "confirmationToken" in payload
      ? String(payload.confirmationToken ?? "")
      : "";

  if (!token) {
    return NextResponse.json({ error: "Falta confirmationToken." }, { status: 400 });
  }

  const result = await confirmConversationExecution(tenant.data, token);
  if (!result.ok) {
    return NextResponse.json(
      { details: result.error.cause ?? null, error: result.error.message },
      { status: result.error.code === "PERMISSION_DENIED" ? 403 : 400 },
    );
  }

  return NextResponse.json(result.data);
}
