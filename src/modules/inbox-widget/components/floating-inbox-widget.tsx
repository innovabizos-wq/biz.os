"use client";

import {
  Check,
  Copy,
  Edit3,
  Filter,
  Handshake,
  MapPin,
  MessageCircle,
  Mic,
  Minus,
  MoreVertical,
  Package,
  Paperclip,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Smile,
  Tag,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  addInboxWidgetMessageAction,
  getInboxWidgetOperationsAction,
  getInboxWidgetQuickRepliesAction,
  getInboxWidgetMessagesAction,
  saveInboxWidgetQuickRepliesAction,
  updateInboxWidgetConversationAction,
} from "@/modules/inbox-widget/actions";
import { MessageBubble } from "@/modules/inbox-widget/components/message-bubble";
import type {
  InboxWidgetConversation,
  InboxWidgetMessage,
  InboxWidgetOperations,
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

type ConversationFilter = "todas" | "abierta" | "pendiente" | "cerrada";
type QuickReplyAccent = keyof typeof quickReplyTone;

type QuickReply = {
  accent: QuickReplyAccent;
  id: string;
  text: string;
  title: string;
};

const quickReplyTone = {
  amber:
    "border-slate-200 bg-white text-slate-800",
  blue:
    "border-slate-200 bg-white text-slate-800",
  green:
    "border-slate-200 bg-white text-slate-800",
  orange:
    "border-slate-200 bg-white text-slate-800",
  violet:
    "border-slate-200 bg-white text-slate-800",
} as const;

const defaultQuickReplies: QuickReply[] = [];

const chatWallpaperStyle = {
  backgroundColor: "#f4f1ec",
  backgroundImage:
    "linear-gradient(180deg, rgba(248,247,244,0.98) 0%, rgba(242,239,234,0.98) 100%)",
  backgroundRepeat: "no-repeat",
  backgroundSize: "cover",
  opacity: 1,
};

function getQuickReplyIcon(accent: QuickReplyAccent) {
  const icons = {
    amber: Handshake,
    blue: Package,
    green: MessageCircle,
    orange: MapPin,
    violet: ShieldCheck,
  };

  return icons[accent];
}

function getConversationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    abierta: "Abierta",
    cerrada: "Cerrada",
    pendiente: "Pendiente",
  };

  return labels[status] ?? status;
}

function getConversationStatusTone(status: string) {
  if (status === "cerrada") {
    return "border border-slate-200 bg-white text-slate-600 shadow-[0_6px_14px_rgba(15,23,42,0.06)]";
  }
  if (status === "pendiente") {
    return "border border-amber-200 bg-white text-amber-700 shadow-[0_6px_14px_rgba(217,119,6,0.08)]";
  }
  return "border border-emerald-200 bg-white text-emerald-700 shadow-[0_6px_14px_rgba(5,150,105,0.08)]";
}

function getConversationStatusDot(status: string) {
  if (status === "cerrada") return "bg-slate-400";
  if (status === "pendiente") return "bg-amber-400";
  return "bg-emerald-500";
}

function getQuickReplyAccentClass(accent: QuickReplyAccent) {
  const accents = {
    amber: "text-amber-600 bg-amber-50 ring-amber-100",
    blue: "text-blue-600 bg-blue-50 ring-blue-100",
    green: "text-emerald-600 bg-emerald-50 ring-emerald-100",
    orange: "text-orange-600 bg-orange-50 ring-orange-100",
    violet: "text-violet-600 bg-violet-50 ring-violet-100",
  };

  return accents[accent];
}

function createQuickReplyDraft(): QuickReply {
  return {
    accent: "green",
    id: `reply-${Date.now()}`,
    text: "",
    title: "",
  };
}

function getVoiceRecordingFormat(channel: InboxWidgetConversation["canal"]) {
  const whatsappFormats = [
    ["audio/ogg;codecs=opus", "ogg"],
    ["audio/mp4;codecs=opus", "m4a"],
    ["audio/mp4", "m4a"],
    ["audio/mpeg", "mp3"],
  ] as const;
  const messagingFormats = [
    ["audio/webm;codecs=opus", "webm"],
    ["audio/webm", "webm"],
    ...whatsappFormats,
  ] as const;
  const candidates = channel === "whatsapp" ? whatsappFormats : messagingFormats;

  return candidates.find(([mimeType]) => MediaRecorder.isTypeSupported(mimeType)) ?? null;
}

export function FloatingInboxWidget({
  conversations,
  isOpen,
  onClose,
  onMinimize,
}: FloatingInboxWidgetProps) {
  const [conversationRows, setConversationRows] =
    useState<InboxWidgetConversation[]>(conversations);
  const [activeConversation, setActiveConversation] =
    useState<InboxWidgetConversation | null>(conversations[0] ?? null);
  const [messagesByConversation, setMessagesByConversation] = useState<
    Record<string, InboxWidgetMessage[]>
  >({});
  const [search, setSearch] = useState("");
  const [conversationFilter, setConversationFilter] =
    useState<ConversationFilter>("todas");
  const [draft, setDraft] = useState("");
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [toolView, setToolView] = useState<"management" | "replies">("replies");
  const [operations, setOperations] = useState<InboxWidgetOperations>({
    canAssign: false,
    canChangeStatus: false,
    canReply: false,
    customers: [],
    users: [],
  });
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [lastQuickReply, setLastQuickReply] = useState<string | null>(null);
  const [quickReplySearch, setQuickReplySearch] = useState("");
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(defaultQuickReplies);
  const [quickReplyDraft, setQuickReplyDraft] = useState<QuickReply | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSending, startSendingTransition] = useTransition();
  const widgetRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const activeMessages = activeConversation
    ? (messagesByConversation[activeConversation.id] ?? [])
    : [];

  const conversationCounts = useMemo(
    () => ({
      abierta: conversationRows.filter((conversation) => conversation.estado === "abierta")
        .length,
      cerrada: conversationRows.filter((conversation) => conversation.estado === "cerrada")
        .length,
      pendiente: conversationRows.filter(
        (conversation) => conversation.estado === "pendiente",
      ).length,
      todas: conversationRows.length,
    }),
    [conversationRows],
  );

  const filteredConversations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return conversationRows.filter((conversation) => {
      const matchesFilter =
        conversationFilter === "todas" || conversation.estado === conversationFilter;

      if (!matchesFilter) return false;
      if (!normalizedSearch) return true;

      return [
        getWidgetContactName(conversation),
        conversation.ultimoMensaje ?? "",
        conversation.canal,
        conversation.estado,
        conversation.asignadoNombre ?? "",
        conversation.contactoTelefono ?? "",
        conversation.contactoIdentificador ?? "",
        conversation.etapaFunnel ?? "",
        conversation.etiquetas.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [conversationFilter, conversationRows, search]);

  const activeName = activeConversation
    ? getWidgetContactName(activeConversation)
    : "Sin conversacion";
  const activeInitials = getWidgetInitials(activeName);
  const activeContact =
    activeConversation?.contactoTelefono ??
    activeConversation?.contactoIdentificador ??
    activeConversation?.contactoUsuario ??
    "Sin telefono";

  const filteredQuickReplies = useMemo(() => {
    const normalizedSearch = quickReplySearch.trim().toLowerCase();

    if (!normalizedSearch) return quickReplies;

    return quickReplies.filter((reply) =>
      [reply.title, reply.text].join(" ").toLowerCase().includes(normalizedSearch),
    );
  }, [quickReplies, quickReplySearch]);

  useEffect(() => {
    window.setTimeout(() => widgetRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    startTransition(async () => {
      const [nextOperations, savedReplies] = await Promise.all([
        getInboxWidgetOperationsAction(),
        getInboxWidgetQuickRepliesAction(),
      ]);
      setOperations(nextOperations);
      setQuickReplies(
        savedReplies.filter((value): value is QuickReply => {
          if (!value || typeof value !== "object") return false;
          const reply = value as Partial<QuickReply>;
          return Boolean(reply.id && reply.title && reply.text && reply.accent);
        }),
      );
    });
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({
      behavior: "smooth",
      top: threadRef.current.scrollHeight,
    });
  }, [activeMessages.length, activeConversation?.id]);

  useEffect(() => {
    if (!activeConversation || messagesByConversation[activeConversation.id]) return;

    startTransition(async () => {
      const messages = await getInboxWidgetMessagesAction(activeConversation.id);
      setMessagesByConversation((current) => ({
        ...current,
        [activeConversation.id]: messages,
      }));
    });
  }, [activeConversation, messagesByConversation]);

  function handleSelectConversation(conversation: InboxWidgetConversation) {
    setWidgetError(null);
    setActiveConversation(conversation);
    setIsInternalNote(false);
  }

  function updateConversation(
    conversationId: string,
    patch: Partial<InboxWidgetConversation>,
  ) {
    setConversationRows((current) =>
      current.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, ...patch } : conversation,
      ),
    );
    setActiveConversation((current) =>
      current?.id === conversationId ? { ...current, ...patch } : current,
    );
  }

  function runConversationOperation(
    formData: FormData,
    patch: Partial<InboxWidgetConversation>,
  ) {
    if (!activeConversation || isSending) return;
    const conversationId = activeConversation.id;
    formData.set("conversacionId", conversationId);
    setWidgetError(null);

    startSendingTransition(async () => {
      const result = await updateInboxWidgetConversationAction(formData);
      if (!result.ok) {
        setWidgetError(result.error);
        return;
      }
      updateConversation(conversationId, patch);
    });
  }

  function sendMessage(contenido: string, attachment?: File) {
    if (!activeConversation || (!contenido.trim() && !attachment) || isSending) return;

    const trimmed = contenido.trim();
    setWidgetError(null);

    startSendingTransition(async () => {
      if (isInternalNote) {
        const noteData = new FormData();
        noteData.set("contenido", trimmed);
        noteData.set("conversacionId", activeConversation.id);
        noteData.set("operation", "note");
        const noteResult = await updateInboxWidgetConversationAction(noteData);
        if (!noteResult.ok) {
          setWidgetError(noteResult.error);
          return;
        }
        const messages = await getInboxWidgetMessagesAction(activeConversation.id);
        setMessagesByConversation((current) => ({
          ...current,
          [activeConversation.id]: messages,
        }));
        setDraft("");
        return;
      }

      const formData = new FormData();
      formData.set("contenido", trimmed);
      formData.set("conversacionId", activeConversation.id);
      if (attachment) formData.set("attachment", attachment, attachment.name);
      const result = await addInboxWidgetMessageAction(formData);

      if (!result.ok) {
        setWidgetError(result.error);
        return;
      }

      setMessagesByConversation((current) => ({
        ...current,
        [activeConversation.id]: result.messages,
      }));
      setDraft("");
    });
  }

  async function toggleVoiceRecording() {
    if (isSending) return;

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setWidgetError("Este navegador no permite grabar notas de voz.");
      return;
    }

    const recordingFormat = activeConversation
      ? getVoiceRecordingFormat(activeConversation.canal)
      : null;
    if (!recordingFormat) {
      setWidgetError(
        activeConversation?.canal === "whatsapp"
          ? "Este navegador no puede grabar OGG o MP4 compatible con WhatsApp."
          : "Este navegador no ofrece un formato de voz compatible con Meta.",
      );
      return;
    }

    const [mimeType, extension] = recordingFormat;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        setIsRecordingVoice(false);

        const voice = new File(
          [new Blob(chunks, { type: mimeType })],
          `nota-de-voz-${Date.now()}.${extension}`,
          { type: mimeType },
        );
        sendMessage("", voice);
      });
      recorder.start();
      setIsRecordingVoice(true);
    } catch {
      setWidgetError("No se pudo acceder al micrófono. Revisa el permiso del navegador.");
    }
  }

  function handleQuickReply(reply: QuickReply) {
    sendMessage(reply.text);
    setLastQuickReply(reply.title);
    window.setTimeout(() => setLastQuickReply(null), 1300);
  }

  function saveQuickReply() {
    if (!quickReplyDraft?.title.trim() || !quickReplyDraft.text.trim()) return;

    const exists = quickReplies.some((reply) => reply.id === quickReplyDraft.id);
    const nextReplies = exists
      ? quickReplies.map((reply) =>
          reply.id === quickReplyDraft.id ? quickReplyDraft : reply,
        )
      : [...quickReplies, quickReplyDraft];
    setQuickReplies(nextReplies);
    startTransition(async () => {
      const result = await saveInboxWidgetQuickRepliesAction(nextReplies);
      if (!result.ok) setWidgetError(result.error);
    });
    setQuickReplyDraft(null);
  }

  if (!isOpen) return null;

  return (
    <section className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-md">
      <div className="absolute inset-0 flex items-center justify-center px-2 py-4">
        <div
          aria-label="Widget de mensajeria WhatsApp"
          className="grid h-[calc(100vh-2rem)] w-[min(1500px,calc(100vw-1rem))] grid-cols-[390px_minmax(760px,1fr)] gap-5 rounded-[24px] border border-white/45 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.94))] p-3 shadow-[0_36px_110px_rgba(2,6,23,0.46),0_0_0_1px_rgba(255,255,255,0.5)_inset] outline-none max-[1280px]:grid-cols-[340px_minmax(420px,1fr)] max-[1280px]:[&_.whapp-tools]:hidden"
          ref={widgetRef}
          tabIndex={0}
        >
          <aside className="flex min-w-0 flex-col gap-3 overflow-hidden">
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.12)]">
              <div className="flex shrink-0 items-center justify-between bg-white px-5 pb-3 pt-4">
                <p className="text-lg font-black text-slate-950">Conversaciones</p>
                <div className="flex items-center gap-5 text-slate-500">
                  <Filter aria-hidden="true" size={17} />
                  <MoreVertical aria-hidden="true" size={17} />
                </div>
              </div>
              <div className="mx-4 grid shrink-0 grid-cols-4 rounded-2xl border border-slate-200 bg-slate-50 p-1 text-center text-[11px] font-black text-slate-500 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                {[
                  ["todas", "Todas", conversationCounts.todas],
                  ["abierta", "Abiertas", conversationCounts.abierta],
                  ["pendiente", "Pendientes", conversationCounts.pendiente],
                  ["cerrada", "Cerradas", conversationCounts.cerrada],
                ].map(([value, label, count]) => (
                  <button
                    className={`rounded-xl px-1 py-2 transition ${
                      conversationFilter === value
                        ? "bg-white text-slate-950 shadow-[0_8px_20px_rgba(15,23,42,0.10)] ring-1 ring-slate-200"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                    key={value}
                    onClick={() => setConversationFilter(value as ConversationFilter)}
                    type="button"
                  >
                    {label}{" "}
                    <span
                      className={`rounded-full px-1.5 text-[10px] ${
                        conversationFilter === value
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-white text-slate-600"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                ))}
              </div>
              <label className="relative mx-4 my-3 block rounded-2xl shadow-[0_8px_22px_rgba(15,23,42,0.06)]">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-10 text-xs outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar conversaciones..."
                  value={search}
                />
                <Filter
                  aria-hidden="true"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={15}
                />
              </label>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {filteredConversations.length > 0 ? (
                  filteredConversations.map((conversation) => {
                    const name = getWidgetContactName(conversation);
                    const isActive = activeConversation?.id === conversation.id;
                    const statusLabel = getConversationStatusLabel(conversation.estado);

                    return (
                      <button
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                          isActive
                            ? "bg-white shadow-[0_14px_30px_rgba(15,118,110,0.12)] ring-1 ring-emerald-200"
                            : "hover:bg-white hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                        }`}
                        key={conversation.id}
                        onClick={() => handleSelectConversation(conversation)}
                        type="button"
                      >
                        <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-800 via-slate-700 to-slate-500 text-sm font-black text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)] ring-2 ring-white">
                          {getWidgetInitials(name)}
                          <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-white shadow-sm">
                            <span
                              className={`size-2 rounded-full ${getConversationStatusDot(conversation.estado)}`}
                            />
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="truncate text-sm font-black text-slate-900">
                              {name}
                            </span>
                            <span className="shrink-0 text-[10px] text-slate-500">
                              {formatWidgetTime(
                                conversation.ultimoMensajeAt ?? conversation.updatedAt,
                              )}
                            </span>
                          </span>
                          <span className="mt-1 block truncate text-xs text-slate-500">
                            {conversation.ultimoMensaje ?? "Sin mensajes recientes"}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 rounded-full px-1.5 py-1 text-[10px] font-black text-slate-500">
                          <span
                            className={`size-1.5 rounded-full ${getConversationStatusDot(conversation.estado)}`}
                          />
                          <span className="sr-only">{statusLabel}</span>
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
              <Link
                className="mx-4 mb-3 shrink-0 rounded-xl bg-gradient-to-r from-emerald-50 to-sky-50 py-3 text-center text-xs font-black text-emerald-700 shadow-[0_10px_24px_rgba(59,130,246,0.10)] ring-1 ring-emerald-100 transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(16,185,129,0.16)]"
                href="/whapp/conversaciones"
              >
                Ver todas las conversaciones <span aria-hidden="true">-&gt;</span>
              </Link>
            </section>
          </aside>

          <section className="grid min-w-0 grid-rows-[92px_minmax(0,1fr)] overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.12)]">
            {activeConversation ? (
              <>
                <div className="flex min-w-0 items-center gap-4 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-sky-50 px-5 shadow-[0_12px_28px_rgba(16,185,129,0.08)]">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-800 via-slate-700 to-slate-500 text-sm font-black text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] ring-2 ring-white">
                    {activeInitials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      {activeConversation.clienteId ? (
                        <Link
                          className="truncate text-lg font-black text-slate-950 transition hover:text-emerald-700"
                          href={`/crm/clientes/${activeConversation.clienteId}`}
                        >
                          {activeName}
                        </Link>
                      ) : (
                        <p className="truncate text-lg font-black text-slate-950">
                          {activeName}
                        </p>
                      )}
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${getConversationStatusTone(activeConversation.estado)}`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${getConversationStatusDot(activeConversation.estado)}`}
                        />
                        {getConversationStatusLabel(activeConversation.estado)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                      <span className="flex items-center gap-1 text-slate-500">
                        <MessageCircle
                          aria-hidden="true"
                          className="text-slate-500"
                          size={15}
                        />
                        {activeContact}
                      </span>
                      <span className="flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 ring-1 ring-slate-200">
                        <MessageCircle
                          aria-hidden="true"
                          className="text-slate-500"
                          size={13}
                        />
                        {activeConversation.canal}
                      </span>
                      <span className="rounded-full bg-slate-50 px-2.5 py-1 ring-1 ring-slate-200">
                        Prioridad {activeConversation.prioridad}
                      </span>
                      {activeConversation.asignadoNombre ? (
                        <span className="rounded-full bg-slate-50 px-2.5 py-1 ring-1 ring-slate-200">
                          {activeConversation.asignadoNombre}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {activeConversation.clienteId ? (
                    <Link
                      className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-black text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition hover:border-emerald-200 hover:text-emerald-700"
                      href={`/crm/clientes/${activeConversation.clienteId}`}
                    >
                      <UserRound aria-hidden="true" size={15} />
                      Perfil CRM
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                      <UserRound aria-hidden="true" size={14} />
                      Sin cliente
                    </span>
                  )}
                  <button
                    aria-label="Etiqueta"
                    className="flex size-9 items-center justify-center border-l border-slate-100 text-slate-500 transition hover:text-slate-900"
                    onClick={() => setToolView((current) => current === "management" ? "replies" : "management")}
                    type="button"
                  >
                    <Tag aria-hidden="true" size={17} />
                  </button>
                  <button
                    aria-label="Minimizar widget"
                    className="flex size-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                    onClick={onMinimize}
                    type="button"
                  >
                    <Minus aria-hidden="true" size={17} />
                  </button>
                  <button
                    aria-label="Cerrar widget"
                    className="flex size-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                    onClick={onClose}
                    type="button"
                  >
                    <X aria-hidden="true" size={17} />
                  </button>
                </div>

                <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_390px] max-[1880px]:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="flex min-w-0 flex-col overflow-hidden border-r border-slate-100/80">
                    <div
                      className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      ref={threadRef}
                      style={chatWallpaperStyle}
                    >
                      <div className="mx-auto w-fit rounded-full border border-white/80 bg-white/92 px-12 py-2 text-xs font-bold text-slate-500 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur">
                        Hoy
                      </div>
                      {isPending && activeMessages.length === 0 ? (
                        <p className="rounded-2xl bg-white/90 px-4 py-3 text-center text-sm text-slate-500 shadow-[0_14px_30px_rgba(15,23,42,0.12)] backdrop-blur">
                          Cargando mensajes...
                        </p>
                      ) : activeMessages.length > 0 ? (
                        activeMessages.map((message) => (
                          <MessageBubble key={message.id} message={message} />
                        ))
                      ) : (
                        <p className="rounded-2xl bg-white/90 px-4 py-3 text-center text-sm text-slate-500 shadow-[0_14px_30px_rgba(15,23,42,0.12)] backdrop-blur">
                          Esta conversacion no tiene mensajes registrados todavia.
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 border-t border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-sky-50 p-4 shadow-[0_-12px_28px_rgba(16,185,129,0.08)]">
                      {widgetError ? (
                        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                          {widgetError}
                        </p>
                      ) : null}
                      <div className="flex items-center gap-3">
                        <button
                          aria-label="Emoji"
                          className="flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                          type="button"
                        >
                          <Smile aria-hidden="true" size={20} />
                        </button>
                        <button
                          aria-label="Adjuntar"
                          className="flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                          disabled={isSending || isInternalNote}
                          onClick={() => attachmentInputRef.current?.click()}
                          type="button"
                        >
                          <Paperclip aria-hidden="true" size={20} />
                        </button>
                        <input
                          className="sr-only"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) sendMessage("", file);
                            event.target.value = "";
                          }}
                          ref={attachmentInputRef}
                          type="file"
                        />
                        <button
                          aria-label={isInternalNote ? "Volver a respuesta" : "Agregar nota interna"}
                          className={`flex size-9 items-center justify-center rounded-lg transition ${
                            isInternalNote
                              ? "bg-amber-100 text-amber-700"
                              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                          onClick={() => setIsInternalNote((current) => !current)}
                          type="button"
                        >
                          <Zap aria-hidden="true" size={18} />
                        </button>
                        <button
                          aria-label="Atajos"
                          className="flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                          type="button"
                        >
                          /
                        </button>
                        <textarea
                          className={`max-h-28 min-h-11 flex-1 resize-none rounded-2xl border bg-white/95 px-4 py-3 text-sm shadow-[0_10px_26px_rgba(59,130,246,0.10)] outline-none transition ${
                            isInternalNote
                              ? "border-amber-300 focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                              : "border-blue-100 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100/80"
                          }`}
                          onChange={(event) => setDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              sendMessage(draft);
                            }
                          }}
                          placeholder={isInternalNote ? "Escribe una nota interna; el cliente no la verá" : "Escribe un mensaje o usa / para atajos"}
                          rows={1}
                          value={draft}
                        />
                        <button
                          aria-label={draft.trim() ? "Enviar respuesta" : isRecordingVoice ? "Detener y enviar nota de voz" : "Grabar nota de voz"}
                          className={`flex size-12 shrink-0 items-center justify-center rounded-full text-white shadow-[0_14px_30px_rgba(5,150,105,0.34)] ring-2 ring-white transition hover:-translate-y-0.5 hover:shadow-[0_20px_38px_rgba(5,150,105,0.42)] disabled:opacity-60 ${
                            isRecordingVoice
                              ? "bg-gradient-to-br from-red-500 to-red-700"
                              : "bg-gradient-to-br from-emerald-500 to-emerald-700"
                          }`}
                          disabled={isSending || (isInternalNote && !draft.trim())}
                          onClick={() => (draft.trim() ? sendMessage(draft) : void toggleVoiceRecording())}
                          type="button"
                        >
                          {draft.trim() ? (
                            <Send aria-hidden="true" size={19} />
                          ) : (
                            <Mic aria-hidden="true" size={19} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <aside className="whapp-tools relative flex min-w-0 flex-col overflow-hidden bg-white">
                    {toolView === "management" ? (
                      <div className="absolute inset-0 z-10 flex min-h-0 flex-col bg-white">
                        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-sky-50 px-4">
                          <div>
                            <p className="text-sm font-black text-slate-950">Gestión de conversación</p>
                            <p className="text-[11px] text-slate-500">SLA {activeConversation.slaStatus}</p>
                          </div>
                          <button
                            className="rounded-full px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-white"
                            onClick={() => setToolView("replies")}
                            type="button"
                          >
                            Respuestas
                          </button>
                        </div>
                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                          <div className="rounded-2xl border border-slate-200 p-4 text-xs text-slate-600">
                            <p className="font-black text-slate-900">SLA de primera respuesta</p>
                            <p className="mt-1">
                              {activeConversation.slaDueAt
                                ? `Vence ${new Date(activeConversation.slaDueAt).toLocaleString("es-CR")}`
                                : "Sin SLA pendiente"}
                            </p>
                          </div>

                          {!operations.canAssign && !operations.canChangeStatus ? (
                            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs leading-5 text-red-700">
                              <span className="mr-2 inline-block size-2 rounded-full bg-red-500" aria-hidden="true" />
                              Tu rol puede ver la conversación, pero no tiene permisos para asignar, vincular CRM, clasificar ni cambiar estado.
                            </div>
                          ) : null}

                          {operations.canChangeStatus ? (
                            <form
                              className="space-y-2 rounded-2xl border border-slate-200 p-4"
                              key={`status-${activeConversation.id}-${activeConversation.estado}`}
                              onSubmit={(event) => {
                                event.preventDefault();
                                const data = new FormData(event.currentTarget);
                                runConversationOperation(data, {
                                  estado: String(data.get("estado")) as InboxWidgetConversation["estado"],
                                });
                              }}
                            >
                              <input name="operation" type="hidden" value="status" />
                              <label className="block text-xs font-black text-slate-700">Estado</label>
                              <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" defaultValue={activeConversation.estado} name="estado">
                                <option value="abierta">Abierta</option>
                                <option value="pendiente">Pendiente</option>
                                <option value="cerrada">Cerrada</option>
                                <option value="spam">Spam</option>
                              </select>
                              <button className="w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white" disabled={isSending} type="submit">Guardar estado</button>
                            </form>
                          ) : null}

                          {operations.canAssign ? (
                            <>
                              <form
                                className="space-y-2 rounded-2xl border border-slate-200 p-4"
                                key={`assign-${activeConversation.id}-${activeConversation.asignadoA}`}
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  const data = new FormData(event.currentTarget);
                                  const assignedId = String(data.get("asignadoA") ?? "") || null;
                                  runConversationOperation(data, {
                                    asignadoA: assignedId,
                                    asignadoNombre: operations.users.find((user) => user.id === assignedId)?.nombre ?? null,
                                  });
                                }}
                              >
                                <input name="operation" type="hidden" value="assign" />
                                <label className="block text-xs font-black text-slate-700">Asignación</label>
                                <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" defaultValue={activeConversation.asignadoA ?? ""} name="asignadoA">
                                  <option value="">Sin asignar</option>
                                  {operations.users.map((user) => <option key={user.id} value={user.id}>{user.nombre}</option>)}
                                </select>
                                <button className="w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white" disabled={isSending} type="submit">Guardar asignación</button>
                              </form>

                              <form
                                className="space-y-2 rounded-2xl border border-slate-200 p-4"
                                key={`customer-${activeConversation.id}-${activeConversation.clienteId}`}
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  const data = new FormData(event.currentTarget);
                                  const customerId = String(data.get("clienteId") ?? "");
                                  runConversationOperation(data, {
                                    clienteId: customerId,
                                    clienteNombre: operations.customers.find((customer) => customer.id === customerId)?.nombre ?? null,
                                  });
                                }}
                              >
                                <input name="operation" type="hidden" value="customer" />
                                <label className="block text-xs font-black text-slate-700">Cliente CRM</label>
                                <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" defaultValue={activeConversation.clienteId ?? ""} name="clienteId" required>
                                  <option value="">Seleccionar cliente</option>
                                  {operations.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.nombre}</option>)}
                                </select>
                                <button className="w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white" disabled={isSending} type="submit">Vincular CRM</button>
                              </form>

                              <form
                                className="space-y-2 rounded-2xl border border-slate-200 p-4"
                                key={`classification-${activeConversation.id}-${activeConversation.etiquetas.join("-")}-${activeConversation.etapaFunnel}`}
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  const data = new FormData(event.currentTarget);
                                  runConversationOperation(data, {
                                    etiquetas: String(data.get("etiquetas") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
                                    etapaFunnel: String(data.get("etapaFunnel") ?? "").trim() || null,
                                  });
                                }}
                              >
                                <input name="operation" type="hidden" value="classification" />
                                <label className="block text-xs font-black text-slate-700">Etiquetas</label>
                                <input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" defaultValue={activeConversation.etiquetas.join(", ")} name="etiquetas" placeholder="venta, urgente, mayorista" />
                                <label className="block text-xs font-black text-slate-700">Etapa del funnel</label>
                                <input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" defaultValue={activeConversation.etapaFunnel ?? ""} name="etapaFunnel" placeholder="Nuevo, calificado, propuesta..." />
                                <button className="w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white" disabled={isSending} type="submit">Guardar clasificación</button>
                              </form>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-sky-50 px-4 shadow-[0_12px_28px_rgba(16,185,129,0.08)]">
                      <label className="relative block min-w-0 flex-1 rounded-2xl shadow-[0_8px_22px_rgba(15,23,42,0.06)]">
                        <Search
                          aria-hidden="true"
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                          size={16}
                        />
                        <input
                          className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-xs outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                          onChange={(event) => setQuickReplySearch(event.target.value)}
                          placeholder="Buscar respuesta rapida..."
                          value={quickReplySearch}
                        />
                      </label>
                      <button
                        aria-label="Nueva respuesta rapida"
                        className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-emerald-700 shadow-[0_10px_24px_rgba(16,185,129,0.14)] transition hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-[0_16px_30px_rgba(16,185,129,0.18)]"
                        onClick={() => setQuickReplyDraft(createQuickReplyDraft())}
                        type="button"
                      >
                        <Plus aria-hidden="true" size={19} />
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {filteredQuickReplies.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-xs leading-5 text-slate-500">
                          No hay respuestas rápidas configuradas para este negocio. Usa el botón + para crear la primera.
                        </div>
                      ) : null}
                      {filteredQuickReplies.map((reply) => {
                        const ReplyIcon = getQuickReplyIcon(reply.accent);

                        return (
                          <div
                            className={`rounded-2xl border p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)] ${quickReplyTone[reply.accent]}`}
                            key={reply.id}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ${getQuickReplyAccentClass(reply.accent)}`}
                              >
                                <ReplyIcon aria-hidden="true" size={17} />
                              </span>
                              <button
                                className="min-w-0 flex-1 text-left"
                                disabled={!activeConversation || isSending}
                                onClick={() => handleQuickReply(reply)}
                                type="button"
                              >
                                <span className="block text-sm font-black">
                                  {reply.title}
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-slate-600">
                                  {reply.text}
                                </span>
                              </button>
                              <button
                                aria-label="Editar respuesta rapida"
                                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-900"
                                onClick={() => setQuickReplyDraft(reply)}
                                type="button"
                              >
                                <Edit3 aria-hidden="true" size={15} />
                              </button>
                              <button
                                aria-label="Copiar y enviar respuesta rapida"
                                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-900"
                                disabled={!activeConversation || isSending}
                                onClick={() => handleQuickReply(reply)}
                                type="button"
                              >
                                <Copy aria-hidden="true" size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="shrink-0 px-8 pb-6">
                      {quickReplyDraft ? (
                        <div className="mb-3 rounded-2xl border border-emerald-200 bg-white p-3 shadow-[0_12px_28px_rgba(16,185,129,0.10)]">
                          <input
                            className="mb-2 h-9 w-full rounded-xl border border-emerald-200 bg-white px-3 text-xs font-bold shadow-sm outline-none"
                            onChange={(event) =>
                              setQuickReplyDraft((current) =>
                                current
                                  ? { ...current, title: event.target.value }
                                  : current,
                              )
                            }
                            placeholder="Titulo"
                            value={quickReplyDraft.title}
                          />
                          <textarea
                            className="mb-2 min-h-20 w-full resize-none rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs shadow-sm outline-none"
                            onChange={(event) =>
                              setQuickReplyDraft((current) =>
                                current
                                  ? { ...current, text: event.target.value }
                                  : current,
                              )
                            }
                            placeholder="Texto de la respuesta"
                            value={quickReplyDraft.text}
                          />
                          <select
                            className="mb-3 h-9 w-full rounded-xl border border-emerald-200 bg-white px-3 text-xs shadow-sm outline-none"
                            onChange={(event) =>
                              setQuickReplyDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      accent: event.target.value as QuickReplyAccent,
                                    }
                                  : current,
                              )
                            }
                            value={quickReplyDraft.accent}
                          >
                            <option value="green">Verde</option>
                            <option value="blue">Azul</option>
                            <option value="violet">Violeta</option>
                            <option value="orange">Naranja</option>
                            <option value="amber">Ambar</option>
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              className="h-9 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-600 shadow-sm transition hover:bg-slate-50"
                              onClick={() => setQuickReplyDraft(null)}
                              type="button"
                            >
                              Cancelar
                            </button>
                            <button
                              className="h-9 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-700 text-xs font-black text-white shadow-[0_12px_24px_rgba(5,150,105,0.24)] disabled:opacity-50"
                              disabled={
                                !quickReplyDraft.title.trim() ||
                                !quickReplyDraft.text.trim()
                              }
                              onClick={saveQuickReply}
                              type="button"
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {lastQuickReply ? (
                        <p className="mt-3 flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm">
                          <Check aria-hidden="true" size={14} />
                          {lastQuickReply} enviada.
                        </p>
                      ) : null}
                    </div>
                  </aside>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-sm text-slate-600">
                <MessageCircle className="mb-3 text-emerald-600" size={42} />
                Selecciona una conversacion para abrir el chat.
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
