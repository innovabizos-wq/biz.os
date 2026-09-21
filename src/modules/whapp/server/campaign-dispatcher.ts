import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendWhatsAppTemplateMessage } from "@/services/meta/client";

type CampaignDispatchConfigRow = {
  access_token?: string;
  access_token_suffix?: string | null;
  access_token_updated_at?: string | null;
  canal_id?: string;
  channel_name?: string;
  empresa_id?: string;
  phone_number_id?: string;
};

type CampaignDispatchRecipientRow = {
  attempt_count: number;
  campana_id: string;
  consentimiento_id: string | null;
  empresa_id: string;
  id: string;
  last_attempt_at: string | null;
  market_code: string | null;
  nombre: string | null;
  telefono: string;
  variables: unknown;
};

type CampaignDispatchCampaignRow = {
  canal_id: string;
  empresa_id: string;
  estado: string;
  id: string;
  plantilla_id: string;
};

type CampaignDispatchTemplateRow = {
  disabled_at: string | null;
  estado: string;
  id: string;
  idioma: string;
  nombre: string;
  last_synced_at: string | null;
  meta_category: string | null;
  meta_status: string | null;
  variables: unknown;
};

type MetaSendPolicyRow = {
  daily_limit: number;
  hourly_limit: number;
  max_failure_percent: number;
  min_interval_ms: number;
  paused_at: string | null;
  quality_status: string;
  require_active_consent: boolean;
  require_recent_template_sync: boolean;
  template_sync_max_age_hours: number;
};

export type CampaignDispatchResult = {
  error?: string;
  messageId?: string | null;
  nextAttemptAt?: string | null;
  recipientId: string;
  status: "sent" | "failed" | "retrying" | "skipped";
};

type DispatchCampaignBatchOptions = {
  campaignId?: string;
  empresaId?: string;
  limit?: number;
};

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

const MAX_CAMPAIGN_RECIPIENT_ATTEMPTS = 3;
const RETRY_BACKOFF_MINUTES = [0, 5, 30] as const;

function normalizeLimit(value?: number) {
  if (!Number.isFinite(value)) return 3;
  return Math.max(1, Math.min(Math.trunc(value ?? 3), 10));
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function getRetryDelayMinutes(attemptCount: number) {
  return RETRY_BACKOFF_MINUTES[
    Math.min(Math.max(attemptCount, 0), RETRY_BACKOFF_MINUTES.length - 1)
  ];
}

function getNextAttemptAt(attemptCount: number, lastAttemptAt: string | null) {
  if (!lastAttemptAt) return null;

  return addMinutes(new Date(lastAttemptAt), getRetryDelayMinutes(attemptCount));
}

function shouldWaitForBackoff(recipient: CampaignDispatchRecipientRow) {
  const nextAttemptAt = getNextAttemptAt(
    recipient.attempt_count,
    recipient.last_attempt_at,
  );

  return Boolean(nextAttemptAt && nextAttemptAt.getTime() > Date.now());
}

function formatNextAttemptAt(recipient: CampaignDispatchRecipientRow) {
  return getNextAttemptAt(
    recipient.attempt_count,
    recipient.last_attempt_at,
  )?.toISOString() ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asTemplateVariables(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function buildTemplateBodyComponents(values: string[]) {
  if (values.length === 0) return undefined;

  return [
    {
      parameters: values.map((value) => ({
        text: value,
        type: "text" as const,
      })),
      type: "body" as const,
    },
  ];
}

function resolveVariableValues(
  templateVariables: string[],
  recipientVariables: Record<string, unknown>,
) {
  if (templateVariables.length === 0) return [];

  return templateVariables.map((variable) => {
    const value = recipientVariables[variable];

    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return JSON.stringify(value);
  });
}

async function validateDispatchGuard(
  supabase: ServiceRoleClient,
  recipient: CampaignDispatchRecipientRow,
  campaign: CampaignDispatchCampaignRow,
  template: CampaignDispatchTemplateRow,
) {
  const { data: policyData } = await supabase
    .from("inbox_meta_politicas_envio")
    .select(
      "daily_limit, hourly_limit, min_interval_ms, max_failure_percent, require_active_consent, require_recent_template_sync, template_sync_max_age_hours, quality_status, paused_at",
    )
    .eq("empresa_id", campaign.empresa_id)
    .eq("canal_id", campaign.canal_id)
    .maybeSingle<MetaSendPolicyRow>();
  const policy = policyData ?? {
    daily_limit: 1000,
    hourly_limit: 200,
    max_failure_percent: 10,
    min_interval_ms: 250,
    paused_at: null,
    quality_status: "UNKNOWN",
    require_active_consent: true,
    require_recent_template_sync: true,
    template_sync_max_age_hours: 168,
  };

  if (policy.paused_at) return "Canal pausado por politica de envio.";
  if (policy.quality_status === "RED") {
    return "Canal bloqueado porque Meta reporta calidad roja.";
  }

  if (policy.require_active_consent) {
    if (!recipient.consentimiento_id) return "Destinatario sin consentimiento auditable.";
    const normalizedPhone = recipient.telefono.replace(/\D/g, "");
    const { data: globalOptOut, error: globalOptOutError } = await supabase
      .from("inbox_contacto_preferencias")
      .select("id")
      .eq("empresa_id", recipient.empresa_id)
      .eq("canal", "whatsapp")
      .eq("identificador_normalizado", normalizedPhone)
      .eq("estado", "baja")
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (globalOptOutError) return "No se pudo validar si el contacto solicito la baja.";
    if (globalOptOut) return "Consentimiento revocado por solicitud de baja.";

    const { data: preference, error: preferenceError } = await supabase
      .from("inbox_contacto_preferencias")
      .select("estado, identificador_normalizado")
      .eq("empresa_id", recipient.empresa_id)
      .eq("id", recipient.consentimiento_id)
      .maybeSingle<{ estado: string; identificador_normalizado: string }>();
    if (preferenceError) return "No se pudo validar el consentimiento del contacto.";
    if (
      preference?.estado !== "consentido" ||
      preference.identificador_normalizado !== normalizedPhone
    ) {
      return "Consentimiento ausente, revocado o asociado a otro contacto.";
    }
  }

  if (template.disabled_at || template.meta_status !== "APPROVED") {
    return "Plantilla no aprobada actualmente por Meta.";
  }
  if (!recipient.market_code || !template.meta_category) {
    return "No se pudo determinar mercado y categoria para calcular el cobro Meta.";
  }
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01T00:00:00.000Z`;
  const nextMonthDate = new Date(monthStart);
  nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1);
  const { count: monthlyVolume, error: monthlyVolumeError } = await supabase
    .from("inbox_meta_costos_mensajes")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", campaign.empresa_id)
    .eq("market_code", recipient.market_code)
    .eq("categoria", template.meta_category)
    .eq("billable", true)
    .gte("delivered_at", monthStart)
    .lt("delivered_at", nextMonthDate.toISOString());
  if (monthlyVolumeError) return "No se pudo calcular el tramo mensual de cobro Meta.";
  const volumePosition = (monthlyVolume ?? 0) + 1;
  const { data: rate, error: rateError } = await supabase
    .from("inbox_meta_tarifas")
    .select("id")
    .eq("market_code", recipient.market_code)
    .eq("categoria", template.meta_category)
    .lte("effective_from", today)
    .lte("volume_from", volumePosition)
    .or([
      "and(effective_to.is.null,volume_to.is.null)",
      `and(effective_to.is.null,volume_to.gte.${volumePosition})`,
      `and(effective_to.gte.${today},volume_to.is.null)`,
      `and(effective_to.gte.${today},volume_to.gte.${volumePosition})`,
    ].join(","))
    .order("effective_from", { ascending: false })
    .order("volume_from", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (rateError || !rate) {
    return `No existe tarifa Meta vigente para ${recipient.market_code}/${template.meta_category}.`;
  }
  if (policy.require_recent_template_sync) {
    const syncedAt = template.last_synced_at
      ? new Date(template.last_synced_at).getTime()
      : Number.NaN;
    const maxAgeMs = policy.template_sync_max_age_hours * 60 * 60 * 1000;
    if (!Number.isFinite(syncedAt) || Date.now() - syncedAt > maxAgeMs) {
      return "Plantilla sin sincronizacion reciente con Meta.";
    }
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [hourly, daily, failures, total, latest] = await Promise.all([
    supabase.from("inbox_campana_destinatarios").select("id", { count: "exact", head: true })
      .eq("empresa_id", campaign.empresa_id).gte("sent_at", hourAgo),
    supabase.from("inbox_campana_destinatarios").select("id", { count: "exact", head: true })
      .eq("empresa_id", campaign.empresa_id).gte("sent_at", dayAgo),
    supabase.from("inbox_campana_destinatarios").select("id", { count: "exact", head: true })
      .eq("empresa_id", campaign.empresa_id).eq("estado", "fallido").gte("last_attempt_at", dayAgo),
    supabase.from("inbox_campana_destinatarios").select("id", { count: "exact", head: true })
      .eq("empresa_id", campaign.empresa_id).gte("last_attempt_at", dayAgo),
    supabase.from("inbox_campana_destinatarios").select("sent_at")
      .eq("empresa_id", campaign.empresa_id).not("sent_at", "is", null)
      .order("sent_at", { ascending: false }).limit(1).maybeSingle<{ sent_at: string }>(),
  ]);

  if ((hourly.count ?? 0) >= policy.hourly_limit) return "Limite horario de envio alcanzado.";
  if ((daily.count ?? 0) >= policy.daily_limit) return "Limite diario de envio alcanzado.";
  if (
    (total.count ?? 0) >= 20 &&
    ((failures.count ?? 0) / Math.max(total.count ?? 1, 1)) * 100 >= policy.max_failure_percent
  ) {
    return "Envios pausados por tasa de fallos elevada.";
  }
  const lastSentAt = latest.data?.sent_at ? new Date(latest.data.sent_at).getTime() : Number.NaN;
  if (Number.isFinite(lastSentAt) && Date.now() - lastSentAt < policy.min_interval_ms) {
    return "Canal esperando intervalo minimo entre mensajes.";
  }

  return null;
}

async function countRecipients(
  supabase: ServiceRoleClient,
  empresaId: string,
  campaignId: string,
  statuses?: string[],
) {
  let query = supabase
    .from("inbox_campana_destinatarios")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("campana_id", campaignId);

  if (statuses && statuses.length > 0) {
    query = query.in("estado", statuses);
  } else {
    query = query.neq("estado", "excluido");
  }

  const { count } = await query;
  return count ?? 0;
}

async function refreshCampaignMetrics(
  supabase: ServiceRoleClient,
  empresaId: string,
  campaignId: string,
) {
  const [
    recipientCount,
    sentCount,
    deliveredCount,
    readCount,
    repliedCount,
    failedCount,
    queuedCount,
  ] = await Promise.all([
    countRecipients(supabase, empresaId, campaignId),
    countRecipients(supabase, empresaId, campaignId, [
      "enviado",
      "entregado",
      "leido",
      "respondido",
    ]),
    countRecipients(supabase, empresaId, campaignId, [
      "entregado",
      "leido",
      "respondido",
    ]),
    countRecipients(supabase, empresaId, campaignId, ["leido", "respondido"]),
    countRecipients(supabase, empresaId, campaignId, ["respondido"]),
    countRecipients(supabase, empresaId, campaignId, ["fallido"]),
    countRecipients(supabase, empresaId, campaignId, ["en_cola"]),
  ]);

  await supabase
    .from("inbox_campanas")
    .update({
      delivered_count: deliveredCount,
      failed_count: failedCount,
      read_count: readCount,
      recipient_count: recipientCount,
      replied_count: repliedCount,
      sent_count: sentCount,
    })
    .eq("empresa_id", empresaId)
    .eq("id", campaignId);

  if (queuedCount === 0) {
    await supabase
      .from("inbox_campanas")
      .update({ estado: "enviada" })
      .eq("empresa_id", empresaId)
      .eq("id", campaignId)
      .eq("estado", "enviando");
  }
}

async function processRecipient(
  supabase: ServiceRoleClient,
  recipient: CampaignDispatchRecipientRow,
): Promise<CampaignDispatchResult> {
  const now = new Date().toISOString();

  if (recipient.attempt_count >= MAX_CAMPAIGN_RECIPIENT_ATTEMPTS) {
    await supabase
      .from("inbox_campana_destinatarios")
      .update({
        estado: "fallido",
        last_error:
          "Limite de reintentos alcanzado antes de despachar la plantilla.",
      })
      .eq("empresa_id", recipient.empresa_id)
      .eq("id", recipient.id)
      .eq("estado", "en_cola");

    return {
      error: "Limite de reintentos alcanzado.",
      recipientId: recipient.id,
      status: "failed",
    };
  }

  if (shouldWaitForBackoff(recipient)) {
    return {
      error: "Destinatario en espera de reintento.",
      nextAttemptAt: formatNextAttemptAt(recipient),
      recipientId: recipient.id,
      status: "skipped",
    };
  }
  const { data: campaign, error: campaignError } = await supabase
    .from("inbox_campanas")
    .select("id, empresa_id, canal_id, plantilla_id, estado")
    .eq("empresa_id", recipient.empresa_id)
    .eq("id", recipient.campana_id)
    .maybeSingle<CampaignDispatchCampaignRow>();

  if (campaignError || !campaign || campaign.estado !== "enviando") {
    return {
      error: campaignError?.message ?? "Campana no esta en estado enviando.",
      recipientId: recipient.id,
      status: "skipped",
    };
  }

  const { data: template, error: templateError } = await supabase
    .from("inbox_meta_plantillas")
    .select("id, nombre, idioma, estado, variables, meta_status, meta_category, last_synced_at, disabled_at")
    .eq("empresa_id", campaign.empresa_id)
    .eq("id", campaign.plantilla_id)
    .maybeSingle<CampaignDispatchTemplateRow>();

  if (templateError || !template || template.estado !== "aprobada") {
    return {
      error: templateError?.message ?? "Plantilla no aprobada.",
      recipientId: recipient.id,
      status: "skipped",
    };
  }

  const guardError = await validateDispatchGuard(supabase, recipient, campaign, template);
  if (guardError) {
    const normalizedGuardError = guardError.toLowerCase();
    const shouldExclude = normalizedGuardError.includes("consentimiento");
    if (shouldExclude) {
      await supabase
        .from("inbox_campana_destinatarios")
        .update({ estado: "excluido", last_error: guardError })
        .eq("empresa_id", recipient.empresa_id)
        .eq("id", recipient.id)
        .eq("estado", "en_cola");
    }
    return { error: guardError, recipientId: recipient.id, status: "skipped" };
  }

  const { data: configData, error: configError } = await supabase.rpc(
    "obtener_inbox_whatsapp_campaign_send_config_server",
    {
      p_canal_id: campaign.canal_id,
      p_empresa_id: campaign.empresa_id,
    },
  );
  const config = (configData as CampaignDispatchConfigRow[] | null)?.[0];

  if (configError || !config?.access_token || !config.phone_number_id) {
    const error = configError?.message ?? "Configuracion de envio incompleta.";
    const nextAttemptCount = recipient.attempt_count + 1;
    const exhausted = nextAttemptCount >= MAX_CAMPAIGN_RECIPIENT_ATTEMPTS;

    await supabase
      .from("inbox_campana_destinatarios")
      .update({
        attempt_count: nextAttemptCount,
        estado: exhausted ? "fallido" : "en_cola",
        last_attempt_at: now,
        last_error: error,
      })
      .eq("empresa_id", recipient.empresa_id)
      .eq("id", recipient.id)
      .eq("estado", "en_cola");

    return {
      error,
      nextAttemptAt: exhausted
        ? null
        : addMinutes(new Date(now), getRetryDelayMinutes(nextAttemptCount)).toISOString(),
      recipientId: recipient.id,
      status: exhausted ? "failed" : "retrying",
    };
  }

  const variableValues = resolveVariableValues(
    asTemplateVariables(template.variables),
    asRecord(recipient.variables),
  );
  const result = await sendWhatsAppTemplateMessage({
    accessToken: config.access_token,
    components: buildTemplateBodyComponents(variableValues),
    languageCode: template.idioma,
    name: template.nombre,
    phoneNumberId: config.phone_number_id,
    to: recipient.telefono,
  });
  const nextAttemptCount = recipient.attempt_count + 1;
  const exhausted = nextAttemptCount >= MAX_CAMPAIGN_RECIPIENT_ATTEMPTS;

  await supabase
    .from("inbox_campana_destinatarios")
    .update({
      attempt_count: nextAttemptCount,
      canal_message_id: result.ok ? result.messageId : null,
      estado: result.ok ? "enviado" : exhausted ? "fallido" : "en_cola",
      last_attempt_at: now,
      last_error: result.ok ? null : result.error,
      sent_at: result.ok ? now : null,
    })
    .eq("empresa_id", recipient.empresa_id)
    .eq("id", recipient.id)
    .eq("estado", "en_cola");

  return result.ok
    ? { messageId: result.messageId, recipientId: recipient.id, status: "sent" }
    : {
        error: result.error,
        nextAttemptAt: exhausted
          ? null
          : addMinutes(
              new Date(now),
              getRetryDelayMinutes(nextAttemptCount),
            ).toISOString(),
        recipientId: recipient.id,
        status: exhausted ? "failed" : "retrying",
      };
}

export async function dispatchInboxCampaignBatch({
  campaignId,
  empresaId,
  limit,
}: DispatchCampaignBatchOptions = {}) {
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("inbox_campana_destinatarios")
    .select(
      "id, empresa_id, campana_id, nombre, telefono, variables, attempt_count, last_attempt_at, consentimiento_id, market_code",
    )
    .eq("estado", "en_cola")
    .eq("opt_in", true)
    .order("created_at", { ascending: true })
    .limit(normalizeLimit(limit) * 3);

  if (empresaId) {
    query = query.eq("empresa_id", empresaId);
  }

  if (campaignId) {
    query = query.eq("campana_id", campaignId);
  }

  const { data, error } = await query;

  if (error) {
    return {
      error: error.message,
      processed: 0,
      results: [] as CampaignDispatchResult[],
    };
  }

  const recipients = (data ?? []) as CampaignDispatchRecipientRow[];
  const results: CampaignDispatchResult[] = [];
  const campaignIds = new Set<string>();
  const processingLimit = normalizeLimit(limit);

  for (const recipient of recipients) {
    if (results.filter((item) => item.status !== "skipped").length >= processingLimit) {
      break;
    }

    const result = await processRecipient(supabase, recipient);
    results.push(result);
    campaignIds.add(`${recipient.empresa_id}:${recipient.campana_id}`);
  }

  for (const key of campaignIds) {
    const [currentEmpresaId, currentCampaignId] = key.split(":");
    await refreshCampaignMetrics(supabase, currentEmpresaId, currentCampaignId);
  }

  return {
    processed: results.length,
    results,
  };
}
