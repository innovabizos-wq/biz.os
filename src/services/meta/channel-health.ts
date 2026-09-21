import "server-only";

import { META_GRAPH_API_VERSION } from "@/services/meta/constants";

export type WhatsAppChannelHealth = {
  messagingLimitTier: string | null;
  qualityRating: "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
  verifiedName: string | null;
};

export async function fetchWhatsAppChannelHealth({
  accessToken,
  phoneNumberId,
}: {
  accessToken: string;
  phoneNumberId: string;
}): Promise<WhatsAppChannelHealth> {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/${phoneNumberId}`);
  url.searchParams.set("fields", "quality_rating,messaging_limit_tier,verified_name");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json() as {
    error?: { message?: string };
    messaging_limit_tier?: string;
    quality_rating?: string;
    verified_name?: string;
  };
  if (!response.ok || data.error) {
    throw new Error(data.error?.message ?? "Meta no devolvio la salud del numero WhatsApp.");
  }
  const quality = data.quality_rating?.toUpperCase();
  return {
    messagingLimitTier: data.messaging_limit_tier ?? null,
    qualityRating: quality === "GREEN" || quality === "YELLOW" || quality === "RED"
      ? quality
      : "UNKNOWN",
    verifiedName: data.verified_name ?? null,
  };
}
