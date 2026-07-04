import { dispatchInboxCampaignBatch } from "@/modules/whapp/server/campaign-dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");

  if (scheme.toLowerCase() === "bearer" && token) return token;

  return request.headers.get("x-whapp-worker-secret");
}

function getAllowedSecrets(allowCronSecret = false) {
  return [
    process.env.WHAPP_CAMPAIGN_WORKER_SECRET,
    allowCronSecret ? process.env.CRON_SECRET : null,
  ].filter((secret): secret is string => Boolean(secret));
}

function isAuthorized(request: Request, allowCronSecret = false) {
  const received = getBearerToken(request);

  if (!received) return false;

  return getAllowedSecrets(allowCronSecret).some((secret) => received === secret);
}

function getLimit(url: URL) {
  const parsed = Number(url.searchParams.get("limit") ?? "3");
  if (!Number.isFinite(parsed)) return 3;
  return Math.max(1, Math.min(Math.trunc(parsed), 10));
}

async function dispatchFromRequest(request: Request) {
  const url = new URL(request.url);
  const limit = getLimit(url);
  const campaignId = url.searchParams.get("campaignId") ?? undefined;
  const empresaId = url.searchParams.get("empresaId") ?? undefined;
  const result = await dispatchInboxCampaignBatch({
    campaignId,
    empresaId,
    limit,
  });

  const results = "results" in result && Array.isArray(result.results) ? result.results : [];
  const summary = {
    campaignId: campaignId ?? null,
    empresaId: empresaId ?? null,
    failed: results.filter((item) => item.status === "failed").length,
    limit,
    path: url.pathname,
    reviewed: result.processed,
    retrying: results.filter((item) => item.status === "retrying").length,
    sent: results.filter((item) => item.status === "sent").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    updated: results.filter((item) => item.status !== "skipped").length,
  };

  console.info("[whapp-campaign-dispatcher]", summary);

  if ("error" in result && result.error) {
    return jsonResponse({ ...result, summary }, 500);
  }

  return jsonResponse({ ...result, summary });
}

export async function GET(request: Request) {
  if (!isAuthorized(request, true)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  return dispatchFromRequest(request);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  return dispatchFromRequest(request);
}
