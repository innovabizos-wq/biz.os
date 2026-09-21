import { runDueFollowupReminderJob } from "@/modules/notifications/followup-reminder-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");
  if (scheme.toLowerCase() === "bearer" && token) return token;
  return request.headers.get("x-reminder-worker-secret");
}

function isAuthorized(request: Request, allowCronSecret: boolean) {
  const received = bearerToken(request);
  if (!received) return false;

  return [
    process.env.REMINDER_WORKER_SECRET,
    allowCronSecret ? process.env.CRON_SECRET : null,
  ]
    .filter((secret): secret is string => Boolean(secret))
    .some((secret) => secret === received);
}

function limitFrom(request: Request) {
  const parsed = Number(new URL(request.url).searchParams.get("limit") ?? "500");
  return Number.isFinite(parsed) ? Math.max(1, Math.min(Math.trunc(parsed), 1000)) : 500;
}

async function run(request: Request) {
  try {
    const result = await runDueFollowupReminderJob(limitFrom(request));
    return Response.json({ ...result, serverTime: new Date().toISOString() });
  } catch (error) {
    console.error("[followup-reminders] scheduled run failed", {
      message: error instanceof Error ? error.message : "Unknown reminder error",
    });
    return Response.json(
      { error: "No se pudo completar el proceso de recordatorios." },
      { status: 503 },
    );
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request, true)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return run(request);
}

export async function POST(request: Request) {
  if (!isAuthorized(request, false)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return run(request);
}
