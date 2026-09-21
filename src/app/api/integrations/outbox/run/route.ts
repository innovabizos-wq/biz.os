import { start } from "workflow/api";

import { integrationOutboxWorkflow } from "@/modules/integrations/outbox/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");
  if (scheme.toLowerCase() === "bearer" && token) return token;
  return request.headers.get("x-outbox-worker-secret");
}

function authorized(request: Request, allowCronSecret: boolean) {
  const received = bearerToken(request);
  if (!received) return false;
  return [process.env.OUTBOX_WORKER_SECRET, allowCronSecret ? process.env.CRON_SECRET : null]
    .filter((secret): secret is string => Boolean(secret))
    .some((secret) => secret === received);
}

function limitFrom(request: Request) {
  const parsed = Number(new URL(request.url).searchParams.get("limit") ?? "10");
  return Number.isFinite(parsed) ? Math.max(1, Math.min(Math.trunc(parsed), 25)) : 10;
}

async function enqueue(request: Request) {
  const run = await start(integrationOutboxWorkflow, [limitFrom(request)]);
  return Response.json({ accepted: true, runId: run.runId }, { status: 202 });
}

export async function GET(request: Request) {
  if (!authorized(request, true)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return enqueue(request);
}

export async function POST(request: Request) {
  if (!authorized(request, false)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return enqueue(request);
}
