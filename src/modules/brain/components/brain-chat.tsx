"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import {
  ArrowUpRight,
  Brain,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  Confirmation,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import {
  Checkpoint,
  CheckpointIcon,
  CheckpointTrigger,
} from "@/components/ai-elements/checkpoint";
import {
  Agent,
  AgentContent,
  AgentHeader,
  AgentInstructions,
} from "@/components/ai-elements/agent";
import {
  Tool,
  ToolContent,
  ToolHeader,
  type ToolPart,
} from "@/components/ai-elements/tool";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "biz.brain.conversation-id.v1";
const SYNC_EVENT = "biz-brain-conversation-updated";
const CONVERSATION_ID_EVENT = "biz-brain-conversation-id-updated";

type BrainChatProps = {
  className?: string;
  variant?: "bar" | "page";
};

type BrainToolPart = {
  approval?:
    | { approved: boolean; id: string; reason?: string }
    | { approved?: never; id: string; reason?: never };
  errorText?: string;
  input?: unknown;
  output?: unknown;
  state: ToolPart["state"];
  toolCallId: string;
  type: `tool-${string}`;
};

function isToolPart(part: UIMessage["parts"][number]): part is UIMessage["parts"][number] & BrainToolPart {
  return part.type.startsWith("tool-");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function toolTitle(type: string) {
  const value = type.toLowerCase();
  if (value.includes("navigation")) return "Abrir pantalla";
  if (value.includes("crm") || value.includes("customer")) return "Consultar CRM";
  if (value.includes("catalog") || value.includes("product")) return "Gestionar catálogo";
  if (value.includes("invent") || value.includes("stock")) return "Consultar inventario";
  if (value.includes("quote") || value.includes("cotiza")) return "Gestionar cotizaciones";
  if (value.includes("sale") || value.includes("venta")) return "Consultar ventas";
  if (value.includes("payment") || value.includes("pago")) return "Gestionar pagos";
  if (value.includes("purchase") || value.includes("compra")) return "Gestionar compras";
  if (value.includes("inbox")) return "Consultar Inbox";
  if (value.includes("brain")) return "Analizar negocio";
  return "Acción de Brain";
}

function outputSummary(output: unknown) {
  const record = asRecord(output);
  return typeof record?.message === "string" ? record.message : null;
}

function outputLinks(output: unknown) {
  const record = asRecord(output);
  if (!Array.isArray(record?.links)) return [];
  return record.links
    .map(asRecord)
    .filter((link): link is Record<string, unknown> => Boolean(link))
    .filter((link) => typeof link.href === "string")
    .slice(0, 6);
}

function outputEvidence(output: unknown) {
  const record = asRecord(output);
  if (!Array.isArray(record?.evidence)) return [];
  return record.evidence
    .map(asRecord)
    .filter((evidence): evidence is Record<string, unknown> => Boolean(evidence))
    .filter((evidence) => typeof evidence.source === "string")
    .slice(0, 12);
}

function currentPageContext() {
  const focused = document.activeElement?.closest<HTMLElement>("[data-brain-entity-type]");
  return {
    entity: focused ? {
      id: focused.dataset.brainEntityId,
      label: focused.dataset.brainEntityLabel,
      type: focused.dataset.brainEntityType as string,
    } : null,
    selection: window.getSelection()?.toString().trim().slice(0, 2_000) || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function BrainOutputLink({ href, label }: { href: string; label: string }) {
  const className = "inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-bold text-cyan-800 hover:bg-cyan-50";
  const content = <>{label}<ArrowUpRight aria-hidden className="size-3" /></>;
  return href.startsWith("/") ? (
    <Link className={className} href={href}>{content}</Link>
  ) : (
    <a className={className} href={href} rel="noreferrer" target="_blank">{content}</a>
  );
}

function moduleFromPath(pathname: string) {
  return pathname.split("/").filter(Boolean)[0] ?? "dashboard";
}

function conversationIdSnapshot() {
  return typeof window === "undefined"
    ? ""
    : window.localStorage.getItem(STORAGE_KEY) ?? "";
}

function subscribeToConversationId(onChange: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", storage);
  window.addEventListener(CONVERSATION_ID_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener(CONVERSATION_ID_EVENT, onChange);
  };
}

function saveConversationId(value: string) {
  window.localStorage.setItem(STORAGE_KEY, value);
  window.dispatchEvent(new Event(CONVERSATION_ID_EVENT));
}

function BrainTool({
  addApproval,
  part,
}: {
  addApproval(input: { approved: boolean; id: string; reason?: string }): void;
  part: BrainToolPart;
}) {
  const summary = outputSummary(part.output);
  const links = outputLinks(part.output);
  const evidence = outputEvidence(part.output);
  const output = asRecord(part.output);
  const teamPlan = asRecord(output?.plan);
  return (
    <Tool defaultOpen={part.state === "approval-requested"}>
      <ToolHeader
        state={part.state}
        title={toolTitle(part.type)}
        type={part.type}
      />
      <ToolContent>
        <Confirmation approval={part.approval} state={part.state}>
          <ConfirmationRequest>
            <ConfirmationTitle>
              Brain preparó esta acción y necesita tu autorización antes de cambiar datos o consumir recursos adicionales.
            </ConfirmationTitle>
            <ConfirmationActions>
              <ConfirmationAction onClick={() => addApproval({ approved: false, id: part.approval!.id })} variant="outline">
                Denegar
              </ConfirmationAction>
              <ConfirmationAction onClick={() => addApproval({ approved: true, id: part.approval!.id })}>
                Aprobar
              </ConfirmationAction>
            </ConfirmationActions>
          </ConfirmationRequest>
        </Confirmation>
        {part.state === "input-streaming" || part.state === "input-available" ? (
          <p className="text-sm text-slate-600">Brain está trabajando con datos reales del sistema…</p>
        ) : null}
        {summary ? <p className="text-sm text-slate-700">{summary}</p> : null}
        {part.type.includes("brain_team_start") && teamPlan ? (
          <Agent>
            <AgentHeader name="Equipo de Brain" />
            <AgentContent>
              <AgentInstructions>{typeof teamPlan.objective === "string" ? teamPlan.objective : "Objetivo coordinado por Brain"}</AgentInstructions>
            </AgentContent>
          </Agent>
        ) : null}
        {part.errorText ? <p className="text-sm text-red-700">{part.errorText}</p> : null}
        {links.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {links.map((link) => (
              <BrainOutputLink
                href={String(link.href)}
                key={String(link.href)}
                label={typeof link.label === "string" ? link.label : "Abrir"}
              />
            ))}
          </div>
        ) : null}
        {evidence.length > 0 ? (
          <Sources>
            <SourcesTrigger count={evidence.length}>Ver {evidence.length} fuente(s)</SourcesTrigger>
            <SourcesContent>
              {evidence.map((item, index) => {
                const href = typeof item.href === "string" ? item.href : null;
                const title = typeof item.label === "string" ? item.label : String(item.source);
                return href ? (
                  <Source href={href} key={`${String(item.source)}-${index}`} title={title} />
                ) : (
                  <div className="text-xs text-slate-600" key={`${String(item.source)}-${index}`}>
                    {title}{typeof item.freshnessAt === "string" ? ` · ${new Date(item.freshnessAt).toLocaleString()}` : ""}
                  </div>
                );
              })}
            </SourcesContent>
          </Sources>
        ) : null}
        {part.state === "output-available" ? (
          <Checkpoint>
            <CheckpointTrigger disabled tooltip="Resultado persistido en este hilo">
              <CheckpointIcon /> Resultado guardado
            </CheckpointTrigger>
          </Checkpoint>
        ) : null}
      </ToolContent>
    </Tool>
  );
}

function BrainChatSession({
  conversationId,
  onNewConversation,
  variant,
}: {
  conversationId: string;
  onNewConversation(): void;
  variant: "bar" | "page";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [historyReady, setHistoryReady] = useState(false);
  const [panelOpen, setPanelOpen] = useState(variant === "page");
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, -1 | 1>>({});
  const navigatedCalls = useRef(new Set<string>());
  const inputRef = useRef<HTMLInputElement>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/brain/chat",
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: {
            channel: variant === "page" ? "brain" : "bar",
            currentModule: moduleFromPath(pathname),
            currentPath: pathname,
            id,
            message: messages[messages.length - 1],
            ...currentPageContext(),
          },
        }),
      }),
    [pathname, variant],
  );
  const {
    addToolApprovalResponse,
    error,
    messages,
    regenerate,
    sendMessage,
    setMessages,
    status,
    stop,
  } = useChat({
    id: conversationId,
    onFinish: () => {
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: conversationId }));
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    transport,
  });

  const fetchHistory = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/brain/conversations/${conversationId}`, {
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error("No se pudo cargar el historial de Brain.");
    const data = await response.json() as { messages?: UIMessage[] };
    return Array.isArray(data.messages) ? data.messages : [];
  }, [conversationId]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const loadHistory = async () => {
      try {
        const history = await fetchHistory(controller.signal);
        if (active) setMessages(history);
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          console.error("[brain.chat.history]", error);
        }
      } finally {
        if (active) setHistoryReady(true);
      }
    };
    void loadHistory();
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail === conversationId) void loadHistory();
    };
    window.addEventListener(SYNC_EVENT, sync);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener(SYNC_EVENT, sync);
    };
  }, [conversationId, fetchHistory, setMessages]);

  useEffect(() => {
    for (const message of messages) {
      for (const rawPart of message.parts) {
        if (!isToolPart(rawPart) || rawPart.state !== "output-available") continue;
        const navigateTo = asRecord(rawPart.output)?.navigateTo;
        if (
          typeof navigateTo === "string" &&
          !navigatedCalls.current.has(rawPart.toolCallId)
        ) {
          navigatedCalls.current.add(rawPart.toolCallId);
          router.push(navigateTo);
        }
      }
    }
  }, [messages, router]);

  useEffect(() => {
    if (variant !== "bar") return;
    const shortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setPanelOpen(true);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [variant]);

  const busy = status === "submitted" || status === "streaming";
  const visibleMessages = variant === "bar" ? messages.slice(-8) : messages;
  const recordFeedback = async (messageId: string, rating: -1 | 1) => {
    const previous = feedbackByMessage[messageId];
    setFeedbackByMessage((current) => ({ ...current, [messageId]: rating }));
    const response = await fetch("/api/brain/feedback", {
      body: JSON.stringify({ conversationId, messageId, rating }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);
    if (!response?.ok) {
      setFeedbackByMessage((current) => {
        const next = { ...current };
        if (previous) next[messageId] = previous;
        else delete next[messageId];
        return next;
      });
    }
  };
  const submit = (submittedText?: string) => {
    const value = (submittedText ?? input).trim();
    if (!value || busy || !historyReady) return;
    setPanelOpen(true);
    sendMessage({ text: value });
    setInput("");
  };

  const conversation = (
    <Conversation className={variant === "bar" ? "h-[390px]" : "h-[560px]"}>
      <ConversationContent className="gap-5 p-4">
        {visibleMessages.length === 0 ? (
          <ConversationEmptyState
            description="Pide datos, acciones, análisis o abre cualquier módulo con lenguaje natural."
            icon={<Brain className="size-8" />}
            title="¿Qué quieres lograr?"
          />
        ) : (
          visibleMessages.map((message) => (
            <Message className="brain-chat-message" from={message.role} key={message.id}>
              <MessageContent>
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return (
                      <MessageResponse
                        isAnimating={busy && message === visibleMessages.at(-1)}
                        key={`${message.id}-text-${index}`}
                      >
                        {part.text}
                      </MessageResponse>
                    );
                  }
                  if (isToolPart(part)) {
                    return (
                      <BrainTool
                        addApproval={addToolApprovalResponse}
                        key={part.toolCallId}
                        part={part}
                      />
                    );
                  }
                  return null;
                })}
              </MessageContent>
              {message.role === "assistant" ? (
                <div className="flex gap-1 px-1 text-slate-400">
                  <button
                    aria-label="Respuesta útil"
                    aria-pressed={feedbackByMessage[message.id] === 1}
                    className="rounded-md p-1.5 hover:bg-slate-100 hover:text-emerald-700 aria-pressed:bg-emerald-50 aria-pressed:text-emerald-700"
                    onClick={() => void recordFeedback(message.id, 1)}
                    title="Útil"
                    type="button"
                  >
                    <ThumbsUp className="size-3.5" />
                  </button>
                  <button
                    aria-label="Respuesta no útil"
                    aria-pressed={feedbackByMessage[message.id] === -1}
                    className="rounded-md p-1.5 hover:bg-slate-100 hover:text-red-700 aria-pressed:bg-red-50 aria-pressed:text-red-700"
                    onClick={() => void recordFeedback(message.id, -1)}
                    title="No útil"
                    type="button"
                  >
                    <ThumbsDown className="size-3.5" />
                  </button>
                </div>
              ) : null}
            </Message>
          ))
        )}
        {status === "submitted" ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Brain está interpretando y eligiendo herramientas…
          </div>
        ) : null}
        {error ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p>{error.message || "Brain no pudo completar la solicitud."}</p>
            <button className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-300 px-2 py-1 font-bold" onClick={() => void regenerate()} type="button">
              <RotateCcw className="size-3.5" /> Reintentar
            </button>
          </div>
        ) : null}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );

  const compactForm = (
    <form
      className="dashboard-ai-search"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Sparkles aria-hidden size={variant === "bar" ? 24 : 20} />
      <label className="sr-only" htmlFor={`brain-input-${variant}`}>
        Hablar con Brain
      </label>
      <input
        autoComplete="off"
        disabled={!historyReady}
        id={`brain-input-${variant}`}
        onChange={(event) => setInput(event.target.value)}
        onFocus={() => variant === "bar" && setPanelOpen(true)}
        placeholder="Pídele cualquier cosa a Brain…"
        ref={inputRef}
        value={input}
      />
      <kbd>Ctrl K</kbd>
      {busy ? (
        <button aria-label="Detener" onClick={stop} type="button">
          <Square aria-hidden size={16} />
        </button>
      ) : (
        <button aria-label="Enviar a Brain" disabled={!input.trim()} type="submit">
          <Send aria-hidden size={17} />
        </button>
      )}
    </form>
  );

  const pageForm = (
    <PromptInput
      className="w-full"
      onSubmit={({ text }) => submit(text)}
    >
      <PromptInputBody>
        <PromptInputTextarea
          aria-label="Hablar con Brain"
          disabled={!historyReady}
          onChange={(event) => setInput(event.currentTarget.value)}
          placeholder="Pídele cualquier cosa a Brain…"
          value={input}
        />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputTools>
          <span className="px-2 text-xs text-slate-500">Enter para enviar · Shift+Enter para nueva línea</span>
        </PromptInputTools>
        <PromptInputSubmit
          disabled={!input.trim() || !historyReady}
          onStop={stop}
          status={status}
        />
      </PromptInputFooter>
    </PromptInput>
  );

  if (variant === "bar") {
    return (
      <div className="dashboard-ai-command">
        {compactForm}
        {panelOpen ? (
          <div className="brain-chat-popover">
            <div className="brain-chat-popover__header">
              <div>
                <strong>Brain</strong>
                <span>{busy ? "Trabajando" : "En línea"}</span>
              </div>
              <div className="flex items-center gap-1">
                <button aria-label="Nueva conversación" onClick={onNewConversation} type="button">
                  <Plus className="size-4" />
                </button>
                <button aria-label="Cerrar" onClick={() => setPanelOpen(false)} type="button">
                  <X className="size-4" />
                </button>
              </div>
            </div>
            {conversation}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b bg-slate-950 px-5 py-4 text-white">
        <div>
          <div className="flex items-center gap-2 font-black">
            <Brain className="size-5 text-amber-400" />
            Habla con Brain
          </div>
          <p className="mt-1 text-xs text-slate-300">Mismo hilo que la barra global · datos y acciones reales</p>
        </div>
        <button
          className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-2 text-xs font-bold hover:bg-white/10"
          onClick={onNewConversation}
          type="button"
        >
          <Plus className="size-4" />
          Nuevo hilo
        </button>
      </div>
      {conversation}
      <div className="border-t bg-slate-50 p-3">{pageForm}</div>
    </div>
  );
}

export function BrainChat({ className, variant = "page" }: BrainChatProps) {
  const conversationId = useSyncExternalStore(
    subscribeToConversationId,
    conversationIdSnapshot,
    () => "",
  );
  useEffect(() => {
    if (!conversationId) saveConversationId(crypto.randomUUID());
  }, [conversationId]);

  const newConversation = useCallback(() => {
    saveConversationId(crypto.randomUUID());
  }, []);

  if (!conversationId) {
    return (
      <div className={cn("flex h-16 items-center justify-center text-sm text-slate-500", className)}>
        <Loader2 className="mr-2 size-4 animate-spin" />
        Abriendo Brain…
      </div>
    );
  }

  return (
    <div className={className}>
      <BrainChatSession
        conversationId={conversationId}
        key={conversationId}
        onNewConversation={newConversation}
        variant={variant}
      />
    </div>
  );
}
