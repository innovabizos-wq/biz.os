import { getCurrentTenantContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getInboxConversations } from "@/modules/inbox/queries";
import type { InboxWidgetConversation } from "@/modules/inbox-widget/types";
import type { CoreResult } from "@/types/core";
import { ok } from "@/types/core";

function firstRelation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getInboxWidgetConversations(): Promise<
  CoreResult<InboxWidgetConversation[]>
> {
  const [result, tenant] = await Promise.all([
    getInboxConversations(),
    getCurrentTenantContext(),
  ]);

  if (!result.ok || !tenant.ok || !tenant.data || result.data.length === 0) {
    return ok([]);
  }

  const supabase = await createClient();
  const linkedCustomerIds = result.data
    .map((conversation) => conversation.clienteId)
    .filter((value): value is string => Boolean(value));
  const conversationIds = result.data.map((conversation) => conversation.id);
  const [{ data }, { data: customerRows }, { data: tagRows }, { data: funnelRows }] =
    await Promise.all([
    supabase
      .from("inbox_eventos")
      .select("conversacion_id, metadata, created_at")
      .eq("empresa_id", tenant.data.empresaId)
      .eq("tipo", "clasificacion_widget")
      .in("conversacion_id", conversationIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("crm_clientes")
      .select("id, numero")
      .eq("empresa_id", tenant.data.empresaId)
      .in(
        "id",
        linkedCustomerIds.length > 0
          ? linkedCustomerIds
          : ["00000000-0000-0000-0000-000000000000"],
      ),
    supabase
      .from("inbox_conversacion_etiquetas")
      .select("conversacion_id, etiqueta:inbox_etiquetas(nombre)")
      .eq("empresa_id", tenant.data.empresaId)
      .in("conversacion_id", conversationIds),
    supabase
      .from("inbox_conversacion_funnel")
      .select("conversacion_id, etapa:inbox_funnel_etapas(nombre)")
      .eq("empresa_id", tenant.data.empresaId)
      .in("conversacion_id", conversationIds),
  ]);

  const classificationByConversation = new Map<
    string,
    { etiquetas: string[]; etapaFunnel: string | null }
  >();

  for (const row of data ?? []) {
    if (!row.conversacion_id || classificationByConversation.has(row.conversacion_id)) {
      continue;
    }

    const metadata = row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};
    classificationByConversation.set(row.conversacion_id, {
      etiquetas: Array.isArray(metadata.etiquetas)
        ? metadata.etiquetas.filter((value): value is string => typeof value === "string")
        : [],
      etapaFunnel:
        typeof metadata.etapaFunnel === "string" && metadata.etapaFunnel.trim()
          ? metadata.etapaFunnel
          : null,
    });
  }

  for (const row of tagRows ?? []) {
    const etiqueta = firstRelation(row.etiqueta)?.nombre;
    if (!row.conversacion_id || !etiqueta) continue;
    const current = classificationByConversation.get(row.conversacion_id) ?? {
      etiquetas: [],
      etapaFunnel: null,
    };
    if (!current.etiquetas.includes(etiqueta)) current.etiquetas.push(etiqueta);
    classificationByConversation.set(row.conversacion_id, current);
  }

  for (const row of funnelRows ?? []) {
    const etapaFunnel = firstRelation(row.etapa)?.nombre;
    if (!row.conversacion_id || !etapaFunnel) continue;
    const current = classificationByConversation.get(row.conversacion_id) ?? {
      etiquetas: [],
      etapaFunnel: null,
    };
    current.etapaFunnel = etapaFunnel;
    classificationByConversation.set(row.conversacion_id, current);
  }

  const customerNumberById = new Map(
    (customerRows ?? []).map((row) => [row.id, row.numero]),
  );

  return ok(
    result.data.map((conversation) => ({
      ...conversation,
      clienteNumero: conversation.clienteId
        ? (customerNumberById.get(conversation.clienteId) ?? null)
        : null,
      ...(classificationByConversation.get(conversation.id) ?? {
        etiquetas: [],
        etapaFunnel: null,
      }),
    })),
  );
}
