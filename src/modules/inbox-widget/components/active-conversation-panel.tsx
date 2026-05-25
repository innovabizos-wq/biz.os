"use client";

import { ArrowLeft, Camera, MapPin, Mic, Paperclip, Send, User } from "lucide-react";

import { MessageBubble } from "@/modules/inbox-widget/components/message-bubble";
import type {
  InboxWidgetConversation,
  InboxWidgetMessage,
} from "@/modules/inbox-widget/types";
import { getWidgetContactName, getWidgetInitials } from "@/modules/inbox-widget/utils";

type ActiveConversationPanelProps = {
  conversation: InboxWidgetConversation;
  isFront?: boolean;
  isLoading: boolean;
  messages: InboxWidgetMessage[];
  onBack: () => void;
};

export function ActiveConversationPanel({
  conversation,
  isFront = true,
  isLoading,
  messages,
  onBack,
}: ActiveConversationPanelProps) {
  const name = getWidgetContactName(conversation);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#efe7dc]">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b bg-white px-3">
        <button
          aria-label="Volver a conversaciones"
          className="flex size-8 items-center justify-center rounded-full hover:bg-slate-100"
          disabled={!isFront}
          onClick={onBack}
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">
          {getWidgetInitials(name) || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-900">{name}</p>
          <p className="text-[11px] font-semibold text-emerald-700">
            {conversation.canal} / {conversation.estado}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {isLoading ? (
          <p className="rounded-full bg-white/80 px-3 py-2 text-center text-xs text-slate-500">
            Cargando mensajes...
          </p>
        ) : messages.length > 0 ? (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        ) : (
          <p className="rounded-full bg-white/80 px-3 py-2 text-center text-xs text-slate-500">
            No hay mensajes registrados en esta conversacion.
          </p>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3 bg-white px-4 py-3 text-center text-[10px] font-semibold text-slate-500">
        {[
          { icon: Camera, label: "Camera" },
          { icon: MapPin, label: "Location" },
          { icon: User, label: "Contact" },
          { icon: Paperclip, label: "File" },
        ].map((action) => (
          <button
            className="flex flex-col items-center gap-1 rounded-xl bg-slate-50 py-2"
            disabled={!isFront}
            key={action.label}
            type="button"
          >
            <action.icon className="text-emerald-600" size={16} />
            {action.label}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-end gap-2 border-t bg-white p-3">
        <textarea
          className="max-h-24 min-h-10 flex-1 resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-300"
          placeholder="Respuesta simulada..."
          rows={1}
        />
        <button
          aria-label="Enviar respuesta simulada"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md"
          disabled={!isFront}
          type="button"
        >
          <Mic aria-hidden="true" className="hidden sm:block" size={17} />
          <Send aria-hidden="true" className="sm:hidden" size={17} />
        </button>
      </div>
      <p className="bg-white px-3 pb-2 text-[10px] text-slate-400">
        No se envian mensajes reales en esta fase.
      </p>
    </div>
  );
}
