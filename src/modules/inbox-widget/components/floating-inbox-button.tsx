"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";

import { FloatingInboxWidget } from "@/modules/inbox-widget/components/floating-inbox-widget";
import type { InboxWidgetConversation } from "@/modules/inbox-widget/types";

type FloatingInboxButtonProps = {
  conversations: InboxWidgetConversation[];
};

export function FloatingInboxButton({ conversations }: FloatingInboxButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const activeCount = conversations.filter(
    (conversation) => conversation.estado !== "cerrada",
  ).length;

  return (
    <>
      <button
        aria-label={isOpen ? "Minimizar mensajeria" : "Abrir mensajeria"}
        aria-pressed={isOpen}
        className={`fixed bottom-24 right-6 z-40 flex size-14 items-center justify-center rounded-full text-white shadow-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 ${
          isOpen ? "bg-slate-950" : "bg-[#25d366]"
        }`}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <MessageCircle aria-hidden="true" size={30} strokeWidth={2.4} />
        {activeCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-black leading-5 text-white">
            {activeCount > 99 ? "99+" : activeCount}
          </span>
        ) : null}
      </button>
      <FloatingInboxWidget
        conversations={conversations}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onMinimize={() => setIsOpen(false)}
      />
    </>
  );
}
