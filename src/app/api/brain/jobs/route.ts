import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import {
  executeBrainAutomationJob,
  listBrainAutomationJobs,
} from "@/modules/brain/automation-service";

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

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

  return NextResponse.json({ jobs: listBrainAutomationJobs(context.tenant) });
}

export async function POST(request: Request) {
  const context = await getTenantOrResponse();
  if ("response" in context) return context.response;

  const payload = await readJson(request);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const result = await executeBrainAutomationJob(context.tenant, payload);
  if (!result.ok) {
    return NextResponse.json(
      { details: result.error.cause ?? null, error: result.error.message },
      { status: result.error.code === "PERMISSION_DENIED" ? 403 : 400 },
    );
  }

  return NextResponse.json(result.data);
}
