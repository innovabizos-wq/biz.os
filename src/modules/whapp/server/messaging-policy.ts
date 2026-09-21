import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";

type MetaPolicyChannel = "facebook" | "instagram" | "whatsapp";

function normalizeIdentifier(channel: MetaPolicyChannel, identifier: string) {
  return channel === "whatsapp"
    ? identifier.replace(/\D/g, "")
    : identifier.trim().toLowerCase();
}

export async function checkMetaContactPolicy({
  channel,
  channelId,
  empresaId,
  identifier,
  requiredPurpose,
}: {
  channel: MetaPolicyChannel;
  channelId?: string;
  empresaId: string;
  identifier: string;
  requiredPurpose?: "mensajeria_comercial" | "mensajeria_servicio";
}) {
  const normalizedIdentifier = normalizeIdentifier(channel, identifier);
  if (!normalizedIdentifier) {
    return { allowed: false as const, reason: "El contacto no tiene identificador valido." };
  }

  const supabase = createServiceRoleClient();
  if (channelId) {
    const { data: sendPolicy, error: sendPolicyError } = await supabase
      .from("inbox_meta_politicas_envio")
      .select("paused_at, quality_status")
      .eq("empresa_id", empresaId)
      .eq("canal_id", channelId)
      .maybeSingle<{ paused_at: string | null; quality_status: string }>();
    if (sendPolicyError) {
      return { allowed: false as const, reason: "No se pudo validar la salud del canal Meta." };
    }
    if (sendPolicy?.paused_at || sendPolicy?.quality_status === "RED") {
      return { allowed: false as const, reason: "El canal Meta esta pausado por salud o politica de envio." };
    }
  }
  const { data, error } = await supabase
    .from("inbox_contacto_preferencias")
    .select("estado, finalidad")
    .eq("empresa_id", empresaId)
    .eq("canal", channel)
    .eq("identificador_normalizado", normalizedIdentifier);

  if (error) {
    return { allowed: false as const, reason: "No se pudo validar la preferencia del contacto." };
  }
  if ((data ?? []).some((preference) => preference.estado === "baja")) {
    return { allowed: false as const, reason: "El contacto solicito no recibir mas mensajes." };
  }
  if (
    requiredPurpose &&
    !(data ?? []).some(
      (preference) =>
        preference.estado === "consentido" && preference.finalidad === requiredPurpose,
    )
  ) {
    return {
      allowed: false as const,
      reason:
        requiredPurpose === "mensajeria_comercial"
          ? "Falta consentimiento comercial verificable."
          : "Falta consentimiento de servicio verificable.",
    };
  }

  return { allowed: true as const };
}
