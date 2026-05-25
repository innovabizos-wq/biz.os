"use client";

import { MessageCircle } from "lucide-react";

import { ConversationListItem } from "@/modules/inbox-widget/components/conversation-list-item";
import { WidgetFilters } from "@/modules/inbox-widget/components/widget-filters";
import { WidgetSearch } from "@/modules/inbox-widget/components/widget-search";
import type { InboxWidgetConversation } from "@/modules/inbox-widget/types";
import { getWidgetContactName } from "@/modules/inbox-widget/utils";

type ConversationsListPanelProps = {
  conversations: InboxWidgetConversation[];
  isFront?: boolean;
  onSelect: (conversation: InboxWidgetConversation) => void;
  search: string;
  setSearch: (value: string) => void;
};

export function ConversationsListPanel({
  conversations,
  isFront = true,
  onSelect,
  search,
  setSearch,
}: ConversationsListPanelProps) {
  const normalizedSearch = search.trim().toLowerCase();
  const visibleConversations = normalizedSearch
    ? conversations.filter((conversation) =>
        [
          getWidgetContactName(conversation),
          conversation.ultimoMensaje ?? "",
          conversation.canal,
          conversation.estado,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch),
      )
    : conversations;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex h-12 shrink-0 items-center justify-between px-4 pt-1">
        <h3 className="text-lg font-black text-[#128c7e]">WhatsApp</h3>
        <span className="text-xs font-black text-slate-400">...</span>
      </div>
      <WidgetSearch onChange={setSearch} value={search} />
      <WidgetFilters />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {visibleConversations.length > 0 ? (
          visibleConversations.map((conversation) => (
            <ConversationListItem
              conversation={conversation}
              key={conversation.id}
              onSelect={onSelect}
            />
          ))
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-slate-500">
            <MessageCircle className="mb-3 text-emerald-500" size={34} />
            No hay conversaciones para mostrar.
          </div>
        )}
      </div>
      <div className="grid h-14 shrink-0 grid-cols-4 border-t bg-white px-3 text-[10px] font-black text-slate-500">
        {["Chats", "Updates", "Communities", "Calls"].map((item, index) => (
          <button
            className={index === 0 ? "text-emerald-700" : ""}
            disabled={!isFront}
            key={item}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
