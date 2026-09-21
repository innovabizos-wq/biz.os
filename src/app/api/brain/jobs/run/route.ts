import { NextResponse } from "next/server";

import { executeBrainAutomationJobsForSystem } from "@/modules/brain/automation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");

  if (scheme.toLowerCase() === "bearer" && token) return token;

  return request.headers.get("x-brain-worker-secret");
}

function isAuthorized(request: Request) {
  const received = getBearerToken(request);
  return Boolean(received && process.env.CRON_SECRET && received === process.env.CRON_SECRET);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const result = await executeBrainAutomationJobsForSystem({
    jobId: url.searchParams.get("jobId"),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json(result.data);
}
