"use client";

import type { InboxWidgetConversation } from "@/modules/inbox-widget/types";
import {
  formatWidgetTime,
  getWidgetContactName,
  getWidgetInitials,
} from "@/modules/inbox-widget/utils";

type ConversationListItemProps = {
  conversation: InboxWidgetConversation;
  onSelect: (conversation: InboxWidgetConversation) => void;
};

export function ConversationListItem({
  conversation,
  onSelect,
}: ConversationListItemProps) {
  const name = getWidgetContactName(conversation);

  return (
    <button
      className="flex w-full gap-3 border-b border-slate-100 px-3 py-3 text-left transition hover:bg-emerald-50/60"
      onClick={() => onSelect(conversation)}
      type="button"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-black text-white">
        {getWidgetInitials(name) || "?"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-black text-slate-900">{name}</span>
          <span className="shrink-0 text-[10px] font-semibold text-emerald-700">
            {formatWidgetTime(conversation.ultimoMensajeAt ?? conversation.createdAt)}
          </span>
        </span>
        <span className="mt-1 block truncate text-xs text-slate-500">
          {conversation.ultimoMensaje ?? "Sin mensajes todavia"}
        </span>
        <span className="mt-2 flex items-center gap-1.5">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
            {conversation.canal}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
            {conversation.estado}
          </span>
          {conversation.asignadoNombre ? (
            <span className="truncate rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
              {conversation.asignadoNombre}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
