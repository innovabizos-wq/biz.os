import { getCurrentTenantContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getInboxConversations } from "@/modules/inbox/queries";
import type { InboxWidgetConversation } from "@/modules/inbox-widget/types";
import type { CoreResult } from "@/types/core";
import { ok } from "@/types/core";

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
  const [{ data }, { data: customerRows }] = await Promise.all([
    supabase
    .from("inbox_eventos")
    .select("conversacion_id, metadata, created_at")
    .eq("empresa_id", tenant.data.empresaId)
    .eq("tipo", "clasificacion_widget")
    .in("conversacion_id", result.data.map((conversation) => conversation.id))
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
