import "server-only";

import { META_GRAPH_API_VERSION } from "@/services/meta/constants";

type MetaTemplateComponent = {
  text?: string;
  type?: string;
};

type MetaTemplateApiItem = {
  category?: string;
  components?: MetaTemplateComponent[];
  id?: string;
  language?: string;
  name?: string;
  quality_score?: unknown;
  rejected_reason?: string;
  status?: string;
};

type MetaTemplateApiResponse = {
  data?: MetaTemplateApiItem[];
  error?: { message?: string };
  paging?: { cursors?: { after?: string } };
};

export type SyncedWhatsAppTemplate = {
  body: string;
  category: string;
  id: string;
  language: string;
  name: string;
  qualityScore: unknown;
  rejectedReason: string | null;
  status: string;
  variables: string[];
};

function extractVariables(body: string) {
  return Array.from(body.matchAll(/\{\{(\d+)\}\}/g), (match) => match[1]).filter(
    (value, index, values) => values.indexOf(value) === index,
  );
}

export async function fetchWhatsAppTemplates({
  accessToken,
  wabaId,
}: {
  accessToken: string;
  wabaId: string;
}) {
  const templates: SyncedWhatsAppTemplate[] = [];
  let after: string | null = null;

  for (let page = 0; page < 10; page += 1) {
    const url = new URL(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(wabaId)}/message_templates`,
    );
    url.searchParams.set(
      "fields",
      "id,name,status,category,language,quality_score,rejected_reason,components",
    );
    url.searchParams.set("limit", "250");
    if (after) url.searchParams.set("after", after);

    const response = await fetch(url, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = (await response.json().catch(() => ({}))) as MetaTemplateApiResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Meta rechazo la sincronizacion de plantillas.");
    }

    for (const item of payload.data ?? []) {
      if (!item.id || !item.name || !item.language || !item.status || !item.category) continue;
      const body =
        item.components?.find((component) => component.type?.toUpperCase() === "BODY")?.text ?? "";
      templates.push({
        body,
        category: item.category.toUpperCase(),
        id: item.id,
        language: item.language,
        name: item.name,
        qualityScore: item.quality_score ?? {},
        rejectedReason: item.rejected_reason ?? null,
        status: item.status.toUpperCase(),
        variables: extractVariables(body),
      });
    }

    after = payload.paging?.cursors?.after ?? null;
    if (!after || (payload.data?.length ?? 0) === 0) break;
  }

  return templates;
}
