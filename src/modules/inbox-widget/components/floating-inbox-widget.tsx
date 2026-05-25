"use client";

import {
  CalendarClock,
  Check,
  MessageCircle,
  Mic,
  Minus,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { getInboxWidgetMessagesAction } from "@/modules/inbox-widget/actions";
import { MessageBubble } from "@/modules/inbox-widget/components/message-bubble";
import type {
  InboxWidgetConversation,
  InboxWidgetMessage,
} from "@/modules/inbox-widget/types";
import {
  formatWidgetTime,
  getWidgetContactName,
  getWidgetInitials,
} from "@/modules/inbox-widget/utils";

type FloatingInboxWidgetProps = {
  conversations: InboxWidgetConversation[];
  isOpen: boolean;
  onClose: () => void;
  onMinimize: () => void;
};

const quickReplies = [
  "Hola, con gusto te atiendo. Dame un momento para revisar tu consulta.",
  "Gracias por escribirnos. Puedes confirmarme el numero de orden o referencia?",
  "Perfecto, queda registrado. Te confirmo apenas tenga la informacion.",
  "Podemos ayudarte con una cotizacion. Indicanos el producto o servicio requerido.",
  "Recibido. Vamos a dar seguimiento y te avisamos por este medio.",
];

const postItColors = [
  { background: "#fef3c7", border: "#f59e0b" },
  { background: "#dcfce7", border: "#22c55e" },
  { background: "#e0f2fe", border: "#0ea5e9" },
  { background: "#fce7f3", border: "#ec4899" },
  { background: "#ede9fe", border: "#8b5cf6" },
  { background: "#ffedd5", border: "#f97316" },
];

const chatWallpaperStyle = {
  backgroundColor: "#eef7f2",
  backgroundImage: "url('/images/whatsapp-doodle-wallpaper.svg')",
  backgroundRepeat: "repeat",
  backgroundSize: "420px 650px",
};

function getPostItColor(value: string, index: number) {
  const hash = value.split("").reduce((accumulator, character) => {
    return accumulator + character.charCodeAt(0);
  }, index * 17);

  return postItColors[hash % postItColors.length];
}

function createLocalMessage(
  conversationId: string,
  contenido: string,
): InboxWidgetMessage {
  const now = new Date().toISOString();

  return {
    canalMessageId: null,
    contenido,
    conversacionId: conversationId,
    createdAt: now,
    direccion: "saliente",
    enviadoPor: null,
    enviadoPorNombre: "biz.os",
    esNotaInterna: false,
    estado: "registrado",
    id: `local-${conversationId}-${Date.now()}`,
    receivedAt: null,
    sentAt: now,
    tipo: "texto",
  };
}

export function FloatingInboxWidget({
  conversations,
  isOpen,
  onClose,
  onMinimize,
}: FloatingInboxWidgetProps) {
  const [activeConversation, setActiveConversation] =
    useState<InboxWidgetConversation | null>(conversations[0] ?? null);
  const [messagesByConversation, setMessagesByConversation] = useState<
    Record<string, InboxWidgetMessage[]>
  >({});
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [lastQuickReply, setLastQuickReply] = useState<string | null>(null);
  const [reminderSaved, setReminderSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const widgetRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const activeMessages = activeConversation
    ? (messagesByConversation[activeConversation.id] ?? [])
    : [];

  const filteredConversations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) return conversations;

    return conversations.filter((conversation) =>
      [
        getWidgetContactName(conversation),
        conversation.ultimoMensaje ?? "",
        conversation.canal,
        conversation.estado,
        conversation.asignadoNombre ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [conversations, search]);

  useEffect(() => {
    window.setTimeout(() => widgetRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({
      behavior: "smooth",
      top: threadRef.current.scrollHeight,
    });
  }, [activeMessages.length, activeConversation?.id]);

  function loadMessages(conversation: InboxWidgetConversation) {
    if (messagesByConversation[conversation.id]) return;

    startTransition(async () => {
      const messages = await getInboxWidgetMessagesAction(conversation.id);
      setMessagesByConversation((current) => ({
        ...current,
        [conversation.id]: messages,
      }));
    });
  }

  function handleSelectConversation(conversation: InboxWidgetConversation) {
    setActiveConversation(conversation);
    loadMessages(conversation);
  }

  function appendLocalMessage(contenido: string) {
    if (!activeConversation || !contenido.trim()) return;

    const message = createLocalMessage(activeConversation.id, contenido.trim());
    setMessagesByConversation((current) => ({
      ...current,
      [activeConversation.id]: [...(current[activeConversation.id] ?? []), message],
    }));
    setDraft("");
  }

  function handleQuickReply(reply: string) {
    appendLocalMessage(reply);
    setLastQuickReply(reply);
    window.setTimeout(() => setLastQuickReply(null), 1300);
  }

  function handleReminderSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReminderSaved(true);
    window.setTimeout(() => setReminderSaved(false), 1600);
  }

  function handleClose() {
    onClose();
  }

  function handleMinimize() {
    onMinimize();
  }

  if (!isOpen) return null;

  return (
    <section className="fixed inset-0 z-[9999] bg-black/60">
      <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-center px-4 lg:left-[280px]">
        <div
          aria-label="Widget de mensajeria WhatsApp"
          className="flex h-[min(720px,calc(100vh-4rem))] w-[min(1220px,calc(100vw-2rem))] gap-3 rounded-[1.6rem] border border-white/15 bg-[#dfe5e7] p-3 shadow-[0_28px_80px_rgba(0,0,0,0.38)] outline-none"
          ref={widgetRef}
          tabIndex={0}
        >
          <aside className="flex min-w-0 basis-[30%] flex-col overflow-hidden rounded-2xl bg-[#f7f8fa] shadow-sm ring-1 ring-black/5">
            <div className="flex h-16 shrink-0 items-center justify-between bg-[#075e54] px-5 text-white">
              <div>
                <p className="text-lg font-black">WhatsApp</p>
                <p className="text-xs font-semibold text-emerald-100">
                  Bandeja rapida
                </p>
              </div>
              <MessageCircle aria-hidden="true" size={24} />
            </div>

            <label className="relative m-4 block">
              <Search
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={17}
              />
              <input
                className="h-11 w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar o iniciar chat"
                value={search}
              />
            </label>

            <div className="flex gap-2 px-4 pb-3 text-xs font-bold">
              {["Todas", "No leidas", "Asignadas", "WhatsApp"].map((filter, index) => (
                <span
                  className={`rounded-full px-3 py-1.5 ${
                    index === 0
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-white text-slate-600"
                  }`}
                  key={filter}
                >
                  {filter}
                </span>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredConversations.length > 0 ? (
                filteredConversations.map((conversation) => {
                  const name = getWidgetContactName(conversation);
                  const isActive = activeConversation?.id === conversation.id;

                  return (
                    <button
                      className={`flex w-full gap-3 border-b border-slate-200 px-4 py-3 text-left transition ${
                        isActive ? "bg-white" : "hover:bg-white/80"
                      }`}
                      key={conversation.id}
                      onClick={() => handleSelectConversation(conversation)}
                      type="button"
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-700 text-sm font-black text-white">
                        {getWidgetInitials(name) || "?"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="truncate text-sm font-black text-slate-900">
                            {name}
                          </span>
                          <span className="shrink-0 text-[10px] font-semibold text-emerald-700">
                            {formatWidgetTime(
                              conversation.ultimoMensajeAt ?? conversation.createdAt,
                            )}
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
                        </span>
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center text-sm text-slate-500">
                  <MessageCircle className="mb-3 text-emerald-500" size={34} />
                  No hay conversaciones para mostrar.
                </div>
              )}
            </div>
          </aside>

          <main className="flex min-w-0 basis-[44%] flex-col overflow-hidden rounded-2xl bg-[#efe7dc] shadow-sm ring-1 ring-black/5">
            {activeConversation ? (
              <>
                <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">
                    {getWidgetInitials(getWidgetContactName(activeConversation)) || "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-900">
                      {getWidgetContactName(activeConversation)}
                    </p>
                    <p className="text-[11px] font-semibold text-emerald-700">
                      {activeConversation.canal} / {activeConversation.estado}
                    </p>
                  </div>
                  <div className="flex gap-1 rounded-full bg-slate-100 p-1">
                    <button
                      aria-label="Minimizar widget"
                      className="flex size-8 items-center justify-center rounded-full text-slate-600 hover:bg-white"
                      onClick={handleMinimize}
                      type="button"
                    >
                      <Minus aria-hidden="true" size={17} />
                    </button>
                    <button
                      aria-label="Cerrar widget"
                      className="flex size-8 items-center justify-center rounded-full text-slate-600 hover:bg-white"
                      onClick={handleClose}
                      type="button"
                    >
                      <X aria-hidden="true" size={17} />
                    </button>
                  </div>
                </div>

                <div
                  className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4"
                  ref={threadRef}
                  style={chatWallpaperStyle}
                >
                  {isPending && activeMessages.length === 0 ? (
                    <p className="rounded-full bg-white/80 px-3 py-2 text-center text-xs text-slate-500">
                      Cargando mensajes...
                    </p>
                  ) : activeMessages.length > 0 ? (
                    activeMessages.map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))
                  ) : (
                    <p className="rounded-full bg-white/80 px-3 py-2 text-center text-xs text-slate-500">
                      No hay mensajes registrados en esta conversacion.
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-end gap-2 border-t border-slate-200 bg-white p-4">
                  <textarea
                    className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-300"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        appendLocalMessage(draft);
                      }
                    }}
                    placeholder="Respuesta simulada..."
                    rows={1}
                    value={draft}
                  />
                  <button
                    aria-label="Enviar respuesta simulada"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md disabled:opacity-50"
                    disabled={!draft.trim()}
                    onClick={() => appendLocalMessage(draft)}
                    type="button"
                  >
                    {draft.trim() ? (
                      <Send aria-hidden="true" size={18} />
                    ) : (
                      <Mic aria-hidden="true" size={18} />
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-sm text-slate-600">
                <MessageCircle className="mb-3 text-emerald-600" size={42} />
                Selecciona una conversacion para abrir el chat.
              </div>
            )}
          </main>

          <aside className="flex min-w-0 basis-[26%] flex-col gap-3">
            <section className="flex min-h-0 flex-[1.55] flex-col overflow-hidden rounded-2xl bg-slate-50 p-4 shadow-sm ring-1 ring-black/5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    Respuestas rapidas
                  </p>
                  <p className="text-xs text-slate-500">Doble click para enviar</p>
                </div>
                <Sparkles className="text-emerald-600" size={18} />
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {quickReplies.map((reply, index) => (
                  <button
                    className="w-full rounded-md border-l-4 p-3 text-left text-xs font-semibold leading-5 text-slate-800 shadow-[0_5px_12px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_9px_18px_rgba(15,23,42,0.16)]"
                    disabled={!activeConversation}
                    key={reply}
                    onDoubleClick={() => handleQuickReply(reply)}
                    style={{
                      backgroundColor: getPostItColor(reply, index).background,
                      borderLeftColor: getPostItColor(reply, index).border,
                    }}
                    title="Doble click para enviar"
                    type="button"
                  >
                    {reply}
                  </button>
                ))}
              </div>

              {lastQuickReply ? (
                <p className="mt-3 flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800">
                  <Check aria-hidden="true" size={14} />
                  Respuesta agregada al chat.
                </p>
              ) : null}
            </section>

            <section className="flex shrink-0 flex-col rounded-2xl bg-slate-50 p-4 shadow-sm ring-1 ring-black/5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    Recordatorios
                  </p>
                  <p className="text-xs text-slate-500">Programador local</p>
                </div>
                <CalendarClock className="text-emerald-600" size={18} />
              </div>

              <form className="space-y-2" onSubmit={handleReminderSubmit}>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] font-bold text-slate-600">
                    Fecha
                    <input
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-emerald-300"
                      type="date"
                    />
                  </label>
                  <label className="text-[11px] font-bold text-slate-600">
                    Hora
                    <input
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-emerald-300"
                      type="time"
                    />
                  </label>
                </div>
                <label className="block text-[11px] font-bold text-slate-600">
                  Comentario
                  <textarea
                    className="mt-1 min-h-16 w-full resize-none rounded-lg border border-slate-200 bg-white p-2 text-xs font-normal outline-none focus:border-emerald-300"
                    placeholder="Ejemplo: llamar para confirmar."
                  />
                </label>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-500">
                    {reminderSaved ? "Recordatorio preparado." : "Visual por ahora."}
                  </p>
                  <button
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
                    type="submit"
                  >
                    OK
                  </button>
                </div>
              </form>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}
